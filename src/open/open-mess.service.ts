import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListOpenMessesDto } from './dto/list-open-messes.dto';

const FEATURED_RADIUS_KM = 20;

@Injectable()
export class OpenMessService {
    constructor(private readonly prisma: PrismaService) { }

    private getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    /// Fisher-Yates shuffle — used so a "featured" listing doesn't always come back in the
    /// same order every time (a fair rotation among nearby featured messes).
    private shuffle<T>(items: T[]): T[] {
        const arr = [...items];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    private lowestActivePlanPrice(
        plans: { isActive: boolean; price: Prisma.Decimal; minPrice: Prisma.Decimal | null }[],
    ): number | null {
        const active = plans.filter((p) => p.isActive !== false);
        if (!active.length) return null;

        const lowest = active.sort(
            (a, b) => Number(a.price.toString()) - Number(b.price.toString()),
        )[0];

        return Number(lowest.minPrice ? lowest.minPrice.toString() : lowest.price.toString());
    }

    /// Shapes one mess record into the flat public-listing card shape.
    private toListingCard(mess: any, distanceKm: number | null) {
        const cover = (mess.images ?? []).find((img: any) => img.isCover) ?? mess.images?.[0];

        return {
            id: mess.id,
            slug: mess.slug,
            messName: mess.name,
            logo: mess.icon ?? null,
            coverImage: cover?.url ?? null,
            startingPlanPrice: this.lowestActivePlanPrice(mess.plans ?? []),
            address: {
                address: mess.address,
                location: mess.location,
                zipcode: mess.zipcode,
                latitude: mess.latitude,
                longitude: mess.logitude,
            },
            status: {
                isVerified: mess.is_verified,
                isFeatured: mess.isFeatured,
                isActive: mess.is_active,
            },
            distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
            foodTypes: (mess.foodTypes ?? []).map((f: any) => f.foodType),
        };
    }

    /// GET /open/messes — public listing for the website. Every filter is optional.
    async findAll(query: ListOpenMessesDto) {
        const page = query.page ? Math.max(1, Number(query.page) || 1) : 1;
        const limit = query.limit ? Math.max(1, Number(query.limit) || 10) : 10;
        const skip = (page - 1) * limit;

        const featured = query.featured === 'true';
        const isVerified = query.isVerified !== undefined ? query.isVerified === 'true' : undefined;

        const lat = query.latitude !== undefined ? Number(query.latitude) : NaN;
        const lng = query.longitude !== undefined ? Number(query.longitude) : NaN;
        const hasCoords = !isNaN(lat) && !isNaN(lng);

        // Only ever surface messes the superadmin has explicitly opted into the public site.
        const where: Prisma.MessWhereInput = {
            isListed: true,
            is_active: true,
        };

        if (query.search) {
            where.OR = [
                { name: { contains: query.search } },
                { description: { contains: query.search } },
            ];
        }

        if (isVerified !== undefined) {
            where.is_verified = isVerified;
        }

        if (featured) {
            where.isFeatured = true;
        }

        if (query.foodType) {
            where.foodTypes = { some: { foodType: query.foodType } };
        }

        if (query.planType) {
            where.plans = {
                some: {
                    isActive: true,
                    ...(query.planType === 'DAILY' ? { isDailyPlan: true } : { isMonthlyPlan: true }),
                },
            };
        }

        const messes = await this.prisma.mess.findMany({
            where,
            include: {
                images: true,
                foodTypes: true,
                plans: { select: { isActive: true, price: true, minPrice: true } },
            },
        });

        let withDistance = messes.map((mess) => {
            let distance: number | null = null;

            if (hasCoords && mess.latitude && mess.logitude) {
                const messLat = Number(mess.latitude);
                const messLng = Number(mess.logitude);
                if (!isNaN(messLat) && !isNaN(messLng)) {
                    distance = this.getDistanceKm(lat, lng, messLat, messLng);
                }
            }

            return { mess, distance };
        });

        if (featured && hasCoords) {
            // Featured + location: restrict to a 20km radius, then shuffle rather than sort by
            // distance — so the same set of nearby featured messes doesn't always come back in
            // the same order.
            withDistance = withDistance.filter(
                (m) => m.distance !== null && m.distance <= FEATURED_RADIUS_KM,
            );
            withDistance = this.shuffle(withDistance);
        } else if (hasCoords) {
            withDistance.sort(
                (a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER),
            );
        } else {
            withDistance.sort(
                (a, b) => b.mess.createdAt.getTime() - a.mess.createdAt.getTime(),
            );
        }

        const total = withDistance.length;
        const paged = withDistance.slice(skip, skip + limit);

        return {
            data: paged.map(({ mess, distance }) => this.toListingCard(mess, distance)),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /// GET /open/mess/:slug — full public detail page: plans (with variations, images, menus),
    /// tags, food types, gallery, and cover image.
    async findBySlug(slug: string) {
        const mess = await this.prisma.mess.findFirst({
            where: { slug, isListed: true, is_active: true },
            include: {
                images: true,
                foodTypes: true,
                tags: true,
                District: { select: { id: true, name: true } },
                plans: {
                    where: { isActive: true },
                    include: {
                        images: true,
                        Variation: { where: { isActive: true } },
                        menus: { where: { isActive: true } },
                    },
                },
            },
        });

        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        const cover = mess.images.find((img) => img.isCover) ?? mess.images[0];
        const gallery = mess.images.filter((img) => img.id !== cover?.id);

        return {
            id: mess.id,
            slug: mess.slug,
            messName: mess.name,
            description: mess.description,
            logo: mess.icon ?? null,
            coverImage: cover?.url ?? null,
            gallery: gallery.map((img) => ({ id: img.id, url: img.url, altText: img.altText })),
            address: {
                address: mess.address,
                location: mess.location,
                zipcode: mess.zipcode,
                latitude: mess.latitude,
                longitude: mess.logitude,
                district: mess.District,
            },
            phone: mess.phone,
            email: mess.email,
            openingHours: mess.openingHours,
            features: mess.features,
            status: {
                isVerified: mess.is_verified,
                isFeatured: mess.isFeatured,
                isPremium: mess.isPremium,
            },
            foodTypes: mess.foodTypes.map((f) => f.foodType),
            tags: mess.tags.map((t) => t.tag),
            plans: mess.plans.map((plan) => ({
                id: plan.id,
                planName: plan.planName,
                description: plan.description,
                price: plan.price,
                minPrice: plan.minPrice,
                isMonthlyPlan: plan.isMonthlyPlan,
                isDailyPlan: plan.isDailyPlan,
                images: plan.images.map((img) => ({ id: img.id, url: img.url, altText: img.altText })),
                variations: plan.Variation.map((v) => ({
                    id: v.id,
                    title: v.title,
                    description: v.description,
                })),
                menus: plan.menus.map((menu) => ({
                    id: menu.id,
                    name: menu.name,
                    schedule: menu.schedule,
                })),
            })),
        };
    }

    /// GET /open/popular-plans — public listing of plans ranked by subscription count.
    async findPopularPlans(page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const where = {
            isActive: true,
            mess: { isListed: true, is_active: true },
        };

        const [plans, total] = await Promise.all([
            this.prisma.plans.findMany({
                where,
                orderBy: { totalCustomers: 'desc' },
                skip,
                take: limit,
                include: {
                    images: true,
                    Variation: { where: { isActive: true } },
                    mess: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            icon: true,
                            address: true,
                            location: true,
                            images: { where: { isCover: true }, take: 1 },
                        },
                    },
                },
            }),
            this.prisma.plans.count({ where }),
        ]);

        return {
            message: 'Popular plans fetched successfully',
            data: plans.map((plan) => ({
                id: plan.id,
                planName: plan.planName,
                description: plan.description,
                price: plan.price,
                minPrice: plan.minPrice,
                isMonthlyPlan: plan.isMonthlyPlan,
                isDailyPlan: plan.isDailyPlan,
                totalCustomers: plan.totalCustomers,
                images: plan.images.map((img) => ({ id: img.id, url: img.url, altText: img.altText })),
                variations: plan.Variation.map((v) => ({
                    id: v.id,
                    title: v.title,
                    description: v.description,
                })),
                mess: {
                    id: plan.mess.id,
                    name: plan.mess.name,
                    slug: plan.mess.slug,
                    logo: plan.mess.icon ?? null,
                    address: plan.mess.address,
                    location: plan.mess.location,
                    coverImage: plan.mess.images?.[0]?.url ?? null,
                },
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

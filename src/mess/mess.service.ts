import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMessDto, UpdateMessDto } from './dto/create-mess.dto';
import { S3Service } from 'src/s3/s3.service';
import { FoodType, Role } from '@prisma/client';
import { CreateMessImageDto } from './dto/create-mess-image.dto';
import { BillingService } from 'src/billing/billing.service';

@Injectable()
export class MessService {
    constructor(private prisma: PrismaService,
        private readonly s3Service: S3Service,
        private readonly billingService: BillingService,
    ) { }


    async create(
        dto: CreateMessDto,
        images: { url: string }[] = [],
    ) {
        let adminProfiles: { id: string }[] = [];

        // 🔹 Validate admin IDs if provided
        if (dto.messAdminIds?.length) {
            adminProfiles = await this.prisma.messAdminProfile.findMany({
                where: { id: { in: dto.messAdminIds } },
                select: { id: true },
            });

            if (adminProfiles.length !== dto.messAdminIds.length) {
                throw new BadRequestException(
                    'One or more MessAdminProfile IDs are invalid',
                );
            }
        }

        // 🔹 Create mess
        const mess = await this.prisma.mess.create({
            data: {
                name: dto.name,
                description: dto.description,
                address: dto.address,
                phone: dto.phone,
                email: dto.email,
                is_active: dto.is_active ?? true,
                is_verified: dto.is_verified ?? false,
                isPremium: dto.isPremium ?? false,
                location: dto.location,
                openingHours: dto.openingHours,
                features: dto.features,
                zipcode: dto.zipcode,


                ...(dto.districtId && {
                    District: { connect: { id: dto.districtId } },
                }),

                ...(adminProfiles.length && {
                    messAdmins: {
                        connect: adminProfiles.map((admin) => ({ id: admin.id })),
                    },
                }),
            },
            include: {
                messAdmins: {
                    include: { user: true },
                },
                images: true,
                foodTypes: true,
                tags: true,
                District: true,
                categories: true,
            },

        });

        // 🔹 Attach food types (optional)
        if (dto.foodTypes?.length) {
            await this.prisma.messFoodType.createMany({
                data: dto.foodTypes.map((foodType) => ({
                    messId: mess.id,
                    foodType,
                })),
                skipDuplicates: true,
            });
        }

        // 🔹 Attach tags (optional)
        if (dto.tags?.length) {
            await this.prisma.messTag.createMany({
                data: dto.tags.map((tag) => ({
                    messId: mess.id,
                    tag,
                })),
                skipDuplicates: true,
            });
        }

        // 🔹 Handle images
        if (images.length) {
            await this.prisma.messImages.createMany({
                data: images.map((image) => ({
                    messId: mess.id,
                    url: image.url,
                })),
            });
        }

        // 🔹 Attach images to response
        const messImages = await this.prisma.messImages.findMany({
            where: { messId: mess.id },
            select: { id: true, url: true },
        });

        const fullMess = await this.prisma.mess.findUnique({
            where: { id: mess.id },
            include: {
                messAdmins: {
                    include: { user: true },
                },
                images: true,
                foodTypes: true,
                tags: true,
                District: true,
                categories: true,
            },
        });

        if (!fullMess) {
            throw new NotFoundException('Mess not found');
        }

        // Apply default trial period (global config) to new mess, if config not present
        await this.billingService.ensureMessBillingConfig(fullMess.id);

        return {
            message: 'Mess created successfully',
            data: {
                ...fullMess,
                admins: fullMess.messAdmins.map((admin) => ({
                    id: admin.id,
                    user: admin.user,
                })),
            },
        };

    }

    private getDistanceKm(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    private getDaysBetween(date1: string, date2?: string) {
        if (!date1) return 0;

        const d1 = new Date(date1);
        const d2 = date2 ? new Date(date2) : new Date(date1);

        const diff = Math.ceil(
            (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
        );

        return diff || 1;
    }

    async findAll(
        page: number = 1,
        limit: number = 10,
        search?: string,
        categoryId?: string,
        ratings?: number,
        is_active?: boolean,
        is_verified?: boolean,
        location?: string,          // ✅ NEW
        variationId?: string,       // ✅ NEW
        foodType?: FoodType,        // ✅ NEW (enum)
        districtName?: string,   // ✅ NEW
        latitude?: string,          // ✅ NEW
        logitude?: string,       // ✅ NEW
        date1?: string,
        date2?: string,
        minPrice?: string,
        maxPrice?: string,

    ) {
        const skip = (page - 1) * limit;

        const where: any = {};

        // 🔍 Search (OR)
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
            ];
        }

        // 🎯 Filters (AND)
        if (is_active !== undefined) {
            where.is_active = is_active;
        }

        if (is_verified !== undefined) {
            where.is_verified = is_verified;
        }

        if (ratings !== undefined) {
            where.ratings = ratings;
        }

        if (categoryId) {
            where.categories = {
                some: {
                    id: categoryId,
                },
            };
        }

        // 📍 Location filter
        if (location) {
            where.location = {
                contains: location,
            };
        }
        // 🏘️ District name filter
        if (districtName) {
            where.District = {
                name: {
                    contains: districtName,
                },
            };
        }

        // 🍱 Food type filter
        if (foodType) {
            where.foodTypes = {
                some: {
                    foodType: {
                        equals: foodType,
                    },
                },
            };
        }

        // 🍽️ Variation-based filtering (Breakfast / Lunch / Dinner)
        if (variationId) {
            where.plans = {
                some: {
                    isActive: true,
                    Variation: {
                        some: {
                            id: variationId,
                            isActive: true,
                        },
                    },
                },
            };
        }
        // 💰 Price range filter
        if (minPrice || maxPrice) {

            const priceFilter: any = {};

            if (minPrice) {
                priceFilter.gte = Number(minPrice);
            }

            if (maxPrice) {
                priceFilter.lte = Number(maxPrice);
            }

            // Merge with existing plans filter (variation filter may already exist)
            if (where.plans) {
                where.plans.some = {
                    ...where.plans.some,
                    price: priceFilter,
                    isActive: true,
                };
            } else {
                where.plans = {
                    some: {
                        price: priceFilter,
                        isActive: true,
                    },
                };
            }
        }
        console.log("heloo 1")
        const [messes, total] = await this.prisma.$transaction([
            this.prisma.mess.findMany({
                skip,
                take: limit,
                where,
                include: {
                    plans: {
                        include: { Variation: true },
                    },
                    messAdmins: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    phone: true,
                                },
                            },
                        },
                    },
                    foodTypes: true,
                    tags: true,
                    Testimonials: true,
                    images: true,
                }
            }),
            this.prisma.mess.count({ where }),
        ]);
        console.log("heloo 2")
        const lat = Number(latitude);
        const lng = Number(logitude);

        const hasLocationFilter =
            !isNaN(lat) &&
            !isNaN(lng);

        const days = date1 ? this.getDaysBetween(date1, date2) : 0;

        const processedMesses = messes.map((mess) => {
            console.log("heloo 3")
            const ratingsCount = mess.Testimonials?.length || 0;

            let distance: number | null = null;

            if (
                hasLocationFilter &&
                mess.latitude &&
                mess.logitude
            ) {
                const messLat = Number(mess.latitude);
                const messLng = Number(mess.logitude);

                if (!isNaN(messLat) && !isNaN(messLng)) {
                    distance = this.getDistanceKm(
                        lat,
                        lng,
                        messLat,
                        messLng,
                    );
                }
            }

            console.log({
                mess: mess.name,
                lat,
                lng,
                messLat: mess.latitude,
                messLng: mess.logitude,
                calculated: distance
            });


            let startingPrice: number | null = null;

            const activePlans = mess.plans?.filter(p => p.isActive !== false) || [];

            if (!date1) {

                // ✅ NORMAL CASE
                // Ignore daily/monthly — just lowest plan

                const lowestPlan = activePlans
                    .sort(
                        (a, b) =>
                            Number(a.price.toString()) -
                            Number(b.price.toString())
                    )[0];

                if (lowestPlan) {
                    startingPrice = Number(
                        lowestPlan.minPrice
                            ? lowestPlan.minPrice.toString()
                            : lowestPlan.price.toString()
                    );
                }

            } else {

                // 🚨 Only NOW care about daily/monthly

                const lowestDailyPlan = activePlans
                    .filter(p => p.isDailyPlan)
                    .sort(
                        (a, b) =>
                            Number(a.price.toString()) -
                            Number(b.price.toString())
                    )[0];

                const lowestMonthlyPlan = activePlans
                    .filter(p => p.isMonthlyPlan)
                    .sort(
                        (a, b) =>
                            Number(a.price.toString()) -
                            Number(b.price.toString())
                    )[0];

                const days = this.getDaysBetween(date1, date2);

                if (!date2) {
                    if (lowestDailyPlan) {
                        startingPrice = Number(
                            lowestDailyPlan.price.toString()
                        );
                    }
                }
                else if (days < 30) {
                    if (lowestDailyPlan) {
                        startingPrice =
                            Number(lowestDailyPlan.price.toString()) * days;
                    }
                }
                else {
                    if (lowestMonthlyPlan) {
                        startingPrice = Number(
                            lowestMonthlyPlan.minPrice
                                ? lowestMonthlyPlan.minPrice.toString()
                                : lowestMonthlyPlan.price.toString()
                        );
                    }
                }
            }
            console.log("heloo 4")
            return {
                ...mess,
                startingPrice,
                __ratingsCount: ratingsCount,
                __distance: distance,
            };
        });

        if (hasLocationFilter) {
            processedMesses.sort(
                (a, b) =>
                    (a.__distance ?? Number.MAX_SAFE_INTEGER) -
                    (b.__distance ?? Number.MAX_SAFE_INTEGER)
            );

        } else {
            processedMesses.sort(
                (a, b) =>
                    b.__ratingsCount - a.__ratingsCount
            );
        }

        const finalMesses = processedMesses.map(({ __ratingsCount, __distance, ...m }) => m);

        return {
            data: finalMesses,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };


    }



    async findOne(id: string) {
        const mess = await this.prisma.mess.findUnique({
            where: { id },
            include: {
                plans: {
                    include: {
                        images: true,
                        Variation: true,
                    },
                },
                messAdmins: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                is_active: true,
                            },
                        },
                    },
                },
                foodTypes: true,
                tags: true,
                Testimonials: true,
                DeliveryPartnerProfile: {
                    include: { user: true },
                },
                UserSubscriptions: true,
                images: true,
            },
        });

        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        // Order summary
        const [totalOrders, deliveredOrders, pendingOrders, inProgressOrders] = await this.prisma.$transaction([
            this.prisma.deliveries.count({ where: { messId: id } }),
            this.prisma.deliveries.count({ where: { messId: id, status: 'DELIVERED' } }),
            this.prisma.deliveries.count({ where: { messId: id, status: 'PENDING' } }),
            this.prisma.deliveries.count({ where: { messId: id, status: 'DELIVERED' } }),
        ]);

        // Revenue summary from payments linked to subscriptions/plans of this mess
        const revenueAgg = await this.prisma.payments.aggregate({
            where: { status: 'SUCCESS', userSubscriptions: { messId: id } },
            _sum: { amount: true },
            _count: { id: true },
        });

        const totalRevenue = Number(revenueAgg._sum.amount || 0);
        const totalPayments = revenueAgg._count.id || 0;

        // Delivery partners assigned to this mess
        const deliveryPartners = await this.prisma.deliveryPartnerProfile.findMany({
            where: { messId: id },
            include: { user: { select: { id: true, name: true, phone: true, email: true, is_active: true } } },
        });

        // Plans and subscriptions are already included in the mess object; format them
        const plans = mess.plans || [];
        const subscriptions = mess.UserSubscriptions || [];

        return {
            ...mess,
            orderSummary: {
                totalOrders,
                deliveredOrders,
                pendingOrders,
                inProgressOrders,
            },
            revenueSummary: {
                totalRevenue,
                totalPayments,
            },
            deliveryPartners,
            plans,
            subscriptions,
        };
    }

    async update(id: string, dto: UpdateMessDto) {
        const mess = await this.prisma.mess.findUnique({ where: { id } });
        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        const updated = await this.prisma.mess.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.address !== undefined && { address: dto.address }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.email !== undefined && { email: dto.email }),
                ...(dto.is_active !== undefined && { is_active: dto.is_active }),
                ...(dto.openingHours !== undefined && { openingHours: dto.openingHours }),
                ...(dto.location !== undefined && { location: dto.location }),
                ...(dto.is_verified !== undefined && { is_verified: dto.is_verified }),
                ...(dto.isPremium !== undefined && { isPremium: dto.isPremium }),
                ...(dto.features !== undefined && { features: dto.features }),
                ...(dto.zipcode !== undefined && { zipcode: dto.zipcode }),

                ...(dto.districtId !== undefined && {
                    District: dto.districtId
                        ? { connect: { id: dto.districtId } }
                        : { disconnect: true },
                }),
            },
            include: {
                plans: true,
                messAdmins: {
                    include: { user: true },
                },
            },
        });

        // ✅ Update food types (optional)
        if (dto.foodTypes) {
            await this.prisma.messFoodType.deleteMany({
                where: { messId: id },
            });

            if (dto.foodTypes.length) {
                await this.prisma.messFoodType.createMany({
                    data: dto.foodTypes.map((foodType) => ({
                        messId: id,
                        foodType,
                    })),
                    skipDuplicates: true,
                });
            }
        }

        // ✅ Update tags (optional)
        if (dto.tags) {
            await this.prisma.messTag.deleteMany({
                where: { messId: id },
            });

            if (dto.tags.length) {
                await this.prisma.messTag.createMany({
                    data: dto.tags.map((tag) => ({
                        messId: id,
                        tag,
                    })),
                    skipDuplicates: true,
                });
            }
        }

        // ✅ Update images (optional)
        if (dto.images !== undefined) {

            const existingImages = await this.prisma.messImages.findMany({
                where: { messId: id },
                select: { id: true },
            });

            const existingIds = existingImages.map(i => i.id);
            const incomingIds = dto.images
                .filter(img => img.id)
                .map(img => img.id as string);

            // delete removed images
            const idsToDelete = existingIds.filter(
                existingId => !incomingIds.includes(existingId),
            );

            if (idsToDelete.length) {
                await this.prisma.messImages.deleteMany({
                    where: { id: { in: idsToDelete } },
                });
            }

            // update existing images
            for (const image of dto.images.filter(img => img.id)) {
                await this.prisma.messImages.update({
                    where: { id: image.id },
                    data: {
                        url: image.url,
                        altText: image.altText,
                        isCover: image.isCover ?? false,
                        sortOrder: image.sortOrder ?? 0,
                    },
                });
            }

            // create new images
            const newImages = dto.images.filter(img => !img.id);

            if (newImages.length) {
                await this.prisma.messImages.createMany({
                    data: newImages.map(img => ({
                        messId: id,
                        url: img.url,
                        altText: img.altText,
                        isCover: img.isCover ?? false,
                        sortOrder: img.sortOrder ?? 0,
                    })),
                });
            }
        }

        const fullMess = await this.prisma.mess.findUnique({
            where: { id },
            include: {
                plans: true,
                messAdmins: {
                    include: { user: true },
                },
                images: true,
                foodTypes: true,
                tags: true,
                District: true,
                categories: true,
            },
        });

        if (!fullMess) {
            throw new NotFoundException('Mess not found');
        }

        return {
            message: 'Mess updated successfully',
            data: {
                ...fullMess,
                admins: fullMess.messAdmins.map((admin) => ({
                    id: admin.id,
                    user: admin.user,
                })),
            },
        };

    }


    async remove(id: string) {
        const mess = await this.prisma.mess.findUnique({ where: { id } });
        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        await this.prisma.mess.delete({ where: { id } });

        return {
            message: 'Mess deleted successfully',
        };
    }

    async getMessStats(messId: string) {
        const mess = await this.prisma.mess.findUnique({ where: { id: messId } });
        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        const [totalPlans, totalMessAdmins, subscriptions] = await this.prisma.$transaction([
            this.prisma.plans.count({ where: { messId } }),
            this.prisma.messAdminProfile.count({
                where: { messes: { some: { id: messId } } },
            }),
            this.prisma.userSubscriptions.findMany({
                where: { plan: { messId } },
                select: {
                    totalPrice: true,
                    discountedPrice: true,
                    is_active: true,
                },
            }),
        ]);

        const totalRevenue = subscriptions.reduce(
            (sum, s) => sum + Number(s.discountedPrice || s.totalPrice),
            0
        );

        const activeSubscriptions = subscriptions.filter((s) => s.is_active).length;

        return {
            messId,
            messName: mess.name,
            totalPlans,
            totalMessAdmins,
            totalSubscriptions: subscriptions.length,
            activeSubscriptions,
            totalRevenue,
        };
    }

    async getAllMesses(userId: string) {
        // Find the messAdminProfile for this user
        const messAdmin = await this.prisma.messAdminProfile.findUnique({
            where: { userId },
            include: {
                messes: {
                    where: { is_active: true },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        foodTypes: true,
                        tags: true,
                    },
                    orderBy: { name: 'asc' },
                },
            },
        });

        if (!messAdmin) {
            throw new Error('MessAdmin profile not found for this user');
        }

        return messAdmin.messes;
    }


    async addMessImages(
        messId: string,
        images: {
            url: string;
        }[] = [],
        altText?: string,
    ) {
        if (!images || images.length === 0) {
            throw new BadRequestException('At least one image is required');
        }

        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
        });

        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        const galleryData = images.map((image) => ({
            messId: mess.id,
            url: image.url,
        }));

        await this.prisma.messImages.createMany({
            data: galleryData,
        });

        // ✅ Fetch images and attach (response structure unchanged)
        const messImages = await this.prisma.messImages.findMany({
            where: { messId: mess.id },
            select: {
                id: true,
                url: true,
            },
        });

        return {
            message: 'Mess images uploaded successfully',
            data: messImages,
        };
    }

    async getMessImages(messId: string) {
        const mess = await this.prisma.mess.findUnique({
            where: { id: messId }
        });

        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        const images = await this.prisma.messImages.findMany({
            where: {
                messId: mess.id,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        return {
            status: 'success',
            message: 'Mess images fetched successfully',
            data: images,
        };
    }

    async deleteMessImage(messId: string, imageId: string) {
        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
        });

        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        const image = await this.prisma.messImages.findUnique({
            where: { id: imageId },
        });

        if (!image || image.messId !== mess.id) {
            throw new NotFoundException('Image not found');
        }
        await this.s3Service.deleteFile(image.url);

        await this.prisma.messImages.delete({
            where: { id: imageId },
        });

        return {
            message: 'Mess image deleted successfully',
        };
    }



    //Only for development/testing:
    async addMissingCoordinates() {

        // Base coordinate (Kochi center)
        const BASE_LAT = 9.9312;
        const BASE_LNG = 76.2673;

        // Fetch messes with missing coordinates
        const messes = await this.prisma.mess.findMany({
            where: {
                OR: [
                    { latitude: null },
                    { logitude: null },
                ],
            },
            select: {
                id: true,
                latitude: true,
                logitude: true,
            },
        });

        if (!messes.length) {
            return {
                message: "No messes found with missing coordinates",
            };
        }

        const updates: Promise<any>[] = [];

        for (const mess of messes) {

            // random offset within ~5km radius
            const latOffset = (Math.random() - 0.5) * 0.05;
            const lngOffset = (Math.random() - 0.5) * 0.05;

            const latitude = (BASE_LAT + latOffset).toFixed(6);
            const longitude = (BASE_LNG + lngOffset).toFixed(6);

            updates.push(
                this.prisma.mess.update({
                    where: { id: mess.id },
                    data: {
                        latitude,
                        logitude: longitude,
                    },
                })
            );
        }

        await Promise.all(updates);

        return {
            message: `${updates.length} messes updated with coordinates`,
        };
    }


    async addCoverImages(
        messId: string,
        images: { url: string }[] = [],
        userId: string,
        role: Role,
        altText?: string,
    ) {
        if (!images || images.length === 0) {
            throw new BadRequestException('At least one image is required');
        }

        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
            include: {
                messAdmins: {
                    select: { userId: true },
                },
            },
        });

        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        /* ===============================
           AUTHORIZATION CHECK
           =============================== */

        if (role === Role.MESSADMIN) {
            const isOwner = mess.messAdmins.some(
                (admin) => admin.userId === userId,
            );

            if (!isOwner) {
                throw new ForbiddenException(
                    'You are not allowed to modify this mess',
                );
            }
        }

        if (role !== Role.SUPERADMIN && role !== Role.MESSADMIN) {
            throw new ForbiddenException('Insufficient permissions');
        }

        const newImageUrl = images[0].url;

        await this.prisma.$transaction(async (tx) => {

            const existingCover = await tx.messImages.findFirst({
                where: {
                    messId,
                    isCover: true,
                },
            });

            if (existingCover) {
                await this.s3Service.deleteFile(existingCover.url);

                await tx.messImages.delete({
                    where: { id: existingCover.id },
                });
            }

            await tx.messImages.create({
                data: {
                    messId,
                    url: newImageUrl,
                    altText,
                    isCover: true,
                },
            });
        });

        const messImages = await this.prisma.messImages.findMany({
            where: { messId },
            select: {
                id: true,
                url: true,
                isCover: true,
            },
        });

        return {
            message: 'Cover image updated successfully',
            data: messImages,
        };
    }


}

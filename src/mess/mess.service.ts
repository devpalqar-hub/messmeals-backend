import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMessDto, UpdateMessDto } from './dto/create-mess.dto';
import { S3Service } from 'src/s3/s3.service';
import { FoodType } from '@prisma/client';

@Injectable()
export class MessService {
    constructor(private prisma: PrismaService,
        private readonly s3Service: S3Service
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
                location: dto.location,
                openingHours: dto.openingHours,

                ...(dto.districtId && {
                    district: { connect: { id: dto.districtId } },
                }),

                ...(adminProfiles.length && {
                    messAdmins: {
                        connect: adminProfiles.map((admin) => ({ id: admin.id })),
                    },
                }),
            },
            include: { messAdmins: { include: { user: true } } },
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

        return {
            message: 'Mess created successfully',
            data: {
                ...mess,
                images: messImages,
                admins: mess.messAdmins.map((admin) => ({
                    id: admin.id,
                    user: admin.user,
                })),
            },
        };
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
                    foodType,
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
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.mess.count({ where }),
        ]);

        // ❗ Response structure unchanged
        return {
            data: messes,
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
                DeliveryPartnerProfile: true,
                UserSubscriptions: true,
                images: true
            },

        });

        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        return mess;
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

                ...(dto.districtId !== undefined && {
                    district: dto.districtId
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

        return {
            message: 'Mess updated successfully',
            data: updated,
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
            throw new NotFoundException('Doula profile not found');
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
            throw new NotFoundException('Doula profile not found');
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
}

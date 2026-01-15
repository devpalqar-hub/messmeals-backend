import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PlansDto, VariationDto, VariationImagesDto, PlanImagesDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import * as path from 'path';
import { pl, tr } from '@faker-js/faker';
import { S3Service } from 'src/s3/s3.service';

@Injectable()
export class PlansService {
    constructor(private prisma: PrismaService,
        private readonly s3Service: S3Service
    ) { }

    async createPlan(
        dto: PlansDto,
        images: { url: string }[] = [],
    ) {

        const { planName, price, minPrice, description, variationIds, messId } = dto;

        if (dto.isMonthlyPlan === dto.isDailyPlan) {
            throw new BadRequestException(
                'Invalid plan type: exactly one of isMonthlyPlan or isDailyPlan must be true',
            );
        }

        // 1️⃣ Validate mess exists
        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
        });

        if (!mess) {
            throw new BadRequestException('Mess not found');
        }

        return this.prisma.$transaction(async (tx) => {
            // 2️⃣ Create Plan
            const plan = await tx.plans.create({
                data: {
                    planName,
                    price,
                    minPrice,
                    description,
                    messId,
                    isActive: true,
                    isDailyPlan: dto.isDailyPlan,
                    isMonthlyPlan: dto.isMonthlyPlan,
                    Variation: {
                        connect: variationIds?.map((id) => ({ id })) || [],
                    },
                },
            });

            // 3️⃣ Add plan images (optional)
            if (images.length > 0) {
                const galleryData = images.map((image) => ({
                    planId: plan.id,
                    url: image.url,
                }));

                await tx.planImages.createMany({
                    data: galleryData,
                });
            }

            // ✅ Response structure unchanged
            return {
                message: 'Plan created successfully',
                planId: plan,
            };
        });
    }


    async findAll(page: number = 1, limit: number = 10, messId?: string) {
        const skip = (page - 1) * limit;

        const where: any = {};
        if (messId) {
            where.messId = messId;
        }

        const [plans, total] = await this.prisma.$transaction([
            this.prisma.plans.findMany({
                skip,
                take: limit,
                where,
                include: {
                    images: true,
                    mess: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    Variation: {
                        select: {
                            id: true,
                            title: true,
                            description: true
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc', // newest first
                },
            }),
            this.prisma.plans.count({ where }),
        ]);

        return {
            data: plans,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }



    async findOne(id: string) {
        const plan = await this.prisma.plans.findUnique({
            where: { id },
            include: {
                images: true,
                mess: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                Variation: {
                    select: {
                        id: true,
                        title: true,
                        description: true
                    },
                },
            },
        });
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    async updatePlan(id: string, dto: UpdatePlanDto, files: any) {
        if (dto.isMonthlyPlan === dto.isDailyPlan) {
            throw new BadRequestException(
                'Invalid plan type: exactly one of isMonthlyPlan or isDailyPlan must be true',
            );
        }

        return this.prisma.$transaction(async (tx) => {
            // 1️⃣ Handle plan images (new uploads)
            const planImagesData =
                files?.planImages?.map((file) => ({
                    url: path.join('uploads', file.filename),
                    altText: file.originalname,
                })) || [];

            // 2️⃣ Prepare update data object
            const updateData: any = {};

            if (dto.planName) updateData.planName = dto.planName;
            if (dto.price) updateData.price = dto.price;
            if (dto.minPrice) updateData.minPrice = dto.minPrice;
            if (dto.description) updateData.description = dto.description;
            if (dto.isActive) updateData.isActive = dto.isActive;
            if (dto.isMonthlyPlan) updateData.isMonthlyPlan = dto.isMonthlyPlan;
            if (dto.isDailyPlan) updateData.isDailyPlan = dto.isDailyPlan;
            if (dto.messId) {
                // Validate mess exists
                const mess = await tx.mess.findUnique({ where: { id: dto.messId } });
                if (!mess) throw new BadRequestException('Mess not found');
                updateData.messId = dto.messId;
            }
            if (dto.lunch !== undefined) updateData.lunch = dto.lunch;

            // 3️⃣ Handle Variations (many-to-many)
            if (dto.variationIds?.length) {
                updateData.Variation = {
                    set: dto.variationIds.map((id) => ({ id })), // replaces existing ones
                };
            }

            // 4️⃣ Handle Images (if new ones uploaded)
            if (planImagesData.length) {
                // Optional: delete old images before adding new
                await tx.planImages.deleteMany({ where: { planId: id } });

                updateData.images = {
                    create: planImagesData,
                };
            }

            // 5️⃣ Update plan
            const updatedPlan = await tx.plans.update({
                where: { id },
                data: updateData,
                include: { Variation: true, images: true },
            });

            return {
                message: 'Plan updated successfully',
                plan: updatedPlan,
            };
        });
    }


    async remove(id: string) {
        return this.prisma.plans.delete({ where: { id } });
    }


    async addPlanImages(
        planId: string,
        images: {
            url: string;
        }[] = [],
        altText?: string,
    ) {
        if (!images || images.length === 0) {
            throw new BadRequestException('At least one image is required');
        }

        const plan = await this.prisma.plans.findUnique({
            where: { id: planId },
        });

        if (!plan) {
            throw new NotFoundException('Plan not found');
        }

        const galleryData = images.map((image) => ({
            planId: plan.id,
            url: image.url,
        }));

        await this.prisma.planImages.createMany({
            data: galleryData,
        });

        // ✅ Fetch images and attach (response structure unchanged)
        const Planimages = await this.prisma.planImages.findMany({
            where: { planId: plan.id },
            select: {
                id: true,
                url: true,
            },
        });

        return {
            message: 'Plan images uploaded successfully',
            data: Planimages,
        };
    }

    async getPlanImages(planId: string) {
        const plans = await this.prisma.plans.findUnique({
            where: { id: planId }
        });

        if (!plans) {
            throw new NotFoundException('Plan not found');
        }

        const images = await this.prisma.planImages.findMany({
            where: {
                planId: plans.id,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        return {
            status: 'success',
            message: 'Plan images fetched successfully',
            data: images,
        };
    }

    async deletePlanImages(planId: string, imageId: string) {
        const plans = await this.prisma.plans.findUnique({
            where: { id: planId },
        });

        if (!plans) {
            throw new NotFoundException('Plan not found');
        }

        const image = await this.prisma.planImages.findUnique({
            where: { id: imageId },
        });

        if (!image || image.planId !== plans.id) {
            throw new NotFoundException('Image not found');
        }
        await this.s3Service.deleteFile(image.url);

        await this.prisma.planImages.delete({
            where: { id: imageId },
        });

        return {
            message: 'Plan image deleted successfully',
        };
    }
}


//add plan image validations 
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PlansDto, VariationDto, VariationImagesDto, PlanImagesDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import * as path from 'path';
import { tr } from '@faker-js/faker';

@Injectable()
export class PlansService {
    constructor(private prisma: PrismaService) { }

    async createPlan(dto: PlansDto, files: any) {
        return this.prisma.$transaction(async (tx) => {
            // 1️⃣ Handle Plan Images (optional)
            const planImagesData =
                files.planImages?.map((file) => ({
                    url: path.join('uploads', file.filename),
                    altText: file.originalname,
                })) || [];

            // 2️⃣ Create Plan
            const plan = await tx.plans.create({
                data: {
                    planName: dto.planName,
                    price: dto.price,
                    minPrice: dto.minPrice,
                    description: dto.description,
                    images: planImagesData.length ? { create: planImagesData } : undefined,
                },
            });

            // 3️⃣ Handle Variations
            if (dto.variations?.length) {
                for (let i = 0; i < dto.variations.length; i++) {
                    const variation = dto.variations[i];
                    const variationImageFile = files.variationImages?.[i];

                    // Match variation[i] with variationImages[i]
                    const variationImageData = variationImageFile
                        ? [
                            {
                                url: path.join('uploads', variationImageFile.filename),
                                altText: variationImageFile.originalname,
                            },
                        ]
                        : [];

                    await tx.variation.create({
                        data: {
                            title: variation.title,
                            timeRange: variation.timeRange,
                            description: variation.description,
                            planId: plan.id,
                            images: variationImageData.length ? { create: variationImageData } : undefined,
                        },
                    });
                }
            }

            return {
                message: '✅ Plan created successfully',
                planId: plan.id,
            };
        });
    }

    async findAll(page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const [plans, total] = await this.prisma.$transaction([
            this.prisma.plans.findMany({
                skip,
                take: limit,
                include: {
                    images: true,
                    Variation: {
                        include: {
                            images: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc', // newest first
                },
            }),
            this.prisma.plans.count(),
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
                Variation: {
                    include: {
                        images: true,
                    },
                },
            },
        });
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    async updatePlan(id: string, dto: UpdatePlanDto, files: any) {
        const { images, variations, ...rest } = dto;

        return this.prisma.$transaction(async (tx) => {
            // 1️⃣ Update main plan fields
            const updatedPlan = await tx.plans.update({
                where: { id },
                data: { ...rest },
            });

            // 2️⃣ Handle plan images (replace if new images provided)
            if (files.planImages && files.planImages.length) {
                // Delete old images from DB (optionally from disk)
                await tx.planImages.deleteMany({ where: { planId: id } });

                const planImagesData = files.planImages.map((file) => ({
                    url: path.join('uploads', file.filename),
                    altText: file.originalname,
                    planId: id,
                }));

                await tx.planImages.createMany({ data: planImagesData });
            }

            // 3️⃣ Handle variations
            if (variations?.length) {
                for (let i = 0; i < variations.length; i++) {
                    const variation = variations[i];
                    const variationImageFile = files.variationImages?.[i];

                    // Upsert variation
                    const upsertedVariation = await tx.variation.upsert({
                        where: { id: variation.id || '' }, // works now
                        update: {
                            title: variation.title,
                            timeRange: variation.timeRange,
                            description: variation.description,
                        },
                        create: {
                            title: variation.title,
                            timeRange: variation.timeRange,
                            description: variation.description,
                            planId: id,
                        },
                    });


                    // Handle variation images
                    if (variationImageFile) {
                        // delete old images
                        await tx.variationImages.deleteMany({
                            where: { variationId: upsertedVariation.id },
                        });

                        await tx.variationImages.create({
                            data: {
                                url: path.join('uploads', variationImageFile.filename),
                                altText: variationImageFile.originalname,
                                variationId: upsertedVariation.id,
                            },
                        });
                    }
                }
            }

            return { message: '✅ Plan updated successfully', planId: id };
        });
    }




    async remove(id: string) {
        return this.prisma.plans.delete({ where: { id } });
    }

    async updateImages(id: string, files: Express.Multer.File[]) {
        const plan = await this.prisma.plans.findUnique({ where: { id } });
        if (!plan) throw new NotFoundException('Plan not found');

        // Remove old images
        await this.prisma.planImages.deleteMany({ where: { planId: id } });

        // Add new ones
        await this.prisma.planImages.createMany({
            data: files.map((file, index) => ({
                planId: id,
                url: `/uploads/plans/${file.filename}`,
                altText: file.originalname,
                sortOrder: index,
            })),
        });

        return this.findOne(id);
    }
}

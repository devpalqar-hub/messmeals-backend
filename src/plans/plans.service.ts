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
        const { planName, price, minPrice, description, variationIds } = dto
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
                    Variation: { connect: dto.variationIds?.map((id) => ({ id })) || [] },
                    images: planImagesData.length ? { create: planImagesData } : undefined,
                },
            });
            return {
                message: 'Plan created successfully',
                planId: plan,
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


//add plan image validations 
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PlansDto,
  VariationDto,
  VariationImagesDto,
  PlanImagesDto,
} from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import * as path from 'path';
import { pl, tr } from '@faker-js/faker';
import { S3Service } from 'src/s3/s3.service';
import { ScheduleType } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(
    private prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  /** Every linked menu must belong to the same mess as the plan itself. */
  private async assertMenusBelongToMess(menuIds: string[], messId: string) {
    if (menuIds.length === 0) return;

    const menus = await this.prisma.menu.findMany({
      where: { id: { in: menuIds } },
      select: { id: true, messId: true },
    });

    if (menus.length !== menuIds.length) {
      throw new BadRequestException('One or more menu IDs are invalid');
    }
    const foreignMenu = menus.find((m) => m.messId !== messId);
    if (foreignMenu) {
      throw new BadRequestException(
        'A plan can only be linked to menus of the same mess',
      );
    }
  }

  /** CUSTOM requires at least one day; EVERYDAY/MONTHLY carry no day restriction. */
  private assertScheduleValid(
    scheduleType: ScheduleType,
    availableDays?: string[],
  ) {
    if (
      scheduleType === ScheduleType.CUSTOM &&
      (!availableDays || availableDays.length === 0)
    ) {
      throw new BadRequestException(
        'availableDays is required when scheduleType is CUSTOM',
      );
    }
  }

  async createPlan(dto: PlansDto, images: { url: string }[] = []) {
    const {
      planName,
      price,
      minPrice,
      description,
      variationIds,
      menuIds,
      messId,
    } = dto;

    if (dto.isMonthlyPlan === dto.isDailyPlan) {
      throw new BadRequestException(
        'Invalid plan type: exactly one of isMonthlyPlan or isDailyPlan must be true',
      );
    }

    const scheduleType = dto.scheduleType ?? ScheduleType.EVERYDAY;
    this.assertScheduleValid(scheduleType, dto.availableDays);

    // 1️⃣ Validate mess exists
    const mess = await this.prisma.mess.findUnique({
      where: { id: messId },
    });

    if (!mess) {
      throw new BadRequestException('Mess not found');
    }

    // 1️⃣b Validate menus (optional) belong to the same mess
    await this.assertMenusBelongToMess(menuIds ?? [], messId);

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
          scheduleType,
          availableDays:
            scheduleType === ScheduleType.CUSTOM
              ? dto.availableDays
              : undefined,
          Variation: {
            connect: variationIds?.map((id) => ({ id })) || [],
          },
          ...(menuIds?.length && {
            menus: { connect: menuIds.map((id) => ({ id })) },
          }),
        },
        include: {
          Variation: true,
          menus: true,
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

      const createdImages = await tx.planImages.findMany({
        where: { planId: plan.id },
        select: {
          id: true,
          url: true,
          altText: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        message: 'Plan created successfully',
        planId: {
          ...plan,
          images: createdImages,
        },
      };
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    messId?: string,
    search?: string,
    includeDeleted = false,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    if (messId) {
      where.messId = messId;
    }
    if (search) {
      where.planName = { contains: search, mode: 'insensitive' };
    }

    const [plans, total] = await this.prisma.$transaction([
      this.prisma.plans.findMany({
        skip,
        take: limit,
        where,
        include: {
          images: {
            where: includeDeleted ? {} : { deletedAt: null },
          },
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
              description: true,
            },
          },
          menus: {
            select: {
              id: true,
              name: true,
              schedule: true,
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
    const plan = await this.prisma.plans.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: { where: { deletedAt: null } },
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
            description: true,
          },
        },
        menus: {
          select: {
            id: true,
            name: true,
            schedule: true,
          },
        },
      },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    if (
      dto.isMonthlyPlan !== undefined &&
      dto.isDailyPlan !== undefined &&
      dto.isMonthlyPlan === dto.isDailyPlan
    ) {
      throw new BadRequestException(
        'Invalid plan type: exactly one of isMonthlyPlan or isDailyPlan must be true',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updateData: any = {};

      if (dto.planName !== undefined) updateData.planName = dto.planName;

      if (dto.price !== undefined) updateData.price = dto.price;

      if (dto.minPrice !== undefined) updateData.minPrice = dto.minPrice;

      if (dto.description !== undefined)
        updateData.description = dto.description;

      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      if (dto.isMonthlyPlan !== undefined)
        updateData.isMonthlyPlan = dto.isMonthlyPlan;

      if (dto.isDailyPlan !== undefined)
        updateData.isDailyPlan = dto.isDailyPlan;

      if (dto.scheduleType !== undefined || dto.availableDays !== undefined) {
        const existing = await tx.plans.findUnique({
          where: { id },
          select: { scheduleType: true, availableDays: true },
        });
        if (!existing) throw new NotFoundException('Plan not found');

        const nextScheduleType = dto.scheduleType ?? existing.scheduleType;
        const nextAvailableDays =
          dto.availableDays ??
          (Array.isArray(existing.availableDays)
            ? (existing.availableDays as string[])
            : undefined);

        this.assertScheduleValid(nextScheduleType, nextAvailableDays);

        updateData.scheduleType = nextScheduleType;
        updateData.availableDays =
          nextScheduleType === ScheduleType.CUSTOM ? nextAvailableDays : null;
      }

      if (dto.lunch !== undefined) updateData.lunch = dto.lunch;

      if (dto.messId) {
        const mess = await tx.mess.findUnique({
          where: { id: dto.messId },
        });

        if (!mess) throw new BadRequestException('Mess not found');

        updateData.messId = dto.messId;
      }

      // Variation update
      if (dto.variationIds?.length) {
        updateData.Variation = {
          set: dto.variationIds.map((id) => ({ id })),
        };
      }

      // Menu update — replaces the full set of linked menus; [] unlinks all
      if (dto.menuIds !== undefined) {
        const targetMessId =
          dto.messId ??
          (
            await tx.plans.findUnique({
              where: { id },
              select: { messId: true },
            })
          )?.messId;
        if (!targetMessId) throw new NotFoundException('Plan not found');
        await this.assertMenusBelongToMess(dto.menuIds, targetMessId);

        updateData.menus = {
          set: dto.menuIds.map((menuId) => ({ id: menuId })),
        };
      }

      // ✅ Add images without removing existing ones
      if (dto.planImages?.length) {
        // fetch existing images
        const existingImages = await tx.planImages.findMany({
          where: { planId: id },
          select: { url: true },
        });

        const existingUrls = new Set(existingImages.map((img) => img.url));

        // filter only new images
        const newImages = dto.planImages.filter(
          (url) => !existingUrls.has(url),
        );

        if (newImages.length) {
          updateData.images = {
            create: newImages.map((url) => ({
              url,
              altText: 'plan-image',
            })),
          };
        }
      }

      const updatedPlan = await tx.plans.update({
        where: { id },
        data: updateData,
        include: {
          Variation: true,
          images: true,
          menus: true,
        },
      });

      return {
        message: 'Plan updated successfully',
        plan: updatedPlan,
      };
    });
  }

  async remove(id: string) {
    const now = new Date();

    // Verify plan exists and is not already deleted
    const plan = await this.prisma.plans.findFirst({
      where: { id, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    return this.prisma.$transaction(async (tx) => {
      // Soft-delete the plan itself
      await tx.plans.update({
        where: { id },
        data: { deletedAt: now, isActive: false },
      });

      // Soft-delete PlanImages
      await tx.planImages.updateMany({
        where: { planId: id, deletedAt: null },
        data: { deletedAt: now },
      });

      // Soft-delete Enquiries linked to this plan
      await tx.enquiry.updateMany({
        where: { planId: id, deletedAt: null },
        data: { deletedAt: now },
      });

      // Fetch active UserSubscriptions for this plan
      const subscriptions = await tx.userSubscriptions.findMany({
        where: { planId: id, deletedAt: null },
        select: { id: true },
      });
      const subscriptionIds = subscriptions.map((s) => s.id);

      if (subscriptionIds.length > 0) {
        // Soft-delete Payments under these subscriptions
        await tx.payments.updateMany({
          where: { subscriptionId: { in: subscriptionIds }, deletedAt: null },
          data: { deletedAt: now },
        });

        // Soft-delete CustomerMessTransactions under these subscriptions
        await tx.customerMessTransaction.updateMany({
          where: { subscriptionId: { in: subscriptionIds }, deletedAt: null },
          data: { deletedAt: now },
        });

        // Soft-delete the UserSubscriptions
        await tx.userSubscriptions.updateMany({
          where: { id: { in: subscriptionIds }, deletedAt: null },
          data: { deletedAt: now, isActive: false },
        });
      }

      // Fetch active Deliveries linked to this plan
      const deliveries = await tx.deliveries.findMany({
        where: { planId: id, deletedAt: null },
        select: { id: true },
      });
      const deliveryIds = deliveries.map((d) => d.id);

      if (deliveryIds.length > 0) {
        // Soft-delete DeliveryVariations
        await tx.deliveryVariation.updateMany({
          where: { deliveryId: { in: deliveryIds }, deletedAt: null },
          data: { deletedAt: now },
        });

        // Soft-delete CustomerMessTransactions linked to these deliveries
        // (those not already deleted via subscription above)
        await tx.customerMessTransaction.updateMany({
          where: { deliveryId: { in: deliveryIds }, deletedAt: null },
          data: { deletedAt: now },
        });

        // Soft-delete Deliveries
        await tx.deliveries.updateMany({
          where: { id: { in: deliveryIds }, deletedAt: null },
          data: { deletedAt: now, isActive: false },
        });
      }

      return {
        message: 'Plan soft-deleted successfully',
        planId: id,
        deletedAt: now,
        cascadeStats: {
          subscriptionsDeleted: subscriptionIds.length,
          deliveriesDeleted: deliveryIds.length,
        },
      };
    });
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

    const plan = await this.prisma.plans.findFirst({
      where: { id: planId, deletedAt: null },
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
    const plans = await this.prisma.plans.findFirst({
      where: { id: planId, deletedAt: null },
    });

    if (!plans) {
      throw new NotFoundException('Plan not found');
    }

    const images = await this.prisma.planImages.findMany({
      where: {
        planId: plans.id,
        deletedAt: null,
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
    const plans = await this.prisma.plans.findFirst({
      where: { id: planId, deletedAt: null },
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDeliveryPriorityDto } from './dto/update-delivery-priority.dto';
import { paginate } from 'src/common/utility/pagination.util';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UpdateUserSubscriptionDto } from './dto/update-user-subscription.dto';


@Injectable()
export class UserSubscriptionsService {
    constructor(private readonly prisma: PrismaService) { }

    async updateDeliveryPriority(
        subscriptionId: string,
        dto: UpdateDeliveryPriorityDto,
    ) {
        const newPriority = dto.deliveryPriority;
        const PRIORITY_OFFSET = 1000000;

        return this.prisma.$transaction(async (tx) => {
            const subscription = await tx.userSubscriptions.findUnique({
                where: { id: subscriptionId },
            });

            if (!subscription) {
                throw new NotFoundException('User subscription not found');
            }

            const { messId, deliveryPriority: oldPriority } = subscription;

            // CASE 1: priority was NULL → assigning first time
            if (oldPriority == null) {
                // Phase 1: move conflicting rows out of the way
                await tx.userSubscriptions.updateMany({
                    where: {
                        messId,
                        deliveryPriority: { gte: newPriority },
                    },
                    data: {
                        deliveryPriority: {
                            increment: PRIORITY_OFFSET,
                        },
                    },
                });

                // Phase 2: normalize back (+1 shift)
                await tx.userSubscriptions.updateMany({
                    where: {
                        messId,
                        deliveryPriority: { gte: newPriority + PRIORITY_OFFSET },
                    },
                    data: {
                        deliveryPriority: {
                            decrement: PRIORITY_OFFSET - 1,
                        },
                    },
                });

                // Phase 3: assign priority
                return tx.userSubscriptions.update({
                    where: { id: subscriptionId },
                    data: { deliveryPriority: newPriority },
                });
            }

            // CASE 2: priority unchanged
            if (oldPriority === newPriority) {
                return subscription;
            }

            // CASE 3: moving UP (5 → 2)
            if (newPriority < oldPriority) {
                await tx.userSubscriptions.updateMany({
                    where: {
                        messId,
                        deliveryPriority: {
                            gte: newPriority,
                            lt: oldPriority,
                        },
                    },
                    data: {
                        deliveryPriority: {
                            increment: PRIORITY_OFFSET,
                        },
                    },
                });

                await tx.userSubscriptions.updateMany({
                    where: {
                        messId,
                        deliveryPriority: {
                            gte: newPriority + PRIORITY_OFFSET,
                        },
                    },
                    data: {
                        deliveryPriority: {
                            decrement: PRIORITY_OFFSET - 1,
                        },
                    },
                });
            }

            // CASE 4: moving DOWN (2 → 5)
            if (newPriority > oldPriority) {
                await tx.userSubscriptions.updateMany({
                    where: {
                        messId,
                        deliveryPriority: {
                            gt: oldPriority,
                            lte: newPriority,
                        },
                    },
                    data: {
                        deliveryPriority: {
                            increment: PRIORITY_OFFSET,
                        },
                    },
                });

                await tx.userSubscriptions.updateMany({
                    where: {
                        messId,
                        deliveryPriority: {
                            gte: oldPriority + 1 + PRIORITY_OFFSET,
                        },
                    },
                    data: {
                        deliveryPriority: {
                            decrement: PRIORITY_OFFSET + 1,
                        },
                    },
                });
            }

            return tx.userSubscriptions.update({
                where: { id: subscriptionId },
                data: { deliveryPriority: newPriority },
            });
        });
    }




    async getAll(
        user: {
            id: string;
            role: Role;
            customerProfileId?: string;
        },
        params: {
            page?: number;
            limit?: number;
            messId?: string;
            isActive?: boolean;
        },
    ) {
        const { page, limit, isActive } = params;
        const where: any = {};

        /**
         * ROLE-BASED VISIBILITY
         */
        switch (user.role) {
            case Role.SUPERADMIN:
                if (params.messId) {
                    where.messId = params.messId;
                }
                break;

            case Role.MESSADMIN: {
                const messAdmin = await this.prisma.messAdminProfile.findUnique({
                    where: { userId: user.id },
                    select: {
                        messes: { select: { id: true } },
                    },
                });

                if (!messAdmin || messAdmin.messes.length === 0) {
                    throw new ForbiddenException('No mess assigned to this admin');
                }

                const messIds = messAdmin.messes.map(m => m.id);
                where.messId = { in: messIds };
                break;
            }

            case Role.USER:
                if (!user.customerProfileId) {
                    throw new ForbiddenException('Customer profile not found');
                }
                where.customerProfileId = user.customerProfileId;
                break;

            default:
                throw new ForbiddenException('Invalid role');
        }

        /**
         * COMMON FILTERS
         */
        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        return paginate({
            prismaModel: this.prisma.userSubscriptions,
            page,
            limit,
            where,
            include: {
                plan: true,
                mess: true,
                UserAddress: true,
                DeliveryPartnerProfile: true,

                // ✅ INCLUDE CUSTOMER + USER DETAILS
                CustomerProfile: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                deliveryPriority: { sort: 'asc', nulls: 'last' },
            },
        });
    }



    /**
     * Get subscription by ID
     */
    async getById(id: string) {
        const subscription = await this.prisma.userSubscriptions.findUnique({
            where: { id },
            include: {
                plan: true,
                mess: true,
                CustomerProfile: true,
                UserAddress: true,
                DeliveryPartnerProfile: true,
                deliveries: true,
            },
        });

        if (!subscription) {
            throw new NotFoundException('User subscription not found');
        }

        return subscription;
    }

    async update(id: string, dto: UpdateUserSubscriptionDto) {
        const existing = await this.prisma.userSubscriptions.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundException('User subscription not found');
        }

        const startDate = dto.start_date
            ? new Date(dto.start_date)
            : undefined;

        const endDate = dto.end_date
            ? new Date(dto.end_date)
            : undefined;

        const pauseStartDate = dto.pause_start_date
            ? new Date(dto.pause_start_date)
            : undefined;

        const pauseEndDate = dto.pause_end_date
            ? new Date(dto.pause_end_date)
            : undefined;

        const cancellationStartDate = dto.cancellation_start_date
            ? new Date(dto.cancellation_start_date)
            : null;

        const cancellationEndDate = dto.cancellation_end_date
            ? new Date(dto.cancellation_end_date)
            : null;


        if (startDate && isNaN(startDate.getTime())) {
            throw new BadRequestException('Invalid start_date');
        }

        if (endDate && isNaN(endDate.getTime())) {
            throw new BadRequestException('Invalid end_date');
        }

        const updated = await this.prisma.userSubscriptions.update({
            where: { id },
            data: {
                ...dto,

                start_date: startDate,
                end_date: endDate,
                pause_start_date: pauseStartDate,
                pause_end_date: pauseEndDate,
                cancellation_start_date: cancellationStartDate,
                cancellation_end_date: cancellationEndDate,
            },
            include: {
                plan: true,
                mess: true,
                CustomerProfile: true,
                UserAddress: true,
                DeliveryPartnerProfile: true,
                deliveries: true,
            },
        });


        return updated;
    }


    async delete(id: string) {
        const existing = await this.prisma.userSubscriptions.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundException('User subscription not found');
        }

        await this.prisma.userSubscriptions.delete({
            where: { id },
        });

        return {
            message: 'User subscription deleted successfully',
        };
    }


}

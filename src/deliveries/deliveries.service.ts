import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryOwnerStatusDto, UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { UpdateVariationStatusDto } from './dto/update-variation-status.dto';
import { AssignDeliveryPartnerDto, AssignDeliveryPartnerPhs2Dto, AssignDeliveryPartnerToDeliveriesDto } from './dto/assign-partner.dto';
import { DeliveryStatus, Role, ScheduleType, VariationStatus } from '@prisma/client';

@Injectable()
export class DeliveriesService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateDeliveryDto) {
        const delivery = await this.prisma.deliveries.create({
            data: {
                date: new Date(dto.date),
                status: dto.status,
                action: dto.action,
                customerId: dto.customerId,
                planId: dto.planId,
                messId: dto.messId,
                partnerId: dto.partnerId,
            },
            include: {
                customer: true,
                plan: true,
                partner: true,
            },
        });
        return delivery;
    }

    async findAll(
        query: {
            page?: number | string;
            limit?: number | string;
            status?: DeliveryStatus;
            date?: string;
            messId?: string;
            partnerId?: string;
            variationId?: string;
        },
        user: {
            id: string;
            role: Role;
            customerProfileId?: string;
            deliveryPartnerProfileId?: string;
            messId?: string;
        },
    ) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;

        const { status, date } = query;

        const where: any = {};

        /* ================= ROLE-BASED VISIBILITY ================= */

        if (user.role === Role.USER) {
            // User → only their deliveries
            where.customerProfileId = user.customerProfileId;
        }

        if (user.role === Role.DELIVERYAGENT) {
            // Delivery agent → only assigned deliveries
            where.partnerId = user.deliveryPartnerProfileId;
        }

        if (user.role === Role.MESSADMIN) {
            // Mess admin → only their mess
            where.messId = user.messId;
        }

        // SUPERADMIN → no restriction

        /* ================= ADDITIONAL FILTERS ================= */

        if (status) {
            where.status = status;
        }

        if (date) {
            const selectedDate = new Date(date);
            const nextDate = new Date(selectedDate);
            nextDate.setDate(selectedDate.getDate() + 1);

            where.date = {
                gte: selectedDate,
                lt: nextDate,
            };
        }

        // Filter by delivery partner (allowed for SUPERADMIN and MESSADMIN)
        if (query.partnerId && (user.role === Role.SUPERADMIN || user.role === Role.MESSADMIN)) {
            where.partnerId = query.partnerId;
        }

        // Filter by mess (allowed for SUPERADMIN only)
        if (query.messId && user.role === Role.SUPERADMIN) {
            where.messId = query.messId;
        }

        // Filter by variation: only deliveries that have this variation
        if (query.variationId) {
            where.deliveryVariations = { some: { variationId: query.variationId } };
        }

        /* ================= QUERY ================= */

        const [deliveries, totalCount] = await this.prisma.$transaction([
            this.prisma.deliveries.findMany({
                where,
                include: {
                    customer: {
                        include: {
                            user: {
                                select: { id: true, name: true, phone: true, email: true },
                            },
                        },
                    },
                    mess: { select: { id: true, name: true } },
                    plan: {
                        select: {
                            id: true,
                            planName: true,
                            price: true,
                            Variation: {
                                select: { id: true, title: true, description: true, isActive: true },
                            },
                        },
                    },
                    partner: {
                        include: {
                            user: {
                                select: { id: true, name: true, phone: true, email: true },
                            },
                        },
                    },
                    deliveryVariations: {
                        include: {
                            variation: {
                                select: { id: true, title: true, description: true },
                            },
                        },
                    },
                },
                orderBy: [
                    { UserSubscriptions: { deliveryPriority: 'asc' } },
                    { date: 'desc' },
                ],
                skip,
                take: limit,
            }),

            this.prisma.deliveries.count({ where }),
        ]);

        /* ================= RESPONSE (UNCHANGED) ================= */

        return {
            message: 'Deliveries fetched successfully',
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            filters: {
                status: status || 'ALL',
                date: date || null,
                variationId: query.variationId || null,
                messId: user.role === Role.SUPERADMIN ? query.messId || null : null,
                partnerId: user.role === Role.SUPERADMIN ? query.partnerId || null : null,
            },
            data: deliveries,
        };
    }





    async findOne(id: string) {
        const delivery = await this.prisma.deliveries.findUnique({
            where: { id },
            include: {
                customer: {
                    include: {
                        user: {
                            select: {
                                id: true, name: true, phone: true, email: true,
                                is_verified: true, is_active: true, role: true,
                                createdAt: true, updatedAt: true,
                            },
                        },
                        addresses: true,
                        Wallet: true,
                    },
                },
                plan: {
                    include: {
                        images: true,
                        Variation: true,
                    },
                },
                partner: {
                    include: {
                        user: {
                            select: {
                                id: true, name: true, phone: true, email: true,
                                is_verified: true, is_active: true, role: true,
                                createdAt: true, updatedAt: true,
                            },
                        },
                    },
                },
                mess: {
                    include: {
                        images: true, foodTypes: true, tags: true,
                        District: true, categories: true,
                    },
                },
                deliveryVariations: {
                    include: {
                        variation: {
                            select: { id: true, title: true, description: true, isActive: true },
                        },
                    },
                },
            },
        });
        if (!delivery) throw new NotFoundException('Delivery not found');
        return delivery;
    }

    async update(id: string, dto: UpdateDeliveryDto) {
        const existing = await this.prisma.deliveries.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Delivery not found');

        return this.prisma.deliveries.update({
            where: { id },
            data: {
                ...dto,
                date: dto.date ? new Date(dto.date) : existing.date,
            },
            include: {
                customer: true,
                plan: true,
                partner: true,
            },
        });
    }

    async remove(id: string) {
        const existing = await this.prisma.deliveries.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Delivery not found');

        return this.prisma.deliveries.delete({ where: { id } });
    }

    async updateStatus(id: string, updatestatusdto: UpdateDeliveryStatusDto) {
        const existing = await this.prisma.deliveries.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Delivery not found');
        return this.prisma.deliveries.update({
            where: { id },
            data: { status: updatestatusdto.status },
            include: {
                plan: { select: { id: true, planName: true, Variation: { select: { id: true, title: true, description: true } } } },
                partner: { include: { user: { select: { id: true, name: true, phone: true } } } },
                deliveryVariations: { include: { variation: { select: { id: true, title: true, description: true } } } },
            },
        });
    }

    /**
     * Update the status of one variation within a delivery.
     * Accessible by MESSADMIN (own mess) and DELIVERYAGENT (assigned to the delivery).
     */
    async updateVariationStatus(
        deliveryId: string,
        variationId: string,
        dto: UpdateVariationStatusDto,
        requestingUserId: string,
    ) {
        // Find the DeliveryVariation record
        const dv = await this.prisma.deliveryVariation.findUnique({
            where: { deliveryId_variationId: { deliveryId, variationId } },
            include: {
                delivery: {
                    include: {
                        mess: { include: { messAdmins: true } },
                        partner: { include: { user: { select: { id: true } } } },
                    },
                },
            },
        });
        if (!dv) throw new NotFoundException('Delivery variation not found');

        const delivery = dv.delivery;

        // Check access: must be mess admin of this delivery's mess, OR the assigned partner
        const isMessAdmin = delivery.mess?.messAdmins?.some(a => a.userId === requestingUserId);
        const isAssignedPartner = delivery.partner?.user?.id === requestingUserId;

        if (!isMessAdmin && !isAssignedPartner) {
            throw new BadRequestException('You do not have permission to update this delivery variation');
        }

        return this.prisma.deliveryVariation.update({
            where: { deliveryId_variationId: { deliveryId, variationId } },
            data: { status: dto.status },
            include: {
                variation: { select: { id: true, title: true, description: true } },
            },
        });
    }

    /**
     * PATCH /deliveries/:id/owner-status
     * Mess admin / superadmin can mark a delivery as COMPLETED or UNDELIVERED.
     */
    async updateOwnerStatus(id: string, dto: UpdateDeliveryOwnerStatusDto, requestingUserId: string) {
        const delivery = await this.prisma.deliveries.findUnique({
            where: { id },
            include: { mess: { include: { messAdmins: true } } },
        });
        if (!delivery) throw new NotFoundException('Delivery not found');

        // Verify the requesting user is an admin of this mess
        const isMessAdmin = delivery.mess?.messAdmins?.some(a => a.userId === requestingUserId);
        if (!isMessAdmin) {
            // SUPERADMIN bypass is handled at the controller (role guard)
            // If not a mess admin of this mess, reject
            throw new BadRequestException('You are not an admin of the mess this delivery belongs to');
        }

        return this.prisma.deliveries.update({
            where: { id },
            data: { status: dto.status },
            include: {
                plan: { select: { id: true, planName: true, Variation: { select: { id: true, title: true, description: true } } } },
                partner: { include: { user: { select: { id: true, name: true, phone: true } } } },
            },
        });
    }

    async updatePartner(id: string, updatestatusdto: AssignDeliveryPartnerDto) {
        const { partnerId } = updatestatusdto; // must be DeliveryPartnerProfile.id

        // 1️⃣ Validate delivery
        const delivery = await this.prisma.deliveries.findUnique({ where: { id } });
        if (!delivery) {
            throw new NotFoundException('Delivery not found');
        }

        // 2️⃣ Validate partner (check in DeliveryPartnerProfile)
        const partner = await this.prisma.deliveryPartnerProfile.findUnique({
            where: { id: partnerId },
        });
        if (!partner) {
            throw new NotFoundException('Invalid partner ID — not found in DeliveryPartnerProfile');
        }

        // 3️⃣ Update
        return this.prisma.deliveries.update({
            where: { id },
            data: {
                partnerId,
                status: DeliveryStatus.PENDING,
            },
            include: {
                partner: {
                    include: { user: true }, // optional: to fetch partner name/email
                },
            },
        });
    }

    async createDeliveriesForDate(inputDate: Date) {
        // Normalize date to midnight (avoid time mismatches)
        const dateOnly = new Date(inputDate);
        dateOnly.setHours(0, 0, 0, 0);

        // 1️⃣ Get all active subscriptions where the date falls within start_date and end_date
        const activeSubscriptions = await this.prisma.userSubscriptions.findMany({
            where: {
                is_active: true,
                start_date: { lte: dateOnly },
                end_date: { gte: dateOnly },
            },
            include: {
                CustomerProfile: true,
                plan: true,
                DeliveryPartnerProfile: true,
            },
        });

        if (activeSubscriptions.length === 0) {
            return { message: 'No active subscriptions found for this date', createdCount: 0 };
        }

        // ✅ Explicitly define array type for Prisma createMany input
        const deliveriesToCreate: {
            date: Date;
            status: DeliveryStatus;
            customerId: string;
            planId: string;
            messId: string;
            partnerId?: string | null;
        }[] = [];

        // 2️⃣ Filter out subscriptions that already have a delivery on that date
        for (const sub of activeSubscriptions) {
            const existingDelivery = await this.prisma.deliveries.findFirst({
                where: {
                    date: dateOnly,
                    customerId: sub.customerProfileId!,
                    planId: sub.planId!,
                },
            });

            if (!existingDelivery) {
                deliveriesToCreate.push({
                    date: dateOnly,
                    status: DeliveryStatus.PENDING,
                    customerId: sub.customerProfileId!,
                    planId: sub.planId!,
                    partnerId: sub.deliveryPartnerProfileId || null,
                    messId: sub.messId,
                });
            }
        }

        // 3️⃣ Create deliveries, then create their variation rows
        if (deliveriesToCreate.length > 0) {
            // Create deliveries individually (to get IDs back for variation linking)
            const createdDeliveries = await this.prisma.$transaction(
                deliveriesToCreate.map(data => this.prisma.deliveries.create({ data, select: { id: true, planId: true } }))
            );

            // Group by planId, then create DeliveryVariation rows per plan
            const planIds = [...new Set(createdDeliveries.map(d => d.planId))];
            for (const pid of planIds) {
                const idsForPlan = createdDeliveries.filter(d => d.planId === pid).map(d => d.id);
                await this.createDeliveryVariationsByIds(pid, idsForPlan);
            }
        }

        return {
            message: `Deliveries created for ${deliveriesToCreate.length} subscriptions on ${dateOnly.toDateString()}`,
            createdCount: deliveriesToCreate.length,
        };
    }


    async PartnerRecentDeliveries(agentId: string, limit = 5, messId?: string) {
        try {
            if (!agentId) {
                throw new BadRequestException('Agent ID is required');
            }

            const agent = await this.prisma.deliveryPartnerProfile.findUnique({
                where: { id: agentId },
            });

            if (!agent) {
                throw new BadRequestException('Agent not found');
            }

            if (agent.messId !== messId) {
                throw new BadRequestException('Agent does not belong to the specified mess');
            }


            // 1️⃣ Build dynamic filter
            const whereClause: any = {
                partnerId: agentId,
                status: DeliveryStatus.DELIVERED,
            };

            // If messId provided, filter deliveries by that mess
            if (messId) {
                whereClause.plan = { messId }; // since plan is related to mess
            }

            // 2️⃣ Fetch recent completed deliveries
            const deliveries = await this.prisma.deliveries.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    date: true,
                    status: true,
                    createdAt: true,
                    plan: true,
                },
            });

            return {
                message: 'Recent deliveries fetched successfully',
                count: deliveries.length,
                data: deliveries,
            };
        } catch (error) {
            console.error('Error fetching recent deliveries:', error);
            throw new InternalServerErrorException('Failed to fetch recent deliveries');
        }
    }


    async CustomerRecentDeliveries(customerId: string, limit = 5, messId?: string) {
        try {
            if (!customerId) {
                throw new BadRequestException('Customer ID is required');
            }
            const customer = await this.prisma.customerProfile.findUnique({
                where: { id: customerId },
            });

            if (!customer) {
                throw new BadRequestException('customer not found');
            }


            // 1️⃣ Build dynamic filter
            const whereClause: any = {
                customerId,
                status: DeliveryStatus.DELIVERED,
            };

            if (messId) {
                whereClause.plan = { messId }; // filter deliveries whose plan belongs to that mess
            }

            // 2️⃣ Fetch recent completed deliveries
            const deliveries = await this.prisma.deliveries.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    date: true,
                    status: true,
                    createdAt: true,
                    plan: true,
                },
            });

            return {
                message: 'Recent deliveries fetched successfully',
                count: deliveries.length,
                data: deliveries,
            };
        } catch (error) {
            console.error('Error fetching recent deliveries:', error);
            throw new InternalServerErrorException('Failed to fetch recent deliveries');
        }
    }



    // Phase 2 updation.
    //This is for Mess Admin to Assign Delivery partner to plan user have purchased.
    async AssignPartner(dto: AssignDeliveryPartnerPhs2Dto, userId: string) {
        // The user accessing this api would be mess owner.
        // check messid of subscription belongs to the mess admin accessing this function
        // create delivery instances after assigning the delivery partner.
        const { subscptnId, partnerId } = dto
        const partner = await this.prisma.deliveryPartnerProfile.findUnique({
            where: { id: partnerId }
        })
        if (!partner) {
            throw new NotFoundException("Parnter not found")
        }
        const subscptn = await this.prisma.userSubscriptions.findFirst({
            where: { id: subscptnId, mess: { messAdmins: { some: { id: userId } } } },
            include: {
                mess: true,
                plan: true,
            }
        })
        if (!subscptn) {
            throw new NotFoundException("subscription not found")
        }

        await this.prisma.userSubscriptions.update({
            where: { id: subscptn.id },
            data: { deliveryPartnerProfileId: partnerId }
        })

        // 6️⃣ Create Deliveries based on scheduleType
        const deliveriesToCreate: any[] = [];
        const currentDate = new Date(subscptn.start_date);

        if (subscptn.scheduleType === ScheduleType.EVERYDAY) {
            // ➤ Create deliveries for each day in range
            if (!subscptn.end_date) {
                throw new BadRequestException("Subscription end_date is missing");
            }
            while (currentDate <= subscptn.end_date) {
                deliveriesToCreate.push({
                    date: new Date(currentDate),
                    customerId: subscptn.customerProfileId,
                    planId: subscptn.planId,
                    subscriptionId: subscptn.id,
                    status: DeliveryStatus.PENDING,
                    partnerId: partner.id,
                    messId: subscptn.messId,
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else if (subscptn.scheduleType === ScheduleType.CUSTOM && Array.isArray(subscptn.selectedDays)) {
            // ➤ Create deliveries only on selected weekdays
            const selectedDaysUpper = subscptn.selectedDays.map((d) => String(d).toUpperCase());
            const weekdayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

            if (!subscptn.end_date) {
                throw new BadRequestException("Subscription end_date is missing");
            }
            while (currentDate <= subscptn.end_date) {
                const dayName = weekdayMap[currentDate.getDay()];
                if (selectedDaysUpper.includes(dayName)) {
                    deliveriesToCreate.push({
                        date: new Date(currentDate),
                        customerId: subscptn.customerProfileId,
                        planId: subscptn.planId,
                        subscriptionId: subscptn.id,
                        status: DeliveryStatus.PENDING,
                        partnerId: partner.id,
                        messId: subscptn.messId,
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        if (deliveriesToCreate.length > 0) {
            await this.prisma.deliveries.createMany({ data: deliveriesToCreate });
            // Auto-create DeliveryVariation rows for each delivery × plan variation
            const createdDeliveries = await this.prisma.deliveries.findMany({
                where: { subscriptionId: subscptn.id, date: { in: deliveriesToCreate.map(d => d.date) } },
                select: { id: true },
            });
            await this.createDeliveryVariationsByIds(subscptn.planId, createdDeliveries.map(d => d.id));
        }
        // ✅ Return success response
        return {
            message: "Delivery Partner Assigned Succesfully",
            data: {
                subscptn,
                deliveriesCreated: deliveriesToCreate.length,
            },
        };
    }

    async assignPartnerToDeliveries(
        dto: AssignDeliveryPartnerToDeliveriesDto,
        userId: string,
    ) {
        const { partnerId, deliveryIds, subscriptionId, fromDate, toDate } = dto;

        // 1️⃣ Validate partner
        const partner = await this.prisma.deliveryPartnerProfile.findUnique({
            where: { id: partnerId },
        });

        if (!partner) {
            throw new NotFoundException('Delivery partner not found');
        }

        // 2️⃣ Build delivery filter
        const where: any = {
            mess: {
                messAdmins: {
                    some: { id: userId },
                },
            },
        };

        if (deliveryIds?.length) {
            where.id = { in: deliveryIds };
        }

        if (subscriptionId) {
            where.subscriptionId = subscriptionId;
        }

        if (fromDate || toDate) {
            where.date = {};
            if (fromDate) where.date.gte = new Date(fromDate);
            if (toDate) where.date.lte = new Date(toDate);
        }

        // 3️⃣ Verify deliveries exist
        const deliveries = await this.prisma.deliveries.findMany({
            where,
            select: { id: true },
        });

        if (!deliveries.length) {
            throw new NotFoundException('No deliveries found for reassignment');
        }

        // 4️⃣ Update deliveries
        const result = await this.prisma.deliveries.updateMany({
            where: {
                id: { in: deliveries.map(d => d.id) },
            },
            data: {
                partnerId: partnerId,
                updatedAt: new Date(),
            },
        });

        return {
            message: 'Delivery partner reassigned successfully',
            data: {
                totalUpdated: result.count,
                partnerId,
            },
        };
    }



    /**
     * Private helper: given a planId and a list of delivery IDs,
     * fetch the plan's active variations and create one DeliveryVariation
     * row per delivery x variation (skipping any duplicates).
     */
    private async createDeliveryVariationsByIds(
        planId: string,
        deliveryIds: string[],
    ): Promise<void> {
        if (deliveryIds.length === 0) return;

        const plan = await this.prisma.plans.findUnique({
            where: { id: planId },
            select: {
                Variation: {
                    where: { isActive: true },
                    select: { id: true },
                },
            },
        });
        const variationIds = plan?.Variation?.map(v => v.id) ?? [];
        if (variationIds.length === 0) return;

        const records = deliveryIds.flatMap(did =>
            variationIds.map(vid => ({
                deliveryId: did,
                variationId: vid,
                status: VariationStatus.PENDING,
            }))
        );

        await this.prisma.deliveryVariation.createMany({
            data: records,
            skipDuplicates: true,
        });
    }

    /**
     * Analytics: variation delivery counts grouped by variation, plan, and date.
     * Access: SUPERADMIN (any mess) | MESSADMIN (own mess only).
     */
    async getVariationDeliveryCounts(
        query: {
            messId: string;
            fromDate: string;
            toDate: string;
            planId?: string;
            status?: VariationStatus;
        },
        user: { id: string; role: Role; messId?: string },
    ) {
        const { messId, fromDate, toDate, planId, status } = query;

        // ── Access control ─────────────────────────────────────────────────────
        if (user.role === Role.MESSADMIN && user.messId !== messId) {
            throw new BadRequestException('You do not have access to this mess');
        }

        // ── Normalise date range ───────────────────────────────────────────────
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);

        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            throw new BadRequestException('Invalid fromDate or toDate. Expected YYYY-MM-DD');
        }
        if (from > to) {
            throw new BadRequestException('fromDate must be before or equal to toDate');
        }

        // ── Fetch DeliveryVariation rows with all needed joins ─────────────────
        const rows = await this.prisma.deliveryVariation.findMany({
            where: {
                ...(status && { status }),
                delivery: {
                    messId,
                    date: { gte: from, lte: to },
                    ...(planId && { planId }),
                },
            },
            select: {
                id: true,
                status: true,
                variationId: true,
                variation: { select: { id: true, title: true } },
                delivery: {
                    select: {
                        id: true,
                        date: true,
                        planId: true,
                        plan: { select: { id: true, planName: true } },
                    },
                },
            },
            orderBy: { delivery: { date: 'asc' } },
        });

        // ── Helper: blank status bucket ────────────────────────────────────────
        const blankStatus = (): Record<VariationStatus, number> => ({
            PENDING: 0,
            DELIVERED: 0,
            COMPLETED: 0,
            UNDELIVERED: 0,
        });

        const dateStr = (d: Date) => d.toISOString().split('T')[0];

        // ── Build byVariation ─────────────────────────────────────────────────
        const varMap = new Map<
            string,
            {
                variationId: string;
                variationTitle: string;
                totalCount: number;
                byStatus: Record<VariationStatus, number>;
                planMap: Map<string, { planId: string; planName: string; count: number; byStatus: Record<VariationStatus, number> }>;
                dateMap: Map<string, { date: string; count: number; byStatus: Record<VariationStatus, number> }>;
            }
        >();

        // ── Build byPlan ──────────────────────────────────────────────────────
        const planMap = new Map<
            string,
            {
                planId: string;
                planName: string;
                totalDeliveries: number;
                varMap: Map<string, { variationId: string; variationTitle: string; count: number }>;
            }
        >();

        // ── Build byDate ──────────────────────────────────────────────────────
        const dateMap = new Map<
            string,
            {
                date: string;
                totalDeliveries: number;
                varMap: Map<string, { variationId: string; variationTitle: string; count: number }>;
            }
        >();

        // Track distinct delivery IDs for summary totals
        const allDeliveryIds = new Set<string>();

        for (const row of rows) {
            const vid = row.variationId;
            const vtitle = row.variation.title;
            const pid = row.delivery.planId;
            const pname = row.delivery.plan.planName;
            const dkey = dateStr(row.delivery.date);
            const st = row.status as VariationStatus;

            allDeliveryIds.add(row.delivery.id);

            // ── byVariation ────────────────────────────────────────────────────
            if (!varMap.has(vid)) {
                varMap.set(vid, {
                    variationId: vid,
                    variationTitle: vtitle,
                    totalCount: 0,
                    byStatus: blankStatus(),
                    planMap: new Map(),
                    dateMap: new Map(),
                });
            }
            const ve = varMap.get(vid)!;
            ve.totalCount++;
            ve.byStatus[st]++;

            // variation → plan breakdown
            if (!ve.planMap.has(pid)) {
                ve.planMap.set(pid, { planId: pid, planName: pname, count: 0, byStatus: blankStatus() });
            }
            const vpe = ve.planMap.get(pid)!;
            vpe.count++;
            vpe.byStatus[st]++;

            // variation → date breakdown
            if (!ve.dateMap.has(dkey)) {
                ve.dateMap.set(dkey, { date: dkey, count: 0, byStatus: blankStatus() });
            }
            const vde = ve.dateMap.get(dkey)!;
            vde.count++;
            vde.byStatus[st]++;

            // ── byPlan ─────────────────────────────────────────────────────────
            if (!planMap.has(pid)) {
                planMap.set(pid, { planId: pid, planName: pname, totalDeliveries: 0, varMap: new Map() });
            }
            const pe = planMap.get(pid)!;
            pe.totalDeliveries++;
            if (!pe.varMap.has(vid)) {
                pe.varMap.set(vid, { variationId: vid, variationTitle: vtitle, count: 0 });
            }
            pe.varMap.get(vid)!.count++;

            // ── byDate ─────────────────────────────────────────────────────────
            if (!dateMap.has(dkey)) {
                dateMap.set(dkey, { date: dkey, totalDeliveries: 0, varMap: new Map() });
            }
            const de = dateMap.get(dkey)!;
            de.totalDeliveries++;
            if (!de.varMap.has(vid)) {
                de.varMap.set(vid, { variationId: vid, variationTitle: vtitle, count: 0 });
            }
            de.varMap.get(vid)!.count++;
        }

        // ── Serialise ─────────────────────────────────────────────────────────
        const byVariation = [...varMap.values()].map((v) => ({
            variationId: v.variationId,
            variationTitle: v.variationTitle,
            totalCount: v.totalCount,
            byStatus: v.byStatus,
            byPlan: [...v.planMap.values()],
            byDate: [...v.dateMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
        }));

        const byPlan = [...planMap.values()].map((p) => ({
            planId: p.planId,
            planName: p.planName,
            totalDeliveries: p.totalDeliveries,
            variations: [...p.varMap.values()],
        }));

        const byDate = [...dateMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, d]) => ({
                date: d.date,
                totalDeliveries: d.totalDeliveries,
                variations: [...d.varMap.values()],
            }));

        return {
            messId,
            fromDate,
            toDate,
            filters: {
                planId: planId ?? null,
                status: status ?? null,
            },
            summary: {
                totalDeliveries: allDeliveryIds.size,
                totalVariationDeliveries: rows.length,
            },
            byVariation,
            byPlan,
            byDate,
        };
    }

}

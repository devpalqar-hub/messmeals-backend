import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { AssignDeliveryPartnerDto, AssignDeliveryPartnerPhs2Dto } from './dto/assign-partner.dto';
import { DeliveryStatus, ScheduleType } from '@prisma/client';
import { tr } from '@faker-js/faker';

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

    async findAll(query: {
        page?: number | string;
        limit?: number | string;
        status?: DeliveryStatus;
        date?: string;
        messId?: string;
        partnerId?: string;   // ✅ delivery agent profileId
    }) {
        // 1️⃣ Convert and set defaults
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;

        const { status, date, messId, partnerId } = query;

        // 2️⃣ Build filters dynamically
        const where: any = {};

        // Filter by partner/delivery agent
        if (partnerId) {
            where.partnerId = partnerId;
        }

        // Filter by messId
        if (messId) {
            where.messId = messId;
        }

        if (status) {
            where.status = status;
        }

        // Filter by specific date
        if (date) {
            const selectedDate = new Date(date);
            const nextDate = new Date(selectedDate);
            nextDate.setDate(selectedDate.getDate() + 1);

            where.date = {
                gte: selectedDate,
                lt: nextDate,
            };
        }

        // 3️⃣ Fetch data + count
        const [deliveries, totalCount] = await this.prisma.$transaction([
            this.prisma.deliveries.findMany({
                where,
                include: {
                    customer: {
                        include: {
                            user: { select: { id: true, name: true } },
                        },
                    },
                    mess: { select: { id: true, name: true } },
                    plan: { select: { id: true, planName: true, price: true } },
                    partner: {
                        include: { user: true }, // delivery partner user details
                    },
                },
                orderBy: { date: 'desc' },
                skip,
                take: limit,
            }),

            this.prisma.deliveries.count({ where }),
        ]);

        // 4️⃣ Response
        return {
            message: 'Deliveries fetched successfully',
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            filters: {
                status: status || 'ALL',
                date: date || null,
                messId: messId || null,
                partnerId: partnerId || null,
            },
            data: deliveries,
        };
    }





    async findOne(id: string) {
        const delivery = await this.prisma.deliveries.findUnique({
            where: { id },
            include: {
                customer: true,
                plan: true,
                partner: true,
                mess: true,
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
        return this.prisma.deliveries.update({
            where: { id: id },
            data: {
                status: updatestatusdto.status,
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

        // 3️⃣ Create all new deliveries in a single transaction
        if (deliveriesToCreate.length > 0) {
            await this.prisma.$transaction(
                deliveriesToCreate.map((data) => this.prisma.deliveries.create({ data }))
            );
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
            await this.prisma.deliveries.createMany({
                data: deliveriesToCreate,
            });
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


}

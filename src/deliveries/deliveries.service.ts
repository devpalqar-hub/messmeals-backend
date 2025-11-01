import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { AssignDeliveryPartnerDto } from './dto/assign-partner.dto';
import { DeliveryStatus } from '@prisma/client';
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
        date?: string; // 🆕 for exact date
    }) {
        // 1️⃣ Convert and set defaults
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const skip = (page - 1) * limit;
        const take = limit;

        const { status, date, } = query;

        // 2️⃣ Build filters dynamically
        const where: any = {};

        if (status) where.status = status;

        // 🆕 Filter by a specific date
        if (date) {
            const selectedDate = new Date(date);
            const nextDate = new Date(selectedDate);
            nextDate.setDate(selectedDate.getDate() + 1);

            where.date = {
                gte: selectedDate,
                lt: nextDate,
            };
        }

        // 3️⃣ Fetch data + total count in a transaction
        const [deliveries, totalCount] = await this.prisma.$transaction([
            this.prisma.deliveries.findMany({
                where,
                include: {
                    customer: {
                        include: {
                            user: true,
                            userSubscriptions: true,

                        },
                    },
                    mess: {
                        select: { id: true, name: true }
                    },
                    plan: true,
                    partner: {
                        include: { user: true },
                    },
                },
                orderBy: { date: 'desc' },
                skip,
                take,
            }),
            this.prisma.deliveries.count({ where }),
        ]);

        // 4️⃣ Return formatted response
        return {
            message: 'Deliveries fetched successfully',
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            filters: {
                status: status || 'ALL',
                date: date || null,
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


    async PartnerRecentDeliveries(agentId: string, limit = 5) {
        try {
            if (!agentId) {
                throw new BadRequestException('Agent ID is required');
            }
            const agent = await this.prisma.deliveryPartnerProfile.findUnique({
                where: { id: agentId }
            })
            // 1️⃣ Validate input
            if (!agent) {
                throw new BadRequestException('Agent not found');
            }
            // 2️⃣ Fetch recent completed deliveries with related details
            const deliveries = await this.prisma.deliveries.findMany({
                where: {
                    partnerId: agentId,
                    status: DeliveryStatus.DELIVERED,
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    date: true,
                    status: true,
                    createdAt: true,
                    plan: true
                }
            });
            return {
                message: 'Recent deliveries fetched successfully',
                count: deliveries.length,
                data: deliveries,
            };
        } catch (error) {
            console.error('Error fetching recent deliveries:', error);
            throw new InternalServerErrorException(
                'Failed to fetch recent deliveries'
            );
        }
    }

    async CustomerRecentDeliveries(customerId: string, limit = 5) {
        try {
            // 1️⃣ Validate input
            if (!customerId) {
                throw new BadRequestException('Customer ID is required');
            }
            // 2️⃣ Fetch recent completed deliveries with related details
            const deliveries = await this.prisma.deliveries.findMany({
                where: {
                    customerId: customerId,
                    status: DeliveryStatus.DELIVERED,
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    date: true,
                    status: true,
                    createdAt: true,
                    plan: true
                }
            });
            return {
                message: 'Recent deliveries fetched successfully',
                count: deliveries.length,
                data: deliveries,
            };
        } catch (error) {
            console.error('Error fetching recent deliveries:', error);
            throw new InternalServerErrorException(
                'Failed to fetch recent deliveries'
            );
        }
    }


    async estimation() { }


}

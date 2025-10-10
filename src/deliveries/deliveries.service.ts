import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { AssignDeliveryPartnerDto } from './dto/assign-partner.dto';
import { DeliveryStatus } from '@prisma/client';

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

    async findAll(query: { page?: number | string; limit?: number | string; status?: DeliveryStatus }) {
        // 1️⃣ Convert and set defaults
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const status = query.status;

        // 2️⃣ Pagination
        const skip = (page - 1) * limit;
        const take = limit;

        // 3️⃣ Build filters
        const where: any = {};
        if (status) where.status = status;

        // 4️⃣ Fetch data + total count
        const [deliveries, totalCount] = await this.prisma.$transaction([
            this.prisma.deliveries.findMany({
                where,
                include: {
                    customer: {
                        include: { user: true },
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

        // 5️⃣ Return paginated result
        return {
            message: 'Deliveries fetched successfully',
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
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
                status: 'DISPATCHED',
            },
            include: {
                partner: {
                    include: { user: true }, // optional: to fetch partner name/email
                },
            },
        });
    }

}

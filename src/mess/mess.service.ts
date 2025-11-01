import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMessDto, UpdateMessDto } from './dto/create-mess.dto';

@Injectable()
export class MessService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateMessDto) {
        const mess = await this.prisma.mess.create({
            data: {
                name: dto.name,
                description: dto.description,
                address: dto.address,
                phone: dto.phone,
                email: dto.email,
                is_active: dto.is_active ?? true,
            },
        });

        return {
            message: 'Mess created successfully',
            data: mess,
        };
    }

    async findAll(page: number = 1, limit: number = 10, search?: string) {
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
            ];
        }

        const [messes, total] = await this.prisma.$transaction([
            this.prisma.mess.findMany({
                skip,
                take: limit,
                where,
                include: {
                    plans: {
                        select: {
                            id: true,
                            planName: true,
                            price: true,
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
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.mess.count({ where }),
        ]);

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
            },
            include: {
                plans: true,
                messAdmins: {
                    include: {
                        user: true,
                    },
                },
            },
        });

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

}

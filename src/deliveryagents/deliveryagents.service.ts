import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DeliveryAgentCreateDto, DeliveryAgentUpdateDto } from './dto/deliveryagents-create.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { DeliveryStatus, Roles } from '@prisma/client';
import { contains } from 'class-validator';
@Injectable()
export class DeliveryAgentService {
    constructor(private prisma: PrismaService) { }

    // Create Delivery Agent + Profile
    async create(dto: DeliveryAgentCreateDto) {
        const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existingEmail) throw new BadRequestException('Email already registered');

        const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
        if (existingPhone) throw new BadRequestException('Phone number already registered');

        // ✅ Validate mess existence
        const messExists = await this.prisma.mess.findUnique({
            where: { id: dto.messId },
        });
        if (!messExists) throw new BadRequestException('Mess not found');

        // ✅ Create User + Partner Profile with messId
        return this.prisma.user.create({
            data: {
                name: dto.name,
                phone: dto.phone,
                email: dto.email,
                role: Roles.DELIVERYAGENT,
                is_active: dto.is_active,
                deliveryPartnerProfile: {
                    create: {
                        address: dto.address,
                        deliveryRegion: dto.deliverAgentRegion,
                        messId: dto.messId, // 👈 added
                    },
                },
            },
            include: { deliveryPartnerProfile: true },
        });
    }



    async findAll(page = 1, limit = 10, search?: string, messId?: string) {
        const skip = (page - 1) * limit;

        // 🔍 Dynamic where condition
        const whereCondition: any = {
            role: Roles.DELIVERYAGENT,
            ...(search && {
                name: { contains: search.toLocaleLowerCase() },
            }),
            ...(messId && {
                deliveryPartnerProfile: { messId },
            }),
        };

        // 🧩 Fetch paginated delivery agents and total count
        const [agents, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where: whereCondition,
                include: {
                    deliveryPartnerProfile: {
                        include: {
                            deliveries: true,
                            mess: { select: { id: true, name: true } },
                        },
                    },
                },
                orderBy: { name: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.user.count({ where: whereCondition }),
        ]);

        // 📊 Compute stats for each agent
        const agentsWithStats = agents.map((agent) => {
            const deliveries = agent.deliveryPartnerProfile?.deliveries ?? [];

            const totalDeliveries = deliveries.length;
            const completedDeliveries = deliveries.filter(
                (d) => d.status === DeliveryStatus.DELIVERED
            ).length;
            const pendingDeliveries = deliveries.filter(
                (d) => d.status === DeliveryStatus.PENDING
            ).length;
            const totalEarnings = completedDeliveries * 100; // Example logic

            return {
                id: agent.id,
                name: agent.name,
                email: agent.email,
                phone: agent.phone,
                is_active: agent.is_active,
                deliveryPartnerProfile: {
                    id: agent.deliveryPartnerProfile?.id,
                    address: agent.deliveryPartnerProfile?.address,
                    deliveryRegion: agent.deliveryPartnerProfile?.deliveryRegion,
                    messId: agent.deliveryPartnerProfile?.mess?.id,
                },
                stats: {
                    totalDeliveries,
                    completedDeliveries,
                    pendingDeliveries,
                    totalEarnings,
                },
            };
        });

        const totalPages = Math.ceil(total / limit);

        return {
            message: 'Delivery agents fetched successfully',
            currentPage: page,
            totalPages,
            totalRecords: total,
            data: agentsWithStats,
        };
    }



    // Get delivery agent by ID
    async getById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                deliveryPartnerProfile: {
                    include: {
                        deliveries: true,
                        mess: { select: { id: true } },
                        _count: { select: { deliveries: true } },
                    },
                },
            },
        });

        if (!user || user.role !== Roles.DELIVERYAGENT) {
            throw new NotFoundException('Delivery agent not found');
        }

        // 🧮 Compute delivery stats
        const deliveries = user.deliveryPartnerProfile?.deliveries || [];

        const totalDeliveries = deliveries.length;
        const completedDeliveries = deliveries.filter(
            (d) => d.status === DeliveryStatus.DELIVERED,
        ).length;
        const pendingDeliveries = deliveries.filter(
            (d) => d.status === DeliveryStatus.PENDING,
        ).length;
        const totalEarnings = completedDeliveries * 100; // Adjust if you have dynamic rates

        // 🧩 Format response to match findAll
        const formattedUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            is_active: user.is_active,
            deliveryPartnerProfile: {
                id: user.deliveryPartnerProfile?.id,
                address: user.deliveryPartnerProfile?.address,
                deliveryRegion: user.deliveryPartnerProfile?.deliveryRegion,
            },
            stats: {
                totalDeliveries,
                completedDeliveries,
                pendingDeliveries,
                totalEarnings,
            },
        };

        return {
            message: 'Delivery agent fetched successfully',
            data: formattedUser,
        };
    }


    async updateDeliveryAgent(id: string, dto: DeliveryAgentUpdateDto) {
        // 1️⃣ Verify user and role
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { deliveryPartnerProfile: true },
        });
        if (!user || user.role !== Roles.DELIVERYAGENT) {
            throw new NotFoundException('Delivery agent not found');
        }
        // 2️⃣ Prepare update objects
        const userUpdateData: any = {};
        const profileUpdateData: any = {};
        if (dto.name !== undefined) userUpdateData.name = dto.name;
        if (dto.is_active !== undefined) userUpdateData.is_active = dto.is_active;
        if (dto.address !== undefined) profileUpdateData.address = dto.address;
        if (dto.deliverAgentRegion !== undefined)
            profileUpdateData.deliverAgentRegion = dto.deliverAgentRegion;
        if (dto.messId !== undefined) profileUpdateData.messId = dto.messId;

        // 3️⃣ Execute updates in a transaction (atomic)
        await this.prisma.$transaction(async (tx) => {
            if (Object.keys(userUpdateData).length > 0) {
                await tx.user.update({
                    where: { id },
                    data: userUpdateData,
                });
            }
            if (
                user.deliveryPartnerProfile &&
                Object.keys(profileUpdateData).length > 0
            ) {
                await tx.deliveryPartnerProfile.update({
                    where: { id: user.deliveryPartnerProfile.id },
                    data: profileUpdateData,
                });
            }
        });
        // 4️⃣ Return updated agent with details
        const updatedAgent = await this.prisma.user.findUnique({
            where: { id },
            include: {
                deliveryPartnerProfile: {
                    include: {
                        deliveries: true,
                        _count: { select: { deliveries: true } },
                    },
                },
            },
        });
        return {
            message: 'Delivery agent updated successfully',
            data: updatedAgent,
        };
    }


    // Delete Delivery Agent
    async delete(id: string) {
        const existingUser = await this.prisma.user.findUnique({
            where: { id },
        });
        if (!existingUser || existingUser.role !== Roles.DELIVERYAGENT) {
            throw new NotFoundException('Delivery agent not found');
        }
        // Delete the profile first due to FK constraint
        await this.prisma.deliveryPartnerProfile.delete({
            where: { userId: id },
        });
        return this.prisma.user.delete({
            where: { id },
        });
    }




}
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DeliveryAgentCreateDto, DeliveryAgentUpdateDto } from './dto/deliveryagents-create.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { Roles } from '@prisma/client';
@Injectable()
export class DeliveryAgentService {
    constructor(private prisma: PrismaService) { }

    // Create Delivery Agent + Profile
    async create(dto: DeliveryAgentCreateDto) {
        const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existingEmail) throw new BadRequestException('Email already registered');

        const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
        if (existingPhone) throw new BadRequestException('Phone number already registered');

        return this.prisma.user.create({
            data: {
                name: dto.name,
                phone: dto.phone,
                email: dto.email,
                role: Roles.DELIVERYAGENT,
                deliveryPartnerProfile: { create: { address: dto.address } },
            },
            include: { deliveryPartnerProfile: true },
        });
    }


    // Get all delivery agents with pagination and delivery count
    async findAll(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [agents, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where: { role: Roles.DELIVERYAGENT },
                include: {
                    deliveryPartnerProfile: {
                        include: {
                            deliveries: true, // include deliveries list
                            _count: { select: { deliveries: true } }, // include delivery count
                        },
                    },
                },
                orderBy: { name: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.user.count({
                where: { role: Roles.DELIVERYAGENT },
            }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            message: 'Delivery agents fetched successfully',
            currentPage: page,
            totalPages,
            totalRecords: total,
            data: agents,
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
                        _count: { select: { deliveries: true } },
                    },
                },
            },
        });
        if (!user || user.role !== Roles.DELIVERYAGENT) {
            throw new NotFoundException('Delivery agent not found');
        }

        return {
            message: 'Delivery agent fetched successfully',
            data: user,
        };
    }


    async updateDeliveryAgent(id: string, dto: DeliveryAgentUpdateDto) {
        // 1️⃣ Check if the user exists and is a delivery agent
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { deliveryPartnerProfile: true },
        });

        if (!user || user.role !== Roles.DELIVERYAGENT) {
            throw new NotFoundException('Delivery agent not found');
        }

        // 2️⃣ Update user fields
        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: {
                ...(dto.name ? { name: dto.name } : {}),
                ...(dto.phone ? { phone: dto.phone } : {}),
                ...(dto.email ? { email: dto.email } : {}),
            },
        });

        // 3️⃣ Update delivery partner profile (address)
        if (user.deliveryPartnerProfile) {
            await this.prisma.deliveryPartnerProfile.update({
                where: { id: user.deliveryPartnerProfile.id },
                data: {
                    ...(dto.address ? { address: dto.address } : {}),
                },
            });
        }

        // 4️⃣ Return updated record
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
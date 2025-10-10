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

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        return this.prisma.user.create({
            data: {
                name: dto.name,
                phone: dto.phone,
                email: dto.email,
                password: hashedPassword,
                role: Roles.DELIVERYAGENT,
                deliveryPartnerProfile: { create: {} },
            },
            include: { deliveryPartnerProfile: true },
        });
    }

    // Get all delivery agents
    async findAll() {
        const agents = await this.prisma.user.findMany({
            where: { role: Roles.DELIVERYAGENT },
            include: { deliveryPartnerProfile: true },
            orderBy: { name: 'asc' }, // optional: sort by name
        });

        return agents;
    }



    // Get by ID
    async getById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { deliveryPartnerProfile: true },
        });

        if (!user || user.role !== Roles.DELIVERYAGENT) {
            throw new NotFoundException('Delivery agent not found');
        }

        return user;
    }

    async update(id: string, dto: DeliveryAgentUpdateDto) {
        if (dto.email) {
            const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
            if (existingEmail && existingEmail.id !== id) throw new BadRequestException('Email already in use');
        }

        if (dto.phone) {
            const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
            if (existingPhone && existingPhone.id !== id) throw new BadRequestException('Phone number already in use');
        }

        if (dto.password) {
            dto.password = await bcrypt.hash(dto.password, 10);
        }

        return this.prisma.user.update({
            where: { id },
            data: dto,
            include: { deliveryPartnerProfile: true },
        });
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
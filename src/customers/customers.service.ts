import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserService } from 'src/user/user.service';
import { DeliveryStatus, Roles } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomerService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly userService: UserService
    ) { }


    async CreateUser(dto: CreateCustomerDto) {
        // 1️⃣ Check if user already exists
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) throw new BadRequestException('Email already registered');

        // 2️⃣ Create user
        const user = await this.userService.createUser({
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
        });
        // 3️⃣ Create customer profile linked to the new user
        const startDate = new Date(dto.start_date);
        const endDate = new Date(dto.end_date);

        // 3️⃣ Create customer profile linked to the new user
        const userProfile = await this.prisma.customerProfile.create({
            data: {
                start_date: new Date(dto.start_date), // ✅ convert string to Date
                end_date: new Date(dto.end_date),
                walletAmount: dto.walletAmount,
                user: {
                    connect: { id: user.id },
                },
                ...(dto.planId && { plan: { connect: { id: dto.planId } } }),
            },
            include: {
                user: true,
                plan: true,
            },
        });
        const diffInMs = endDate.getTime() - startDate.getTime();
        let totalDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
        totalDays = Math.min(totalDays, 30); // cap at 30
        if (dto.planId && totalDays > 0) {
            const deliveriesData = Array.from({ length: totalDays }, (_, i) => ({
                date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
                customerId: userProfile.id,
                planId: dto.planId,
                status: DeliveryStatus.PLACED, // or null if default
            }));

            await this.prisma.deliveries.createMany({
                data: deliveriesData,
            });
        }
        // 4️⃣ Return both user and profile
        return {
            message: 'User and profile created successfully',
            user,
            userProfile,
        };
    }


    async UpdateUser(id: string, dto: Partial<CreateCustomerDto>) {
        // 1️⃣ Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { customerProfile: true },
        });
        if (!user) throw new NotFoundException('User not found');
        // 2️⃣ Update user info
        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: {
                ...(dto.name ? { name: dto.name } : {}),
                ...(dto.email ? { email: dto.email } : {}),
                ...(dto.phone ? { phone: dto.phone } : {}),
            },
        });
        // 3️⃣ Update or create profile
        if (user.customerProfile) {
            await this.prisma.customerProfile.update({
                where: { userId: id },
                data: {
                    ...(dto.start_date ? { start_date: new Date(dto.start_date) } : {}),
                    ...(dto.end_date ? { end_date: new Date(dto.end_date) } : {}),
                    ...(dto.walletAmount !== undefined ? { walletAmount: dto.walletAmount } : {}),
                    ...(dto.planId ? { plan: { connect: { id: dto.planId } } } : {}),
                },
            });
        } else {
            await this.prisma.customerProfile.create({
                data: {
                    start_date: dto.start_date ? new Date(dto.start_date) : new Date(),
                    end_date: dto.end_date ? new Date(dto.end_date) : null,
                    walletAmount: dto.walletAmount ?? 0,
                    user: { connect: { id } },
                    ...(dto.planId ? { plan: { connect: { id: dto.planId } } } : {}),
                },
            });
        }
        // 4️⃣ Return updated record
        const updatedUserWithProfile = await this.prisma.user.findUnique({
            where: { id },
            include: { customerProfile: { include: { plan: true } } },
        });

        return {
            message: 'User and profile updated successfully',
            data: updatedUserWithProfile,
        };
    }


    async findAll(page: number = 1, limit: number = 10) {
        // 1️⃣ Pagination setup
        const skip = (page - 1) * limit;

        // 2️⃣ Fetch deliveries + count in one transaction
        const [deliveries, total] = await this.prisma.$transaction([
            this.prisma.deliveries.findMany({
                skip,
                take: limit,
                include: {
                    customer: {
                        include: {
                            user: true,
                        },
                    },
                    plan: true,
                    partner: {
                        include: {
                            user: true,
                        },
                    },
                },
                orderBy: { date: 'desc' },
            }),
            this.prisma.deliveries.count(),
        ]);

        // 3️⃣ Return paginated result
        return {
            data: deliveries,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }




}

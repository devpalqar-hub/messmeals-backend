import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { DeliveryAgentCreateDto, DeliveryAgentUpdateDto } from './dto/deliveryagents-create.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { DeliveryStatus, Role } from '@prisma/client';
import { contains } from 'class-validator';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
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
                role: Role.DELIVERYAGENT,
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
            role: Role.DELIVERYAGENT,
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

        if (!user || user.role !== Role.DELIVERYAGENT) {
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
        if (!user || user.role !== Role.DELIVERYAGENT) {
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
        if (!existingUser || existingUser.role !== Role.DELIVERYAGENT) {
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


    // -------------------------------------------------------
    // PHASE 3
    // -------------------------------------------------------
    async toggleOnlineOffline(is_online: boolean, userId: string) {
        const partner = await this.prisma.deliveryPartnerProfile.findUnique({
            where: { userId: userId },
            select: { isonline: true }
        })
        if (!partner) {
            throw new NotFoundException("Partner Not found")
        }

        partner.isonline = is_online

        return { message: "Online Status Updated", data: partner }
    }


    async DeliveryStats(
        userId: string,
        filters?: {
            date1?: Date;
            date2?: Date;
            status?: DeliveryStatus;
            variationId?: string;
        },
    ) {
        // 1️⃣ Validate user and delivery partner profile
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { deliveryPartnerProfile: true },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const profile = user.deliveryPartnerProfile;

        if (!profile) {
            throw new BadRequestException('User is not a delivery partner');
        }

        // 2️⃣ Base where condition (always applied)
        const where: any = {
            partnerId: profile.id,
        };

        // 3️⃣ Status filter (optional)
        if (filters?.status) {
            where.status = filters.status;
        }

        // 4️⃣ Date filters (optional)
        if (filters?.date1 && filters?.date2) {
            where.date = {
                gte: new Date(filters.date1),
                lte: new Date(filters.date2),
            };
        } else if (filters?.date1) {
            const start = new Date(filters.date1);
            const end = new Date(filters.date1);
            end.setHours(23, 59, 59, 999);

            where.date = {
                gte: start,
                lte: end,
            };
        }

        // 5️⃣ Variation filter (optional)
        if (filters?.variationId) {
            where.plan = {
                Variation: {
                    some: {
                        id: filters.variationId,
                    },
                },
            };
        }

        // 6️⃣ Filtered deliveries count
        const filteredDeliveriesCount = await this.prisma.deliveries.count({
            where,
        });

        // 7️⃣ Total deliveries count (no filters)
        const totalDeliveriesCount = await this.prisma.deliveries.count({
            where: {
                partnerId: profile.id,
            },
        });

        // 8️⃣ Active subscriptions (unchanged logic)
        const activeSubscriptions = await this.prisma.userSubscriptions.count({
            where: {
                deliveryPartnerProfileId: profile.id,
                is_active: true,
            },
        });

        // 9️⃣ Response
        return {
            userId: user.id,
            profileId: profile.id,

            totalDeliveriesCount,
            filteredDeliveriesCount,

            totalActiveOrders: activeSubscriptions,
        };
    }


    async getDeliveryAgentProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                deliveryPartnerProfile: {
                    include: {
                        mess: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.deliveryPartnerProfile) {
            throw new BadRequestException('User does not have a delivery partner profile');
        }

        const profile = user.deliveryPartnerProfile;

        return {
            // User fields
            userId: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            is_active: user.is_active,
            role: user.role,

            // Delivery Partner profile fields
            messProfileId: profile.id,          // your requirement
            deliveryRegion: profile.deliveryRegion,
            isonline: profile.isonline,
            address: profile.address,

            mess: profile.mess,                  // includes full mess data
        };
    }

    async myDeliveries(
        userId: string,
        status?: DeliveryStatus,
        date?: string,
        page: number = 1,
        limit: number = 10,
    ) {
        // 1️⃣ Fetch user + delivery partner profile
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                deliveryPartnerProfile: true,
            },
        });

        if (!user || !user.deliveryPartnerProfile) {
            throw new NotFoundException("Delivery agent profile not found");
        }

        const profileId = user.deliveryPartnerProfile.id;

        // pagination calculation
        const skip = (page - 1) * limit;

        // 2️⃣ Build WHERE filter
        const where: any = {
            partnerId: profileId,
        };

        if (status) {
            where.status = status;
        }

        if (date) {
            const startOfDay = new Date(date + "T00:00:00.000Z");
            const endOfDay = new Date(date + "T23:59:59.999Z");

            where.date = {
                gte: startOfDay,
                lte: endOfDay,
            };
        }

        // 3️⃣ Fetch deliveries (pagination added)
        const deliveries = await this.prisma.deliveries.findMany({
            where,
            include: {
                mess: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        is_active: true,
                    },
                },
                plan: {
                    select: {
                        id: true,
                        planName: true,
                        price: true,
                        images: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        });

        // 4️⃣ Response formatting (UNCHANGED STRUCTURE)
        return {
            message: "Deliveries fetched successfully",
            filters: {
                status: status || "ALL",
                date: date || "ALL",
                page,
                limit,
            },
            user: {
                userId: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
            },
            profile: {
                profileId,
                deliveryRegion: user.deliveryPartnerProfile.deliveryRegion,
                isonline: user.deliveryPartnerProfile.isonline,
                address: user.deliveryPartnerProfile.address,
            },
            deliveries: deliveries.map((d) => ({
                deliveryId: d.id,
                date: d.date,
                status: d.status,
                action: d.action,

                messId: d.messId,
                mess: {
                    name: d.mess.name,
                    address: d.mess.address,
                    is_active: d.mess.is_active,
                },

                planId: d.planId,
                plan: {
                    name: d.plan.planName,
                    price: d.plan.price,
                    images: d.plan.images || [],
                },
            })),
        };
    }




    async activeOrders(userId: string) {
        const today = new Date();

        // 1️⃣ Fetch user + delivery agent profile
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { deliveryPartnerProfile: true },
        });

        if (!user || !user.deliveryPartnerProfile) {
            throw new NotFoundException("Delivery agent profile not found");
        }

        const profileId = user.deliveryPartnerProfile.id;

        // 2️⃣ Fetch active subscriptions assigned to this delivery agent
        const activeSubs = await this.prisma.userSubscriptions.findMany({
            where: {
                deliveryPartnerProfileId: profileId,
                is_active: true,
                cancelled_on: null,
                start_date: { lte: today },
                OR: [
                    { end_date: null },
                    { end_date: { gte: today } }
                ],
            },
            include: {
                plan: {
                    select: {
                        id: true,
                        planName: true,
                        price: true,
                        images: true,
                    },
                },
                mess: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        is_active: true,
                    },
                },
                CustomerProfile: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                email: true,
                            },
                        },
                    },
                },
                UserAddress: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // 3️⃣ Format response
        return {
            message: "Active delivery orders fetched successfully",
            agent: {
                userId: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                profileId: profileId,
            },

            activeOrders: activeSubs.map((s) => ({
                subscriptionId: s.id,
                startDate: s.start_date,
                endDate: s.end_date,
                scheduleType: s.scheduleType,
                selectedDays: s.selectedDays,
                totalPrice: s.totalPrice,
                address: s.UserAddress,

                customer: {
                    customerId: s.customerProfileId,
                    name: s.CustomerProfile?.user?.name,
                    phone: s.CustomerProfile?.user?.phone,
                    email: s.CustomerProfile?.user?.email,
                },

                plan: {
                    planId: s.plan.id,
                    name: s.plan.planName,
                    price: s.plan.price,
                    images: s.plan.images,
                },

                mess: {
                    messId: s.mess.id,
                    name: s.mess.name,
                    address: s.mess.address,
                    is_active: s.mess.is_active,
                },
            })),
        };
    }

    async updateDeliveryStatus(userId: string, dto: UpdateDeliveryStatusDto) {
        const { deliveryId, status } = dto;

        // 1. Validate delivery agent exists
        const partner = await this.prisma.deliveryPartnerProfile.findUnique({
            where: { userId },
        });

        if (!partner) {
            throw new ForbiddenException('You are not registered as a delivery partner.');
        }

        // 2. Fetch delivery assigned to this partner
        const delivery = await this.prisma.deliveries.findUnique({
            where: { id: deliveryId },
        });

        if (!delivery) {
            throw new NotFoundException('Delivery not found.');
        }

        // Ensure this delivery belongs to this delivery partner
        if (delivery.partnerId !== partner.id) {
            throw new ForbiddenException('This delivery is not assigned to you.');
        }

        // 3. Update status
        const updated = await this.prisma.deliveries.update({
            where: { id: deliveryId },
            data: { status },
        });

        return {
            message: 'Delivery status updated successfully.',
            delivery: updated,
        };
    }


    async getDeliveryById(userId: string, deliveryId: string) {
        // 1️⃣ Ensure delivery agent exists
        const partner = await this.prisma.deliveryPartnerProfile.findUnique({
            where: { userId },
        });

        if (!partner) {
            throw new NotFoundException("Delivery partner profile not found");
        }

        // 2️⃣ Fetch delivery
        const delivery = await this.prisma.deliveries.findUnique({
            where: { id: deliveryId },
            include: {
                mess: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        is_active: true,
                    },
                },
                plan: {
                    select: {
                        id: true,
                        planName: true,
                        price: true,
                        images: true,
                    },
                },
                customer: {
                    select: {
                        id: true,
                        address: true,
                        current_location: true,
                        latitude_logitude: true,
                        user: {
                            select: {
                                name: true,
                                phone: true,
                            },
                        },
                    },
                },
            },
        });

        if (!delivery) {
            throw new NotFoundException("Delivery not found");
        }

        // 3️⃣ Validate that delivery belongs to this agent
        if (delivery.partnerId !== partner.id) {
            throw new ForbiddenException("You are not allowed to view this delivery");
        }

        // 4️⃣ Format response
        return {
            message: "Delivery fetched successfully",
            delivery: {
                id: delivery.id,
                date: delivery.date,
                status: delivery.status,
                action: delivery.action,

                mess: delivery.mess,
                plan: {
                    id: delivery.plan.id,
                    name: delivery.plan.planName,
                    price: delivery.plan.price,
                    images: delivery.plan.images || [],
                },

                customer: {
                    id: delivery.customer.id,
                    address: delivery.customer.address,
                    current_location: delivery.customer.current_location,
                    latitude_logitude: delivery.customer.latitude_logitude,
                    name: delivery.customer.user.name,
                    phone: delivery.customer.user.phone,
                },
            },
        };
    }






}
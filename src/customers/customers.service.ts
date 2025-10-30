import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { RenewSubscriptionDto } from './dto/renew-Subscription.dto';
import { de } from '@faker-js/faker';

@Injectable()
export class CustomerService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly userService: UserService
    ) { }


    async CreateUser(dto: CreateCustomerDto) {

        const { name, phone, email, address, currentLocation, latitude_logitude, is_active, walletAmount, discount, planId, deliveryPartnerId, start_date, end_date } = dto
        // 1️⃣ Check if user already exists
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) throw new BadRequestException('Email already registered');

        const Partnerexisting = await this.prisma.user.findUnique({
            where: { id: dto.deliveryPartnerId },
        });
        if (Partnerexisting) throw new BadRequestException('Delivery Partner not found');

        const plan = await this.prisma.plans.findUnique({
            where: { id: dto.planId },
        });
        if (!plan) throw new BadRequestException('Plan not found');
        // 2️⃣ Create user
        const user = await this.userService.createUser({
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            is_active: dto.is_active
        });
        const walletamount = Number(dto.walletAmount)
        const customerProfile = await this.prisma.customerProfile.create({
            data: {
                userId: user.id,
                address: dto.address,
                walletAmount: walletamount,
                current_location: dto.currentLocation,
                latitude_logitude: dto.latitude_logitude

            }
        })
        const startDate = new Date(dto.start_date);
        const endDate = new Date(dto.end_date);
        const dscnt = Number(dto.walletAmount)
        const actualPrice = plan.price
        const discountedprice = Number(actualPrice) - dscnt

        //payment logic here.

        const userSubscription = await this.prisma.userSubscriptions.create({
            data: {
                customerProfileId: customerProfile.id,
                start_date: startDate,
                end_date: endDate,
                discount: dto.discount,
                totalPrice: actualPrice,
                discountedPrice: discountedprice,
                deliveryPartnerProfileId: dto.deliveryPartnerId,
                planId: dto.planId
            }
        })
        //Return both user and profile
        return {
            message: 'User and profile created successfully',
            data: { user, customerProfile, userSubscription }
        };
    }


    async updateCustomerProfile(userId: string, dto: UpdateCustomerDto) {
        const {
            name,
            address,
            latitude_logitude,
            currentLocation,
            walletAmount,
            planId,
            deliveryPartnerId,
        } = dto;

        // 1️⃣ Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { customerProfile: true },
        });

        if (!user) throw new NotFoundException('User not found');

        // 2️⃣ Prepare update data
        const userUpdateData: any = {};
        const customerProfileUpdateData: any = {};

        if (name !== undefined) userUpdateData.name = name;
        if (address !== undefined) customerProfileUpdateData.address = address;
        if (latitude_logitude !== undefined)
            customerProfileUpdateData.latitude_logitude = latitude_logitude;
        if (currentLocation !== undefined)
            customerProfileUpdateData.current_location = currentLocation;
        if (walletAmount !== undefined)
            customerProfileUpdateData.walletAmount = walletAmount;

        // 3️⃣ Run atomic transaction
        const result = await this.prisma.$transaction(async (tx) => {
            // 🧩 Update user if needed
            if (Object.keys(userUpdateData).length > 0) {
                await tx.user.update({
                    where: { id: userId },
                    data: userUpdateData,
                });
            }

            // 🧩 Update customer profile if exists, else throw error
            if (user.customerProfile) {
                await tx.customerProfile.update({
                    where: { id: user.customerProfile.id },
                    data: customerProfileUpdateData,
                });
            } else {
                throw new NotFoundException('Customer profile not found for this user');
            }

            // 🧩 Optionally update or create user subscription
            if (planId || deliveryPartnerId) {
                const existingSubscription = await tx.userSubscriptions.findFirst({
                    where: { customerProfileId: user.customerProfile.id },
                });

                if (existingSubscription) {
                    await tx.userSubscriptions.update({
                        where: { id: existingSubscription.id },
                        data: {
                            ...(planId ? { planId } : {}),
                            ...(deliveryPartnerId ? { deliveryPartnerProfileId: deliveryPartnerId } : {}),
                        },
                    });
                } else {
                    await tx.userSubscriptions.create({
                        data: {
                            start_date: new Date(),
                            customerProfileId: user.customerProfile.id,
                            planId,
                            ...(deliveryPartnerId ? { deliveryPartnerProfileId: deliveryPartnerId } : {}),
                        },
                    });
                }
            }

            // 🧩 Return updated user with relations
            return tx.user.findUnique({
                where: { id: userId },
                include: {
                    customerProfile: {
                        include: { userSubscriptions: true },
                    },
                },
            });
        });

        // 4️⃣ Return response
        return {
            message: 'User and customer profile updated successfully',
            data: result,
        };
    }



    async findAll(page: number = 1, limit: number = 10, search?: string) {
        const skip = (page - 1) * limit;

        // Build dynamic filter for search
        const where: any = search
            ? {
                OR: [{
                    user: {
                        name: {
                            contains: search.toLowerCase()
                        },
                    },
                },
                {
                    user: {
                        email: {
                            contains: search.toLowerCase()
                        },
                    },
                },
                {
                    userSubscriptions: {
                        some: {
                            plan: {
                                planName: {
                                    contains: search.toLowerCase()
                                },
                            },
                        },
                    },
                }
                ]
            }
            : {};

        // Fetch data + count in a transaction
        const [customers, total] = await this.prisma.$transaction([
            this.prisma.customerProfile.findMany({
                skip,
                take: limit,
                where,
                include: {
                    user: true,
                    userSubscriptions: {
                        where: { is_active: true },
                        include: {
                            plan: {
                                include: { images: true, Variation: true },
                            },
                        },
                    },
                    deliveries: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.customerProfile.count({ where }),
        ]);

        // Transform response
        const result = customers.map((c) => {
            const activeSubs = c.userSubscriptions.filter(
                (sub) => !sub.end_date || sub.end_date > new Date()
            );

            const totalOrders = activeSubs.length; // active plan count
            const totalSpent = c.userSubscriptions.reduce(
                (sum, sub) => sum + Number(sub.totalPrice),
                0
            );

            const daysLeft =
                activeSubs.length > 0 && activeSubs[0].end_date
                    ? Math.ceil(
                        (new Date(activeSubs[0].end_date).getTime() -
                            new Date().getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                    : null;

            return {
                id: c.user.id,
                customerProfileId: c.id, // ✅ Add this line
                name: c.user.name,
                email: c.user.email,
                phone: c.user.phone,
                walletBalance: Number(c.walletAmount),
                address: c.address,
                current_location: c.current_location,
                latitude_logitude: c.latitude_logitude,
                noOfDaysToEnd: daysLeft,
                totalOrders,
                totalSpent,
                activeSubscriptions: activeSubs.map((sub) => ({
                    id: sub.id,
                    start_date: sub.start_date,
                    end_date: sub.end_date,
                    totalPrice: Number(sub.totalPrice),
                    discountedPrice: Number(sub.discountedPrice),
                    deliveryPartnerProfileId: sub.deliveryPartnerProfileId,
                    plan: sub.plan
                        ? {
                            id: sub.plan.id,
                            name: sub.plan.planName,
                            price: Number(sub.plan.price),
                            description: sub.plan.description,
                            variation: sub.plan.Variation,
                            images: sub.plan.images.map((img) => ({
                                url: img.url,
                                altText: img.altText,
                            })),
                        }
                        : null,
                })),
            };
        });

        return {
            data: result,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }


    async findOne(id: string) {
        const customer = await this.prisma.customerProfile.findUnique({
            where: { userId: id }, // Assuming customerProfile is linked to User
            include: {
                user: true,
                userSubscriptions: {
                    include: {
                        plan: {
                            include: { images: true, Variation: true },
                        },
                    },
                },
                deliveries: true,
            },
        });

        if (!customer) {
            throw new NotFoundException(`Customer with ID ${id} not found`);
        }

        // 🧩 Filter and compute details (same as in findAll)
        const activeSubs = customer.userSubscriptions.filter(
            (sub) => !sub.end_date || sub.end_date > new Date()
        );

        const totalOrders = activeSubs.length;
        const totalSpent = customer.userSubscriptions.reduce(
            (sum, sub) => sum + Number(sub.totalPrice),
            0
        );

        const daysLeft =
            activeSubs.length > 0 && activeSubs[0].end_date
                ? Math.ceil(
                    (new Date(activeSubs[0].end_date).getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                )
                : null;

        // 🧾 Final response
        return {
            id: customer.user.id,
            customerProfileId: customer.id, // ✅ Add this line
            name: customer.user.name,
            email: customer.user.email,
            phone: customer.user.phone,
            walletBalance: Number(customer.walletAmount),
            current_location: customer.current_location,
            latitude_logitude: customer.latitude_logitude,
            address: customer.address,
            noOfDaysToEnd: daysLeft,
            totalOrders,
            totalSpent,
            activeSubscriptions: activeSubs.map((sub) => ({
                id: sub.id,
                start_date: sub.start_date,
                end_date: sub.end_date,
                totalPrice: Number(sub.totalPrice),
                discountedPrice: Number(sub.discountedPrice),
                deliveryPartnerProfileId: sub.deliveryPartnerProfileId,
                plan: sub.plan
                    ? {
                        id: sub.plan.id,
                        name: sub.plan.planName,
                        price: Number(sub.plan.price),
                        description: sub.plan.description,
                        images: sub.plan.images.map((img) => ({
                            url: img.url,
                            altText: img.altText,
                        })),
                    }
                    : null,
            })),
        };
    }

    async deleteCustomer(userId: string) {
        // 1️⃣ Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                customerProfile: {
                    include: {
                        userSubscriptions: true,
                        deliveries: true,
                    },
                },
            },
        });

        if (!user) throw new NotFoundException('User not found');
        await this.prisma.user.delete({ where: { id: userId } });
        return {
            message: 'Customer and related data deleted successfully',
            deletedUserId: userId,
        };
    }


    async RenewSubscription(dto: RenewSubscriptionDto) {
        const { deliveryPartnerId, planId, start_date, end_date, discount, customerProfileId } = dto;
        const plan = await this.prisma.plans.findUnique({
            where: { id: planId },
        });
        if (!plan) throw new BadRequestException('Plan not found');
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const actualPrice = plan.price
        const userSubscription = await this.prisma.userSubscriptions.create({
            data: {
                start_date: startDate,
                end_date: endDate,
                totalPrice: actualPrice,
                deliveryPartnerProfileId: deliveryPartnerId,
                planId: planId,
                discount: discount,
                discountedPrice: Number(actualPrice),
                customerProfileId: customerProfileId
            }
        })
        return {
            message: 'Subscription Renewed successfully',
            data: { userSubscription }
        };

    }


    async UpdateWalletAmount(userId: string, amount: number) {
        // Logic to update wallet amount
        await this.prisma.customerProfile.update({
            where: { id: userId },
            data: { walletAmount: { increment: amount } },
        });
        return { message: 'Wallet amount updated successfully' };

    }


    async CancelSubscription(subscriptionId: string) {
        const subscription = await this.prisma.userSubscriptions.findUnique({
            where: { id: subscriptionId },
        });

        if (!subscription) {
            throw new NotFoundException('Subscription not found');
        }

        await this.prisma.userSubscriptions.update({
            where: { id: subscriptionId },
            data: { is_active: false },

        });
        return { message: 'Subscription cancelled successfully' };
    }
}
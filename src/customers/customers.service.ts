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
import { CancelSubDto } from './dto/cancel-sub.dto';
import { is } from 'date-fns/locale';

@Injectable()
export class CustomerService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly userService: UserService
    ) { }


    async CreateUser(dto: CreateCustomerDto) {
        const {
            name,
            phone,
            email,
            address,
            currentLocation,
            latitude_logitude,
            is_active,
            walletAmount,
            discount,
            planId,
            deliveryPartnerId,
            start_date,
            end_date,
        } = dto;

        // 1️⃣ Validate delivery partner
        const deliveryPartner = await this.prisma.deliveryPartnerProfile.findUnique({
            where: { id: deliveryPartnerId },
        });
        if (!deliveryPartner) throw new BadRequestException('Delivery Partner not found');

        // 2️⃣ Validate plan
        const plan = await this.prisma.plans.findUnique({
            where: { id: planId },
        });
        if (!plan) throw new BadRequestException('Plan not found');

        if (plan.messId !== deliveryPartner.messId) {
            throw new BadRequestException('Plan does not belong to the specified Mess');
        }
        // 3️⃣ Check if user already exists by email
        let user = await this.prisma.user.findUnique({
            where: { email },
        });

        let customerProfile;

        if (!user) {
            // 🆕 Create new user
            user = await this.userService.createUser({
                name,
                email,
                phone,
                is_active,
            });

            // 🆕 Create new customer profile
            customerProfile = await this.prisma.customerProfile.create({
                data: {
                    userId: user.id,
                    address,
                    walletAmount: Number(walletAmount),
                    current_location: currentLocation,
                    latitude_logitude,
                },
            });
        } else {
            // ✅ Fetch existing customer profile (or create one if missing)
            customerProfile = await this.prisma.customerProfile.findUnique({
                where: { userId: user.id },
            });

            if (!customerProfile) {
                customerProfile = await this.prisma.customerProfile.create({
                    data: {
                        userId: user.id,
                        address,
                        walletAmount: Number(walletAmount),
                        current_location: currentLocation,
                        latitude_logitude,
                    },
                });
            }
        }

        // 4️⃣ Calculate subscription duration and price
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const diffInMs = endDate.getTime() - startDate.getTime();
        const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

        const numericDiscount = Number(discount);
        const totalPrice = diffInDays * Number(plan.price);
        const discountedPrice = totalPrice - numericDiscount;

        // 5️⃣ Create new user subscription
        const userSubscription = await this.prisma.userSubscriptions.create({
            data: {
                customerProfileId: customerProfile.id,
                start_date: startDate,
                end_date: endDate,
                discount: numericDiscount,
                totalPrice,
                discountedPrice,
                messId: plan.messId,
                deliveryPartnerProfileId: deliveryPartnerId,
                planId,
            },
        });

        // 6️⃣ Update wallet after subscription
        await this.prisma.customerProfile.update({
            where: { id: customerProfile.id },
            data: {
                walletAmount: Number(customerProfile.walletAmount) - discountedPrice,
            },
        });

        // ✅ Return combined response
        return {
            message: user.createdAt ? 'New user and subscription created successfully' : 'Subscription created successfully for existing user',
            data: {
                user,
                customerProfile,
                userSubscription,
            },
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
                                include: { images: true, Variation: true, mess: true },
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
                is_active: c.user.is_active,
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
                    is_active: sub.is_active,
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
                            mess: sub.plan.mess,
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
        const customerProfile = await this.prisma.customerProfile.findUnique({
            where: { id: customerProfileId }
        })
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const actualPrice = plan.price
        const discountedPrice = Number(actualPrice) - Number(discount)
        const userSubscription = await this.prisma.userSubscriptions.create({
            data: {
                start_date: startDate,
                end_date: endDate,
                totalPrice: actualPrice,
                deliveryPartnerProfileId: deliveryPartnerId,
                planId: planId,
                discount: discount,
                messId: plan.messId,
                discountedPrice: discountedPrice,
                customerProfileId: customerProfileId
            }
        })
        await this.prisma.customerProfile.update({
            where: { id: customerProfileId },
            data: {
                walletAmount: Number(customerProfile?.walletAmount) - discountedPrice
            }
        })
        return {
            message: 'Subscription Renewed successfully',
            data: { userSubscription }
        };

    }


    async UpdateWalletAmount(userId: string, amount: number) {
        // Logic to update wallet amount
        console.log('Updating wallet for user:', userId, 'by amount:', amount);
        await this.prisma.customerProfile.update({
            where: { id: userId },
            data: { walletAmount: { increment: amount } },
        });
        return { message: 'Wallet amount updated successfully' };

    }


    async CancelSubscription(subscriptionId: string) {
        // 1️⃣ Find the subscription
        const subscription = await this.prisma.userSubscriptions.findUnique({
            where: { id: subscriptionId },
            include: {
                CustomerProfile: true, // Include customer details to access walletAmount
            },
        });

        // 2️⃣ Handle not found
        if (!subscription) {
            throw new NotFoundException('Subscription not found');
        }

        // 3️⃣ Check if already inactive
        if (!subscription.is_active) {
            throw new BadRequestException('Subscription is already cancelled');
        }

        // 4️⃣ Validate wallet amount
        if (subscription.CustomerProfile) {
            const walletAmount = Number(subscription.CustomerProfile.walletAmount);

            if (walletAmount < 0) {
                throw new BadRequestException(
                    'Cannot cancel subscription: wallet amount is less than 0'
                );
            }
        } else {
            throw new BadRequestException('Customer profile not found for this subscription');
        }

        // 5️⃣ Update subscription status
        await this.prisma.userSubscriptions.update({
            where: { id: subscriptionId },
            data: { is_active: false },
        });

        return { message: 'Subscription cancelled successfully' };
    }





    async getVariationCountByDate(dateString: string) {
        if (!dateString) {
            throw new BadRequestException('Date is required');
        }

        const inputDate = new Date(dateString);
        if (isNaN(inputDate.getTime())) {
            throw new BadRequestException('Invalid date format');
        }

        // ✅ Find subscriptions active on that date
        const subscriptions = await this.prisma.userSubscriptions.findMany({
            where: {
                start_date: { lte: inputDate },
                OR: [
                    { end_date: null },
                    { end_date: { gte: inputDate } },
                ],
                is_active: true,
            },
            include: {
                plan: {
                    include: {
                        Variation: true, // include all variations linked to plan
                    },
                },
            },
        });

        // ✅ Count occurrences of each variation
        const variationCount: Record<string, number> = {};
        for (const sub of subscriptions) {
            for (const variation of sub.plan.Variation) {
                variationCount[variation.title] =
                    (variationCount[variation.title] || 0) + 1;
            }
        }

        // ✅ Format output
        const result = Object.entries(variationCount).map(([title, count]) => ({
            title,
            count,
        }));

        return {
            message: `Variation count for ${dateString}`,
            totalSubscriptions: subscriptions.length,
            data: result,
        };
    }

}
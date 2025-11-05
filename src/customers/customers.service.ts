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
import { ScheduleType, Prisma, DeliveryStatus } from '@prisma/client';
import { CancelSubDto } from './dto/cancel-sub.dto';
import { PauseSubDto } from './dto/pause-sub.dto';
import { Subscription } from 'rxjs';

@Injectable()
export class CustomerService {
    constructor(
        private readonly prisma: PrismaService,
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

            // phase 2
            scheduleType,
            selectedDays, // Array of weekdays if CUSTOM (e.g. ["MONDAY", "WEDNESDAY", "FRIDAY"])
        } = dto;

        if (ScheduleType.CUSTOM === scheduleType && (!selectedDays || selectedDays.length === 0)) {
            throw new BadRequestException('Selected days are required for CUSTOM schedule type');
        }

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

        // 3️⃣ Check if user exists
        let user = await this.prisma.user.findUnique({ where: { email } });
        let customerProfile;

        if (!user) {
            // 🆕 Create user
            user = await this.userService.createUser({
                name,
                email,
                phone,
                is_active,
            });

            // 🆕 Create customer profile
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
            // ✅ Fetch or create customer profile
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

        // 4️⃣ Calculate duration and price
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const diffInMs = endDate.getTime() - startDate.getTime();
        const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

        const numericDiscount = Number(discount);
        const totalPrice = diffInDays * Number(plan.price);
        const discountedPrice = totalPrice - numericDiscount;

        // 5️⃣ Create subscription
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
                scheduleType,
                selectedDays: scheduleType === 'CUSTOM' ? selectedDays : undefined,
            },
        });

        // 6️⃣ Create Deliveries based on scheduleType
        const deliveriesToCreate: any[] = [];
        const currentDate = new Date(startDate);

        if (scheduleType === ScheduleType.EVERYDAY) {
            // ➤ Create deliveries for each day in range
            while (currentDate <= endDate) {
                deliveriesToCreate.push({
                    date: new Date(currentDate),
                    customerId: customerProfile.id,
                    planId,
                    subscriptionId: userSubscription.id,
                    status: DeliveryStatus.PENDING,
                    partnerId: deliveryPartnerId,
                    messId: plan.messId,
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else if (scheduleType === ScheduleType.CUSTOM && Array.isArray(selectedDays)) {
            // ➤ Create deliveries only on selected weekdays
            const selectedDaysUpper = selectedDays.map((d) => d.toUpperCase());
            const weekdayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

            while (currentDate <= endDate) {
                const dayName = weekdayMap[currentDate.getDay()];
                if (selectedDaysUpper.includes(dayName)) {
                    deliveriesToCreate.push({
                        date: new Date(currentDate),
                        customerId: customerProfile.id,
                        planId,
                        subscriptionId: userSubscription.id,
                        status: DeliveryStatus.PENDING,
                        partnerId: deliveryPartnerId,
                        messId: plan.messId,
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        if (deliveriesToCreate.length > 0) {
            await this.prisma.deliveries.createMany({
                data: deliveriesToCreate,
            });
        }

        // 7️⃣ Update wallet
        await this.prisma.customerProfile.update({
            where: { id: customerProfile.id },
            data: {
                walletAmount: Number(customerProfile.walletAmount) - discountedPrice,
            },
        });

        // ✅ Return success response
        return {
            message: user.createdAt
                ? 'New user and subscription created successfully'
                : 'Subscription created successfully for existing user',
            data: {
                user,
                customerProfile,
                userSubscription,
                deliveriesCreated: deliveriesToCreate.length,
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



    async findAll(
        page: number = 1,
        limit: number = 10,
        search?: string,
        messId?: string, // ✅ new parameter
    ) {
        const skip = (page - 1) * limit;

        // ✅ Build dynamic filter for search and mess
        const where: any = {
            ...(search
                ? {
                    OR: [
                        {
                            user: {
                                name: { contains: search.toLowerCase() },
                            },
                        },
                        {
                            user: {
                                email: { contains: search.toLowerCase() },
                            },
                        },
                        {
                            userSubscriptions: {
                                some: {
                                    plan: {
                                        planName: { contains: search.toLowerCase() },
                                    },
                                },
                            },
                        },
                    ],
                }
                : {}),
            ...(messId
                ? {
                    userSubscriptions: {
                        some: {
                            messId, // ✅ filter by mess
                        },
                    },
                }
                : {}),
        };

        // ✅ Fetch data + count in a transaction
        const [customers, total] = await this.prisma.$transaction([
            this.prisma.customerProfile.findMany({
                skip,
                take: limit,
                where,
                include: {
                    user: true,
                    userSubscriptions: {
                        where: {
                            is_active: true,
                            ...(messId ? { messId } : {}), // ✅ filter inside subscriptions too
                        },
                        include: {
                            plan: {
                                include: {
                                    images: true,
                                    Variation: true,
                                    mess: true,
                                },
                            },
                        },
                    },
                    deliveries: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.customerProfile.count({ where }),
        ]);

        // ✅ Transform response
        const result = customers.map((c) => {
            const activeSubs = c.userSubscriptions.filter(
                (sub) => (!sub.end_date || sub.end_date > new Date()) && (!messId || sub.messId === messId)
            );

            const totalOrders = activeSubs.length;
            const totalSpent = c.userSubscriptions
                .filter((sub) => !messId || sub.messId === messId)
                .reduce((sum, sub) => sum + Number(sub.totalPrice), 0);

            const daysLeft =
                activeSubs.length > 0 && activeSubs[0].end_date
                    ? Math.ceil(
                        (new Date(activeSubs[0].end_date).getTime() - new Date().getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                    : null;

            return {
                id: c.user.id,
                customerProfileId: c.id,
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


    async CancelSubscription(subscriptionId: string, dto: CancelSubDto) {
        const { cancellation_start_date, cancellation_end_date } = dto || {};

        const cancelStartDate = cancellation_start_date ? new Date(cancellation_start_date) : null;
        const cancelEndDate = cancellation_end_date ? new Date(cancellation_end_date) : null;
        const currentDate = new Date();

        // 1️⃣ Find subscription with plan and customer profile
        const subscription = await this.prisma.userSubscriptions.findUnique({
            where: { id: subscriptionId },
            include: {
                CustomerProfile: true,
                plan: true,
            },
        });

        if (!subscription) throw new NotFoundException('Subscription not found');
        if (!subscription.is_active) throw new BadRequestException('Subscription is already cancelled');
        if (!subscription.CustomerProfile) throw new BadRequestException('Customer profile not found');

        const planPrice = Number(subscription.plan.price);
        const customerWallet = Number(subscription.CustomerProfile.walletAmount);

        let refundAmount = 0;
        let deletedDeliveriesCount = 0;
        let cancellationType = 'Full';

        // 2️⃣ Partial cancellation (date range provided)
        if (cancelStartDate && cancelEndDate) {
            // Ensure start is before end
            if (cancelEndDate < cancelStartDate) {
                throw new BadRequestException('Cancellation end date must be after start date.');
            }

            // Ensure cancellation start is at least 2 days from now
            const diffFromNowDays = Math.ceil(
                (cancelStartDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffFromNowDays < 2) {
                throw new BadRequestException('Cancellation can only be scheduled at least 2 days in advance.');
            }

            // Calculate duration between cancellation start and end
            const diffInMs = cancelEndDate.getTime() - cancelStartDate.getTime();
            const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

            // Calculate refund amount
            refundAmount = diffInDays * planPrice;

            // Delete deliveries during cancellation period
            const result = await this.prisma.deliveries.deleteMany({
                where: {
                    subscriptionId,
                    date: {
                        gte: cancelStartDate,
                        lte: cancelEndDate,
                    },
                },
            });
            deletedDeliveriesCount = result.count;

            // Update wallet with refund
            await this.prisma.customerProfile.update({
                where: { id: subscription.CustomerProfile.id },
                data: { walletAmount: customerWallet + refundAmount },
            });

            // Update subscription
            await this.prisma.userSubscriptions.update({
                where: { id: subscriptionId },
                data: {
                    cancellation_start_date: cancelStartDate,
                    cancellation_end_date: cancelEndDate,
                    cancelled_on: new Date(),
                    is_active: false,
                },
            });

            cancellationType = 'Partial';
        }
        // 3️⃣ Full cancellation (no dates provided)
        else {
            // Find undelivered deliveries
            const undeliveredDeliveries = await this.prisma.deliveries.findMany({
                where: {
                    subscriptionId,
                    date: { gte: currentDate },
                },
            });

            const remainingDays = undeliveredDeliveries.length;

            // Calculate refund for undelivered days
            refundAmount = remainingDays * planPrice;

            // Delete all future deliveries
            const result = await this.prisma.deliveries.deleteMany({
                where: {
                    subscriptionId,
                    date: { gte: currentDate },
                },
            });
            deletedDeliveriesCount = result.count;

            // Update wallet
            await this.prisma.customerProfile.update({
                where: { id: subscription.CustomerProfile.id },
                data: { walletAmount: customerWallet + refundAmount },
            });

            // Update subscription
            await this.prisma.userSubscriptions.update({
                where: { id: subscriptionId },
                data: {
                    is_active: false,
                    cancelled_on: new Date(),
                    cancellation_start_date: null,
                    cancellation_end_date: null,
                },
            });
        }

        return {
            message: 'Subscription cancelled successfully',
            cancellationType,
            deletedDeliveries: deletedDeliveriesCount,
            refundAmount,
            updatedWallet: customerWallet + refundAmount,
        };
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

    async getAllMesses(userId: string) {
        // Find the messAdminProfile for this user
        const messAdmin = await this.prisma.messAdminProfile.findUnique({
            where: { userId: userId },
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

    async addMessToMessAdmin(userId: string, messId: string) {
        // Find the messAdminProfile for this user
        console.log(messId, "-----", userId)
        const messAdmin = await this.prisma.messAdminProfile.findUnique({
            where: { userId: userId },
        });
        console.log(messAdmin, "--------messadmin")
        if (!messAdmin) {
            throw new Error('MessAdmin profile not found for this user');
        }
        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
        });
        console.log(mess, "--------mess")

        if (!mess) {
            throw new Error('Mess not found for this user');
        }


        // Connect the mess to the mess admin
        await this.prisma.messAdminProfile.update({
            where: { id: messAdmin.id },
            data: {
                messes: {
                    connect: { id: messId },
                },
            },
        });

        return { message: 'Mess added to MessAdmin successfully' };
    }

    async PauseSubscription(subscriptionId: string, dto: PauseSubDto) {
        const { pause_start_date, pause_end_date } = dto;

        // 1️⃣ Validate pause dates
        if (!pause_start_date || !pause_end_date) {
            throw new BadRequestException('Both pause start and pause end dates are required');
        }

        const pauseStart = new Date(pause_start_date);
        const pauseEnd = new Date(pause_end_date);
        const currentDate = new Date();

        // 2️⃣ Ensure pause start is at least 2 days from now
        const diffFromNowDays = Math.ceil(
            (pauseStart.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffFromNowDays < 2) {
            throw new BadRequestException('Pause can only be scheduled at least 2 days in advance.');
        }

        // 2️⃣ Fetch subscription
        const subscription = await this.prisma.userSubscriptions.findUnique({
            where: { id: subscriptionId },
            include: {
                DeliveryPartnerProfile: true,
            },
        });

        if (!subscription) throw new NotFoundException('Subscription not found');

        if (!subscription.is_active)
            throw new BadRequestException('Subscription is inactive and cannot be paused');

        // 3️⃣ Validate pause range
        if (!subscription.end_date) {
            throw new BadRequestException('Subscription has no end date');
        }
        if (pauseEnd > subscription.end_date) {
            throw new BadRequestException('Pause end date cannot exceed subscription end date');
        }

        // 4️⃣ Calculate pause duration (in days)
        const pauseDurationDays =
            Math.ceil((pauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // 5️⃣ Fetch all deliveries of this subscription
        const allDeliveries = await this.prisma.deliveries.findMany({
            where: {
                subscriptionId: subscriptionId,
            },
            orderBy: { date: 'asc' },
        });

        // 6️⃣ Separate completed vs remaining deliveries
        const completedDeliveries = allDeliveries.filter(
            (d) => d.date < pauseStart
        );

        const remainingDeliveries = allDeliveries.filter(
            (d) => d.date >= pauseStart
        );

        if (remainingDeliveries.length === 0) {
            throw new BadRequestException('No future deliveries found to pause.');
        }

        // 7️⃣ Shift remaining deliveries forward by pause duration
        const updates: Prisma.PrismaPromise<any>[] = [];
        for (const delivery of remainingDeliveries) {
            const newDate = new Date(delivery.date);
            newDate.setDate(newDate.getDate() + pauseDurationDays);

            updates.push(
                this.prisma.deliveries.update({
                    where: { id: delivery.id },
                    data: { date: newDate },
                })
            );
        }

        // Run all updates in one transaction
        await this.prisma.$transaction(updates);

        // 8️⃣ Optionally, extend subscription end_date
        const newEndDate = new Date(subscription.end_date);
        newEndDate.setDate(newEndDate.getDate() + pauseDurationDays);

        // 9️⃣ Update subscription with pause info + new end date
        await this.prisma.userSubscriptions.update({
            where: { id: subscriptionId },
            data: {
                pause_start_date: pauseStart,
                pause_end_date: pauseEnd,
                end_date: newEndDate, // extend subscription to keep total deliveries
            },
        });

        // ✅ Return summary
        return {
            message: 'Subscription paused successfully and future deliveries rescheduled',
            pauseDurationDays,
            shiftedDeliveries: remainingDeliveries.length,
            newSubscriptionEndDate: newEndDate,
        };
    }

    async ResetWalletAmount(userId: string) {
        const customer = await this.prisma.customerProfile.findUnique({
            where: { id: userId },
        });

        if (!customer) {
            throw new NotFoundException('Customer profile not found');
        }

        await this.prisma.customerProfile.update({
            where: { id: userId },
            data: { walletAmount: 0 },
        });


    }
}
import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { PaymentsService } from 'src/payments/payments.service';
import { choosePlanDto, CreateCustomerDto, CreateSubscriptionForCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { RenewSubscriptionDto } from './dto/renew-Subscription.dto';
import { ScheduleType, Prisma, DeliveryStatus, VariationStatus, Role } from '@prisma/client';
import { CancelSubDto } from './dto/cancel-sub.dto';
import { PauseSubDto } from './dto/pause-sub.dto';
import { Subscription } from 'rxjs';


@Injectable()
export class CustomerService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly userService: UserService,
        private readonly paymentsService: PaymentsService,
    ) { }

    // Ensure a Wallet exists for a customer profile. Returns the wallet.
    private async ensureWallet(profileId: string) {
        const existing = await this.prisma.wallet.findUnique({ where: { userId: profileId } });
        if (existing) return existing;

        // create wallet with initial amount from customerProfile if available
        const profile = await this.prisma.customerProfile.findUnique({ where: { id: profileId } });
        const initialAmount = profile?.walletAmount || 0;
        return this.prisma.wallet.create({ data: { userId: profileId, walletAmount: initialAmount } });
    }

    // Create a wallet transaction and update wallet balance atomically
    private async createWalletTransaction(profileId: string, amount: number, meta?: any) {
        // use a transaction to update wallet amount and create transaction record
        const result = await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.upsert({
                where: { userId: profileId },
                create: { userId: profileId, walletAmount: amount },
                update: { walletAmount: { increment: amount } },
            });

            const txn = await tx.transaction.create({
                data: {
                    walletId: wallet.id,
                    amount: amount,
                    balanceAfter: wallet.walletAmount,
                    meta: meta || null,
                },
            });

            return { wallet, txn };
        });

        return result;
    }

    private ensureHttpsUrl(url: string): string {
        if (!url) return url;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        return `https://${url}`;
    }

    private getDefaultUrl(path: string): string {
        const frontendUrl = process.env.FRONTEND_URL;
        if (!frontendUrl) {
            throw new Error('FRONTEND_URL environment variable is not set');
        }
        const baseUrl = this.ensureHttpsUrl(frontendUrl);
        return `${baseUrl}${path}`;
    }

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
        console.log("helloooo - 1")
        // 3️⃣ Check if user exists
        let user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { phone: phone },
                ],
            },
        });

        if (user) {
            const allowedRoles: Role[] = [
                Role.DELIVERYAGENT,
                Role.MESSADMIN,
                Role.SUPERADMIN,
            ];

            if (allowedRoles.includes(user.role)) {
                throw new ForbiddenException(
                    "Email or Phone already registered for another role",
                );
            }
        }
        console.log("user found: ", user)

        let customerProfile;

        if (!user) {
            console.log("helloooo - 2")
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
            console.log("user created: ", user)
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
        if (isNaN(startDate.getTime())) {
            throw new BadRequestException('Invalid start_date');
        }

        // ─── Derive end date ──────────────────────────────────────────────────
        let endDate: Date;

        if (end_date) {
            endDate = new Date(end_date);
        } else if (plan.isMonthlyPlan) {
            // Default: 1 calendar month, last day inclusive
            const endExclusive = new Date(Date.UTC(
                startDate.getUTCFullYear(),
                startDate.getUTCMonth() + 1,
                startDate.getUTCDate(),
            ));
            endDate = new Date(endExclusive);
            endDate.setUTCDate(endDate.getUTCDate() - 1);
        } else {
            // Daily plan: default to startDate (single day)
            endDate = new Date(startDate);
        }

        if (isNaN(endDate.getTime())) {
            throw new BadRequestException('Invalid end_date');
        }
        if (endDate < startDate) {
            throw new BadRequestException('end_date must be >= start_date');
        }

        const parsedDiscount = Number(discount);
        const numericDiscount = Number.isFinite(parsedDiscount) ? parsedDiscount : 0;

        const normalizedScheduleType =
            scheduleType === ScheduleType.CUSTOM || (Array.isArray(selectedDays) && selectedDays.length > 0)
                ? ScheduleType.CUSTOM
                : ScheduleType.EVERYDAY;

        const normalizedSelectedDays =
            normalizedScheduleType === ScheduleType.CUSTOM
                ? (Array.isArray(selectedDays) ? selectedDays : [])
                : undefined;

        if (normalizedScheduleType === ScheduleType.CUSTOM && (!normalizedSelectedDays || normalizedSelectedDays.length === 0)) {
            throw new BadRequestException('Selected days are required for CUSTOM schedule type');
        }

        // ─── Pricing ──────────────────────────────────────────────────────────
        let totalPrice = 0;

        if (plan.isMonthlyPlan) {
            // Monthly: derive month count by dividing actual day span by 30 and rounding.
            // This treats 25-35 days as 1 month, 55-65 days as 2 months, etc.
            // Avoids the calendar-month boundary bug (e.g. Jun5 → Jul5 = 31 days ≈ 1 month).
            const msPerDay = 1000 * 60 * 60 * 24;
            const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
            const numMonths = Math.max(1, Math.round(totalDays / 30));
            totalPrice = numMonths * Number(plan.price);
        } else {
            // Daily: count chargeable delivery days in [startDate, endDate]
            let chargeableDays = 0;
            const tempDate = new Date(startDate);

            if (normalizedScheduleType === ScheduleType.EVERYDAY) {
                while (tempDate <= endDate) {
                    chargeableDays++;
                    tempDate.setDate(tempDate.getDate() + 1);
                }
            } else {
                const selectedDaysUpper = (normalizedSelectedDays ?? []).map(d => d.toUpperCase());
                const weekdayMap = [
                    'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
                ];
                while (tempDate <= endDate) {
                    const dayName = weekdayMap[tempDate.getDay()];
                    if (selectedDaysUpper.includes(dayName)) {
                        chargeableDays++;
                    }
                    tempDate.setDate(tempDate.getDate() + 1);
                }
            }

            totalPrice = chargeableDays * Number(plan.price);
        }

        const appliedDiscount = Math.max(0, Math.min(numericDiscount, totalPrice));
        const discountedPrice = totalPrice - appliedDiscount;


        // 5️⃣ Create subscription
        const userSubscription = await this.prisma.userSubscriptions.create({
            data: {
                customerProfileId: customerProfile.id,
                start_date: startDate,
                end_date: endDate,
                discount: appliedDiscount,
                totalPrice,
                discountedPrice,
                messId: plan.messId,
                deliveryPartnerProfileId: deliveryPartnerId,
                planId,
                scheduleType: normalizedScheduleType,
                selectedDays: normalizedScheduleType === ScheduleType.CUSTOM ? normalizedSelectedDays : undefined,
            },
        });

        // 6️⃣ Create Deliveries based on scheduleType
        const deliveriesToCreate: any[] = [];
        const currentDate = new Date(startDate);
        console.log({
            startDate,
            endDate,
            currentDate,
            comparison: currentDate <= endDate,
        });

        if (normalizedScheduleType === ScheduleType.EVERYDAY) {
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
        } else if (normalizedScheduleType === ScheduleType.CUSTOM && Array.isArray(normalizedSelectedDays)) {
            // ➤ Create deliveries only on selected weekdays
            const selectedDaysUpper = normalizedSelectedDays.map((d) => d.toUpperCase());
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
            await this.prisma.deliveries.createMany({ data: deliveriesToCreate });
            await this.createDeliveryVariationsForPlan(planId, userSubscription.id, deliveriesToCreate.map(d => d.date));
        }

        // 7️⃣ Update wallet (debit for subscription)
        const updatedProfile = await this.prisma.customerProfile.update({
            where: { id: customerProfile.id },
            data: {
                walletAmount: Number(customerProfile.walletAmount) - discountedPrice,
            },
        });

        // create transaction record (negative amount)
        try {
            await this.createWalletTransaction(customerProfile.id, -Number(discountedPrice), { note: 'Subscription purchase', subscriptionId: userSubscription.id });
        } catch (err) {
            // non-fatal: log and continue
            console.error('Failed to create wallet transaction:', err);
        }

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
        messId?: string,
        isActive?: boolean, // ✅ NEW
    ) {
        const skip = (page - 1) * limit;

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
                                        planName: {
                                            contains: search.toLowerCase(),
                                        },
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
                        some: { messId },
                    },
                }
                : {}),

            // ✅ is_active filter
            ...(isActive !== undefined
                ? {
                    user: {
                        is_active: isActive,
                    },
                }
                : {}),
        };

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
                            ...(messId ? { messId } : {}),
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

        const result = customers.map((c) => {
            const activeSubs = c.userSubscriptions.filter(
                (sub) =>
                    (!sub.end_date ||
                        sub.end_date > new Date()) &&
                    (!messId || sub.messId === messId)
            );

            const totalOrders = activeSubs.length;

            const totalSpent = c.userSubscriptions
                .filter((sub) => !messId || sub.messId === messId)
                .reduce(
                    (sum, sub) => sum + Number(sub.totalPrice),
                    0
                );

            const daysLeft =
                activeSubs.length > 0 &&
                    activeSubs[0].end_date
                    ? Math.ceil(
                        (new Date(
                            activeSubs[0].end_date
                        ).getTime() -
                            new Date().getTime()) /
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
                    seletedDays: sub.selectedDays,
                    scheduletype: sub.scheduleType,
                    is_active: sub.is_active,
                    totalPrice: Number(sub.totalPrice),
                    discountedPrice: Number(sub.discountedPrice),
                    deliveryPartnerProfileId:
                        sub.deliveryPartnerProfileId,
                    plan: sub.plan
                        ? {
                            id: sub.plan.id,
                            name: sub.plan.planName,
                            price: Number(sub.plan.price),
                            description:
                                sub.plan.description,
                            variation: sub.plan.Variation,
                            mess: sub.plan.mess,
                            images: sub.plan.images.map(
                                (img) => ({
                                    url: img.url,
                                    altText: img.altText,
                                })
                            ),
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
            activeSubscriptions: activeSubs.map((sub) => {
                const today = new Date();
                let status: string;
                if (sub.cancelled_on) {
                    status = 'CANCELLED';
                } else if (
                    sub.pause_start_date &&
                    sub.pause_end_date &&
                    today >= new Date(sub.pause_start_date) &&
                    today <= new Date(sub.pause_end_date)
                ) {
                    status = 'PAUSED';
                } else if (sub.is_active) {
                    status = 'ACTIVE';
                } else {
                    status = 'INACTIVE';
                }

                return {
                    id: sub.id,
                    start_date: sub.start_date,
                    end_date: sub.end_date,
                    seletedDays: sub.selectedDays,
                    scheduletype: sub.scheduleType,
                    totalPrice: Number(sub.totalPrice),
                    discountedPrice: Number(sub.discountedPrice),
                    deliveryPartnerProfileId: sub.deliveryPartnerProfileId,
                    status,
                    plan: sub.plan
                        ? {
                            id: sub.plan.id,
                            name: sub.plan.planName,
                            price: Number(sub.plan.price),
                            description: sub.plan.description,
                            isMonthlyPlan: sub.plan.isMonthlyPlan,
                            isDailyPlan: sub.plan.isDailyPlan,
                            images: sub.plan.images.map((img) => ({
                                url: img.url,
                                altText: img.altText,
                            })),
                        }
                        : null,
                };
            }),
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
        const {
            subscriptionId,
            deliveryPartnerId,
            planId,
            start_date,
            end_date,
            discount,
            customerProfileId: providedCustomerProfileId,
            scheduleType,
            selectedDays,
        } = dto;

        // ─── 1. Resolve customer profile ─────────────────────────────────────
        const customerProfile = await this.prisma.customerProfile.findFirst({
            where: {
                OR: [{ id: providedCustomerProfileId }, { userId: providedCustomerProfileId }],
            },
        });
        if (!customerProfile) {
            throw new BadRequestException(
                'Customer profile not found (customerProfileId can be CustomerProfile.id or User.id)'
            );
        }
        const customerProfileId = customerProfile.id;

        // ─── 2. Verify the subscription belongs to this customer ─────────────
        const existingSubscription = await this.prisma.userSubscriptions.findUnique({
            where: { id: subscriptionId },
        });
        if (!existingSubscription) throw new BadRequestException('Subscription not found');
        if (existingSubscription.customerProfileId !== customerProfileId) {
            throw new BadRequestException('Subscription does not belong to this customer');
        }

        // ─── 3. Validate delivery partner ────────────────────────────────────
        const deliveryPartner = await this.prisma.deliveryPartnerProfile.findUnique({
            where: { id: deliveryPartnerId },
        });
        if (!deliveryPartner) throw new BadRequestException('Delivery Partner not found');

        // ─── 4. Validate plan ─────────────────────────────────────────────────
        const plan = await this.prisma.plans.findUnique({ where: { id: planId } });
        if (!plan) throw new BadRequestException('Plan not found');

        // ─── 5. Parse & validate dates ────────────────────────────────────────
        const startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) throw new BadRequestException('Invalid start_date');

        const endDate = new Date(end_date);
        if (isNaN(endDate.getTime())) throw new BadRequestException('Invalid end_date');
        if (endDate < startDate) throw new BadRequestException('end_date must be >= start_date');

        // ─── 6. Normalize schedule (same as CreateUser) ──────────────────────
        const normalizedScheduleType =
            scheduleType === ScheduleType.CUSTOM || (Array.isArray(selectedDays) && selectedDays.length > 0)
                ? ScheduleType.CUSTOM
                : ScheduleType.EVERYDAY;

        const normalizedSelectedDays =
            normalizedScheduleType === ScheduleType.CUSTOM
                ? (Array.isArray(selectedDays) ? selectedDays : [])
                : undefined;

        if (normalizedScheduleType === ScheduleType.CUSTOM && (!normalizedSelectedDays || normalizedSelectedDays.length === 0)) {
            throw new BadRequestException('Selected days are required for CUSTOM schedule type');
        }

        // ─── 7. Calculate total price from date range ─────────────────────────
        let totalPrice = 0;
        const weekdayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        if (plan.isMonthlyPlan) {
            // Monthly: round actual day span to nearest 30-day month.
            // 25-35 days = 1 month, 55-65 days = 2 months, etc.
            const msPerDay = 1000 * 60 * 60 * 24;
            const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
            const numMonths = Math.max(1, Math.round(totalDays / 30));
            totalPrice = numMonths * Number(plan.price);
        } else {
            let chargeableDays = 0;
            const tempDate = new Date(startDate);
            if (normalizedScheduleType === ScheduleType.EVERYDAY) {
                while (tempDate <= endDate) {
                    chargeableDays++;
                    tempDate.setDate(tempDate.getDate() + 1);
                }
            } else {
                const selectedDaysUpper = (normalizedSelectedDays ?? []).map(d => d.toUpperCase());
                while (tempDate <= endDate) {
                    if (selectedDaysUpper.includes(weekdayMap[tempDate.getDay()])) chargeableDays++;
                    tempDate.setDate(tempDate.getDate() + 1);
                }
            }
            totalPrice = chargeableDays * Number(plan.price);
        }

        const parsedDiscount = Number(discount);
        const numericDiscount = Number.isFinite(parsedDiscount) ? parsedDiscount : 0;
        const appliedDiscount = Math.max(0, Math.min(numericDiscount, totalPrice));
        const discountedPrice = totalPrice - appliedDiscount;

        // ─── 8. Update existing subscription (not create a new one) ─────────
        const updatedSubscription = await this.prisma.userSubscriptions.update({
            where: { id: subscriptionId },
            data: {
                start_date: startDate,
                end_date: endDate,
                totalPrice,
                deliveryPartnerProfileId: deliveryPartnerId,
                planId,
                discount: appliedDiscount,
                messId: plan.messId,
                discountedPrice,
                scheduleType: normalizedScheduleType,
                selectedDays: normalizedScheduleType === ScheduleType.CUSTOM ? normalizedSelectedDays : undefined,
                is_active: true,
                cancelled_on: null,
            },
        });

        // ─── 9. Create deliveries for the new period (same as CreateUser) ────
        const deliveriesToCreate: any[] = [];
        const currentDate = new Date(startDate);

        if (normalizedScheduleType === ScheduleType.EVERYDAY) {
            while (currentDate <= endDate) {
                deliveriesToCreate.push({
                    date: new Date(currentDate),
                    customerId: customerProfileId,
                    planId,
                    subscriptionId,
                    status: DeliveryStatus.PENDING,
                    partnerId: deliveryPartnerId,
                    messId: plan.messId,
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else if (normalizedScheduleType === ScheduleType.CUSTOM && Array.isArray(normalizedSelectedDays)) {
            const selectedDaysUpper = normalizedSelectedDays.map(d => d.toUpperCase());
            while (currentDate <= endDate) {
                if (selectedDaysUpper.includes(weekdayMap[currentDate.getDay()])) {
                    deliveriesToCreate.push({
                        date: new Date(currentDate),
                        customerId: customerProfileId,
                        planId,
                        subscriptionId,
                        status: DeliveryStatus.PENDING,
                        partnerId: deliveryPartnerId,
                        messId: plan.messId,
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        if (deliveriesToCreate.length > 0) {
            await this.prisma.deliveries.createMany({ data: deliveriesToCreate });
            await this.createDeliveryVariationsForPlan(planId, subscriptionId, deliveriesToCreate.map(d => d.date));
        }

        // ─── 10. Debit wallet ─────────────────────────────────────────────────
        await this.prisma.customerProfile.update({
            where: { id: customerProfileId },
            data: { walletAmount: Number(customerProfile.walletAmount ?? 0) - discountedPrice },
        });

        // create wallet debit transaction for renewal
        try {
            await this.createWalletTransaction(customerProfileId, -Number(discountedPrice), { note: 'Subscription renewal', subscriptionId });
        } catch (err) {
            console.error('Failed to create wallet transaction on renewal:', err);
        }

        return {
            message: 'Subscription renewed successfully',
            data: {
                subscription: updatedSubscription,
                deliveriesCreated: deliveriesToCreate.length,
            },
        };
    }


    async UpdateWalletAmount(userId: string, amount: number) {
        // Logic to update wallet amount
        console.log('Updating wallet for user:', userId, 'by amount:', amount);
        const updatedProfile = await this.prisma.customerProfile.update({
            where: { id: userId },
            data: { walletAmount: { increment: amount } },
        });

        // create wallet transaction (credit)
        try {
            await this.createWalletTransaction(userId, Number(amount), { note: 'Wallet top-up' });
        } catch (err) {
            console.error('Failed to create wallet transaction on top-up:', err);
        }

        return { message: 'Wallet amount updated successfully', walletBalance: Number(updatedProfile.walletAmount) };
    }

    async getWalletTransactionsForUser(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;

        const profile = await this.prisma.customerProfile.findUnique({ where: { userId } });
        if (!profile) throw new NotFoundException('Customer profile not found');

        const wallet = await this.prisma.wallet.findUnique({ where: { userId: profile.id } });
        if (!wallet) {
            return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        }

        const [transactions, total] = await this.prisma.$transaction([
            this.prisma.transaction.findMany({
                where: { walletId: wallet.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.transaction.count({ where: { walletId: wallet.id } }),
        ]);

        return {
            data: transactions,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
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
            const updatedProfileRefund = await this.prisma.customerProfile.update({
                where: { id: subscription.CustomerProfile.id },
                data: { walletAmount: customerWallet + refundAmount },
            });

            // create wallet credit transaction for refund
            try {
                await this.createWalletTransaction(subscription.CustomerProfile.id, Number(refundAmount), { note: 'Subscription partial cancellation refund', subscriptionId });
            } catch (err) {
                console.error('Failed to create wallet transaction on partial cancellation:', err);
            }

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
            const updatedProfileRefund = await this.prisma.customerProfile.update({
                where: { id: subscription.CustomerProfile.id },
                data: { walletAmount: customerWallet + refundAmount },
            });

            // create wallet credit transaction for refund
            try {
                await this.createWalletTransaction(subscription.CustomerProfile.id, Number(refundAmount), { note: 'Subscription full cancellation refund', subscriptionId });
            } catch (err) {
                console.error('Failed to create wallet transaction on full cancellation:', err);
            }

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
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // SUPERADMIN can see all active messes.
        if (user.role === Role.SUPERADMIN) {
            return this.prisma.mess.findMany({
                where: { is_active: true },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    address: true,
                },
                orderBy: { name: 'asc' },
            });
        }

        // MESSADMIN sees only linked messes.
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
            return [];
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

        // 2️⃣.1 Validate against already paused range
        if (
            subscription.pause_start_date &&
            subscription.pause_end_date
        ) {
            const existingStart = new Date(subscription.pause_start_date);
            const existingEnd = new Date(subscription.pause_end_date);

            const isOverlapping =
                pauseStart <= existingEnd &&
                pauseEnd >= existingStart;

            if (isOverlapping) {
                throw new BadRequestException(
                    'Selected pause dates overlap with already paused dates'
                );
            }
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


    async choosePlan(dto: choosePlanDto, userId: string) {
        const {
            addressId,
            planId,
            start_date,
            end_date,
            scheduleType,
            selectedDays, // Array of weekdays if CUSTOM (e.g. ["MONDAY", "WEDNESDAY", "FRIDAY"])
            successUrl,
            cancelUrl,
        } = dto;

        const normalizedScheduleType =
            scheduleType === ScheduleType.CUSTOM || (Array.isArray(selectedDays) && selectedDays.length > 0)
                ? ScheduleType.CUSTOM
                : ScheduleType.EVERYDAY;

        const normalizedSelectedDays =
            normalizedScheduleType === ScheduleType.CUSTOM
                ? (Array.isArray(selectedDays) ? selectedDays : [])
                : undefined;

        if (normalizedScheduleType === ScheduleType.CUSTOM && (!normalizedSelectedDays || normalizedSelectedDays.length === 0)) {
            throw new BadRequestException('Selected days are required for CUSTOM schedule type');
        }
        let address = await this.prisma.userAddress.findUnique({ where: { id: addressId } });
        if (!address) {
            throw new BadRequestException('Address not found');
        }

        // customer existence is validated below when fetching profile with user relation
        //Validate plan
        const plan = await this.prisma.plans.findUnique({
            where: { id: planId },
        });
        if (!plan) throw new BadRequestException('Plan not found');


        // Calculate duration and price
        const startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) {
            throw new BadRequestException('Invalid start_date');
        }

        const deriveDefaultEndDate = () => {
            if (plan.isMonthlyPlan) {
                const endExclusive = new Date(Date.UTC(
                    startDate.getUTCFullYear(),
                    startDate.getUTCMonth() + 1,
                    startDate.getUTCDate(),
                    0,
                    0,
                    0,
                ));
                const endInclusive = new Date(endExclusive);
                endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
                return endInclusive;
            }
            return new Date(startDate);
        };

        const endDate = end_date ? new Date(end_date) : deriveDefaultEndDate();
        if (isNaN(endDate.getTime())) {
            throw new BadRequestException('Invalid end_date');
        }
        if (endDate < startDate) {
            throw new BadRequestException('end_date must be >= start_date');
        }
        const diffInMs = endDate.getTime() - startDate.getTime();
        const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
        const totalPrice = diffInDays * Number(plan.price);

        // Create a pending (inactive) subscription. It will be activated only after successful payment.
        // Include the user relation to access email/phone
        const customerProfile = await this.prisma.customerProfile.findUnique({
            where: { userId: userId },
            include: { user: true },
        });

        if (!customerProfile) {
            throw new BadRequestException('Customer profile not found');
        }

        const userSubscription = await this.prisma.userSubscriptions.create({
            data: {
                customerProfileId: customerProfile.id,
                start_date: startDate,
                end_date: endDate,
                discount: 0,
                totalPrice,
                discountedPrice: totalPrice,
                messId: plan.messId,
                planId,
                scheduleType: normalizedScheduleType,
                selectedDays: normalizedScheduleType === ScheduleType.CUSTOM ? normalizedSelectedDays : undefined,
                userAddressId: addressId,
                is_active: false, // mark inactive until payment success
            },
        });

        // Create a Razorpay order and return session URL so frontend can redirect user to payment
        const paymentResult = await this.paymentsService.createPaymentOrder(
            userSubscription.id,
            Number(totalPrice),
            customerProfile.user?.email || '',
            customerProfile.user?.phone || '',
            customerProfile.user?.name || '',
            successUrl,
            cancelUrl,
        );

        return {
            message: 'Payment initiated',
            data: {
                subscription: userSubscription,
                payment: paymentResult.data,
            },
        };
    }


    //This function is for user to cancel their active subscriptions
    async CancelUserSubscription(dto: CancelSubDto, userId: string) {
        const { cancellation_start_date, cancellation_end_date, subscriptionId } = dto || {};

        const cancelStartDate = cancellation_start_date ? new Date(cancellation_start_date) : null;
        const cancelEndDate = cancellation_end_date ? new Date(cancellation_end_date) : null;
        const currentDate = new Date();

        let user = await this.prisma.customerProfile.findUnique({ where: { userId: userId } });
        if (!user) {
            throw new BadRequestException('User not found');
        }
        // 1️⃣ Find subscription with plan and customer profile
        const subscription = await this.prisma.userSubscriptions.findUnique({
            where: { id: subscriptionId, customerProfileId: user.id },
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
            const updatedProfileRefund = await this.prisma.customerProfile.update({
                where: { id: subscription.CustomerProfile.id },
                data: { walletAmount: customerWallet + refundAmount },
            });

            try {
                await this.createWalletTransaction(subscription.CustomerProfile.id, Number(refundAmount), { note: 'Subscription partial cancellation refund', subscriptionId });
            } catch (err) {
                console.error('Failed to create wallet transaction on user partial cancellation:', err);
            }

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
            const updatedProfileRefund = await this.prisma.customerProfile.update({
                where: { id: subscription.CustomerProfile.id },
                data: { walletAmount: customerWallet + refundAmount },
            });

            try {
                await this.createWalletTransaction(subscription.CustomerProfile.id, Number(refundAmount), { note: 'Subscription full cancellation refund', subscriptionId });
            } catch (err) {
                console.error('Failed to create wallet transaction on user full cancellation:', err);
            }

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


    //This function is for user to pause their subscriptions.
    async PauseUserSubscription(dto: PauseSubDto, userId: string) {
        const { pause_start_date, pause_end_date, subscriptionId } = dto;

        let user = await this.prisma.customerProfile.findUnique({ where: { userId: userId } });
        if (!user) {
            throw new BadRequestException('User not found');
        }

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
            where: { id: subscriptionId, customerProfileId: user.id },
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


    /**
     * Admin API: Create a new subscription for an existing customer.
     *
     * Pricing rules:
     *  - Monthly plan  → totalPrice = numMonths × plan.price
     *    (numMonths = ceil of calendar-month difference between startDate and endDate)
     *  - Daily plan    → totalPrice = chargeableDays × plan.price
     *    (chargeableDays = days matching the delivery schedule within the date range)
     *
     * No wallet deduction – this is an admin record-keeping operation.
     */
    async createSubscriptionForCustomer(dto: CreateSubscriptionForCustomerDto) {
        const {
            customerProfileId: rawCustomerProfileId,
            planId,
            deliveryPartnerId,
            start_date,
            end_date,
            scheduleType,
            selectedDays,
            discount,
            userAddressId,
        } = dto;

        // ─── 1. Resolve customer profile (accept CustomerProfile.id OR User.id) ───
        const customerProfile = await this.prisma.customerProfile.findFirst({
            where: {
                OR: [
                    { id: rawCustomerProfileId },
                    { userId: rawCustomerProfileId },
                ],
            },
        });
        if (!customerProfile) {
            throw new BadRequestException(
                'Customer profile not found. Provide a valid CustomerProfile.id or User.id.',
            );
        }

        // ─── 2. Validate plan ───────────────────────────────────────────────────
        const plan = await this.prisma.plans.findUnique({ where: { id: planId } });
        if (!plan) throw new BadRequestException('Plan not found');
        if (!plan.isActive) throw new BadRequestException('Plan is not active');

        // ─── 3. Validate delivery partner & mess alignment ──────────────────────
        const deliveryPartner = await this.prisma.deliveryPartnerProfile.findUnique({
            where: { id: deliveryPartnerId },
        });
        if (!deliveryPartner) throw new BadRequestException('Delivery partner not found');
        if (plan.messId !== deliveryPartner.messId) {
            throw new BadRequestException('Plan does not belong to the delivery partner\'s mess');
        }

        // ─── 4. Validate optional address ───────────────────────────────────────
        if (userAddressId) {
            const addr = await this.prisma.userAddress.findUnique({ where: { id: userAddressId } });
            if (!addr) throw new BadRequestException('User address not found');
        }

        // ─── 5. Parse & validate dates ──────────────────────────────────────────
        const startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) throw new BadRequestException('Invalid start_date');

        const deriveDefaultEndDate = () => {
            if (plan.isMonthlyPlan) {
                // Default: 1 calendar month, last day inclusive
                const endExclusive = new Date(Date.UTC(
                    startDate.getUTCFullYear(),
                    startDate.getUTCMonth() + 1,
                    startDate.getUTCDate(),
                ));
                const endInclusive = new Date(endExclusive);
                endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
                return endInclusive;
            }
            return new Date(startDate); // daily plan defaults to single day
        };

        const endDate = end_date ? new Date(end_date) : deriveDefaultEndDate();
        if (isNaN(endDate.getTime())) throw new BadRequestException('Invalid end_date');
        if (endDate < startDate) throw new BadRequestException('end_date must be >= start_date');

        // ─── 6. Normalize schedule ──────────────────────────────────────────────
        const normalizedScheduleType =
            scheduleType === ScheduleType.CUSTOM ||
            (Array.isArray(selectedDays) && selectedDays.length > 0)
                ? ScheduleType.CUSTOM
                : ScheduleType.EVERYDAY;

        const normalizedSelectedDays =
            normalizedScheduleType === ScheduleType.CUSTOM
                ? (Array.isArray(selectedDays) ? selectedDays : [])
                : undefined;

        if (
            normalizedScheduleType === ScheduleType.CUSTOM &&
            (!normalizedSelectedDays || normalizedSelectedDays.length === 0)
        ) {
            throw new BadRequestException('selectedDays are required for CUSTOM schedule type');
        }

        // ─── 7. Calculate total price ────────────────────────────────────────────
        let totalPrice = 0;

        if (plan.isMonthlyPlan) {
            // Monthly: round actual day span to nearest 30-day month.
            // This avoids the calendar-month boundary bug where Jun5 → Jul5
            // (31 days, 1 real month) was being counted as 2 months.
            // Rules: 25–35 days = 1 month | 55–65 days = 2 months | etc.
            const msPerDay = 1000 * 60 * 60 * 24;
            const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
            const numMonths = Math.max(1, Math.round(totalDays / 30));

            totalPrice = numMonths * Number(plan.price);
        } else {
            // Daily plan: count chargeable delivery days
            const weekdayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
            const selectedDaysUpper =
                normalizedScheduleType === ScheduleType.CUSTOM
                    ? (normalizedSelectedDays ?? []).map((d) => d.toUpperCase())
                    : [];

            let chargeableDays = 0;
            const tempDate = new Date(startDate);
            while (tempDate <= endDate) {
                if (normalizedScheduleType === ScheduleType.EVERYDAY) {
                    chargeableDays++;
                } else {
                    const dayName = weekdayMap[tempDate.getUTCDay()];
                    if (selectedDaysUpper.includes(dayName)) chargeableDays++;
                }
                tempDate.setUTCDate(tempDate.getUTCDate() + 1);
            }

            totalPrice = chargeableDays * Number(plan.price);
        }

        // ─── 8. Apply discount ──────────────────────────────────────────────────
        const numericDiscount = Number.isFinite(Number(discount)) ? Number(discount) : 0;
        const appliedDiscount = Math.max(0, Math.min(numericDiscount, totalPrice));
        const discountedPrice = totalPrice - appliedDiscount;

        // ─── 9. Create subscription record ─────────────────────────────────────
        const userSubscription = await this.prisma.userSubscriptions.create({
            data: {
                customerProfileId: customerProfile.id,
                planId,
                messId: plan.messId,
                deliveryPartnerProfileId: deliveryPartnerId,
                start_date: startDate,
                end_date: endDate,
                scheduleType: normalizedScheduleType,
                selectedDays:
                    normalizedScheduleType === ScheduleType.CUSTOM ? normalizedSelectedDays : undefined,
                totalPrice,
                discount: appliedDiscount,
                discountedPrice,
                is_active: true,
                ...(userAddressId ? { userAddressId } : {}),
            },
        });

        // ─── 10. Auto-create deliveries ─────────────────────────────────────────
        const deliveriesToCreate: any[] = [];
        const weekdayMapDelivery = [
            'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
        ];
        const selectedDaysUpperDelivery =
            normalizedScheduleType === ScheduleType.CUSTOM
                ? (normalizedSelectedDays ?? []).map((d) => d.toUpperCase())
                : [];

        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const shouldCreate =
                normalizedScheduleType === ScheduleType.EVERYDAY ||
                selectedDaysUpperDelivery.includes(weekdayMapDelivery[currentDate.getUTCDay()]);

            if (shouldCreate) {
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
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        if (deliveriesToCreate.length > 0) {
            await this.prisma.deliveries.createMany({ data: deliveriesToCreate });
            await this.createDeliveryVariationsForPlan(planId, userSubscription.id, deliveriesToCreate.map(d => d.date));
        }

        // ─── 11. Deduct from wallet (same as register-user) ─────────────────
        const updatedProfile = await this.prisma.customerProfile.update({
            where: { id: customerProfile.id },
            data: {
                walletAmount: Number(customerProfile.walletAmount) - discountedPrice,
            },
        });

        // create transaction record (negative amount) — same as CreateUser
        try {
            await this.createWalletTransaction(customerProfile.id, -Number(discountedPrice), { note: 'Subscription purchase', subscriptionId: userSubscription.id });
        } catch (err) {
            console.error('Failed to create wallet transaction:', err);
        }

        // ─── 12. Return result ──────────────────────────────────────────────────
        return {
            message: 'Subscription created successfully',
            data: {
                subscription: {
                    id: userSubscription.id,
                    customerProfileId: customerProfile.id,
                    planId,
                    messId: plan.messId,
                    start_date: startDate,
                    end_date: endDate,
                    scheduleType: normalizedScheduleType,
                    selectedDays: normalizedSelectedDays ?? null,
                    totalPrice,
                    discount: appliedDiscount,
                    discountedPrice,
                    pricingMode: plan.isMonthlyPlan ? 'monthly' : 'daily',
                },
                deliveriesCreated: deliveriesToCreate.length,
                walletBalance: Number(updatedProfile.walletAmount),
            },
        };
    }


    /**
     * Cancel delivery for a single specific date.
     * - Marks that delivery as inactive (isActive = false).
     * - Daily plan: refund 1 × plan.price to wallet.
     * - Monthly plan: no wallet refund.
     */
    async CancelDeliveryForDate(subscriptionId: string, dateStr: string) {
        const targetDate = new Date(dateStr);
        if (isNaN(targetDate.getTime())) {
            throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
        }

        const subscription = await this.prisma.userSubscriptions.findUnique({
            where: { id: subscriptionId },
            include: { CustomerProfile: true, plan: true },
        });

        if (!subscription) throw new NotFoundException('Subscription not found');
        if (!subscription.is_active) throw new BadRequestException('Subscription is not active');
        if (!subscription.CustomerProfile) throw new BadRequestException('Customer profile not found');

        const startOfDay = new Date(Date.UTC(
            targetDate.getUTCFullYear(),
            targetDate.getUTCMonth(),
            targetDate.getUTCDate(),
            0, 0, 0, 0,
        ));
        const endOfDay = new Date(Date.UTC(
            targetDate.getUTCFullYear(),
            targetDate.getUTCMonth(),
            targetDate.getUTCDate(),
            23, 59, 59, 999,
        ));

        const delivery = await this.prisma.deliveries.findFirst({
            where: {
                subscriptionId,
                date: { gte: startOfDay, lte: endOfDay },
                isActive: true,
            },
        });

        if (!delivery) {
            throw new NotFoundException(`No active delivery found for subscription on ${dateStr}`);
        }

        if (delivery.status === 'DELIVERED') {
            throw new BadRequestException('Cannot cancel a delivery that is already delivered');
        }

        // Soft-delete the delivery
        await this.prisma.deliveries.update({
            where: { id: delivery.id },
            data: { isActive: false },
        });

        // Refund only for daily plans
        let refundAmount = 0;
        if (!subscription.plan.isMonthlyPlan) {
            refundAmount = Number(subscription.plan.price);
            const currentWallet = Number(subscription.CustomerProfile.walletAmount);
            await this.prisma.customerProfile.update({
                where: { id: subscription.CustomerProfile.id },
                data: { walletAmount: currentWallet + refundAmount },
            });
            try {
                await this.createWalletTransaction(
                    subscription.CustomerProfile.id,
                    refundAmount,
                    { note: `Delivery cancelled for ${dateStr}`, subscriptionId, deliveryId: delivery.id },
                );
            } catch (err) {
                console.error('Failed to create wallet transaction on delivery cancel:', err);
            }
        }

        return {
            message: `Delivery on ${dateStr} cancelled successfully`,
            deliveryId: delivery.id,
            refundAmount,
            planType: subscription.plan.isMonthlyPlan ? 'monthly' : 'daily',
            note: subscription.plan.isMonthlyPlan
                ? 'No wallet refund for monthly plans'
                : `Refunded ₹${refundAmount} to wallet`,
        };
    }

    /**
     * Fully cancel a subscription.
     * - Marks subscription inactive.
     * - Soft-deletes all future pending deliveries.
     * - Daily plan: refund remaining delivery days × plan.price.
     * - Monthly plan: no wallet refund.
     */
    async CancelFullSubscription(subscriptionId: string) {
        const subscription = await this.prisma.userSubscriptions.findUnique({
            where: { id: subscriptionId },
            include: { CustomerProfile: true, plan: true },
        });

        if (!subscription) throw new NotFoundException('Subscription not found');
        if (!subscription.is_active) throw new BadRequestException('Subscription is already cancelled');
        if (!subscription.CustomerProfile) throw new BadRequestException('Customer profile not found');

        const currentDate = new Date();

        const futureDeliveries = await this.prisma.deliveries.findMany({
            where: {
                subscriptionId,
                date: { gte: currentDate },
                isActive: true,
            },
        });

        const remainingDays = futureDeliveries.length;

        if (remainingDays > 0) {
            await this.prisma.deliveries.updateMany({
                where: {
                    subscriptionId,
                    date: { gte: currentDate },
                    isActive: true,
                },
                data: { isActive: false },
            });
        }

        // Wallet refund — only for daily plans
        let refundAmount = 0;
        if (!subscription.plan.isMonthlyPlan) {
            refundAmount = remainingDays * Number(subscription.plan.price);
            if (refundAmount > 0) {
                const currentWallet = Number(subscription.CustomerProfile.walletAmount);
                await this.prisma.customerProfile.update({
                    where: { id: subscription.CustomerProfile.id },
                    data: { walletAmount: currentWallet + refundAmount },
                });
                try {
                    await this.createWalletTransaction(
                        subscription.CustomerProfile.id,
                        refundAmount,
                        { note: 'Full subscription cancellation refund', subscriptionId },
                    );
                } catch (err) {
                    console.error('Failed to create wallet transaction on full cancellation:', err);
                }
            }
        }

        await this.prisma.userSubscriptions.update({
            where: { id: subscriptionId },
            data: {
                is_active: false,
                cancelled_on: new Date(),
                cancellation_start_date: null,
                cancellation_end_date: null,
            },
        });

        return {
            message: 'Subscription fully cancelled',
            subscriptionId,
            remainingDeliveriesDeactivated: remainingDays,
            refundAmount,
            planType: subscription.plan.isMonthlyPlan ? 'monthly' : 'daily',
            note: subscription.plan.isMonthlyPlan
                ? 'No wallet refund for monthly plans'
                : `Refunded ₹${refundAmount} to wallet`,
        };
    }

    /**
     * List all deliveries for a subscription with optional filters.
     */
    async getDeliveriesForSubscription(
        subscriptionId: string,
        status?: string,
        startDate?: string,
        endDate?: string,
        page: number = 1,
        limit: number = 20,
    ) {
        const subscription = await this.prisma.userSubscriptions.findUnique({
            where: { id: subscriptionId },
            select: { id: true, planId: true, messId: true },
        });
        if (!subscription) throw new NotFoundException('Subscription not found');

        const where: any = { subscriptionId };

        if (status) {
            const validStatuses = ['PENDING', 'PROGRESS', 'DELIVERED', 'COMPLETED', 'UNDELIVERED'];
            if (!validStatuses.includes(status.toUpperCase())) {
                throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            }
            where.status = status.toUpperCase();
        }

        if (startDate) {
            const parsedStart = new Date(startDate);
            if (isNaN(parsedStart.getTime())) throw new BadRequestException('Invalid startDate');
            where.date = { ...where.date, gte: parsedStart };
        }

        if (endDate) {
            const parsedEnd = new Date(endDate);
            if (isNaN(parsedEnd.getTime())) throw new BadRequestException('Invalid endDate');
            where.date = { ...where.date, lte: parsedEnd };
        }

        const skip = (page - 1) * limit;

        const [deliveries, total] = await this.prisma.$transaction([
            this.prisma.deliveries.findMany({
                where,
                orderBy: { date: 'asc' },
                skip,
                take: limit,
                include: {
                    plan: {
                        select: {
                            id: true,
                            planName: true,
                            price: true,
                            Variation: {
                                select: { id: true, title: true, description: true, isActive: true },
                            },
                        },
                    },
                    partner: {
                        include: {
                            user: {
                                select: { id: true, name: true, phone: true, email: true },
                            },
                        },
                    },
                },
            }),
            this.prisma.deliveries.count({ where }),
        ]);

        return {
            data: deliveries.map((d) => ({
                id: d.id,
                date: d.date,
                status: d.status,
                isActive: d.isActive,
                partnerId: d.partnerId,
                partner: d.partner
                    ? {
                        id: d.partner.id,
                        name: d.partner.user.name,
                        phone: d.partner.user.phone,
                        email: d.partner.user.email,
                    }
                    : null,
                variations: (d.plan as any)?.Variation ?? [],
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Private helper: after deliveries are created via createMany,
     * fetch their IDs by subscriptionId + dates, then create one
     * DeliveryVariation row per delivery x plan variation.
     */
    private async createDeliveryVariationsForPlan(
        planId: string,
        subscriptionId: string,
        dates: Date[],
    ): Promise<void> {
        if (dates.length === 0) return;

        // Fetch active variations for this plan
        const plan = await this.prisma.plans.findUnique({
            where: { id: planId },
            select: {
                Variation: {
                    where: { isActive: true },
                    select: { id: true },
                },
            },
        });
        const variationIds = plan?.Variation?.map(v => v.id) ?? [];
        if (variationIds.length === 0) return;

        // Fetch the delivery IDs we just created
        const deliveries = await this.prisma.deliveries.findMany({
            where: { subscriptionId, date: { in: dates } },
            select: { id: true },
        });
        if (deliveries.length === 0) return;

        // Create one DeliveryVariation per delivery x variation
        const records = deliveries.flatMap(d =>
            variationIds.map(vid => ({
                deliveryId: d.id,
                variationId: vid,
                status: VariationStatus.PENDING,
            }))
        );

        await this.prisma.deliveryVariation.createMany({
            data: records,
            skipDuplicates: true,
        });
    }

}

import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDeliveryAgentDto, RegisterDto, UserRegisterDto } from './dto/Registration.dto';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';
import { DeliveryStatus, EnquiryType, Role } from '@prisma/client';
import { generate6DigitOtp } from 'src/common/utility/utils';
import { MailerService } from '@nestjs-modules/mailer';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { TwoFactorService } from 'src/twofactor/twofactor.service';
import { SuperAdminLoginDto } from './dto/superadmin-login.dto';
import { SuperAdminRegisterDto } from './dto/superadmin-register.dto';
import { CreateMessAdminBySuperAdminDto, UpdateMessAdminBySuperAdminDto, MessAdminListQueryDto } from './dto/messadmin-admin.dto';
import { MessOwnerSendOtpDto, MessOwnerSignupDto } from './dto/mess-owner-signup.dto';
import * as bcrypt from 'bcrypt';


@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly otpservice: TwoFactorService,
        private readonly mailerService: MailerService,
    ) { }
    async sendOtpForRegistration(dto: RegisterDto) {
        const { email, name, phone, messId } = dto;

        const existingUser = await this.prisma.user.findUnique({
            where: { phone },
            include: { messAdminProfile: true },
        });

        let mess;

        // 🔹 Validate mess ONLY if messId is provided
        if (messId) {
            mess = await this.prisma.mess.findUnique({
                where: { id: messId },
            });

            if (!mess) {
                throw new NotFoundException('Mess not found');
            }
        }

        let user = existingUser;

        // 🔹 Create user if not exists
        if (!existingUser) {
            user = await this.prisma.user.create({
                data: {
                    name,
                    email,
                    phone,
                    role: Role.MESSADMIN,
                    is_verified: false,

                    // 🔹 Create MessAdminProfile only once
                    messAdminProfile: {
                        create: messId
                            ? {
                                messes: {
                                    connect: [{ id: messId }],
                                },
                            }
                            : {}, // no mess linked
                    },
                },
                include: {
                    messAdminProfile: { include: { messes: true } },
                },
            });
        }

        // 🔹 If user exists but messId is provided and not linked yet
        else if (messId && existingUser.messAdminProfile) {
            await this.prisma.messAdminProfile.update({
                where: { id: existingUser.messAdminProfile.id },
                data: {
                    messes: {
                        connect: [{ id: messId }],
                    },
                },
            });
        }

        // 🔹 OTP logic (unchanged)
        if (process.env.NODE_ENV === 'PRODUCTION') {
            const numbers = await this.prisma.phoneNumbers.findUnique({
                where: { phone },
            });

            if (numbers) {
                return {
                    message: 'OTP sent successfully',
                    sessionId: '2b37ee5f-41ee-4da6-abcf-d0702168c339',
                    otp: '123456',
                    status: 200,
                };
            }

            const otpResponse = await this.otpservice.sendOtp(phone);
            if (otpResponse._fallback) {
                return {
                    message: 'OTP sent successfully',
                    sessionId: otpResponse.Details, // 'FALLBACK'
                    otp: otpResponse._fallbackOtp, // '759409'
                    status: 200,
                };
            }
            return {
                message: 'OTP sent successfully',
                sessionId: otpResponse.Details,
                status: 200,
            };
        }

        return {
            message: 'OTP sent successfully',
            status: 200,
        };
    }

    //dummy otp of 123456 is given right now. after dlt registration change it to otp variable
    async sendOtpForLogin(loginDto: LoginDto) {
        const { phone } = loginDto;
        let user = await this.prisma.user.findUnique({ where: { phone: phone } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        // if (process.env.NODE_ENV === 'STAGING') {
        //     const numbers = await this.prisma.phoneNumbers.findUnique({
        //         where: { phone: phone }
        //     })
        //     if (!numbers) {
        //         throw new NotFoundException("Phone Number Not Found")
        //     }
        //     return {
        //         message: 'OTP sent successfully',
        //         sessionId: "2b37ee5f-41ee-4da6-abcf-d0702168c339",
        //         otp: "123456",
        //         status: 200,
        //     };
        // }
        else if (process.env.NODE_ENV === 'PRODUCTION') {
            const numbers = await this.prisma.phoneNumbers.findUnique({
                where: { phone: phone }
            })
            if (numbers) {
                return {
                    message: 'OTP sent successfully',
                    sessionId: "2b37ee5f-41ee-4da6-abcf-d0702168c339",
                    otp: "123456",
                    status: 200,
                };
            }
            const otpResponse = await this.otpservice.sendOtp(phone);
            if (otpResponse._fallback) {
                return {
                    message: 'OTP sent successfully',
                    sessionId: otpResponse.Details, // 'FALLBACK'
                    otp: otpResponse._fallbackOtp, // '759409'
                    status: 200,
                };
            }
            return {
                message: 'OTP sent successfully',
                sessionId: otpResponse.Details,
                status: 200,
            };
        }
    }



    async verifyOtp(dto: OtpVerifyDto) {
        const { phone, sessionId, otp } = dto;
        // if (process.env.NODE_ENV === 'STAGING') {
        //     const numbers = await this.prisma.phoneNumbers.findUnique({
        //         where: { phone: phone }
        //     })
        //     if (!numbers) {
        //         throw new NotFoundException("Phone Number Not Found")
        //     }
        //     if (otp != "123456") {
        //         throw new BadRequestException("Otp not correct")
        //     }

        // }
        if (process.env.NODE_ENV === 'PRODUCTION') {
            const numbers = await this.prisma.phoneNumbers.findUnique({
                where: { phone: phone }
            })
            if (!numbers) {
                const verify = await this.otpservice.verifyOtp(sessionId, otp);

                if (verify.Status !== 'Success') {
                    throw new UnauthorizedException('Invalid OTP');
                }
            }
            else {
                if (otp != "123456") {
                    throw new BadRequestException("Otp not correct")
                }
            }

        }
        // Step2. Fetch user and profiles
        const user = await this.prisma.user.findUnique({
            where: { phone },
            include: {
                customerProfile: {
                    include: {
                        addresses: true,
                        Wallet: true,
                    },
                },
                deliveryPartnerProfile: {
                    include: {
                        mess: true, // delivery agent belongs to one mess
                    },
                },
                messAdminProfile: {
                    include: {
                        messes: true, // mess admin may have multiple messes
                    },
                },
            },
        });
        if (!user) throw new UnauthorizedException('User not found');
        // Step3. Update verification only once
        if (!user.is_verified) {
            await this.prisma.user.update({
                where: { phone },
                data: { is_verified: true },
            });
            user.is_verified = true;
        }

        // Step4. Role specific payload
        let payloadData = {};

        switch (user.role) {
            case Role.USER:
                payloadData = {
                    profile: user.customerProfile,
                    addresses: user.customerProfile?.addresses || [],
                    wallet: user.customerProfile?.Wallet || null,
                };
                break;

            case Role.DELIVERYAGENT:
                payloadData = {
                    profile: user.deliveryPartnerProfile,
                    mess: user.deliveryPartnerProfile?.mess || null,
                };
                break;

            case Role.MESSADMIN:
                payloadData = {
                    profile: user.messAdminProfile,
                    messes: user.messAdminProfile?.messes || [],
                };
                break;

            case Role.SUPERADMIN:
                payloadData = {
                    profile: null,
                };
                break;

            default:
                payloadData = {};
        }

        // Step5. Generate token
        const accessToken = this.jwtService.sign({
            sub: user.id,
            phone: user.phone,
            email: user.email,
            role: user.role,
        });

        // Step6. Final response
        return {
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                role: user.role,
                ...payloadData,
            },
            accessToken,
            message: user.is_verified
                ? 'User verified successfully'
                : 'User already verified before',
            status: 200,
        };

    }

    async sendOtpForMessOwnerSignup(dto: MessOwnerSendOtpDto) {
        const rawName = dto.ownerName ?? dto.name;
        if (!rawName) throw new BadRequestException('ownerName (or name) is required');
        if (!dto.messName) throw new BadRequestException('messName is required');
        if (!dto.phone) throw new BadRequestException('phone is required');
        if (!dto.email) throw new BadRequestException('email is required');

        const ownerName = rawName.trim();
        const messName = dto.messName.trim();
        const phone = dto.phone.trim();
        const email = dto.email.trim().toLowerCase();
        const districtName = dto.district?.trim() ?? null;
        const zipcode = dto.zipcode?.trim() ?? null;

        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ phone }, { email }],
            },
            select: { id: true },
        });

        if (existingUser) {
            throw new BadRequestException('User already exists with this phone or email');
        }

        let district: { id: string; name: string } | null = null;
        if (districtName) {
            district = await this.prisma.district.findFirst({
                where: { name: { equals: districtName } },
                select: { id: true, name: true },
            });

            if (!district) {
                throw new BadRequestException('District not found');
            }
        }

        // Mirror existing OTP behavior, but keep a safe dev fallback.
        if (process.env.NODE_ENV === 'PRODUCTION') {
            const numbers = await this.prisma.phoneNumbers.findUnique({
                where: { phone },
            });

            if (numbers) {
                // Store a lightweight internal OTP session marker so signup can resolve without a sessionId.
                await this.prisma.enquiry.create({
                    data: {
                        name: ownerName,
                        email,
                        phone,
                        message: 'OTP_SESSION:bypass',
                        enquiryType: EnquiryType.MESS_OWNER,
                        messname: messName,
                        district: district?.name ?? null,
                        pincode: zipcode,
                    },
                });
                return {
                    message: 'OTP sent successfully',
                    otp: '123456',
                    status: 200,
                };
            }

            const otpResponse = await this.otpservice.sendOtp(phone);

            // Store sessionId internally (keyed by phone) so client does not need to manage it.
            await this.prisma.enquiry.create({
                data: {
                    name: ownerName,
                    email,
                    phone,
                    message: `OTP_SESSION:${otpResponse.Details}`,
                    enquiryType: EnquiryType.MESS_OWNER,
                    messname: messName,
                    district: district?.name ?? null,
                    pincode: zipcode,
                },
            });

            if (otpResponse._fallback) {
                return {
                    message: 'OTP sent successfully',
                    otp: otpResponse._fallbackOtp, // '759409' — SMS gateway failed, use fallback OTP
                    status: 200,
                };
            }
            return {
                message: 'OTP sent successfully',
                status: 200,
            };
        }

        // Non-production (local/dev) fallback

        await this.prisma.enquiry.create({
            data: {
                name: ownerName,
                email,
                phone,
                message: 'OTP_SESSION:local-dev',
                enquiryType: EnquiryType.MESS_OWNER,
                messname: messName,
                district: district?.name ?? null,
                pincode: zipcode,
            },
        });

        return {
            message: 'OTP sent successfully',
            otp: '123456',
            status: 200,
        };
    }

    async signupMessOwner(dto: MessOwnerSignupDto) {
        const ownerName = (dto.ownerName ?? dto.name).trim();
        const messName = dto.messName.trim();
        const phone = dto.phone.trim();
        const email = dto.email.trim().toLowerCase();
        const address = dto.address.trim();
        const districtName = dto.district?.trim() ?? null;
        const zipcode = dto.zipcode?.trim() ?? null;

        // 1) Resolve OTP sessionId internally by phone (last 10 minutes)
        const sessionRow = await this.prisma.enquiry.findFirst({
            where: {
                enquiryType: EnquiryType.MESS_OWNER,
                phone,
                message: {
                    startsWith: 'OTP_SESSION:',
                },
                createdAt: {
                    gte: new Date(Date.now() - 10 * 60 * 1000),
                },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, message: true },
        });

        if (!sessionRow) {
            throw new BadRequestException('OTP session not found or expired. Please request OTP again.');
        }

        const sessionId = sessionRow.message.replace('OTP_SESSION:', '').trim();

        // 2) OTP verification first
        if (process.env.NODE_ENV === 'PRODUCTION') {
            const numbers = await this.prisma.phoneNumbers.findUnique({
                where: { phone },
            });

            if (!numbers) {
                const verify = await this.otpservice.verifyOtp(sessionId, dto.otp);
                if (verify.Status !== 'Success') {
                    throw new UnauthorizedException('Invalid OTP');
                }
            } else {
                if (dto.otp !== '123456') {
                    throw new BadRequestException('Otp not correct');
                }
            }
        } else {
            // dev fallback: accept only 123456
            if (dto.otp !== '123456') {
                throw new BadRequestException('Otp not correct');
            }
        }

        // cleanup: remove the OTP session marker record
        await this.prisma.enquiry.delete({ where: { id: sessionRow.id } }).catch(() => undefined);

        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ phone }, { email }],
            },
            select: { id: true },
        });

        if (existingUser) {
            throw new BadRequestException('User already exists with this phone or email');
        }

        let district: { id: string; name: string } | null = null;
        if (districtName) {
            district = await this.prisma.district.findFirst({
                where: { name: { equals: districtName } },
                select: { id: true, name: true },
            });

            if (!district) {
                throw new BadRequestException('District not found');
            }
        }

        const trialEndsAt = await (async () => {
            const cfg = await this.prisma.billingGlobalConfig.findFirst({ orderBy: { createdAt: 'desc' } });
            const days = Number(cfg?.defaultTrialDays ?? 30);
            if (!days || days <= 0) return null;
            return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        })();

        const created = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: ownerName,
                    phone,
                    email,
                    role: Role.MESSADMIN,
                    is_verified: true,
                    messAdminProfile: {
                        create: {
                            messes: {
                                create: [
                                    {
                                        name: messName,
                                        address,
                                        phone,
                                        email,
                                        ...(district ? { districtId: district.id } : {}),
                                        zipcode,
                                        is_verified: false,
                                        MessBillingConfig: {
                                            create: {
                                                trialEndsAt,
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                include: {
                    messAdminProfile: {
                        include: {
                            messes: {
                                include: {
                                    District: true,
                                },
                            },
                        },
                    },
                },
            });

            const createdMess = user.messAdminProfile?.messes?.[0];

            await tx.enquiry.create({
                data: {
                    name: ownerName,
                    email,
                    phone,
                    message: `New mess owner signup request for ${messName}`,
                    enquiryType: EnquiryType.MESS_OWNER,
                    messId: createdMess?.id,
                    messname: messName,
                    district: district?.name ?? null,
                    pincode: zipcode,
                },
            });

            return { user };
        });

        const accessToken = await this.jwtService.signAsync({
            sub: created.user.id,
            phone: created.user.phone,
            email: created.user.email,
            role: created.user.role,
        });

        return {
            message: 'Mess owner signed up successfully',
            accessToken,
            user: {
                id: created.user.id,
                name: created.user.name,
                phone: created.user.phone,
                email: created.user.email,
                role: created.user.role,
                profile: created.user.messAdminProfile,
                messes: created.user.messAdminProfile?.messes ?? [],
            },
            status: 201,
        };
    }


    async ListDeliveryAgents(page: number = 1, limit: number = 10, search?: string) {
        const skip = (page - 1) * limit;
        const whereClause: any = {
            role: Role.DELIVERYAGENT,
        };
        if (search) {
            whereClause.email = {
                contains: search.toLowerCase()
            };
        }
        const [agents, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where: whereClause }),
        ]);
        return {
            data: agents,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getDashboardStats(
        user: any,
        messId?: string,
        date1?: string,
        date2?: string,
    ) {

        let allowedMessIds: string[] = [];

        // ---------------------------------------------------
        // 1️⃣ Resolve allowed mess scope
        // ---------------------------------------------------

        if (user.role === 'SUPERADMIN') {

            if (messId) {
                allowedMessIds = [messId];
            } else {
                const messes = await this.prisma.mess.findMany({
                    select: { id: true },
                });
                allowedMessIds = messes.map(m => m.id);
            }

        } else if (user.role === 'MESSADMIN') {

            const adminProfile = await this.prisma.messAdminProfile.findUnique({
                where: { userId: user.id },
                select: {
                    messes: {
                        select: { id: true },
                    },
                },
            });

            const adminMessIds = adminProfile?.messes.map(m => m.id) || [];

            if (messId) {
                if (!adminMessIds.includes(messId)) {
                    throw new ForbiddenException(
                        'You are not allowed to access this mess'
                    );
                }
                allowedMessIds = [messId];
            } else {
                allowedMessIds = adminMessIds;
            }
        }

        // count for response
        const messesCount = allowedMessIds.length;

        const messFilter =
            allowedMessIds.length > 0
                ? { messId: { in: allowedMessIds } }
                : {};

        // ---------------------------------------------------
        // Date filter construction
        // ---------------------------------------------------

        let dateFilter: any = {};

        if (date1 && !date2) {
            // single day insight
            const start = startOfDay(new Date(date1));
            const end = endOfDay(new Date(date1));

            dateFilter = {
                start_date: {
                    gte: start,
                    lte: end,
                },
            };
        }

        if (date1 && date2) {
            // date range insight
            const start = startOfDay(new Date(date1));
            const end = endOfDay(new Date(date2));

            dateFilter = {
                start_date: {
                    gte: start,
                    lte: end,
                },
            };
        }



        // ---------------------------------------------------
        // 2️⃣ Total Customers
        // ---------------------------------------------------

        const totalCustomers = await this.prisma.user.count({
            where: {
                role: 'USER',
                customerProfile: {
                    userSubscriptions: {
                        some: {
                            ...messFilter,
                            ...dateFilter,
                        },
                    }

                },
            },
        });

        // ---------------------------------------------------
        // 3️⃣ Delivery Partners
        // ---------------------------------------------------

        const partnerFilter =
            allowedMessIds.length > 0
                ? { deliveryPartnerProfile: { messId: { in: allowedMessIds } } }
                : {};

        const totalPartners = await this.prisma.user.count({
            where: {
                role: 'DELIVERYAGENT',
                ...partnerFilter,
            },
        });

        const activePartners = await this.prisma.user.count({
            where: {
                role: 'DELIVERYAGENT',
                is_active: true,
                ...partnerFilter,
            },
        });


        // ---------------------------------------------------
        // 4️⃣ Subscriptions
        // ---------------------------------------------------

        const subscriptions = await this.prisma.userSubscriptions.findMany({
            where: {
                ...messFilter,
                ...dateFilter,
            },

            select: {
                totalPrice: true,
                discountedPrice: true,
                is_active: true,
                start_date: true,
                createdAt: true,
            },
        });

        // ---------------------------------------------------
        // 5️⃣ Calculations (UNCHANGED)
        // ---------------------------------------------------

        const totalRevenue = subscriptions.reduce(
            (sum, s) => sum + Number(s.discountedPrice || s.totalPrice),
            0
        );

        const completedOrders = subscriptions.filter(s => s.is_active).length;
        const totalOrders = subscriptions.length;

        const pendingRevenue = subscriptions
            .filter(s => !s.is_active)
            .reduce(
                (sum, s) =>
                    sum + Number(s.discountedPrice || s.totalPrice),
                0
            );

        const today = new Date();

        const todaysRevenue = subscriptions
            .filter(
                s =>
                    s.start_date >= startOfDay(today) &&
                    s.start_date <= endOfDay(today)
            )
            .reduce(
                (sum, s) =>
                    sum + Number(s.discountedPrice || s.totalPrice),
                0
            );

        const avgPerCustomer =
            totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

        // ---------------------------------------------------
        // 6️⃣ Final response (ONLY ADD messesCount)
        // ---------------------------------------------------

        return {
            totalRevenue,
            completedOrders,
            totalOrders,
            totalCustomers,
            totalPartners,
            activePartners,
            avgPerCustomer,
            pendingRevenue,
            todaysRevenue,
            messesCount, // ✅ newly added
        };
    }



    async getallmessadmin(query?: MessAdminListQueryDto, page: number = 1, limit: number = 10) {
        const { search, isActive } = query || {};

        const where: any = {
            role: Role.MESSADMIN,
        };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
            ];
        }

        if (isActive !== undefined) {
            where.is_active = isActive === 'true';
        }

        const skip = (page - 1) * limit;

        const [users, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                include: {
                    messAdminProfile: {
                        include: {
                            messes: {
                                select: {
                                    id: true,
                                    name: true,
                                    address: true,
                                    is_active: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { name: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data: users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async createMessAdminBySuperAdmin(dto: CreateMessAdminBySuperAdminDto) {
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: dto.email }, { phone: dto.phone }],
            },
        });

        if (existingUser) {
            throw new BadRequestException('User already exists');
        }

        const messIds = dto.messIds || [];

        if (messIds.length) {
            const messes = await this.prisma.mess.findMany({
                where: { id: { in: messIds } },
                select: { id: true },
            });

            if (messes.length !== messIds.length) {
                throw new BadRequestException('One or more messIds are invalid');
            }
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const user = await this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                password: hashedPassword,
                role: Role.MESSADMIN,
                is_verified: true,
                is_active: dto.is_active ?? true,
                messAdminProfile: {
                    create: messIds.length
                        ? {
                            messes: {
                                connect: messIds.map((id) => ({ id })),
                            },
                        }
                        : {},
                },
            },
            include: {
                messAdminProfile: {
                    include: { messes: true },
                },
            },
        });

        return {
            message: 'Mess admin created successfully',
            data: user,
        };
    }

    async updateMessAdminBySuperAdmin(id: string, dto: UpdateMessAdminBySuperAdminDto) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { messAdminProfile: true },
        });

        if (!user || user.role !== Role.MESSADMIN) {
            throw new NotFoundException('Mess admin not found');
        }

        const existingEmail = dto.email
            ? await this.prisma.user.findFirst({
                where: { email: dto.email, NOT: { id } },
            })
            : null;

        if (existingEmail) {
            throw new BadRequestException('Email already in use');
        }

        const existingPhone = dto.phone
            ? await this.prisma.user.findFirst({
                where: { phone: dto.phone, NOT: { id } },
            })
            : null;

        if (existingPhone) {
            throw new BadRequestException('Phone number already in use');
        }

        const updateData: any = {};
        if (dto.name !== undefined) updateData.name = dto.name;
        if (dto.email !== undefined) updateData.email = dto.email;
        if (dto.phone !== undefined) updateData.phone = dto.phone;
        if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
        if (dto.password !== undefined) {
            updateData.password = await bcrypt.hash(dto.password, 10);
        }

        await this.prisma.user.update({
            where: { id },
            data: updateData,
        });

        if (dto.messIds !== undefined) {
            const messes = await this.prisma.mess.findMany({
                where: { id: { in: dto.messIds } },
                select: { id: true },
            });

            if (messes.length !== dto.messIds.length) {
                throw new BadRequestException('One or more messIds are invalid');
            }

            if (!user.messAdminProfile) {
                await this.prisma.messAdminProfile.create({
                    data: {
                        userId: id,
                        messes: {
                            connect: dto.messIds.map((messId) => ({ id: messId })),
                        },
                    },
                });
            } else {
                await this.prisma.messAdminProfile.update({
                    where: { id: user.messAdminProfile.id },
                    data: {
                        messes: {
                            set: dto.messIds.map((messId) => ({ id: messId })),
                        },
                    },
                });
            }
        }

        const updated = await this.prisma.user.findUnique({
            where: { id },
            include: {
                messAdminProfile: {
                    include: { messes: true },
                },
            },
        });

        return {
            message: 'Mess admin updated successfully',
            data: updated,
        };
    }

    // -------------------------------------------------------
    // PHASE 3
    // -------------------------------------------------------
    async sendOtpForClientRegistration(dto: UserRegisterDto) {
        const {
            email,
            phone,
            name,
            street,
            townOrcity,
            country,
            postcode,
            landmark,
            latitudeLogitude,
        } = dto;
        const otp = '123456'
        // Fetch user with customerProfile
        let user = await this.prisma.user.findUnique({
            where: { phone },
            include: { customerProfile: true },
        });

        // Create user (and empty customerProfile) only if not present
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    name,
                    email,
                    phone,
                    otp: otp, //remove this 
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now //remove this
                    role: Role.USER, // keep as in your original code
                    is_verified: false,
                    customerProfile: {
                        create: {},
                    },
                },
                include: { customerProfile: true },
            });
        }

        // Ensure customerProfile exists (in case of legacy users without profile)
        let customerProfile = user.customerProfile;
        if (!customerProfile) {
            customerProfile = await this.prisma.customerProfile.create({
                data: {
                    userId: user.id,
                },
            });
        }

        // Check if we have the minimum required data to create address
        const hasRequiredAddressData = street && townOrcity && postcode;

        if (hasRequiredAddressData) {
            await this.prisma.userAddress.create({
                data: {
                    name,
                    street,
                    townOrcity,
                    postcode,
                    phone,
                    email,
                    profileId: customerProfile.id,
                    ...(country && { country }),
                    ...(landmark && { landmark }),
                    ...(latitudeLogitude && { latitudeLogitude }),
                },
            });
        }

        // if (process.env.NODE_ENV === 'STAGING') {
        //     const numbers = await this.prisma.phoneNumbers.findUnique({
        //         where: { phone: phone }
        //     })
        //     if (!numbers) {
        //         throw new NotFoundException("Phone Number Not Found")
        //     }
        //     return {
        //         message: 'OTP sent successfully',
        //         sessionId: "2b37ee5f-41ee-4da6-abcf-d0702168c339",
        //         otp: "123456",
        //         status: 200,
        //     };
        // }
        if (process.env.NODE_ENV === 'PRODUCTION') {
            const numbers = await this.prisma.phoneNumbers.findUnique({
                where: { phone: phone }
            })
            if (numbers) {
                return {
                    message: 'OTP sent successfully',
                    sessionId: "2b37ee5f-41ee-4da6-abcf-d0702168c339",
                    otp: "123456",
                    status: 200,
                };
            }
            const otpResponse = await this.otpservice.sendOtp(phone);
            if (otpResponse._fallback) {
                return {
                    message: 'OTP sent successfully',
                    sessionId: otpResponse.Details, // 'FALLBACK'
                    otp: otpResponse._fallbackOtp, // '759409'
                    status: 200,
                };
            }
            return {
                message: 'OTP sent successfully',
                sessionId: otpResponse.Details,
                status: 200,
            };
        }
    }

    async sendOtpForDeliveryAgentRegistration(dto: RegisterDeliveryAgentDto) {
        const { email, phone, name, messId, deliveryRegion, address } = dto;

        let user = await this.prisma.user.findUnique({
            where: { phone },
            include: { deliveryPartnerProfile: true },
        });
        const otp = '123456'
        // Create user + deliveryPartnerProfile if not found
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    name,
                    email,
                    phone,
                    role: Role.DELIVERYAGENT,
                    otp: otp, //remove this 
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now //remove this
                    is_verified: false,
                    deliveryPartnerProfile: {
                        create: {
                            messId,
                            deliveryRegion,
                            address,
                        },
                    },
                },
                include: { deliveryPartnerProfile: true },
            });
        }

        // If user exists but does not have a delivery partner profile (legacy case)
        if (!user.deliveryPartnerProfile) {
            await this.prisma.deliveryPartnerProfile.create({
                data: {
                    userId: user.id,
                    messId,
                    deliveryRegion,
                    address,
                },
            });
        }

        // Update delivery partner profile if already exists and want to update values
        else {
            await this.prisma.deliveryPartnerProfile.update({
                where: { userId: user.id },
                data: {
                    ...(deliveryRegion && { deliveryRegion }),
                    ...(address && { address }),
                },
            });
        }

        // if (process.env.NODE_ENV === 'STAGING') {
        //     const numbers = await this.prisma.phoneNumbers.findUnique({
        //         where: { phone: phone }
        //     })
        //     if (!numbers) {
        //         throw new NotFoundException("Phone Number Not Found")
        //     }
        //     return {
        //         message: 'OTP sent successfully',
        //         sessionId: "2b37ee5f-41ee-4da6-abcf-d0702168c339",
        //         otp: "123456",
        //         status: 200,
        //     };
        // }
        if (process.env.NODE_ENV === 'PRODUCTION') {
            const numbers = await this.prisma.phoneNumbers.findUnique({
                where: { phone: phone }
            })
            if (numbers) {
                return {
                    message: 'OTP sent successfully',
                    sessionId: "2b37ee5f-41ee-4da6-abcf-d0702168c339",
                    otp: "123456",
                    status: 200,
                };
            }
            const otpResponse = await this.otpservice.sendOtp(phone);
            if (otpResponse._fallback) {
                return {
                    message: 'OTP sent successfully',
                    sessionId: otpResponse.Details, // 'FALLBACK'
                    otp: otpResponse._fallbackOtp, // '759409'
                    status: 200,
                };
            }
            return {
                message: 'OTP sent successfully',
                sessionId: otpResponse.Details,
                status: 200,
            };
        }
    }


    async AddPhoneNumber(number: string) {
        const phone = await this.prisma.phoneNumbers.create({
            data: { phone: number }
        })

        return { message: "Phone Number added successfully." }
    }



    async registerSuperAdmin(dto: SuperAdminRegisterDto) {
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: dto.email }, { phone: dto.phone }],
            },
        });

        if (existingUser) {
            throw new BadRequestException('User already exists');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const superAdmin = await this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                password: hashedPassword,
                role: Role.SUPERADMIN,
                is_verified: true,
            },
        });

        // ✅ JWT payload
        const payload = {
            sub: superAdmin.id,
            role: superAdmin.role,
            email: superAdmin.email,
        };

        // ✅ Generate access token
        const accessToken = await this.jwtService.signAsync(payload);

        return {
            message: 'Super Admin registered successfully',
            accessToken,
            user: {
                id: superAdmin.id,
                name: superAdmin.name,
                email: superAdmin.email,
                role: superAdmin.role,
            },
        };
    }

    async loginSuperAdmin(dto: SuperAdminLoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user || user.role !== Role.SUPERADMIN || !user.password) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordMatch = await bcrypt.compare(dto.password, user.password);

        if (!passwordMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = {
            sub: user.id,
            role: user.role,
            email: user.email,
        };

        const token = await this.jwtService.signAsync(payload);

        return {
            accessToken: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        };
    }
}
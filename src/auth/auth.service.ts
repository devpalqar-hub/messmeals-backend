import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDeliveryAgentDto, RegisterDto, UserRegisterDto } from './dto/Registration.dto';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';
import { DeliveryStatus, Role } from '@prisma/client';
import { generate6DigitOtp } from 'src/common/utility/utils';
import { MailerService } from '@nestjs-modules/mailer';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { TwoFactorService } from 'src/twofactor/twofactor.service';

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
        const existingUser = await this.prisma.user.findUnique({ where: { phone } });
        const mess = await this.prisma.mess.findUnique({ where: { id: messId } });
        if (!mess) {
            throw new Error("Mess not found");
        }
        // Create user only if not present
        let user = existingUser;
        if (!existingUser) {
            user = await this.prisma.user.create({
                data: {
                    name,
                    email,
                    phone,
                    role: Role.MESSADMIN,
                    is_verified: false,
                    messAdminProfile: {
                        create: {
                            messes: {
                                connect: [{ id: messId }],
                            },
                        },
                    },
                },
                include: {
                    messAdminProfile: { include: { messes: true } },
                },
            });
        }
        const otpResponse = await this.otpservice.sendOtp(phone);

        return {
            message: 'OTP sent successfully',
            sessionId: otpResponse.Details,
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
        const otpResponse = await this.otpservice.sendOtp(phone);
        return {
            message: 'OTP sent successfully',
            sessionId: otpResponse.Details,  // store this on frontend
            status: 200,
        };
    }



    async verifyOtp(dto: OtpVerifyDto) {
        const { phone, sessionId, otp } = dto;

        // Step1. Verify OTP from external service
        const verify = await this.otpservice.verifyOtp(sessionId, otp);

        if (verify.Status !== 'Success') {
            throw new UnauthorizedException('Invalid OTP');
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


    async getDashboardStats(messId?: string) {
        // Add filter object (empty if messId is not passed)
        const messFilter = messId ? { messId } : {};

        // 1️⃣ Total Customers (role = USER, mess-specific)
        const totalCustomers = await this.prisma.user.count({
            where: {
                role: 'USER',
                customerProfile: {
                    userSubscriptions: {
                        some: messFilter,
                    },
                },
            },
        });

        // 2️⃣ Total Partners (role = DELIVERYAGENT, mess-specific)
        const totalPartners = await this.prisma.user.count({
            where: {
                role: 'DELIVERYAGENT',
                deliveryPartnerProfile: messId ? { messId } : {},
            },
        });

        const activePartners = await this.prisma.user.count({
            where: {
                role: 'DELIVERYAGENT',
                is_active: true,
                deliveryPartnerProfile: messId ? { messId } : {},
            },
        });

        // 3️⃣ Subscriptions data (mess-specific)
        const subscriptions = await this.prisma.userSubscriptions.findMany({
            where: messFilter,
            select: {
                totalPrice: true,
                discountedPrice: true,
                is_active: true,
                start_date: true,
                createdAt: true,
            },
        });

        // 4️⃣ Calculations
        const totalRevenue = subscriptions.reduce(
            (sum, s) => sum + Number(s.discountedPrice || s.totalPrice),
            0
        );

        const completedOrders = subscriptions.filter((s) => s.is_active).length;
        const totalOrders = subscriptions.length;

        const pendingRevenue = subscriptions
            .filter((s) => !s.is_active)
            .reduce((sum, s) => sum + Number(s.discountedPrice || s.totalPrice), 0);

        const today = new Date();
        const todaysRevenue = subscriptions
            .filter(
                (s) =>
                    s.start_date >= startOfDay(today) &&
                    s.start_date <= endOfDay(today)
            )
            .reduce((sum, s) => sum + Number(s.discountedPrice || s.totalPrice), 0);

        const avgPerCustomer =
            totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

        // 5️⃣ Final response
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
        };
    }
    async getallmessadmin() {
        const users = await this.prisma.user.findMany({
            include: {
                messAdminProfile: true
            }
        })

        return users

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

        const otpResponse = await this.otpservice.sendOtp(phone);

        return {
            message: 'OTP sent successfully',
            sessionId: otpResponse.Details,
            status: 200,
        };
    }

    async sendOtpForDeliveryAgentRegistration(dto: RegisterDeliveryAgentDto) {
        const { email, phone, name, messId, deliveryRegion, address } = dto;

        let user = await this.prisma.user.findUnique({
            where: { phone },
            include: { deliveryPartnerProfile: true },
        });

        // Create user + deliveryPartnerProfile if not found
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    name,
                    email,
                    phone,
                    role: Role.DELIVERYAGENT,
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

        const otpResponse = await this.otpservice.sendOtp(phone);

        return {
            message: 'OTP sent successfully',
            sessionId: otpResponse.Details,
            status: 200,
        };
    }



}
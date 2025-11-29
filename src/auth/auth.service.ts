import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/Registration.dto';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';
import { DeliveryStatus, Roles } from '@prisma/client';
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
                    role: Roles.MESSADMIN,
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


    async verifyOtp(dto: OtpVerifyDto) {
        const { phone, sessionId, otp } = dto;

        // 1️⃣ Verify OTP using 2Factor
        const verify = await this.otpservice.verifyOtp(sessionId, otp);

        if (verify.Status !== 'Success') {
            throw new UnauthorizedException('Invalid OTP');
        }

        // 2️⃣ Fetch user with mess-admin profile
        const user = await this.prisma.user.findUnique({
            where: { phone },
            include: {
                messAdminProfile: {
                    include: {
                        messes: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!user) throw new UnauthorizedException('User not found');

        // 3️⃣ Update verification status
        let updatedUser = user;

        if (!user.is_verified) {
            updatedUser = await this.prisma.user.update({
                where: { phone },
                data: { is_verified: true },
                include: {
                    messAdminProfile: {
                        include: {
                            messes: { select: { id: true, name: true } },
                        },
                    },
                },
            });
        }

        // 4️⃣ MessAdmin mess details
        const messes = updatedUser.messAdminProfile?.messes || [];

        // 5️⃣ Generate JWT
        const accessToken = this.jwtService.sign({
            sub: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
        });

        // 6️⃣ Final payload
        return {
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role,
                messes,
            },
            accessToken,
            message: user.is_verified
                ? 'User already verified'
                : 'User verified successfully',
            status: 200,
        };
    }

    async ListDeliveryAgents(page: number = 1, limit: number = 10, search?: string) {
        const skip = (page - 1) * limit;
        const whereClause: any = {
            role: Roles.DELIVERYAGENT,
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



}
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

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly userService: UserService,
        private readonly mailerService: MailerService,
    ) { }


    //dummy otp of 123456 is given right now. after dlt registration change it to otp variable
    async sendOtpForLogin(loginDto: LoginDto) {
        const otp = generate6DigitOtp();
        const { phone } = loginDto;
        let user = await this.prisma.user.findUnique({ where: { phone: phone } });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        user = await this.prisma.user.update({
            where: { phone: phone },
            data: {
                otp: '123456',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
            }
        });
        // await this.mailerService.sendMail({
        //     to: loginDto.email,
        //     subject: 'Login OTP',
        //     template: 'authentication', // ✅ refers to authentication.pug
        //     context: {
        //         otp, // ✅ available inside the template
        //     },
        // });
        return { message: 'OTP sent successfully' };
    }

    //dummy otp of 123456 is given right now. after dlt registration change it to otp variable
    async sendOtpForRegistration(dto: RegisterDto) {
        const otp = generate6DigitOtp();
        const { email, name, phone } = dto;
        let user = await this.prisma.user.findUnique({ where: { phone: phone } });
        const mess = await this.prisma.mess.findUnique({ where: { id: dto.messId } })
        if (!mess) {
            throw new Error("Mess Not found")
        }
        if (!user) {
            // 3️⃣ Create new user with MessAdminProfile
            user = await this.prisma.user.create({
                data: {
                    name,
                    email,
                    phone,
                    otp: '123456',
                    role: Roles.MESSADMIN,
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                    is_verified: false,
                    messAdminProfile: {
                        create: {
                            messes: {
                                connect: [{ id: mess.id }], // ✅ link to existing mess
                            },
                        },
                    },
                },
                include: {
                    messAdminProfile: { include: { messes: true } },
                },
            });
        }
        // await this.mailerService.sendMail({
        //     to: loginDto.email,
        //     subject: 'Login OTP',
        //     template: 'authentication', // ✅ refers to authentication.pug
        //     context: {
        //         otp, // ✅ available inside the template
        //     },
        // });
        console.log(1)
        return { message: 'OTP sent successfully' };
    }


    async verifyOtp(dto: OtpVerifyDto) {
        const { phone } = dto;

        // 1️⃣ Find user with role and messAdminProfile (if exists)
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

        // 2️⃣ Check if OTP and expiry exist
        if (!user.otp || !user.expiresAt) {
            throw new UnauthorizedException('No OTP found for this user');
        }

        // 3️⃣ Validate OTP and expiry
        const isOtpValid = user.otp === '123456';
        const isOtpNotExpired = user.expiresAt > new Date();

        if (!isOtpValid || !isOtpNotExpired) {
            throw new UnauthorizedException('Invalid OTP or OTP has expired');
        }

        // 4️⃣ Update verification status if needed
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

        // 5️⃣ Clear OTP fields (optional for security)
        await this.prisma.user.update({
            where: { phone },
            data: { otp: null, expiresAt: null },
        });

        // 6️⃣ Extract mess info (only if user is a MESSADMIN)
        const messes = user.messAdminProfile?.messes || [];

        // 7️⃣ Generate JWT token
        const accessToken = this.jwtService.sign({
            sub: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
        });

        // 8️⃣ Return response
        return {
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role,
                messes: messes, // ✅ includes [{ id, name }]
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


    async getDashboardStats() {
        // 1️⃣ Total Customers (role = USER)
        const totalCustomers = await this.prisma.user.count({
            where: { role: Roles.USER },
        });

        // 2️⃣ Total Partners (role = DELIVERYAGENT)
        const totalPartners = await this.prisma.user.count({
            where: { role: Roles.DELIVERYAGENT },
        });

        const activePartners = await this.prisma.user.count({
            where: { role: Roles.DELIVERYAGENT, is_active: true },
        });

        // 3️⃣ Subscriptions data
        const subscriptions = await this.prisma.userSubscriptions.findMany({
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

        // 5️⃣ Construct the final dashboard response
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
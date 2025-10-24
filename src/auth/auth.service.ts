import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';
import { DeliveryStatus, Roles } from '@prisma/client';
import { generate6DigitOtp } from 'src/common/utility/utils';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly userService: UserService,
        private readonly mailerService: MailerService,
    ) { }

    // // 🟢 Register new admin
    // async register(dto: RegisterDto) {
    //     const existing = await this.prisma.user.findUnique({
    //         where: { email: dto.email },
    //     });
    //     if (existing) throw new BadRequestException('Email already registered');
    //     const hashedPassword = await bcrypt.hash(dto.password, 10);

    //     const user = await this.userService.createAdmin({
    //         name: dto.name,
    //         email: dto.email,
    //         phone: dto.phone,
    //         password: hashedPassword
    //     });
    //     const { password, ...returnWithoutPass } = user
    //     const token = this.jwtService.sign({ sub: user.id, email: user.email });
    //     return { returnWithoutPass, token };
    // }

    // // 🟡 Login for admin
    // async login(dto: LoginDto) {
    //     const user = await this.prisma.user.findUnique({
    //         where: { email: dto.email },
    //     });
    //     if (!user) throw new UnauthorizedException('Invalid credentials');
    //     const passwordValid = await bcrypt.compare(dto.password, user.password);
    //     if (!passwordValid)
    //         throw new UnauthorizedException('Invalid credentials');
    //     const token = this.jwtService.sign({ sub: user.id, email: user.email });
    //     const { password, ...returnWithoutPass } = user
    //     return { returnWithoutPass, token };
    // }

    // // 🔴 Logout
    // async logout() {
    //     // JWTs are stateless; just return success or implement token blacklist if needed.
    //     return { message: 'Logout successful' };
    // }




    async sendOtp(loginDto: LoginDto) {
        const otp = generate6DigitOtp();
        let user = await this.prisma.user.findUnique({ where: { email: loginDto.email } });
        if (!user) {
            await this.prisma.user.create({
                data: {
                    name: loginDto.name,
                    email: loginDto.email,
                    phone: loginDto.phone,
                    otp: otp,
                    role: Roles.ADMIN,
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
                    is_verified: false,
                }
            });
        }
        else {
            user = await this.prisma.user.update({
                where: { email: loginDto.email },
                data: {
                    otp: otp,
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
                }
            });
        }
        await this.mailerService.sendMail({
            to: loginDto.email,
            subject: 'Login OTP',
            template: 'authentication', // ✅ refers to authentication.pug
            context: {
                otp, // ✅ available inside the template
            },
        });
        return { message: 'OTP sent successfully' };
    }


    async verifyOtp(email: string, otp: string) {
        // 1️⃣ Find the user by email
        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // 2️⃣ Check if OTP and expiry exist
        if (!user.otp || !user.expiresAt) {
            throw new UnauthorizedException('No OTP found for this user');
        }

        // 3️⃣ Validate OTP and expiry
        const isOtpValid = user.otp === otp;
        const isOtpNotExpired = user.expiresAt > new Date();

        if (!isOtpValid || !isOtpNotExpired) {
            throw new UnauthorizedException('Invalid OTP or OTP has expired');
        }

        // 4️⃣ Update verification status if needed
        let updatedUser = user;
        if (!user.is_verified) {
            updatedUser = await this.prisma.user.update({
                where: { email },
                data: { is_verified: true },
            });
        }

        // 5️⃣ Clear OTP fields (optional but recommended for security)
        await this.prisma.user.update({
            where: { email },
            data: { otp: null, expiresAt: null },
        });

        // 6️⃣ Return response with JWT token
        return {
            user: updatedUser,
            accessToken: this.jwtService.sign({
                sub: updatedUser.id,
                email: updatedUser.email,
            }),
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


    async getCustomerStats() {
        const totalCustomers = await this.prisma.user.count({
            where: { role: Roles.USER, },
        });

        const totalDeliveryAgent = await this.prisma.user.count({
            where: {
                role: Roles.DELIVERYAGENT,
            },
        });

        const orders = await this.prisma.deliveries.count({
            where: { status: DeliveryStatus.PLACED }
        })

        const revenueCollected = await this.prisma.deliveries.count({
            //
        })

        // Future calculations (dummy for now)
        const avgWalletPerCustomer = 0.0;
        const pendingAmount = 0.0;

        return {
            orders,
            totalDeliveryAgent,
            totalCustomers,
            avgWalletPerCustomer,
            pendingAmount,
        };
    }

}
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
import { Roles } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly userService: UserService
    ) { }

    // 🟢 Register new admin
    async register(dto: RegisterDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) throw new BadRequestException('Email already registered');
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const user = await this.userService.createAdmin({
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            password: hashedPassword
        });
        const { password, ...returnWithoutPass } = user
        const token = this.jwtService.sign({ sub: user.id, email: user.email });
        return { returnWithoutPass, token };
    }

    // 🟡 Login for admin
    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user) throw new UnauthorizedException('Invalid credentials');
        const passwordValid = await bcrypt.compare(dto.password, user.password);
        if (!passwordValid)
            throw new UnauthorizedException('Invalid credentials');
        const token = this.jwtService.sign({ sub: user.id, email: user.email });
        const { password, ...returnWithoutPass } = user
        return { returnWithoutPass, token };
    }

    // 🔴 Logout
    async logout() {
        // JWTs are stateless; just return success or implement token blacklist if needed.
        return { message: 'Logout successful' };
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
        // Count only users with role USER (customers)
        const totalCustomers = await this.prisma.user.count({
            where: { role: 'USER' },
        });

        // Future calculations (dummy for now)
        const avgWalletPerCustomer = 0.0;
        const pendingAmount = 0.0;

        return {
            totalCustomers,
            avgWalletPerCustomer,
            pendingAmount,
        };
    }
}

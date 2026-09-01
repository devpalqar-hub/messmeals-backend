import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { paginate } from 'src/common/utility/pagination.util';
import { GetUsersQueryDto } from './dto/list-users.query.dto';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) { }

    // 🟢 Create a new customer (customers live in their own `Customer` table)
    async createUser(data: Prisma.CustomerCreateInput) {
        const { name, phone, email } = data;
        return this.prisma.customer.create({ data: { name, phone, email } });
    }

    // 🟢 Create a new user
    async createDeliveryAgent(data: CreateUserDto) {
        const { name, phone, email, password } = data;
        return this.prisma.user.create({ data: { name, phone, email, role: Role.DELIVERYAGENT } });
    }

    async createMessAdmin(data: CreateUserDto) {
        const { name, phone, email, password } = data;
        return this.prisma.user.create({ data: { name, phone, email, role: Role.MESSADMIN } });
    }

    // 🟡 List all staff/admin users (customers live in their own `Customer` table now)
    async findAll() {
        return this.prisma.user.findMany({
            include: {
                deliveryPartnerProfile: true,
            },
        });
    }

    // 🟣 Get a single staff/admin user by ID
    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                deliveryPartnerProfile: true,
            },
        });

        if (!user) throw new NotFoundException(`User with ID ${id} not found`);
        return user;
    }

    // 🟠 Update (patch) user by ID
    async update(id: string, data: Prisma.UserUpdateInput) {
        const existing = await this.prisma.user.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`User with ID ${id} not found`);

        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    // 🔴 Delete user by ID
    async remove(id: string) {
        const existing = await this.prisma.user.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`User with ID ${id} not found`);

        return this.prisma.user.delete({ where: { id } });
    }


    //phase 2.

    async userProfile(userId: string, role: Role) {
        // Customers live in their own `Customer` table — `role` comes straight off the
        // JWT (req.user.role), so we know which table to query before we've queried
        // anything.
        if (role === Role.USER) {
            const customer = await this.prisma.customer.findUnique({
                where: { id: userId },
                include: { customerProfile: true },
            });
            if (!customer) throw new BadRequestException("User not found");
            return customer;
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        })
        if (!user) throw new BadRequestException("User not found");
        let includeOptions: any = {}
        switch (user.role) {
            case Role.MESSADMIN:
                includeOptions = { messAdminProfile: true };
                break;

            case Role.DELIVERYAGENT:
                includeOptions = { deliveryAgentProfile: true };
                break;

            case Role.SUPERADMIN:
                includeOptions = { adminProfile: true };
                break;

            default:
                throw new BadRequestException("No profile found");
        }

        return await this.prisma.user.findUnique({
            where: { id: userId },
            include: includeOptions,
        });
    }


    async getAllUsersForSuperAdmin(query: GetUsersQueryDto) {
        const { search, is_active, role, page, limit } = query;

        const where: Prisma.UserWhereInput = {};

        /* Search: name | phone | email */
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { phone: { contains: search } },
                { email: { contains: search } },
            ];
        }

        /* Filter: is_active */
        if (is_active !== undefined) {
            where.is_active = is_active === 'true';
        }

        /* Filter: role */
        if (role) {
            where.role = role;
        }

        return paginate({
            prismaModel: this.prisma.user,
            page,
            limit,
            where,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                customerProfile: true,
                deliveryPartnerProfile: true,
                messAdminProfile: true,
            },
        });
    }

    // Staff/admin users only — customers live in their own `Customer` table and are
    // not returned by this endpoint (see `GET /customer/:id` for customer detail).
    async getUserByIdForSuperAdmin(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                deliveryPartnerProfile: {
                    include: {
                        mess: true,
                        deliveries: true,
                        userSubscriptions: true,
                        Testimonials: true,
                    },
                },
                messAdminProfile: {
                    include: {
                        messes: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

}

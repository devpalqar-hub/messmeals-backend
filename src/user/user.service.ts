import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, Roles } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) { }

    // 🟢 Create a new user
    async createUser(data: Prisma.UserCreateInput) {
        const { name, phone, email } = data;
        return this.prisma.user.create({ data: { name, phone, email, role: Roles.USER } });
    }

    // 🟢 Create a new user
    async createDeliveryAgent(data: CreateUserDto) {
        const { name, phone, email, password } = data;
        return this.prisma.user.create({ data: { name, phone, email, password, role: Roles.DELIVERYAGENT } });
    }

    async createAdmin(data: CreateUserDto) {
        const { name, phone, email, password } = data;
        return this.prisma.user.create({ data: { name, phone, email, password, role: Roles.ADMIN } });
    }

    // 🟡 List all users
    async findAll() {
        return this.prisma.user.findMany({
            include: {
                customerProfile: true,
                deliveryPartnerProfile: true,
            },
        });
    }

    // 🟣 Get a single user by ID
    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                customerProfile: true,
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


    // Get total number of users

}

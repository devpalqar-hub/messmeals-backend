import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignMessAdminDto, RemoveMessAdminDto, CreateMessAdminDto } from './dto/mess-admin.dto';
import { Roles } from '@prisma/client';

@Injectable()
export class MessAdminService {
    constructor(private prisma: PrismaService) { }

    async createMessAdmin(dto: CreateMessAdminDto) {
        // Check if user already exists
        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: dto.email }, { phone: dto.phone }],
            },
        });

        if (existing) {
            throw new BadRequestException('User with this email or phone already exists');
        }

        // Validate mess IDs
        const messes = await this.prisma.mess.findMany({
            where: { id: { in: dto.messIds } },
        });

        if (messes.length !== dto.messIds.length) {
            throw new BadRequestException('One or more mess IDs are invalid');
        }

        // Create user and mess admin profile
        const user = await this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                role: Roles.MESSADMIN,
                is_verified: true,
                messAdminProfile: {
                    create: {
                        messes: {
                            connect: dto.messIds.map((id) => ({ id })),
                        },
                    },
                },
            },
            include: {
                messAdminProfile: {
                    include: {
                        messes: true,
                    },
                },
            },
        });

        return {
            message: 'Mess admin created successfully',
            data: user,
        };
    }

    async assignMessAdmin(dto: AssignMessAdminDto) {
        // Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { id: dto.userId },
            include: { messAdminProfile: true },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Validate mess IDs
        const messes = await this.prisma.mess.findMany({
            where: { id: { in: dto.messIds } },
        });

        if (messes.length !== dto.messIds.length) {
            throw new BadRequestException('One or more mess IDs are invalid');
        }

        // Create mess admin profile if doesn't exist, or update role
        if (!user.messAdminProfile) {
            await this.prisma.user.update({
                where: { id: dto.userId },
                data: {
                    role: Roles.MESSADMIN,
                    messAdminProfile: {
                        create: {
                            messes: {
                                connect: dto.messIds.map((id) => ({ id })),
                            },
                        },
                    },
                },
            });
        } else {
            // Add new messes to existing mess admin
            await this.prisma.messAdminProfile.update({
                where: { id: user.messAdminProfile.id },
                data: {
                    messes: {
                        connect: dto.messIds.map((id) => ({ id })),
                    },
                },
            });
        }

        return {
            message: 'Mess admin assigned successfully',
        };
    }

    async removeMessAdminFromMess(dto: RemoveMessAdminDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: dto.userId },
            include: { messAdminProfile: { include: { messes: true } } },
        });

        if (!user || !user.messAdminProfile) {
            throw new NotFoundException('Mess admin not found');
        }

        await this.prisma.messAdminProfile.update({
            where: { id: user.messAdminProfile.id },
            data: {
                messes: {
                    disconnect: { id: dto.messId },
                },
            },
        });

        return {
            message: 'Mess admin removed from mess successfully',
        };
    }

    async findAll(page: number = 1, limit: number = 10, search?: string) {
        const skip = (page - 1) * limit;

        const where: any = {
            role: Roles.MESSADMIN,
        };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
            ];
        }

        const [messAdmins, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                skip,
                take: limit,
                where,
                include: {
                    messAdminProfile: {
                        include: {
                            messes: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    is_active: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data: messAdmins,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                messAdminProfile: {
                    include: {
                        messes: {
                            include: {
                                plans: {
                                    select: {
                                        id: true,
                                        planName: true,
                                        price: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user || user.role !== Roles.MESSADMIN) {
            throw new NotFoundException('Mess admin not found');
        }

        return user;
    }

    async getMessAdminsByMess(messId: string, page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const mess = await this.prisma.mess.findUnique({ where: { id: messId } });
        if (!mess) {
            throw new NotFoundException('Mess not found');
        }

        const [messAdmins, total] = await this.prisma.$transaction([
            this.prisma.messAdminProfile.findMany({
                skip,
                take: limit,
                where: {
                    messes: {
                        some: { id: messId },
                    },
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            is_active: true,
                            createdAt: true,
                        },
                    },
                },
            }),
            this.prisma.messAdminProfile.count({
                where: {
                    messes: {
                        some: { id: messId },
                    },
                },
            }),
        ]);

        return {
            data: messAdmins,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

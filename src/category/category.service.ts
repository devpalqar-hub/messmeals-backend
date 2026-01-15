import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { paginate } from 'src/common/utility/pagination.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoryService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateCategoryDto) {
        return this.prisma.category.create({
            data: dto,
        });
    }



    async findAll(
        page?: number,
        limit?: number,
        search?: string,
        isActive?: boolean,
    ) {
        const where: Prisma.CategoryWhereInput = {
            ...(search && {
                name: {
                    contains: search
                },
            }),
            ...(isActive !== undefined && {
                isActive,
            }),
        };

        return paginate({
            prismaModel: this.prisma.category,
            page,
            limit,
            where,
            orderBy: { createdAt: 'desc' },
        });
    }



    async findOne(id: string) {
        const category = await this.prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        return category;
    }

    async update(id: string, dto: UpdateCategoryDto) {
        await this.findOne(id); // existence check

        return this.prisma.category.update({
            where: { id },
            data: dto,
        });
    }

    async remove(id: string) {
        await this.findOne(id); // existence check

        return this.prisma.category.delete({
            where: { id },
        });
    }
}

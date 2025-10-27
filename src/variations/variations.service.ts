import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVariationDto } from './dto/create-variations.dto';
import { UpdateVariationDto } from './dto/update-variation.dto';

@Injectable()
export class VariationService {
    constructor(private prisma: PrismaService) { }

    // ➕ Create
    async create(dto: CreateVariationDto) {
        const { title, description } = dto
        const variation = await this.prisma.variation.create({
            data: { title: title, description: description }
        });
        return {
            message: 'Variation created successfully',
            variation,
        };
    }

    // 📜 Get all
    async findAll() {
        const variations = await this.prisma.variation.findMany({
            include: { plans: true },
            orderBy: { createdAt: 'desc' },
        });
        return variations;
    }

    // 🔍 Get by ID
    async findById(id: string) {
        const variation = await this.prisma.variation.findUnique({
            where: { id },
            include: { plans: true },
        });

        if (!variation) {
            throw new NotFoundException('Variation not found');
        }

        return variation;
    }

    // ✏️ Update
    async update(id: string, dto: UpdateVariationDto) {
        const variation = await this.prisma.variation.update({
            where: { id },
            data: dto,
        });

        return {
            message: 'Variation updated successfully',
            variation,
        };
    }

    // 🗑️ Delete
    async delete(id: string) {
        const variation = await this.prisma.variation.delete({
            where: { id },
        });

        return {
            message: 'Variation deleted successfully',
            variation,
        };
    }
}

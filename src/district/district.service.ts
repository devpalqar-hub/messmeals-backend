import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { paginate } from 'src/common/utility/pagination.util';

@Injectable()
export class DistrictService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateDistrictDto) {
        const district = await this.prisma.district.create({ data: dto });

        return {
            message: 'District created successfully',
            data: district,
        };
    }

    async findAll(
        page?: number,
        limit?: number,
        search?: string,
    ) {
        const result = await paginate({
            prismaModel: this.prisma.district,
            page,
            limit,
            where: search
                ? {
                    name: {
                        contains: search,
                    },
                }
                : undefined,
            orderBy: { createdAt: 'desc' },
        });

        return {
            message: 'Districts fetched successfully',
            data: result.data,
            meta: result.meta,
        };
    }


    async findOne(id: string) {
        const district = await this.prisma.district.findUnique({ where: { id } });

        if (!district) {
            throw new NotFoundException('District not found');
        }

        return {
            message: 'District fetched successfully',
            data: district,
        };
    }

    async update(id: string, dto: UpdateDistrictDto) {
        const district = await this.prisma.district.findUnique({ where: { id } });

        if (!district) {
            throw new NotFoundException('District not found');
        }

        const updated = await this.prisma.district.update({
            where: { id },
            data: dto,
        });

        return {
            message: 'District updated successfully',
            data: updated,
        };
    }

    async remove(id: string) {
        const district = await this.prisma.district.findUnique({ where: { id } });

        if (!district) {
            throw new NotFoundException('District not found');
        }

        await this.prisma.district.delete({ where: { id } });

        return {
            message: 'District deleted successfully',
        };
    }
}

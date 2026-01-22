import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';

@Injectable()
export class TestimonialsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateTestimonialDto) {
        return this.prisma.testimonials.create({
            data: {
                messId: dto.messId,
                ratings: dto.ratings,
                reviews: dto.reviews,
                customerId: dto.customerId,
                DeliveryagentId: dto.DeliveryagentId,
                isActive: dto.isActive ?? true,
            },
        });
    }

    async findAll() {
        return this.prisma.testimonials.findMany({
            include: {
                mess: true,
                customer: true,
                deliveryPartner: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findOne(id: string) {
        const testimonial = await this.prisma.testimonials.findUnique({
            where: { id },
            include: {
                mess: true,
                customer: true,
                deliveryPartner: true,
            },
        });

        if (!testimonial) {
            throw new NotFoundException('Testimonial not found');
        }

        return testimonial;
    }

    async update(id: string, dto: UpdateTestimonialDto) {
        await this.findOne(id);

        return this.prisma.testimonials.update({
            where: { id },
            data: dto,
        });
    }

    async remove(id: string) {
        await this.findOne(id);

        return this.prisma.testimonials.delete({
            where: { id },
        });
    }

    async toggleStatus(id: string, isActive: boolean) {
        await this.findOne(id);

        return this.prisma.testimonials.update({
            where: { id },
            data: { isActive },
        });
    }
}

import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Patch,
    Delete,
    ParseUUIDPipe,
    UseGuards,
} from '@nestjs/common';
import { TestimonialsService } from './testimonials.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('testimonials')
export class TestimonialsController {
    constructor(private readonly testimonialsService: TestimonialsService) { }

    @Post()
    create(@Body() dto: CreateTestimonialDto) {
        return this.testimonialsService.create(dto);
    }

    @Get()
    findAll() {
        return this.testimonialsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.testimonialsService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTestimonialDto,
    ) {
        return this.testimonialsService.update(id, dto);
    }

    @Patch(':id/status/:status')
    toggleStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('status') status: string,
    ) {
        return this.testimonialsService.toggleStatus(
            id,
            status === 'true',
        );
    }

    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.testimonialsService.remove(id);
    }
}

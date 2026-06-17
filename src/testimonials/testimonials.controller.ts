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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TestimonialsService } from './testimonials.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('SUPERADMIN')
@ApiTags('Testimonials')
@ApiBearerAuth()
@Controller('testimonials')
export class TestimonialsController {
    constructor(private readonly testimonialsService: TestimonialsService) { }

    @ApiOperation({
        summary: 'Create testimonial',
        description: 'Creates a new customer testimonial for a mess or delivery experience.'
    })
    @ApiResponse({ status: 201, description: 'Testimonial created successfully.' })
    @Post()
    create(@Body() dto: CreateTestimonialDto) {
        return this.testimonialsService.create(dto);
    }

    @ApiOperation({
        summary: 'List testimonials',
        description: 'Returns all testimonials.'
    })
    @ApiResponse({ status: 200, description: 'Testimonials fetched successfully.' })
    @Get()
    findAll() {
        return this.testimonialsService.findAll();
    }

    @ApiOperation({
        summary: 'Get testimonial by id',
        description: 'Fetches a testimonial using its UUID identifier.'
    })
    @ApiParam({ name: 'id', description: 'Testimonial UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Testimonial fetched successfully.' })
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.testimonialsService.findOne(id);
    }

    @ApiOperation({
        summary: 'Update testimonial',
        description: 'Updates a testimonial by UUID.'
    })
    @ApiParam({ name: 'id', description: 'Testimonial UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Testimonial updated successfully.' })
    @Patch(':id')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTestimonialDto,
    ) {
        return this.testimonialsService.update(id, dto);
    }

    @ApiOperation({
        summary: 'Toggle testimonial status',
        description: 'Enables or disables a testimonial using the status route parameter.'
    })
    @ApiParam({ name: 'id', description: 'Testimonial UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiParam({ name: 'status', description: 'Boolean status string', example: 'true' })
    @ApiResponse({ status: 200, description: 'Testimonial status updated successfully.' })
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

    @ApiOperation({
        summary: 'Delete testimonial',
        description: 'Deletes a testimonial by UUID.'
    })
    @ApiParam({ name: 'id', description: 'Testimonial UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Testimonial deleted successfully.' })
    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.testimonialsService.remove(id);
    }
}

import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    ParseUUIDPipe,
    BadRequestException,
    UsePipes,
    ValidationPipe,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { PlansDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
const maxSize = 10 * 1024 * 1024; // 50MB per media

@ApiTags('Plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
    constructor(private readonly plansService: PlansService) { }


    @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles('SUPERADMIN')
    @ApiOperation({
        summary: 'Create a plan',
        description: 'Creates a new plan with optional gallery images and linked variations.'
    })
    @ApiResponse({ status: 201, description: 'Plan created successfully.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                planName: { type: 'string', example: 'Weekly Lunch Plan' },
                price: { type: 'number', example: 999 },
                minPrice: { type: 'number', example: 799 },
                description: { type: 'string', example: 'Balanced weekday meal plan' },
                messId: { type: 'string', example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' },
                variationIds: { type: 'array', example: ['1f2e3d4c-1111-2222-3333-444455556666'], items: { type: 'string' } },
                isMonthlyPlan: { type: 'boolean', example: true },
                isDailyPlan: { type: 'boolean', example: false },
                images: {
                    type: 'array',
                    example: [{ url: 'https://cdn.example.com/plans/plan-1.jpg' }],
                    items: {
                        type: 'object',
                        properties: {
                            url: { type: 'string', example: 'https://cdn.example.com/plans/plan-1.jpg' },
                            altText: { type: 'string', example: 'Plan image' },
                            sortOrder: { type: 'number', example: 1 },
                        },
                    },
                },
            },
            required: ['planName', 'price', 'description', 'messId'],
        },
    })
    @Post()
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
        }),
    )
    async createPlan(
        @Body() dto: PlansDto,
    ) {
        if (dto.variationIds && typeof dto.variationIds === 'string') {
            dto.variationIds = JSON.parse(dto.variationIds);
        }
        const imagePayload = (dto.images || []).map((img) => ({ url: img.url }));

        return this.plansService.createPlan(dto, imagePayload);
    }


    // ✅ GET all (with pagination)
    @ApiOperation({
        summary: 'List plans',
        description: 'Returns a paginated list of plans. Supports optional mess and search filters.'
    })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'messId', required: false, description: 'Filter plans by mess UUID' })
    @ApiQuery({ name: 'search', required: false, description: 'Search by plan name' })
    @ApiResponse({ status: 200, description: 'Plans fetched successfully.' })
    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('messId') messId?: string,
        @Query('search') search?: string,
    ) {
        return this.plansService.findAll(Number(page) || 1, Number(limit) || 10, messId, search);
    }


    // ✅ GET by ID
    @ApiOperation({
        summary: 'Get plan by id',
        description: 'Fetches a single plan by its UUID identifier.'
    })
    @ApiParam({ name: 'id', description: 'Plan UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Plan fetched successfully.' })
    @Get(':id')
    findOne(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.plansService.findOne(id);
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles('SUPERADMIN')
    @ApiOperation({
        summary: 'Update plan',
        description: 'Updates an existing plan using its UUID identifier.'
    })
    @ApiParam({ name: 'id', description: 'Plan UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Plan updated successfully.' })
    @Patch(':id')
    async updatePlan(
        @Param('id') id: string,
        @Body() dto: UpdatePlanDto,
    ) {
        if (typeof dto.variationIds === 'string') {
            try {
                dto.variationIds = JSON.parse(dto.variationIds);
            } catch {
                dto.variationIds = [];
            }
        }

        return this.plansService.updatePlan(id, dto);
    }


    // ✅ DELETE
    @ApiOperation({
        summary: 'Delete plan',
        description: 'Deletes a plan by UUID.'
    })
    @ApiParam({ name: 'id', description: 'Plan UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Plan deleted successfully.' })
    @Delete(':id')
    remove(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.plansService.remove(id);
    }


    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)
    @ApiOperation({
        summary: 'Add images to a plan',
        description: 'Adds gallery image URLs to an existing plan.'
    })
    @ApiParam({ name: 'planId', description: 'Plan UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 201, description: 'Plan images uploaded successfully.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                images: {
                    type: 'array',
                    example: [{ url: 'https://cdn.example.com/plans/plan-1.jpg' }],
                    items: {
                        type: 'object',
                        properties: {
                            url: { type: 'string', example: 'https://cdn.example.com/plans/plan-1.jpg' },
                        },
                        required: ['url'],
                    },
                },
            },
            required: ['images'],
        },
    })
    @Post(':planId/plan/images')
    async addPlanImages(
        @Param('planId') planId: string,
        @Body('images') images: { url: string }[],
    ) {
        if (!images || images.length === 0) {
            throw new BadRequestException('At least one image is required');
        }
        const imagePayload = images.map((img) => ({ url: img.url }));
        return this.plansService.addPlanImages(planId, imagePayload);
    }

    // =========================
    // GET MESS IMAGES
    // =========================
    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)

    // @ApiOperation({ summary: 'Get mess gallery images' })
    // @ApiResponse({
    //     status: 200,
    //     description: 'Mess images fetched successfully',
    // })
    @ApiOperation({
        summary: 'Get plan images',
        description: 'Returns all gallery images attached to a plan.'
    })
    @ApiParam({ name: 'planId', description: 'Plan UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 200, description: 'Plan images fetched successfully.' })
    @Get(':planId/gallery/images')
    async getMessImages(@Param('planId') planId: string) {
        return this.plansService.getPlanImages(planId);
    }

    // =========================
    // DELETE MESS IMAGE
    // =========================
    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)
    @ApiOperation({
        summary: 'Delete a plan image',
        description: 'Deletes a single gallery image from a plan.'
    })
    @ApiParam({ name: 'planId', description: 'Plan UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiParam({ name: 'imageId', description: 'Image UUID', example: 'aab2d7d4-9a39-4d6c-9df6-4f7d3d7d8a01' })
    @ApiResponse({ status: 200, description: 'Plan image deleted successfully.' })
    @Delete(':planId/gallery/images/:imageId')
    async deleteMessGalleryImage(
        @Param('planId') planId: string,
        @Param('imageId') imageId: string,
    ) {
        return this.plansService.deletePlanImages(planId, imageId);
    }
}

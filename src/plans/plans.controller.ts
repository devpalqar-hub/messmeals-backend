import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Param,
    Body,
    UseInterceptors,
    UploadedFiles,
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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express'; // ✅ this one
import { PlansService } from './plans.service';
import { PlansDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { S3Service } from 'src/s3/s3.service';
const maxSize = 10 * 1024 * 1024; // 50MB per media
const maxSizeGallery = 50 * 1024 * 1024; // 50 MB

@ApiTags('Plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
    constructor(private readonly plansService: PlansService,
        private readonly s3Service: S3Service
    ) { }


    @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles('SUPERADMIN')
    @ApiOperation({
        summary: 'Create a plan',
        description: 'Creates a new plan with optional gallery images and linked variations.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 201, description: 'Plan created successfully.' })
    @Post()
    @UseInterceptors(
        FilesInterceptor('planImages', 10),
    )
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
        }),
    )
    async createPlan(
        @Body() dto: PlansDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        const totalGallerySize = files.reduce(
            (sum, file) => sum + file.size,
            0,
        );

        if (totalGallerySize > maxSizeGallery) {
            throw new BadRequestException(
                'Total gallery image size must not exceed 50MB',
            );
        }
        let galleryImages: any[] = [];
        if (files) {
            const folder = "uploads/plans/gallery"
            galleryImages = await this.s3Service.uploadMultipleFiles(files, folder);
        }
        const imagePayload = galleryImages.map((url) => ({ url }));
        if (dto.variationIds && typeof dto.variationIds === 'string') {
            dto.variationIds = JSON.parse(dto.variationIds);
        }

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
        description: 'Uploads gallery images and attaches them to an existing plan.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiParam({ name: 'planId', description: 'Plan UUID', example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @ApiResponse({ status: 201, description: 'Plan images uploaded successfully.' })
    @Post(':planId/plan/images')
    @UseInterceptors(FilesInterceptor('files', 10))
    async addPlanImages(
        @Param('planId') planId: string,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('At least one image is required');
        }

        const totalGallerySize = files.reduce(
            (sum, file) => sum + file.size,
            0,
        );

        if (totalGallerySize > maxSizeGallery) {
            throw new BadRequestException(
                'Total Plan image size must not exceed 50MB',
            );
        }

        const folder = "uploads/plans/gallery";
        const uploadedUrls = await this.s3Service.uploadMultipleFiles(
            files,
            folder,
        );

        const imagePayload = uploadedUrls.map((url) => ({ url }));

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

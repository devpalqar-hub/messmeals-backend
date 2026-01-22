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
} from '@nestjs/common';
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

@Controller('plans')
export class PlansController {
    constructor(private readonly plansService: PlansService,
        private readonly s3Service: S3Service
    ) { }


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
    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('messId') messId?: string,
    ) {
        return this.plansService.findAll(Number(page) || 1, Number(limit) || 10, messId);
    }


    // ✅ GET by ID
    @Get(':id')
    findOne(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.plansService.findOne(id);
    }

    @Patch(':id')
    @UseInterceptors(
        FilesInterceptor('planImages', 10, {
            storage: diskStorage({
                destination: './uploads',
                filename: (req, file, callback) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    callback(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
        }),
    )
    async updatePlan(
        @Param('id') id: string,
        @Body() dto: UpdatePlanDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        // 🧩 Handle JSON string conversion for variationIds if sent as string
        if (typeof dto.variationIds === 'string') {
            try {
                dto.variationIds = JSON.parse(dto.variationIds);
            } catch {
                dto.variationIds = [];
            }
        }

        return this.plansService.updatePlan(id, { ...dto }, { planImages: files });
    }

    // ✅ DELETE
    @Delete(':id')
    remove(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.plansService.remove(id);
    }


    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)
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
    @Get(':planId/gallery/images')
    async getMessImages(@Param('planId') planId: string) {
        return this.plansService.getPlanImages(planId);
    }

    // =========================
    // DELETE MESS IMAGE
    // =========================
    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)
    @Delete(':planId/gallery/images/:imageId')
    async deleteMessGalleryImage(
        @Param('planId') planId: string,
        @Param('imageId') imageId: string,
    ) {
        return this.plansService.deletePlanImages(planId, imageId);
    }
}

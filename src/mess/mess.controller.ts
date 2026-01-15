import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    DefaultValuePipe,
    ParseIntPipe,
    BadRequestException,
    UseGuards,
    Req,
    NotFoundException,
    UseInterceptors,
    UploadedFiles,
} from '@nestjs/common';
import { MessService } from './mess.service';
import { CreateMessDto, UpdateMessDto } from './dto/create-mess.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from 'src/s3/s3.service';
const maxSize = 10 * 1024 * 1024; // 50MB per media
const maxSizeGallery = 50 * 1024 * 1024; // 50 MB

@Controller('mess')
export class MessController {
    constructor(private readonly messService: MessService,
        private readonly s3Service: S3Service
    ) { }

    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.SUPERADMIN)
    @Post()
    @UseInterceptors(
        FilesInterceptor('files', 10),
    )
    async create(@Body() dto: CreateMessDto, @UploadedFiles() files: Express.Multer.File[],) {
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
            const folder = "uploads/mess/gallery"
            galleryImages = await this.s3Service.uploadMultipleFiles(files, folder);
        }
        const imagePayload = galleryImages.map((url) => ({ url }));
        return this.messService.create(dto, imagePayload);
    }

    @Get()
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('categoryId') categoryId?: string,
        @Query('ratings') ratings?: string,
        @Query('is_active') is_active?: string,
        @Query('is_verified') is_verified?: string,
    ) {
        return this.messService.findAll(
            page,
            limit,
            search,
            categoryId,
            ratings !== undefined ? Number(ratings) : undefined,
            is_active !== undefined ? is_active === 'true' : undefined,
            is_verified !== undefined ? is_verified === 'true' : undefined,
        );
    }



    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.messService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateMessDto,
    ) {
        return this.messService.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN)
    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.messService.remove(id);
    }

    @Get(':id/stats')
    getStats(@Param('id', ParseUUIDPipe) id: string) {
        return this.messService.getMessStats(id);
    }



    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)
    @Post(':messId/gallery/images')
    @UseInterceptors(FilesInterceptor('files', 10))
    async addMessImages(
        @Param('messId') messId: string,
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
                'Total gallery image size must not exceed 50MB',
            );
        }

        const folder = 'uploads/mess/gallery';
        const uploadedUrls = await this.s3Service.uploadMultipleFiles(
            files,
            folder,
        );

        const imagePayload = uploadedUrls.map((url) => ({ url }));

        return this.messService.addMessImages(messId, imagePayload);
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
    @Get(':messId/gallery/images')
    async getMessImages(@Param('messId') messId: string) {
        return this.messService.getMessImages(messId);
    }

    // =========================
    // DELETE MESS IMAGE
    // =========================
    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.MESS_ADMIN)
    @Delete(':messId/gallery/images/:imageId')
    async deleteMessGalleryImage(
        @Param('messId') messId: string,
        @Param('imageId') imageId: string,
    ) {
        return this.messService.deleteMessImage(messId, imageId);
    }
}

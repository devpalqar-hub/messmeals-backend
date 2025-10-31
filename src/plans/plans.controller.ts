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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express'; // ✅ this one
import { PlansService } from './plans.service';
import { PlansDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('plans')
export class PlansController {
    constructor(private readonly plansService: PlansService) { }


    @Post()
    @UseInterceptors(
        FilesInterceptor('planImages', 10, {
            storage: diskStorage({
                destination: './uploads', // folder to store images
                filename: (req, file, callback) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    callback(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),

            // ✅ Limit file size to 1MB per image
            limits: {
                fileSize: 1 * 1024 * 1024, // 1 MB
            },

            // ✅ Accept only image files
            fileFilter: (req, file, callback) => {
                // if (!file.mimetype.match(/^image\//)) {
                //     return callback(new BadRequestException('Only image files are allowed!'), false);
                // }
                callback(null, true);
            },
        }),
    )
    async createPlan(
        @Body() dto: PlansDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (dto.variationIds && typeof dto.variationIds === 'string') {
            dto.variationIds = JSON.parse(dto.variationIds);
        }

        // ✅ Handle case when files are missing or invalid
        if (files && files.length > 0) {
            for (const file of files) {
                if (file.size > 1 * 1024 * 1024) {
                    throw new BadRequestException('Each image must be less than 1MB');
                }
            }
        }

        return this.plansService.createPlan(dto, { planImages: files });
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

    // ✅ PATCH images separately
    @Patch(':id/images')
    @UseInterceptors(
        FilesInterceptor('images', 10, {
            storage: diskStorage({
                destination: './uploads/plans',
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
        }),
    )
    updateImages(
        @Param('id', new ParseUUIDPipe()) id: string,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        return this.plansService.updateImages(id, files);
    }
}

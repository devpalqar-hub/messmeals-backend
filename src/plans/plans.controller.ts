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
        FileFieldsInterceptor(
            [
                { name: 'planImages', maxCount: 10 },
                { name: 'variationImages', maxCount: 50 },
            ],
            {
                storage: diskStorage({
                    destination: './uploads',
                    filename: (req, file, cb) => {
                        const uniqueSuffix =
                            Date.now() + '-' + Math.round(Math.random() * 1e9);
                        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
                    },
                }),
            },
        ),
    )
    async createPlan(
        @UploadedFiles()
        files: {
            planImages?: Express.Multer.File[];
            variationImages?: Express.Multer.File[];
        },
        @Body() body: any,
    ) {
        const dto: PlansDto = JSON.parse(body.planData);
        return this.plansService.createPlan(dto, files);
    }

    // ✅ GET all (with pagination)
    @Get()
    findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
        return this.plansService.findAll(Number(page) || 1, Number(limit) || 10);
    }


    // ✅ GET by ID
    @Get(':id')
    findOne(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.plansService.findOne(id);
    }

    @Patch(':id')
    @UseInterceptors(
        FileFieldsInterceptor(
            [
                { name: 'planImages', maxCount: 10 },
                { name: 'variationImages', maxCount: 50 },
            ],
            {
                storage: diskStorage({
                    destination: './uploads',
                    filename: (req, file, cb) => {
                        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
                    },
                }),
            },
        ),
    )
    async updatePlan(
        @Param('id') id: string,
        @UploadedFiles()
        files: {
            planImages?: Express.Multer.File[];
            variationImages?: Express.Multer.File[];
        },
        @Body() body: any,
    ) {
        const dto: UpdatePlanDto = JSON.parse(body.planData);
        return this.plansService.updatePlan(id, dto, files);
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

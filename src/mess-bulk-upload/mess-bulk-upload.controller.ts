import {
    BadRequestException,
    Controller,
    Get,
    Post,
    Query,
    StreamableFile,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { BulkUploadQueryDto, TemplateQueryDto } from './dto/bulk-upload-query.dto';
import { MessBulkUploadService } from './mess-bulk-upload.service';
import { MAX_FILE_SIZE_BYTES, MAX_ROWS_PER_UPLOAD } from './mess-excel.parser';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Mess Bulk Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
@Controller('admin/mess-bulk-upload')
export class MessBulkUploadController {
    constructor(private readonly bulkUploadService: MessBulkUploadService) { }

    @Get('template')
    @ApiOperation({
        summary: 'Download the mess bulk-upload Excel template',
        description: 'Returns an .xlsx with the expected columns and an Instructions sheet (allowed food types and tags).',
    })
    @ApiQuery({ name: 'withSamples', required: false, type: Boolean })
    @ApiResponse({ status: 200, description: 'The .xlsx template file.' })
    async downloadTemplate(@Query() query: TemplateQueryDto) {
        const buffer = await this.bulkUploadService.getTemplate(query.withSamples ?? false);
        return new StreamableFile(buffer, {
            type: XLSX_MIME,
            disposition: 'attachment; filename="mess-bulk-upload-template.xlsx"',
        });
    }

    @Post()
    @ApiOperation({
        summary: 'Bulk-create messes (and their owner accounts) from an Excel sheet',
        description:
            `Superadmin-only. Upload an .xlsx (max ${MAX_ROWS_PER_UPLOAD} rows) built from the template. ` +
            'For every valid row it creates the mess (food types, tags, icon, cover and gallery images) and an owner ' +
            '(MESSADMIN) account: username = mess name, login phone = phone number, random password, and email = ' +
            '<phone>@messmeals.com when the sheet has none. Rows are independent: one bad row never blocks the others. ' +
            'The generated passwords are returned only in this response. Use ?dryRun=true to validate first.',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary', description: 'The filled-in .xlsx template' } },
            required: ['file'],
        },
    })
    @ApiResponse({ status: 201, description: 'Per-row results plus a summary (rows may still have FAILED/SKIPPED status).' })
    @ApiResponse({ status: 400, description: 'Not an .xlsx file, required columns missing, no data rows, or too many rows.' })
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
            fileFilter: (_req, file, cb) => {
                if (!/\.xlsx$/i.test(file.originalname)) {
                    return cb(new BadRequestException('Only .xlsx Excel files are supported'), false);
                }
                cb(null, true);
            },
        }),
    )
    upload(@UploadedFile() file: Express.Multer.File | undefined, @Query() query: BulkUploadQueryDto) {
        if (!file) {
            throw new BadRequestException('An Excel file is required in the "file" form field');
        }

        return this.bulkUploadService.upload(file.buffer, {
            dryRun: query.dryRun ?? false,
            isListed: query.isListed ?? false,
            isVerified: query.isVerified ?? false,
        });
    }
}

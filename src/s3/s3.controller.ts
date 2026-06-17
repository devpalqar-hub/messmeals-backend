import {
    Controller,
    Post,
    Delete,
    Body,
    Query,
    UploadedFile,
    UploadedFiles,
    UseInterceptors,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from './s3.service';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('S3')
@Controller('s3')
export class S3Controller {
    constructor(private readonly s3Service: S3Service) { }

    // ------------------------------------------------
    // ✅ Upload Single File
    // POST /s3/upload
    // ------------------------------------------------
    @Post('upload')
    @ApiOperation({ summary: 'Upload single file', description: 'Uploads a single file to S3.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                folder: { type: 'string', example: 'plans' },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body('folder') folder?: string,
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }

        const url = await this.s3Service.uploadFile(file, folder);

        return {
            message: 'File uploaded successfully',
            url,
        };
    }

    // ------------------------------------------------
    // ✅ Upload Multiple Files
    // POST /s3/upload-multiple
    // ------------------------------------------------
    @Post('upload-multiple')
    @ApiOperation({ summary: 'Upload multiple files', description: 'Uploads multiple files to S3.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                folder: { type: 'string', example: 'plans' },
            },
        },
    })
    @UseInterceptors(FilesInterceptor('files'))
    async uploadMultipleFiles(
        @UploadedFiles() files: Express.Multer.File[],
        @Body('folder') folder?: string,
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('Files are required');
        }

        const urls = await this.s3Service.uploadMultipleFiles(files, folder);

        return {
            message: 'Files uploaded successfully',
            urls,
        };
    }

    // ------------------------------------------------
    // ✅ Delete File
    // DELETE /s3/delete
    // ------------------------------------------------
    @Delete('delete')
    @ApiOperation({ summary: 'Delete file', description: 'Deletes a file from S3 using its URL.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                fileUrl: { type: 'string', example: 'https://cdn.example.com/uploads/file.jpg' },
            },
            required: ['fileUrl'],
        },
    })
    async deleteFile(@Body('fileUrl') fileUrl: string) {
        if (!fileUrl) {
            throw new BadRequestException('fileUrl is required');
        }

        await this.s3Service.deleteFile(fileUrl);

        return {
            message: 'File deleted successfully',
        };
    }

    // ------------------------------------------------
    // ✅ Get Signed URL
    // GET /s3/signed-url?key=uploads/a.jpg
    // ------------------------------------------------
    @Post('signed-url')
    @ApiOperation({ summary: 'Get signed URL', description: 'Returns a signed URL for a given S3 key.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                key: { type: 'string', example: 'uploads/a.jpg' },
                expiresIn: { type: 'number', example: 3600 },
            },
            required: ['key'],
        },
    })
    async getSignedUrl(
        @Body('key') key: string,
        @Body('expiresIn') expiresIn?: number,
    ) {
        if (!key) {
            throw new BadRequestException('Key is required');
        }

        const url = await this.s3Service.getSignedUrl(key, expiresIn);

        return {
            signedUrl: url,
        };
    }

    // ------------------------------------------------
    // ✅ Check File Exists
    // GET /s3/exists?key=uploads/a.jpg
    // ------------------------------------------------
    @Post('exists')
    @ApiOperation({ summary: 'Check file exists', description: 'Checks whether a given S3 key exists.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                key: { type: 'string', example: 'uploads/a.jpg' },
            },
            required: ['key'],
        },
    })
    async fileExists(@Body('key') key: string) {
        if (!key) {
            throw new BadRequestException('Key is required');
        }

        const exists = await this.s3Service.fileExists(key);

        return { exists };
    }
}

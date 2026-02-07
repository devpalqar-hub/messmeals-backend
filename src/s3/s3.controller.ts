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

@Controller('s3')
export class S3Controller {
    constructor(private readonly s3Service: S3Service) { }

    // ------------------------------------------------
    // ✅ Upload Single File
    // POST /s3/upload
    // ------------------------------------------------
    @Post('upload')
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
    async fileExists(@Body('key') key: string) {
        if (!key) {
            throw new BadRequestException('Key is required');
        }

        const exists = await this.s3Service.fileExists(key);

        return { exists };
    }
}

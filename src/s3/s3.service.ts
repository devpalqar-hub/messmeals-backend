import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const bucket = this.configService.get<string>('AWS_PUBLIC_BUCKET_NAME');
    const region = this.configService.get<string>('AWS_REGION');

    if (!bucket) {
      throw new Error('AWS_S3_BUCKET_NAME is missing');
    }

    if (!region) {
      throw new Error('AWS_REGION is missing');
    }

    this.bucketName = bucket;

    this.s3Client = new S3Client({
      region: 'ap-south-1',

      // 🔴 THIS IS THE KEY FIX
      endpoint: 'https://s3.ap-south-1.amazonaws.com',
      forcePathStyle: true,

      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });

  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<string> {
    console.log('[S3 DEBUG] uploadFile called');

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${timestamp}-${randomString}.${fileExtension}`;

    console.log('[S3 DEBUG] Prepared upload params', {
      bucket: this.bucketName,
      region: this.configService.get('AWS_REGION'),
      key: fileName,
      contentType: file.mimetype,
      bufferExists: !!file.buffer,
      bufferLength: file.buffer?.length,
    });

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      console.log('[S3 DEBUG] Sending PutObjectCommand...');
      await this.s3Client.send(command);
      console.log('[S3 DEBUG] PutObjectCommand SUCCESS');

      return `https://${this.bucketName}.s3.${this.configService.get(
        'AWS_REGION',
      )}.amazonaws.com/${fileName}`;
    } catch (error) {
      console.error('[S3 DEBUG] PutObjectCommand FAILED', {
        name: error?.name,
        message: error?.message,
        metadata: error?.$metadata,
      });

      throw new BadRequestException(
        `Failed to upload file: ${error.message}`,
      );
    }
  }


  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'uploads',
  ): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: string = 'uploads',
  ): Promise<string> {
    if (!buffer) {
      throw new BadRequestException('No buffer provided');
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileKey = `${folder}/${timestamp}-${randomString}-${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: buffer,
        ContentType: mimeType,
        //ACL: 'public-read',
      });

      await this.s3Client.send(command);
      return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${fileKey}`;
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload buffer: ${error.message}`,
      );
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract the key from the URL
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1); // Remove leading slash

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      throw new BadRequestException(`Failed to delete file: ${error.message}`);
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate signed URL: ${error.message}`,
      );
    }
  }

  // Helper method to validate file types
  validateFileType(file: Express.Multer.File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.mimetype);
  }

  // Helper method to validate file size
  validateFileSize(file: Express.Multer.File, maxSizeInBytes: number): boolean {
    return file.size <= maxSizeInBytes;
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (err: any) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  getPublicUrl(key: string): string {
    const region = this.configService.get<string>('AWS_REGION');
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
  }
}

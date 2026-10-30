import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GeneratePresignedUrlDto, CompleteUploadDto, UploadCategory } from './dto/upload.dto';

type AuthUser = { id: string; role: string };

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
];

@Injectable()
export class UploadsService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.bucketName =
      this.configService.get<string>('AWS_PUBLIC_BUCKET_NAME') ||
      this.configService.get<string>('AWS_S3_BUCKET_NAME') ||
      'messmeals-bucket';
    this.region = this.configService.get<string>('AWS_REGION') || 'ap-south-1';

    this.s3Client = new S3Client({
      region: this.region,
      endpoint: `https://s3.${this.region}.amazonaws.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  private async assertOwnership(userId: string, messId: string) {
    const profile = await this.prisma.messAdminProfile.findFirst({
      where: { userId, messes: { some: { id: messId } } },
    });
    if (!profile) throw new ForbiddenException('You do not own this business');
  }

  // POST /api/v1/uploads/presigned-url
  async generatePresignedUrl(user: AuthUser, dto: GeneratePresignedUrlDto) {
    if (!ALLOWED_MIME_TYPES.includes(dto.fileType)) {
      throw new BadRequestException(
        `Invalid file type: ${dto.fileType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (dto.messId && user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, dto.messId);
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const sanitizedFilename = dto.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = dto.messId ? `businesses/${dto.messId}` : `users/${user.id}`;
    const key = `${folder}/${dto.category.toLowerCase()}/${timestamp}-${random}-${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: dto.fileType,
    });

    const expiresIn = 900; // 15 minutes
    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

    return {
      success: true,
      message: 'Presigned upload URL generated',
      data: {
        uploadUrl,
        key,
        publicUrl,
        expiresIn,
        headers: {
          'Content-Type': dto.fileType,
        },
      },
    };
  }

  // POST /api/v1/uploads/complete
  async completeUpload(user: AuthUser, dto: CompleteUploadDto) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, dto.messId);
    }

    const mess = await this.prisma.mess.findUnique({ where: { id: dto.messId } });
    if (!mess) throw new NotFoundException('Business not found');

    const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${dto.key}`;

    if (dto.category === UploadCategory.LOGO) {
      await this.prisma.businessBranding.upsert({
        where: { messId: dto.messId },
        create: {
          messId: dto.messId,
          logoUrl: publicUrl,
          logoKey: dto.key,
        },
        update: {
          logoUrl: publicUrl,
          logoKey: dto.key,
        },
      });

      await this.prisma.mess.update({
        where: { id: dto.messId },
        data: { icon: publicUrl },
      });
    } else if (dto.category === UploadCategory.COVER) {
      await this.prisma.businessBranding.upsert({
        where: { messId: dto.messId },
        create: {
          messId: dto.messId,
          coverUrl: publicUrl,
          coverKey: dto.key,
        },
        update: {
          coverUrl: publicUrl,
          coverKey: dto.key,
        },
      });
    } else if (dto.category === UploadCategory.GALLERY) {
      const branding = await this.prisma.businessBranding.upsert({
        where: { messId: dto.messId },
        create: { messId: dto.messId },
        update: {},
      });

      const count = await this.prisma.brandingGallery.count({
        where: { brandingId: branding.id },
      });

      await this.prisma.brandingGallery.create({
        data: {
          brandingId: branding.id,
          url: publicUrl,
          s3Key: dto.key,
          altText: dto.altText || null,
          sortOrder: count,
        },
      });
    }

    return {
      success: true,
      message: 'Upload completed and linked to business successfully',
      data: {
        category: dto.category,
        key: dto.key,
        url: publicUrl,
        messId: dto.messId,
      },
    };
  }
}

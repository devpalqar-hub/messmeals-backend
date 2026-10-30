import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum UploadCategory {
  LOGO = 'LOGO',
  COVER = 'COVER',
  GALLERY = 'GALLERY',
  DOCUMENT = 'DOCUMENT',
}

export class GeneratePresignedUrlDto {
  @ApiProperty({ example: 'logo.png', description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiProperty({ example: 'image/png', description: 'MIME type of the file' })
  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @ApiProperty({ enum: UploadCategory, example: UploadCategory.LOGO })
  @IsEnum(UploadCategory)
  category!: UploadCategory;

  @ApiPropertyOptional({ example: 'b0a701fa-bfba-40a2-a89e-2fcda4b7a701' })
  @IsOptional()
  @IsUUID()
  messId?: string;
}

export class CompleteUploadDto {
  @ApiProperty({ example: 'businesses/123/logo/1730000000-abc-logo.png' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ enum: UploadCategory, example: UploadCategory.LOGO })
  @IsEnum(UploadCategory)
  category!: UploadCategory;

  @ApiProperty({ example: 'b0a701fa-bfba-40a2-a89e-2fcda4b7a701' })
  @IsUUID()
  messId!: string;

  @ApiPropertyOptional({ example: 'Dining hall view' })
  @IsOptional()
  @IsString()
  altText?: string;
}

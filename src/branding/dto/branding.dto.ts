import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WebsiteTheme } from '@prisma/client';

export class GalleryItemDto {
  @ApiPropertyOptional({ example: 'https://s3.amazonaws.com/messmeals/gallery1.jpg' })
  @IsString()
  url!: string;

  @ApiPropertyOptional({ example: 'uploads/branding/gallery1.jpg' })
  @IsOptional()
  @IsString()
  s3Key?: string;

  @ApiPropertyOptional({ example: 'Dining Hall View' })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateBrandingDto {
  @ApiPropertyOptional({ example: 'Annapoorna Grand Dining' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ enum: WebsiteTheme, example: WebsiteTheme.WARM })
  @IsOptional()
  @IsEnum(WebsiteTheme)
  theme?: WebsiteTheme;

  @ApiPropertyOptional({ example: '#E65100', description: 'Hex color code' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#FFA726', description: 'Hex color code' })
  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: 'https://s3.amazonaws.com/messmeals/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'uploads/branding/logo.png' })
  @IsOptional()
  @IsString()
  logoKey?: string;

  @ApiPropertyOptional({ example: 'https://s3.amazonaws.com/messmeals/cover.jpg' })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ example: 'uploads/branding/cover.jpg' })
  @IsOptional()
  @IsString()
  coverKey?: string;

  @ApiPropertyOptional({ type: [GalleryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryItemDto)
  galleryItems?: GalleryItemDto[];
}

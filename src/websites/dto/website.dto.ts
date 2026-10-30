import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { WebsiteTheme } from '@prisma/client';

export class GenerateWebsiteDto {
  @ApiPropertyOptional({ example: 'b0a701fa-bfba-40a2-a89e-2fcda4b7a701', description: 'Business UUID (optional if user has only 1 business)' })
  @IsOptional()
  @IsUUID()
  messId?: string;

  @ApiPropertyOptional({ enum: WebsiteTheme, example: WebsiteTheme.WARM, description: 'Website visual theme' })
  @IsOptional()
  @IsEnum(WebsiteTheme)
  theme?: WebsiteTheme;

  @ApiPropertyOptional({ example: 'annapoorna.messmeals.com', description: 'Custom domain (optional)' })
  @IsOptional()
  @IsString()
  customDomain?: string;
}

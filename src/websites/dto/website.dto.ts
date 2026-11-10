import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { WebsiteTheme } from '@prisma/client';

export class GenerateWebsiteDto {
  @ApiPropertyOptional({ example: 'b0a701fa-bfba-40a2-a89e-2fcda4b7a701', description: 'Business UUID (optional if user has only 1 business)' })
  @IsOptional()
  @IsUUID()
  messId?: string;

  @ApiPropertyOptional({
    example: 'annapoorna',
    description: 'Custom subdomain name for the website (e.g. annapoorna -> annapoorna.messmeals.com). If omitted, mess slug is used.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 63, { message: 'Subdomain must be between 2 and 63 characters' })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/, {
    message: 'Subdomain can only contain letters, numbers, and hyphens, and cannot start or end with a hyphen',
  })
  subdomain?: string;

  @ApiPropertyOptional({ enum: WebsiteTheme, example: WebsiteTheme.WARM, description: 'Website visual theme' })
  @IsOptional()
  @IsEnum(WebsiteTheme)
  theme?: WebsiteTheme;

  @ApiPropertyOptional({ example: 'annapoorna.messmeals.com', description: 'Custom domain (optional)' })
  @IsOptional()
  @IsString()
  customDomain?: string;
}

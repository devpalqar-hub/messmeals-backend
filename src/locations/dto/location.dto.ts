import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SupportedCountry } from '@prisma/client';

export class CreateLocationDto {
  @ApiProperty({ enum: SupportedCountry, example: SupportedCountry.IN, description: 'Supported country code' })
  @IsEnum(SupportedCountry)
  country!: SupportedCountry;

  @ApiPropertyOptional({ example: 'Suite 204, Royal Complex', description: 'Building or street address' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: 'Koramangala', description: 'Locality or area' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiProperty({ example: 'Bengaluru', description: 'City name' })
  @IsString()
  @MinLength(2)
  city!: string;

  @ApiProperty({ example: 'Karnataka', description: 'State or province' })
  @IsString()
  @MinLength(2)
  state!: string;

  @ApiProperty({ example: '560034', description: 'Postal or zip code' })
  @IsString()
  @MinLength(3)
  postalCode!: string;
}

export class UpdateLocationDto {
  @ApiPropertyOptional({ enum: SupportedCountry, example: SupportedCountry.IN })
  @IsOptional()
  @IsEnum(SupportedCountry)
  country?: SupportedCountry;

  @ApiPropertyOptional({ example: 'Suite 204, Royal Complex' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: 'Koramangala' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Karnataka' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '560034' })
  @IsOptional()
  @IsString()
  postalCode?: string;
}

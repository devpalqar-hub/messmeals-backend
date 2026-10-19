import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateDeliveryAddressDto {
  @ApiProperty({ example: 51.5237 })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -0.1585 })
  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=51.5237,-0.1585' })
  @IsOptional()
  @IsString()
  locationLink?: string;
}

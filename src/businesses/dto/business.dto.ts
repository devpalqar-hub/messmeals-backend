import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Annapoorna Mess', description: 'Business / mess name' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'Suresh Kumar', description: "Owner's full name" })
  @IsString()
  @MinLength(2)
  ownerName!: string;

  @ApiProperty({ example: 'owner@annapoorna.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+919000001001', description: 'Verified business phone (defaults to authenticated phone)' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateBusinessDto {
  @ApiPropertyOptional({ example: 'Annapoorna Mess' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'Suresh Kumar' })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional({ example: 'owner@annapoorna.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+919000001001' })
  @IsOptional()
  @IsString()
  phone?: string;
}

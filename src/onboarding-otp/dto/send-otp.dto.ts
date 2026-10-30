import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsPhoneNumber, IsIn, IsOptional } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '+919000001001', description: 'Phone number in E.164 format' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'IN', description: 'Country code: IN, AE, QA' })
  @IsIn(['IN', 'AE', 'QA'])
  countryCode!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919000001001' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: '482615', description: '6-digit OTP' })
  @IsString()
  otp!: string;
}

export class ResendOtpDto {
  @ApiProperty({ example: '+919000001001' })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ example: 'IN', default: 'IN' })
  @IsOptional()
  @IsIn(['IN', 'AE', 'QA'])
  countryCode?: string;
}

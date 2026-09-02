import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OtpVerifyDto {
  @ApiProperty({ example: '2b37ee5f-41ee-4da6-abcf-d0702168c339' })
  @IsString()
  @IsNotEmpty({ message: 'sessionId is required' })
  sessionId: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'otp is required' })
  otp: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty({ message: 'phone is required' })
  phone: string;
}

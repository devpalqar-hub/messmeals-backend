import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OtpVerifyDto {
  @ApiProperty({ example: '2b37ee5f-41ee-4da6-abcf-d0702168c339' })
  sessionId: string;
  @ApiProperty({ example: '123456' })
  otp: string;
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty({ message: 'phone is required' })
  phone: string;
}

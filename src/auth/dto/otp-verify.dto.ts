import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class OtpVerifyDto {
  @IsString()
  @MinLength(10)
  phone: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}

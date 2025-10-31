import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @IsString()
    @MinLength(10)
    phone: string;

}

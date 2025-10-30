import { IsEmail, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateContactFormDto {
    @IsString()
    @IsNotEmpty()
    Name: string;

    @IsString()
    @IsNotEmpty()
    phone_number: string;

    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    message: string;

}


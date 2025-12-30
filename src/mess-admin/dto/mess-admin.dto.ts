import { IsString, IsArray, IsEmail } from 'class-validator';

export class AssignMessAdminDto {
    @IsString()
    userId: string;

    @IsArray()
    @IsString({ each: true })
    messIds: string[];
}

export class RemoveMessAdminDto {
    @IsString()
    userId: string;

    @IsString()
    messId: string;
}

export class CreateMessAdminDto {
    @IsString()
    name: string;

    @IsString()
    phone: string;

    @IsEmail()
    email: string;

    @IsArray()
    @IsString({ each: true })
    messIds: string[];
}

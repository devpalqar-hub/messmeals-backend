import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateMessAdminBySuperAdminDto {
    @IsString()
    name!: string;

    @IsEmail()
    email!: string;

    @IsString()
    phone!: string;

    @IsString()
    @MinLength(6)
    password!: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    messIds?: string[];
}

export class UpdateMessAdminBySuperAdminDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    messIds?: string[];
}

export class MessAdminListQueryDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    isActive?: string;
}

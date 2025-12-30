import { IsEmail, IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';


export class DeliveryAgentCreateDto {
    @IsString()
    name: string;

    @IsString()
    phone: string;

    @IsString()
    @IsOptional()
    address: string;

    @IsString()
    messId: string

    @IsEmail()
    email: string;

    @IsString()
    deliverAgentRegion: string

    @IsBoolean()
    is_active: boolean


}

export class DeliveryAgentUpdateDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsString()
    @IsOptional()
    address: string;

    @IsString()
    @IsOptional()
    deliverAgentRegion: string

    @IsOptional()
    @IsString()
    messId: string

    @IsBoolean()
    @IsOptional()
    is_active: boolean
}

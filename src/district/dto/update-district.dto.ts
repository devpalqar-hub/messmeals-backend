import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateDistrictDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    image?: string;


    @IsOptional()
    @IsBoolean()
    isPopular?: boolean;
}

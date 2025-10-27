import { IsOptional, IsString } from 'class-validator';

export class CreateVariationDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;
}

import { IsBoolean, IsOptional, IsString, IsUUID, IsInt } from 'class-validator';

export class CreateMessImageDto {
    @IsUUID()
    messId: string;

    @IsString()
    image: string;

    @IsOptional()
    @IsString()
    altText?: string;

    @IsOptional()
    @IsBoolean()
    isCover?: boolean;

    @IsOptional()
    @IsInt()
    sortOrder?: number;
}

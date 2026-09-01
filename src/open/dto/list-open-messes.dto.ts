import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { FoodType } from '@prisma/client';

/// GET /open/messes — every field is optional; this is the public-website listing API.
export class ListOpenMessesDto {
    @ApiPropertyOptional({ example: '1' })
    @IsOptional()
    @IsString()
    page?: string;

    @ApiPropertyOptional({ example: '10' })
    @IsOptional()
    @IsString()
    limit?: string;

    @ApiPropertyOptional({
        example: 'Super Meals',
        description: 'Matches against mess name and description.',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: FoodType, example: FoodType.VEG })
    @IsOptional()
    @IsEnum(FoodType)
    foodType?: FoodType;

    @ApiPropertyOptional({
        enum: ['DAILY', 'MONTHLY'],
        example: 'MONTHLY',
        description: 'Only messes that have at least one active plan of this type.',
    })
    @IsOptional()
    @IsIn(['DAILY', 'MONTHLY'])
    planType?: 'DAILY' | 'MONTHLY';

    @ApiPropertyOptional({
        example: 'true',
        description:
            'Only superadmin-featured messes. When combined with latitude/longitude, results are ' +
            'limited to a 20km radius and shuffled (not always the same order) rather than strictly ' +
            'sorted by distance — so featured messes rotate fairly.',
    })
    @IsOptional()
    @IsString()
    featured?: string;

    @ApiPropertyOptional({ example: 'true', description: 'Only messes verified by the platform.' })
    @IsOptional()
    @IsString()
    isVerified?: string;

    @ApiPropertyOptional({ example: '9.9312' })
    @IsOptional()
    @IsString()
    latitude?: string;

    @ApiPropertyOptional({ example: '76.2673' })
    @IsOptional()
    @IsString()
    longitude?: string;
}

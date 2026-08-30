import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Skips a single meal/variation (e.g. Lunch) on a specific date for a
 * subscription, without cancelling the whole day's delivery — used for
 * frequency-based plans (Breakfast/Lunch/Dinner) where the customer only
 * wants to skip one meal.
 */
export class SkipVariationDto {
    @ApiProperty({
        example: '2026-06-10',
        description: 'ISO date of the delivery containing the variation to skip (YYYY-MM-DD).',
    })
    @IsString()
    date: string;

    @ApiProperty({
        example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111',
        description: 'Variation UUID to skip (e.g. Lunch).',
    })
    @IsString()
    variationId: string;
}

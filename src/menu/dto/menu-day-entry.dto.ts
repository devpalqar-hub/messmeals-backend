import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/** One meal entry within a day of a Menu's schedule, e.g. { variationId: <Lunch>, items: "Rice, Dal, Sabzi" }. */
export class MenuDayEntryDto {
    @ApiProperty({
        example: '1f2e3d4c-1111-2222-3333-444455556666',
        description: 'Variation UUID this entry is for (e.g. Breakfast / Lunch / Dinner).',
    })
    @IsUUID()
    variationId!: string;

    @ApiProperty({ example: 'Rice, Dal, Sabzi, Roti, Pickle', description: 'Menu items as free text.' })
    @IsString()
    @IsNotEmpty()
    items!: string;
}

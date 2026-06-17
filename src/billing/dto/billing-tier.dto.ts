import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpsertBillingTierDto {
    @ApiProperty({ example: 0 })
    @IsInt()
    @Min(0)
    minCustomers!: number;

    @ApiPropertyOptional({ example: 10, description: 'Inclusive upper bound. Omit for open-ended.' })
    @IsOptional()
    @IsInt()
    @Min(0)
    maxCustomers?: number;

    @ApiProperty({ example: 5, description: 'Per-customer rate in INR.' })
    @IsNumber()
    @Min(0)
    perCustomerRate!: number;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

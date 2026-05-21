import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateBillingGlobalConfigDto {
    @ApiPropertyOptional({ example: 4, description: 'Default per-customer rate (INR) if no tier matches.' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    defaultPerCustomerRate?: number;

    @ApiPropertyOptional({
        example: 30,
        description: 'Default free trial duration (days) applied when a new mess is created.',
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    defaultTrialDays?: number;

    @ApiPropertyOptional({ example: 5, description: 'Due date is (periodEnd - dueDaysBeforePeriodEnd).' })
    @IsOptional()
    @IsInt()
    @Min(0)
    dueDaysBeforePeriodEnd?: number;

    @ApiPropertyOptional({ example: 5, description: 'Disable after (dueDate + graceDaysAfterDue) if unpaid.' })
    @IsOptional()
    @IsInt()
    @Min(0)
    graceDaysAfterDue?: number;
}

export class UpdateMessBillingConfigDto {
    @ApiPropertyOptional({
        example: '2026-06-30T23:59:59.000Z',
        description: 'Free usage until this date (trial).',
    })
    @IsOptional()
    @IsDateString()
    trialEndsAt?: string;

    @ApiPropertyOptional({
        example: 4,
        description: 'Override per-customer rate (INR) for this mess.',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    perCustomerRateOverride?: number;
}

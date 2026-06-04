import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ScheduleType, DayOfWeek } from '@prisma/client';

export class RenewSubscriptionDto {

    @ApiProperty({
        example: 'e5d4c3b2-a1b2-3c4d-5e6f-7a8b9c0d1e2f',
        description: 'The existing subscription ID to renew/extend (will be updated, not replaced)',
    })
    @IsString()
    subscriptionId: string

    @ApiProperty({ example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111' })
    @IsString()
    planId: string

    @ApiProperty({ example: '2026-05-07' })
    @IsString()
    start_date: string

    @ApiProperty({ example: '2026-06-06', description: 'End date of the renewed period. Used to calculate price and generate deliveries.' })
    @IsString()
    end_date: string

    @ApiProperty({ example: 'b3f4fb3e-0e61-43c3-8b3b-b833f18b2f55' })
    @IsString()
    deliveryPartnerId: string

    @ApiProperty({
        example: '9b8c7d6e-1234-5678-90ab-cdef12345678',
        description: 'CustomerProfile.id (preferred) or User.id',
    })
    @IsString()
    customerProfileId: string

    @ApiProperty({ example: '50' })
    @IsString()
    discount: string

    @ApiProperty({ example: 'EVERYDAY', enum: ScheduleType })
    @IsEnum(ScheduleType)
    scheduleType: ScheduleType

    @ApiPropertyOptional({ example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] })
    @IsOptional()
    @IsArray()
    @IsEnum(DayOfWeek, { each: true })
    selectedDays?: string[]
}

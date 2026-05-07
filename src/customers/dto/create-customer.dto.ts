import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsOptional, IsPhoneNumber, IsString, IsBoolean, IsEnum, IsJSON, IsArray } from 'class-validator';
import { ScheduleType, DayOfWeek } from '@prisma/client';

export class CreateCustomerDto {
    //user model
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    name: string;

    @ApiProperty({ example: '+919876543218' })
    @IsString()
    phone: string;

    @ApiProperty({ example: 'john@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '123 Main Street' })
    @IsString()
    address: string

    @ApiProperty({ example: '12.9716,77.5946' })
    @IsString()
    latitude_logitude: string

    @ApiProperty({ example: 'Bangalore' })
    @IsString()
    currentLocation: string

    @ApiProperty({ example: true })
    @IsBoolean()
    is_active: boolean

    //customer profile model
    @ApiProperty({ example: '1000' })
    @IsString()
    walletAmount: string

    @ApiProperty({ example: '50' })
    @IsString()
    discount: string

    @ApiProperty({ example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111' })
    @IsString()
    planId: string

    @ApiProperty({ example: 'b3f4fb3e-0e61-43c3-8b3b-b833f18b2f55' })
    @IsString()
    deliveryPartnerId: string

    @ApiProperty({ example: '2026-05-07' })
    @IsString()
    start_date: string

    @ApiPropertyOptional({ example: '2026-06-07' })
    @IsString()
    @IsOptional()
    end_date: string

    //phase 2 changes:

    @ApiProperty({ example: 'WEEKLY' })
    @IsEnum(ScheduleType)
    scheduleType: ScheduleType;

    @ApiPropertyOptional({ example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] })
    @IsOptional()
    @IsArray()
    @IsEnum(DayOfWeek, { each: true }) // optional if you have enum
    selectedDays: string[];


}

export class UpdateCustomerDto {
    //user model
    @ApiPropertyOptional({ example: 'John Doe' })
    @IsString()
    @IsOptional()
    name: string;

    @ApiPropertyOptional({ example: '123 Main Street' })
    @IsString()
    @IsOptional()
    address: string

    @ApiPropertyOptional({ example: '12.9716,77.5946' })
    @IsString()
    @IsOptional()
    latitude_logitude: string

    @ApiPropertyOptional({ example: 'Bangalore' })
    @IsString()
    @IsOptional()
    currentLocation: string

    //customer profile model
    @ApiPropertyOptional({ example: 1200 })
    @IsNumber()
    @IsOptional()
    walletAmount: number

    @ApiPropertyOptional({ example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111' })
    @IsString()
    @IsOptional()
    planId: string

    @ApiPropertyOptional({ example: 'b3f4fb3e-0e61-43c3-8b3b-b833f18b2f55' })
    @IsString()
    @IsOptional()
    deliveryPartnerId: string

}



export class choosePlanDto {

    @ApiProperty({ example: 'a1c2e3f4-1111-2222-3333-444455556666' })
    @IsString()
    addressId: string

    @ApiProperty({ example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111' })
    @IsString()
    planId: string

    @ApiProperty({ example: '2026-05-07' })
    @IsString()
    start_date: string

    @ApiPropertyOptional({ example: '2026-06-07' })
    @IsString()
    @IsOptional()
    end_date: string

    //phase 2 changes:

    @ApiProperty({ example: 'WEEKLY' })
    @IsEnum(ScheduleType)
    scheduleType: ScheduleType;

    @ApiPropertyOptional({ example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] })
    @IsOptional()
    @IsArray()
    @IsEnum(DayOfWeek, { each: true }) // optional if you have enum
    selectedDays: string[];

    @ApiPropertyOptional({ example: 'https://example.com/success' })
    @IsOptional()
    @IsString()
    successUrl: string;

    @ApiPropertyOptional({ example: 'https://example.com/cancel' })
    @IsOptional()
    @IsString()
    cancelUrl: string;

}
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsOptional, IsPhoneNumber, IsString, IsBoolean } from 'class-validator';

export class RenewSubscriptionDto {

    @ApiProperty({ example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111' })
    @IsString()
    planId: string

    @ApiProperty({ example: '2026-05-07' })
    @IsString()
    start_date: string

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

    @ApiPropertyOptional({ example: '2026-06-07' })
    @IsString()
    @IsOptional()
    end_date: string

}

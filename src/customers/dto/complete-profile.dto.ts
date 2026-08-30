import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * Filled in by a customer right after their first OTP verification
 * (see AuthService.verifyOtp -> isNewUser / isProfileComplete).
 * Address fields are optional — if provided, a UserAddress is created
 * and can be used as the pickup address when booking a plan.
 */
export class CompleteProfileDto {
    @ApiPropertyOptional({ example: 'John Doe' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'john@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: '221B Baker Street' })
    @IsOptional()
    @IsString()
    street?: string;

    @ApiPropertyOptional({ example: 'Bangalore' })
    @IsOptional()
    @IsString()
    townOrcity?: string;

    @ApiPropertyOptional({ example: '560001' })
    @IsOptional()
    @IsString()
    postcode?: string;

    @ApiPropertyOptional({ example: 'India' })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiPropertyOptional({ example: 'Near City Mall' })
    @IsOptional()
    @IsString()
    landmark?: string;

    @ApiPropertyOptional({ example: '12.9716,77.5946' })
    @IsOptional()
    @IsString()
    latitudeLogitude?: string;

    @ApiPropertyOptional({ example: 'https://maps.google.com/?q=12.9716,77.5946' })
    @IsOptional()
    @IsString()
    locationLink?: string;
}

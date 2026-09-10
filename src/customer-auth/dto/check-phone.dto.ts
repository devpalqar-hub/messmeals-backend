import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/// POST /customer-auth/check-phone — step 1 of customer login. Tells the client whether
/// an account exists for this phone number so it can route to login vs. registration.
export class CheckPhoneDto {
    @ApiProperty({ example: '+919876543210' })
    @IsString()
    @MinLength(10)
    phone: string;
}

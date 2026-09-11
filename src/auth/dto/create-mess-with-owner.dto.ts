import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMessDto } from 'src/mess/dto/create-mess.dto';

/// Owner (MESSADMIN) account details — used by the superadmin "create mess owner + mess"
/// direct-create flow. No OTP: the account is created verified/active immediately.
export class MessOwnerDetailsDto {
    @ApiProperty({ example: 'Ramesh Kumar' })
    @IsString()
    name!: string;

    @ApiProperty({ example: 'ramesh.mess@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: '+919876543210' })
    @IsString()
    phone!: string;

    @ApiProperty({ example: 'secure123', description: 'Login password for the mess owner (min 6 chars).' })
    @IsString()
    @MinLength(6)
    password!: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

/// Mess details for the same flow — identical to CreateMessDto minus messAdminIds,
/// which is derived automatically from the owner created alongside it.
export class MessDetailsForSuperAdminDto extends OmitType(CreateMessDto, ['messAdminIds'] as const) { }

export class CreateMessWithOwnerDto {
    @ApiProperty({ type: MessOwnerDetailsDto })
    @ValidateNested()
    @Type(() => MessOwnerDetailsDto)
    owner!: MessOwnerDetailsDto;

    @ApiProperty({ type: MessDetailsForSuperAdminDto })
    @ValidateNested()
    @Type(() => MessDetailsForSuperAdminDto)
    mess!: MessDetailsForSuperAdminDto;

    @ApiPropertyOptional({
        example: [{ url: 'https://cdn.example.com/mess/gallery-1.jpg' }],
        description: 'Optional gallery images for the mess (upload via POST /s3/upload first).',
    })
    @IsOptional()
    @IsArray()
    images?: { url: string }[];
}

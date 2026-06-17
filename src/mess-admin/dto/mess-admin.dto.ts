import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsEmail } from 'class-validator';

export class AssignMessAdminDto {
    @ApiProperty({ example: '9b8c7d6e-1234-5678-90ab-cdef12345678' })
    @IsString()
    userId: string;

    @ApiProperty({ example: ['c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11'] })
    @IsArray()
    @IsString({ each: true })
    messIds: string[];
}

export class RemoveMessAdminDto {
    @ApiProperty({ example: '9b8c7d6e-1234-5678-90ab-cdef12345678' })
    @IsString()
    userId: string;

    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' })
    @IsString()
    messId: string;
}

export class CreateMessAdminDto {
    @ApiProperty({ example: 'Mess Admin' })
    @IsString()
    name: string;

    @ApiProperty({ example: '+919876543219' })
    @IsString()
    phone: string;

    @ApiProperty({ example: 'messadmin@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: ['c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11'] })
    @IsArray()
    @IsString({ each: true })
    messIds: string[];
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// Read the raw query value: the global ValidationPipe uses enableImplicitConversion, which would
// turn the string "false" into `true` (Boolean("false")) before a value-based @Transform runs.
const toBoolean = ({ obj, key }: { obj: any; key: string }) => {
    const raw = obj[key];
    if (raw === undefined || raw === '') return undefined;
    return raw === true || raw === 'true' || raw === '1';
};

export class BulkUploadQueryDto {
    @ApiPropertyOptional({
        example: false,
        description: 'Validate the sheet and report what would happen, without saving anything.',
    })
    @IsOptional()
    @Transform(toBoolean)
    @IsBoolean()
    dryRun?: boolean;

    @ApiPropertyOptional({
        example: false,
        description: 'Show the created messes on the public website right away (default false).',
    })
    @IsOptional()
    @Transform(toBoolean)
    @IsBoolean()
    isListed?: boolean;

    @ApiPropertyOptional({
        example: false,
        description: 'Mark the created messes as verified (default false).',
    })
    @IsOptional()
    @Transform(toBoolean)
    @IsBoolean()
    isVerified?: boolean;
}

export class TemplateQueryDto {
    @ApiPropertyOptional({
        example: false,
        description: 'Fill the data sheet with two example rows instead of leaving it header-only.',
    })
    @IsOptional()
    @Transform(toBoolean)
    @IsBoolean()
    withSamples?: boolean;
}

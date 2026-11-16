import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

export class MessReportQueryDto {
  @ApiProperty({ description: 'Mess UUID' })
  @IsString()
  messId: string;

  @ApiPropertyOptional({
    description: 'Start date (YYYY-MM-DD). Defaults to 30 days ago.',
    example: '2026-11-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (YYYY-MM-DD). Defaults to today.',
    example: '2026-11-30',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ExportMessReportDto extends MessReportQueryDto {
  @ApiPropertyOptional({
    description:
      'If provided, the report is emailed (Excel attached) to this address (or addresses) ' +
      'instead of being downloaded.',
    example: 'owner@example.com',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? [value.trim()] : value,
  )
  @IsArray()
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true })
  email?: string[];
}

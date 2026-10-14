import { ApiPropertyOptional } from '@nestjs/swagger';
import { LedgerEntryReason, LedgerEntryType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ description: 'Page number (default 1)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size (default 20)', example: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Customer profile UUID (ignored for role USER — always their own)',
  })
  @IsOptional()
  @IsUUID()
  customerProfileId?: string;

  @ApiPropertyOptional({ description: 'Mess UUID (SUPERADMIN only; MESSADMIN is scoped to their own mess(es))' })
  @IsOptional()
  @IsUUID()
  messId?: string;

  @ApiPropertyOptional({ description: 'Subscription UUID' })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional({ enum: LedgerEntryType, description: 'DEBIT (charge) or CREDIT (payment)' })
  @IsOptional()
  @IsEnum(LedgerEntryType)
  type?: LedgerEntryType;

  @ApiPropertyOptional({ enum: LedgerEntryReason })
  @IsOptional()
  @IsEnum(LedgerEntryReason)
  reason?: LedgerEntryReason;

  @ApiPropertyOptional({ description: 'Start of date range (YYYY-MM-DD), inclusive' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'End of date range (YYYY-MM-DD), inclusive' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

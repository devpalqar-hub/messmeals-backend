import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Customer profile UUID the payment is for' })
  @IsUUID()
  customerProfileId: string;

  @ApiProperty({ description: 'Mess UUID this payment is credited against' })
  @IsUUID()
  messId: string;

  @ApiPropertyOptional({
    description: 'Optional subscription UUID this payment relates to',
  })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiProperty({ description: 'Amount paid (always positive)', example: 1500 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    description: 'Optional note, e.g. "Cash payment collected on visit"',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

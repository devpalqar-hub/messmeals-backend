import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceLineItemDto {
  @ApiProperty({ description: 'Item title or service description' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Extra details or notes for this line item' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiProperty({ description: 'Quantity or days', default: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Unit price in INR' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Total line item amount' })
  @IsOptional()
  @IsNumber()
  amount?: number;
}

export class CreateCustomInvoiceDto {
  @ApiProperty({ description: 'Mess UUID associated with this invoice' })
  @IsUUID()
  messId: string;

  @ApiPropertyOptional({ description: 'Customer profile UUID if customer-specific invoice' })
  @IsOptional()
  @IsUUID()
  customerProfileId?: string;

  @ApiPropertyOptional({ description: 'Subscription UUID if linked to a subscription' })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiProperty({ description: 'Invoice title', example: 'Monthly Meal Plan Invoice' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Invoice description or notes' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Billing period start date (YYYY-MM-DD or ISO)' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ description: 'Billing period end date (YYYY-MM-DD or ISO)' })
  @IsDateString()
  periodEnd: string;

  @ApiProperty({ description: 'Payment due date (YYYY-MM-DD or ISO)' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ description: 'Line items on this invoice', type: [InvoiceLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  items: InvoiceLineItemDto[];

  @ApiPropertyOptional({ description: 'Discount applied in INR', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Tax amount in INR', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ description: 'Amount already paid towards this invoice', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @ApiPropertyOptional({ description: 'Payment method if paid (e.g. UPI, CASH, RAZORPAY)' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Transaction ID / Reference if paid' })
  @IsOptional()
  @IsString()
  transactionId?: string;
}


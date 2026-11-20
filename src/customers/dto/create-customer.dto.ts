import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsBoolean,
  IsEnum,
  IsJSON,
  IsArray,
  IsUUID,
  IsDateString,
  IsIn,
  Matches,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ScheduleType, DayOfWeek } from '@prisma/client';

/** "lat,lng" — e.g. "9.434495,76.35037". */
export const LAT_LNG_REGEX =
  /^\s*-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?\s*$/;

export const DELIVERY_TYPES = ['EVERYDAY', 'CUSTOM'] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

const trimToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Body of POST /customer/register-user — only these fields are accepted. */
export class CreateCustomerDto {
  @ApiProperty({ example: 'Fayas' })
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @ApiProperty({ example: '+919638527410' })
  @IsString()
  @IsNotEmpty({ message: 'phone is required' })
  phone: string;

  @ApiProperty({
    example: 'test address',
    description:
      "Delivery address. Saved on the customer profile and as the new subscription's delivery address.",
  })
  @IsString()
  @IsNotEmpty({ message: 'address is required' })
  address: string;

  @ApiPropertyOptional({
    example: '9.434495,76.35037',
    description:
      'Delivery location as "latitude,longitude". Saved as the customer\'s latitude_logitude ' +
      "(used for delivery route optimisation) and on the subscription's delivery address.",
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @Matches(LAT_LNG_REGEX, {
    message: 'location must be "latitude,longitude", e.g. "9.434495,76.35037"',
  })
  location?: string;

  @ApiPropertyOptional({
    example: 'f14600ac-abf0-4197-b608-4d478bc664e7',
    description: "Mess of the plan. When sent, it must match the plan's mess.",
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsUUID()
  messId?: string;

  @ApiProperty({ example: '7041f26f-9141-4224-a6e9-e37b19119d20' })
  @IsUUID()
  planId: string;

  @ApiPropertyOptional({
    example: '093dd44e-66c8-4c85-8acd-209f926afcbf',
    description:
      'Optional. A customer can be registered without a delivery partner and assigned one later.',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsUUID()
  deliveryPartnerId?: string;

  @ApiProperty({ example: '2026-11-20' })
  @IsDateString()
  start_date: string;

  @ApiPropertyOptional({
    example: '2026-12-19',
    description:
      'Defaults to one month (monthly plans) or the start date (daily plans).',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    example: 0.0,
    description: 'Amount paid now (cash/UPI collected at registration).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  walletAmount?: number;

  @ApiPropertyOptional({ example: 0.0, description: 'Discount amount.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({
    example: 'Everyday',
    enum: ['Everyday', 'Custom'],
    description:
      'Everyday = deliver every day. Custom = deliver only on deliveryDays. Case-insensitive.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim() === ''
        ? undefined
        : value.trim().toUpperCase()
      : value,
  )
  @IsOptional()
  @IsIn(DELIVERY_TYPES, { message: 'deliveryType must be Everyday or Custom' })
  deliveryType?: DeliveryType;

  @ApiPropertyOptional({
    example: '',
    description: 'Preferred delivery time (accepted, not stored yet).',
  })
  @IsOptional()
  @IsString()
  preferredTime?: string;

  @ApiPropertyOptional({
    example: [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ],
    enum: DayOfWeek,
    isArray: true,
    description: 'Delivery weekdays — required when deliveryType is Custom.',
  })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((d) => (typeof d === 'string' ? d.trim().toUpperCase() : d))
      : value,
  )
  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  deliveryDays?: DayOfWeek[];
}

/**
 * Internal input of CustomerService.CreateUser — the register-user body after mapping,
 * plus the extra columns the bulk upload provides (email, schedule).
 */
export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
  address: string;
  /** "lat,lng" — stored as CustomerProfile.latitude_logitude. */
  latitude_logitude?: string;
  messId?: string;
  planId: string;
  deliveryPartnerId?: string;
  start_date: string;
  end_date?: string;
  walletAmount?: string | number;
  discount?: string | number;
  scheduleType?: ScheduleType;
  selectedDays?: string[];
}

export class UpdateCustomerDto {
  //user model
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  name: string;

  @ApiPropertyOptional({ example: '123 Main Street' })
  @IsString()
  @IsOptional()
  address: string;

  @ApiPropertyOptional({ example: '12.9716,77.5946' })
  @IsString()
  @IsOptional()
  latitude_logitude: string;

  @ApiPropertyOptional({ example: 'Bangalore' })
  @IsString()
  @IsOptional()
  currentLocation: string;

  //customer profile model
  @ApiPropertyOptional({ example: 1200 })
  @IsNumber()
  @IsOptional()
  walletAmount: number;

  @ApiPropertyOptional({ example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111' })
  @IsString()
  @IsOptional()
  planId: string;

  @ApiPropertyOptional({ example: 'b3f4fb3e-0e61-43c3-8b3b-b833f18b2f55' })
  @IsString()
  @IsOptional()
  deliveryPartnerId: string;
}

export class choosePlanDto {
  @ApiProperty({ example: 'a1c2e3f4-1111-2222-3333-444455556666' })
  @IsString()
  addressId: string;

  @ApiProperty({ example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111' })
  @IsString()
  planId: string;

  @ApiProperty({ example: '2026-05-07' })
  @IsString()
  start_date: string;

  @ApiPropertyOptional({ example: '2026-06-07' })
  @IsString()
  @IsOptional()
  end_date: string;

  //phase 2 changes:

  @ApiProperty({ example: 'WEEKLY' })
  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;

  @ApiPropertyOptional({ example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] })
  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, { each: true }) // optional if you have enum
  selectedDays: string[];

  @ApiPropertyOptional({ example: 'https://example.com/success' })
  @IsOptional()
  @IsString()
  successUrl: string;

  @ApiPropertyOptional({ example: 'https://example.com/cancel' })
  @IsOptional()
  @IsString()
  cancelUrl: string;
}

export class CreateSubscriptionForCustomerDto {
  @ApiPropertyOptional({
    example: '9b8c7d6e-1234-5678-90ab-cdef12345678',
    description:
      'CustomerProfile.id (preferred) or Customer.id of the existing customer',
  })
  @IsOptional()
  @IsString()
  customerProfileId?: string;

  @ApiPropertyOptional({
    example: 'c1a57700-4a7d-432c-85f8-03b03e3fc0bb',
    description: 'Customer.id of the customer',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    example: '9b8c7d6e-1234-5678-90ab-cdef12345678',
    description: 'Alias for customerProfileId',
  })
  @IsOptional()
  @IsString()
  userProfileId?: string;

  @ApiPropertyOptional({
    example: 'c1a57700-4a7d-432c-85f8-03b03e3fc0bb',
    description: 'Alias for customerId',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111' })
  @IsString()
  planId: string;

  @ApiPropertyOptional({ example: 'b3f4fb3e-0e61-43c3-8b3b-b833f18b2f55' })
  @IsString()
  @IsOptional()
  deliveryPartnerId?: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsString()
  start_date: string;

  @ApiPropertyOptional({
    example: '2026-08-31',
    description:
      'Optional. For monthly plans defaults to startDate + 1 month - 1 day. For daily plans defaults to startDate.',
  })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiProperty({
    enum: ScheduleType,
    example: 'EVERYDAY',
    description: 'EVERYDAY, CUSTOM, or MONTHLY',
  })
  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;

  @ApiPropertyOptional({
    example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    description: 'Required when scheduleType is CUSTOM',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  selectedDays?: string[];

  @ApiPropertyOptional({
    example: 100,
    description: 'Flat discount amount to deduct from totalPrice (default 0)',
  })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional({
    example: 'a1c2e3f4-1111-2222-3333-444455556666',
    description:
      'Optional delivery address (existing UserAddress.id). Ignored if "address" is also provided.',
  })
  @IsOptional()
  @IsString()
  userAddressId?: string;

  @ApiPropertyOptional({
    example: '221B Baker Street, Bangalore, 560001',
    description:
      'Optional new delivery address as a plain string. If provided, this takes precedence over ' +
      'userAddressId — a new UserAddress is created and linked to the subscription.',
  })
  @IsOptional()
  @IsString()
  address?: string;
}

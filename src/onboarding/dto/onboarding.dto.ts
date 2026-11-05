import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OnboardingStage, ScheduleType, SupportedCountry, WebsiteTheme } from '@prisma/client';

// ─────────────────────────────────────────────
// Existing DTOs (unchanged)
// ─────────────────────────────────────────────

export class StartOnboardingDto {
  @ApiPropertyOptional({ example: 'b0a701fa-bfba-40a2-a89e-2fcda4b7a701' })
  @IsOptional()
  @IsUUID()
  messId?: string;
}

export class TransitionStageDto {
  @ApiProperty({ enum: OnboardingStage, example: OnboardingStage.BUSINESS_DETAILS })
  @IsEnum(OnboardingStage)
  stage!: OnboardingStage;

  @ApiPropertyOptional({ example: 'COMPLETED', default: 'COMPLETED' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ example: { source: 'web_step_3' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// ─────────────────────────────────────────────
// New: Unified onboarding data submission DTOs
// ─────────────────────────────────────────────

/** Stage: BUSINESS_DETAILS — updates Mess + MessAdminProfile */
export class OnboardingBusinessDto {
  @ApiPropertyOptional({ example: 'Sri Lakshmi Mess' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Ravi Kumar' })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional({ example: 'ravi@srilakshmi.in' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Homestyle South Indian meals delivered daily.' })
  @IsOptional()
  @IsString()
  description?: string;
}

/** Stage: LOCATION — upserts BusinessLocation */
export class OnboardingLocationDto {
  @ApiPropertyOptional({ enum: SupportedCountry, example: 'IN' })
  @IsOptional()
  @IsEnum(SupportedCountry)
  country?: SupportedCountry;

  @ApiPropertyOptional({ example: 'No. 12, Anna Salai, 2nd Floor' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: 'T. Nagar' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: 'Chennai' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Tamil Nadu' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '600017' })
  @IsOptional()
  @IsString()
  postalCode?: string;
}

/** Stage: BRANDING — upserts BusinessBranding */
export class OnboardingBrandingDto {
  @ApiPropertyOptional({ example: 'Sri Lakshmi' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ enum: WebsiteTheme, example: 'WARM' })
  @IsOptional()
  @IsEnum(WebsiteTheme)
  theme?: WebsiteTheme;

  @ApiPropertyOptional({ example: '#FF5733' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#33C1FF' })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  coverUrl?: string;
}

/** Stage: WEBSITE_OFFER — claims the website offer for this mess */
export class OnboardingOfferDto {
  /**
   * Whether the mess wants to CLAIM the offer (true) or DISMISS it (false).
   * Defaults to CLAIMED when this section is included.
   */
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  claim?: boolean;
}

/** A single day's entry within a weekly menu schedule */
export class MenuScheduleDayEntryDto {
  @ApiPropertyOptional({ example: 'variation-uuid' })
  @IsOptional()
  @IsString()
  variationId?: string;

  @ApiProperty({ example: 'Rice, Dal, Sabzi, Roti' })
  @IsString()
  items!: string;
}

/** Stage: MENU_DAYS + DAILY_DISHES — upserts Menu */
export class OnboardingMenuDto {
  @ApiPropertyOptional({ example: 'Weekly Menu' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'plan-uuid' })
  @IsOptional()
  @IsString()
  planId?: string;

  /**
   * Schedule keyed by DayOfWeek (MONDAY, TUESDAY … SUNDAY).
   * Each day holds an array of variation/meal entries.
   * Example: { "MONDAY": [{ "items": "Rice, Dal, Roti" }] }
   */
  @ApiPropertyOptional({
    example: {
      MONDAY: [{ items: 'Rice, Dal, Sabzi, Roti' }],
      TUESDAY: [{ items: 'Idli, Sambar, Chutney' }],
    },
  })
  @IsOptional()
  @IsObject()
  schedule?: Record<string, { variationId?: string; items: string }[]>;
}

/** A single plan entry for the PRICING stage */
export class OnboardingPlanDto {
  @ApiProperty({ example: 'Monthly Lunch' })
  @IsString()
  planName!: string;

  @ApiProperty({ example: 1800 })
  @IsNumber()
  price!: number;

  @ApiPropertyOptional({ example: 'Full lunch meals every day of the month.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDailyPlan?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMonthlyPlan?: boolean;

  @ApiPropertyOptional({ enum: ScheduleType, example: 'EVERYDAY' })
  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @ApiPropertyOptional({ example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableDays?: string[];
}

/** Root DTO — POST /api/v1/onboarding/data */
export class SaveOnboardingDataDto {
  @ApiPropertyOptional({ example: 'b0a701fa-bfba-40a2-a89e-2fcda4b7a701' })
  @IsOptional()
  @IsUUID()
  messId?: string;

  /**
   * Optionally declare which stage this submission represents.
   * If omitted, the service auto-advances to the last section saved.
   */
  @ApiPropertyOptional({ enum: OnboardingStage, example: 'BUSINESS_DETAILS' })
  @IsOptional()
  @IsEnum(OnboardingStage)
  currentStage?: OnboardingStage;

  /** BUSINESS_DETAILS stage — updates Mess name/email/phone/description */
  @ApiPropertyOptional({ type: OnboardingBusinessDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingBusinessDto)
  business?: OnboardingBusinessDto;

  /** LOCATION stage — upserts BusinessLocation */
  @ApiPropertyOptional({ type: OnboardingLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingLocationDto)
  location?: OnboardingLocationDto;

  /** BRANDING stage — upserts BusinessBranding */
  @ApiPropertyOptional({ type: OnboardingBrandingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingBrandingDto)
  branding?: OnboardingBrandingDto;

  /** WEBSITE_OFFER stage — claims/dismisses the website offer */
  @ApiPropertyOptional({ type: OnboardingOfferDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingOfferDto)
  offer?: OnboardingOfferDto;

  /** MENU_DAYS + DAILY_DISHES stages — upserts weekly Menu */
  @ApiPropertyOptional({ type: OnboardingMenuDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingMenuDto)
  menu?: OnboardingMenuDto;

  /** PRICING stage — upserts Plans (merge by planName) */
  @ApiPropertyOptional({ type: [OnboardingPlanDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingPlanDto)
  plans?: OnboardingPlanDto[];
}

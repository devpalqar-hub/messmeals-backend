import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { OnboardingStage } from '@prisma/client';

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

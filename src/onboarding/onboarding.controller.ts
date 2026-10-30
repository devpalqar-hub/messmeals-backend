import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { StartOnboardingDto, TransitionStageDto } from './dto/onboarding.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Onboarding Flow (v1)')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MESSADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Post(['api/v1/onboarding/start', 'v1/onboarding/start'])
  @ApiOperation({
    summary: 'Start or restart onboarding session',
    description: 'Initializes an onboarding session for the authenticated business owner.',
  })
  start(@Req() req: any, @Body() dto: StartOnboardingDto) {
    return this.svc.start(req.user, dto);
  }

  @Get(['api/v1/onboarding/status', 'v1/onboarding/status'])
  @ApiOperation({ summary: 'Get current onboarding status and stage' })
  @ApiQuery({ name: 'messId', required: false, description: 'Optional business UUID' })
  getStatus(@Req() req: any, @Query('messId') messId?: string) {
    return this.svc.getStatus(req.user, messId);
  }

  @Get(['api/v1/onboarding/progress', 'v1/onboarding/progress'])
  @ApiOperation({
    summary: 'Calculate onboarding progress checklist',
    description: 'Computes overall percentage completion and checklist across all 10 setup stages based on actual DB records.',
  })
  @ApiQuery({ name: 'messId', required: false, description: 'Optional business UUID' })
  getProgress(@Req() req: any, @Query('messId') messId?: string) {
    return this.svc.getProgress(req.user, messId);
  }

  @Post(['api/v1/onboarding/resume', 'v1/onboarding/resume'])
  @ApiOperation({
    summary: 'Resume onboarding',
    description: 'Inspects business setup completion and redirects to the exact next incomplete stage.',
  })
  @ApiQuery({ name: 'messId', required: false, description: 'Optional business UUID' })
  resume(@Req() req: any, @Query('messId') messId?: string) {
    return this.svc.resume(req.user, messId);
  }

  @Patch(['api/v1/onboarding/stage', 'v1/onboarding/stage'])
  @ApiOperation({
    summary: 'Transition onboarding stage',
    description: 'Advances the onboarding session to a specific stage and logs an audit event.',
  })
  transitionStage(@Req() req: any, @Body() dto: TransitionStageDto) {
    return this.svc.transitionStage(req.user, dto);
  }

  @Post(['api/v1/onboarding/complete', 'v1/onboarding/complete'])
  @ApiOperation({
    summary: 'Finalize and complete onboarding',
    description: 'Marks onboarding as COMPLETED and activates the business on MessMeals.',
  })
  @ApiQuery({ name: 'messId', required: false, description: 'Optional business UUID' })
  complete(@Req() req: any, @Query('messId') messId?: string) {
    return this.svc.complete(req.user, messId);
  }
}

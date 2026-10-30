import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { V1PlansService } from './v1-plans.service';
import {
  SetPlanMealsDto,
  SetPlanPricingDto,
  SetPlanAvailabilityDto,
} from './dto/v1-plan.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Plan Onboarding & Pricing (v1)')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MESSADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class V1PlansController {
  constructor(private readonly svc: V1PlansService) {}

  @Get(['api/v1/plans/:id/meals', 'v1/plans/:id/meals'])
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiOperation({ summary: 'Get meal variations included in the plan' })
  getMeals(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getPlanMeals(req.user, id);
  }

  @Put(['api/v1/plans/:id/meals', 'v1/plans/:id/meals'])
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiOperation({ summary: 'Set meal variations included in the plan' })
  setMeals(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPlanMealsDto,
  ) {
    return this.svc.setPlanMeals(req.user, id, dto);
  }

  @Get(['api/v1/plans/:id/pricing', 'v1/plans/:id/pricing'])
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiOperation({ summary: 'Get plan pricing, discounts and billing period' })
  getPricing(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getPlanPricing(req.user, id);
  }

  @Put(['api/v1/plans/:id/pricing', 'v1/plans/:id/pricing'])
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiOperation({ summary: 'Set plan pricing, billing period and discount structure' })
  setPricing(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPlanPricingDto,
  ) {
    return this.svc.setPlanPricing(req.user, id, dto);
  }

  @Get(['api/v1/plans/:id/availability', 'v1/plans/:id/availability'])
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiOperation({ summary: 'Get plan schedule availability' })
  getAvailability(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getPlanAvailability(req.user, id);
  }

  @Put(['api/v1/plans/:id/availability', 'v1/plans/:id/availability'])
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiOperation({ summary: 'Set plan schedule availability (EVERYDAY or CUSTOM days)' })
  setAvailability(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPlanAvailabilityDto,
  ) {
    return this.svc.setPlanAvailability(req.user, id, dto);
  }

  @Get(['api/v1/plans/:id/summary', 'v1/plans/:id/summary'])
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  @ApiOperation({ summary: 'Get complete plan summary and onboarding completion status' })
  getSummary(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getPlanSummary(req.user, id);
  }
}

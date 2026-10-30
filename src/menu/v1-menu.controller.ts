import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { V1MenuService } from './v1-menu.service';
import { SetMenuDaysDto, SetDayMealsDto } from './dto/v1-menu.dto';
import { DayOfWeek } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Menu Onboarding & Management (v1)')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MESSADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class V1MenuController {
  constructor(private readonly svc: V1MenuService) {}

  @Get(['api/v1/menus/:id/days', 'v1/menus/:id/days'])
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiOperation({ summary: 'Get configured serving days for menu' })
  getDays(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getDays(req.user, id);
  }

  @Put(['api/v1/menus/:id/days', 'v1/menus/:id/days'])
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiOperation({ summary: 'Set serving days for menu' })
  setDays(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMenuDaysDto,
  ) {
    return this.svc.setDays(req.user, id, dto.days);
  }

  @Get(['api/v1/menus/:id/days/:day/meals', 'v1/menus/:id/days/:day/meals'])
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiParam({ name: 'day', enum: DayOfWeek, description: 'Day of week e.g. MONDAY' })
  @ApiOperation({ summary: 'Get meals configured for a specific day' })
  getDayMeals(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('day') day: DayOfWeek,
  ) {
    return this.svc.getDayMeals(req.user, id, day);
  }

  @Put(['api/v1/menus/:id/days/:day/meals', 'v1/menus/:id/days/:day/meals'])
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiParam({ name: 'day', enum: DayOfWeek })
  @ApiOperation({ summary: 'Set/replace meals for a specific day' })
  setDayMeals(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('day') day: DayOfWeek,
    @Body() dto: SetDayMealsDto,
  ) {
    return this.svc.setDayMeals(req.user, id, day, dto.meals);
  }

  @Delete(['api/v1/menus/:id/days/:day/meals', 'v1/menus/:id/days/:day/meals'])
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiParam({ name: 'day', enum: DayOfWeek })
  @ApiOperation({ summary: 'Delete meals for a specific day' })
  deleteDayMeals(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('day') day: DayOfWeek,
  ) {
    return this.svc.deleteDayMeals(req.user, id, day);
  }

  @Get(['api/v1/menus/:id/progress', 'v1/menus/:id/progress'])
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiOperation({ summary: 'Get menu onboarding completion progress' })
  getProgress(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getProgress(req.user, id);
  }

  @Post(['api/v1/menus/:id/validate', 'v1/menus/:id/validate'])
  @ApiParam({ name: 'id', description: 'Menu UUID' })
  @ApiOperation({ summary: 'Validate menu completeness and advance onboarding' })
  validateMenu(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.validateMenu(req.user, id);
  }
}

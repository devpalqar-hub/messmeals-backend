import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthUser, DeliveryWorkService } from './delivery-work.service';
import {
  AdminRoutesQueryDto,
  DeliveryDetailsQueryDto,
  MyRouteQueryDto,
  WorkDayQueryDto,
} from './dto/work-query.dto';
import { StartWorkSessionDto } from './dto/start-session.dto';
import { UpdateStopStatusDto } from './dto/update-stop-status.dto';
import {
  OptimizeRoutesDto,
  TransferDeliveriesDto,
} from './dto/admin-route.dto';

type AuthRequest = { user: AuthUser };

@ApiTags('Delivery Work (partner runs & route optimisation)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('delivery-work')
export class DeliveryWorkController {
  constructor(private readonly service: DeliveryWorkService) {}

  // ─── Partner: plan the day ───────────────────────────────────────────────

  @Roles(Role.DELIVERYAGENT)
  @ApiOperation({
    summary: 'Partner: variations to work today',
    description:
      'Variations (Breakfast/Lunch/Dinner…) the partner has deliveries for on the day, ' +
      'with stop counts by status, run (session) state and whether it can be started.',
  })
  @Get('my/variations')
  myVariations(@Req() req: AuthRequest, @Query() q: WorkDayQueryDto) {
    return this.service.listMyVariations(req.user, q.date);
  }

  @Roles(Role.DELIVERYAGENT)
  @ApiOperation({
    summary: 'Partner: route-sorted deliveries for a variation (map view)',
    description:
      'All deliveries of the variation in optimised two-wheeler route order, with ' +
      'coordinates, leg distance/duration, cumulative ETA, encoded polylines, live ' +
      'delivery status and which stop is current. The route is re-optimised ' +
      'automatically if orders were added, ended or transferred since last time.',
  })
  @Get('my/route')
  myRoute(@Req() req: AuthRequest, @Query() q: MyRouteQueryDto) {
    return this.service.getMyRoute(req.user, q.variationId, q.date);
  }

  // ─── Partner: work session ───────────────────────────────────────────────

  @Roles(Role.DELIVERYAGENT)
  @ApiOperation({
    summary: 'Partner: start (or resume) the run for a variation',
    description:
      'Starts the delivery run for one variation on a day and returns the first stop. ' +
      'Only one run can be in progress at a time (409 otherwise). Calling it again for ' +
      'the same variation/day resumes the run.',
  })
  @Post('sessions/start')
  start(@Req() req: AuthRequest, @Body() dto: StartWorkSessionDto) {
    return this.service.startSession(req.user, dto.variationId, dto.date);
  }

  @Roles(Role.DELIVERYAGENT)
  @ApiOperation({
    summary: 'Partner: current in-progress run',
    description:
      'Returns the run in progress (stage, progress, current stop) so the app can ' +
      'resume where the partner left off. `active: false` when nothing is running.',
  })
  @Get('sessions/active')
  active(@Req() req: AuthRequest) {
    return this.service.getActiveSession(req.user);
  }

  @Roles(Role.DELIVERYAGENT)
  @ApiOperation({
    summary: 'Partner: current / next delivery of a run',
    description:
      'The current stop (first pending stop on the route) plus the next few. Once all ' +
      'stops are done, returns `jobCompleted: true` with the completion summary.',
  })
  @ApiParam({ name: 'sessionId', description: 'Work session UUID' })
  @Get('sessions/:sessionId/current')
  current(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.service.getCurrentStop(req.user, sessionId);
  }

  @Roles(Role.DELIVERYAGENT)
  @ApiOperation({
    summary:
      'Partner: update a stop status (DELIVERED / UNDELIVERED / CANCELLED)',
    description:
      'Sets the status of this run’s variation on one delivery, then returns the next ' +
      'stop automatically. When the last stop is updated the run is completed and the ' +
      'response has `jobCompleted: true` and a `completion` summary.',
  })
  @ApiParam({ name: 'sessionId', description: 'Work session UUID' })
  @ApiParam({ name: 'deliveryId', description: 'Delivery UUID' })
  @Patch('sessions/:sessionId/stops/:deliveryId/status')
  updateStopStatus(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Body() dto: UpdateStopStatusDto,
  ) {
    return this.service.updateStopStatus(req.user, sessionId, deliveryId, dto);
  }

  @Roles(Role.DELIVERYAGENT)
  @ApiOperation({
    summary: 'Partner: run summary (job completed model)',
    description:
      'Totals for the run — delivered / undelivered / cancelled / pending, time taken, ' +
      'planned distance — and whether the job is complete.',
  })
  @ApiParam({ name: 'sessionId', description: 'Work session UUID' })
  @Get('sessions/:sessionId/summary')
  summary(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.service.getSessionSummary(req.user, sessionId);
  }

  @Roles(Role.DELIVERYAGENT)
  @ApiOperation({
    summary: 'Partner: end a run early',
    description:
      'Closes an in-progress run without completing it. Remaining stops stay PENDING ' +
      'and the run can be restarted with sessions/start.',
  })
  @ApiParam({ name: 'sessionId', description: 'Work session UUID' })
  @Patch('sessions/:sessionId/end')
  end(
    @Req() req: AuthRequest,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.service.endSession(req.user, sessionId);
  }

  // ─── Order details ───────────────────────────────────────────────────────

  @Roles(Role.DELIVERYAGENT, Role.MESSADMIN, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Full delivery details',
    description:
      'Customer name, contact number, full address with coordinates and navigation ' +
      'link, plan, every variation of the delivery with its status, subscription, mess ' +
      'contact and (with variationId) the stop’s position on the route. Partners can ' +
      'only open deliveries assigned to them; mess admins only their mess.',
  })
  @ApiParam({ name: 'deliveryId', description: 'Delivery UUID' })
  @Get('deliveries/:deliveryId')
  deliveryDetails(
    @Req() req: AuthRequest,
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Query() q: DeliveryDetailsQueryDto,
  ) {
    return this.service.getDeliveryDetails(req.user, deliveryId, q.variationId);
  }

  // ─── Admin: routes & transfers ───────────────────────────────────────────

  @Roles(Role.MESSADMIN, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Admin: optimised routes for a day',
    description:
      'One optimised route per partner (and one for unassigned deliveries) per ' +
      'variation, with the same map data as the partner route view.',
  })
  @Get('routes')
  routes(@Req() req: AuthRequest, @Query() q: AdminRoutesQueryDto) {
    return this.service.getRoutes(req.user, q);
  }

  @Roles(Role.MESSADMIN, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Admin: force re-optimisation of routes',
    description:
      'Re-optimises the matching routes for a day even if nothing changed (e.g. after ' +
      'fixing customer locations). Delivered/cancelled stops keep their place.',
  })
  @Post('routes/optimize')
  optimize(@Req() req: AuthRequest, @Body() dto: OptimizeRoutesDto) {
    return this.service.optimizeRoutes(req.user, dto);
  }

  @Roles(Role.MESSADMIN, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Admin: transfer a day’s pending deliveries to another partner',
    description:
      'Moves pending deliveries for one day (selected ids, all of a partner’s, or all ' +
      'unassigned) to another partner, then reorders both the old and new partner’s ' +
      'routes. The subscription’s default partner is not changed.',
  })
  @Post('transfer')
  transfer(@Req() req: AuthRequest, @Body() dto: TransferDeliveriesDto) {
    return this.service.transferDeliveries(req.user, dto);
  }
}

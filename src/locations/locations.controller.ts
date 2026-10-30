import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Locations & Business Address (v1)')
@Controller()
export class LocationsController {
  constructor(private readonly svc: LocationsService) {}

  @Get(['api/v1/locations/countries', 'v1/locations/countries'])
  @ApiOperation({
    summary: 'Get supported countries',
    description: 'Returns the list of supported countries with their currencies, symbols, and timezones (IN, AE, QA).',
  })
  getCountries() {
    return this.svc.getCountries();
  }

  @Get(['api/v1/businesses/:id/location', 'v1/businesses/:id/location'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MESSADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Business (mess) UUID' })
  @ApiOperation({ summary: 'Get business location' })
  getLocation(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getLocation(req.user, id);
  }

  @Post(['api/v1/businesses/:id/location', 'v1/businesses/:id/location'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MESSADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Business (mess) UUID' })
  @ApiOperation({
    summary: 'Configure business location',
    description: 'Saves structured address and automatically configures currency and timezone based on country.',
  })
  createLocation(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLocationDto,
  ) {
    return this.svc.createLocation(req.user, id, dto);
  }

  @Patch(['api/v1/businesses/:id/location', 'v1/businesses/:id/location'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MESSADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Business (mess) UUID' })
  @ApiOperation({ summary: 'Update business location' })
  updateLocation(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.svc.updateLocation(req.user, id, dto);
  }
}

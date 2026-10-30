import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@ApiTags('Businesses (v1)')
@Controller(['api/v1/businesses', 'v1/businesses'])
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BusinessesController {
  constructor(private readonly svc: BusinessesService) {}

  @Post()
  @Roles('MESSADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Register business', description: 'Creates a new business (mess) for the authenticated owner.' })
  create(@Req() req: any, @Body() dto: CreateBusinessDto) {
    return this.svc.create(req.user, dto);
  }

  @Get('me')
  @Roles('MESSADMIN', 'SUPERADMIN')
  @ApiOperation({ summary: 'Get my business', description: 'Returns the business(es) owned by the authenticated user.' })
  getMe(@Req() req: any) {
    return this.svc.getMyBusiness(req.user);
  }

  @Get(':id')
  @Roles('MESSADMIN', 'SUPERADMIN')
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiOperation({ summary: 'Get business by ID' })
  findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(req.user, id);
  }

  @Patch(':id')
  @Roles('MESSADMIN', 'SUPERADMIN')
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiOperation({ summary: 'Update business details' })
  update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBusinessDto) {
    return this.svc.update(req.user, id, dto);
  }
}

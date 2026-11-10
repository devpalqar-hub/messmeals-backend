import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CustomDomainService } from './custom-domain.service';
import { AddCustomDomainDto } from './dto/custom-domain.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Custom Domains (v1)')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MESSADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class CustomDomainController {
  constructor(private readonly svc: CustomDomainService) {}

  @Post([
    'api/v1/websites/:websiteId/domains',
    'v1/websites/:websiteId/domains',
  ])
  @ApiParam({ name: 'websiteId', description: 'Website UUID' })
  @ApiOperation({
    summary: 'Add a custom domain to a restaurant website',
    description: 'Registers a custom domain (e.g. order.myrestaurant.com) and provides DNS TXT record for ownership verification.',
  })
  addDomain(
    @Req() req: any,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body() dto: AddCustomDomainDto,
  ) {
    return this.svc.addCustomDomain(req.user, websiteId, dto);
  }

  @Get([
    'api/v1/websites/:websiteId/domains',
    'v1/websites/:websiteId/domains',
  ])
  @ApiParam({ name: 'websiteId', description: 'Website UUID' })
  @ApiOperation({ summary: 'List custom domains configured for a website' })
  getDomains(
    @Req() req: any,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
  ) {
    return this.svc.getCustomDomains(req.user, websiteId);
  }

  @Post([
    'api/v1/websites/:websiteId/domains/:domainId/verify',
    'v1/websites/:websiteId/domains/:domainId/verify',
  ])
  @ApiParam({ name: 'websiteId', description: 'Website UUID' })
  @ApiParam({ name: 'domainId', description: 'Custom Domain UUID' })
  @ApiOperation({
    summary: 'Verify DNS ownership of a custom domain',
    description: 'Checks public DNS for matching TXT verification token. Activates domain upon successful match.',
  })
  verifyDomain(
    @Req() req: any,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.svc.verifyCustomDomain(req.user, websiteId, domainId);
  }

  @Delete([
    'api/v1/websites/:websiteId/domains/:domainId',
    'v1/websites/:websiteId/domains/:domainId',
  ])
  @ApiParam({ name: 'websiteId', description: 'Website UUID' })
  @ApiParam({ name: 'domainId', description: 'Custom Domain UUID' })
  @ApiOperation({ summary: 'Disconnect / remove a custom domain' })
  disconnectDomain(
    @Req() req: any,
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.svc.disconnectCustomDomain(req.user, websiteId, domainId);
  }
}


import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { WebsitesService } from './websites.service';
import { GenerateWebsiteDto } from './dto/website.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Business Websites (v1)')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MESSADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class WebsitesController {
  constructor(private readonly svc: WebsitesService) {}

  @Post(['api/v1/websites/generate', 'v1/websites/generate'])
  @ApiOperation({
    summary: 'Trigger website generation',
    description: 'Generates a branded public website for the business incorporating theme, menu, and plans.',
  })
  generate(@Req() req: any, @Body() dto: GenerateWebsiteDto) {
    return this.svc.generate(req.user, dto);
  }

  @Get(['api/v1/websites/generation/:jobId', 'v1/websites/generation/:jobId'])
  @ApiParam({ name: 'jobId', description: 'Generation Job UUID' })
  @ApiOperation({ summary: 'Check website generation job progress' })
  getJob(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.svc.getJob(jobId);
  }

  @Get(['api/v1/websites/me', 'v1/websites/me'])
  @ApiOperation({ summary: 'Get current user business website' })
  getMyWebsite(@Req() req: any) {
    return this.svc.getMyWebsite(req.user);
  }

  @Get(['api/v1/websites/:id', 'v1/websites/:id'])
  @ApiParam({ name: 'id', description: 'Website UUID' })
  @ApiOperation({ summary: 'Get website by ID' })
  findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(req.user, id);
  }

  @Post(['api/v1/websites/:id/publish', 'v1/websites/:id/publish'])
  @ApiParam({ name: 'id', description: 'Website UUID' })
  @ApiOperation({ summary: 'Publish website and make it live' })
  publish(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.publish(req.user, id);
  }

  @Post(['api/v1/websites/:id/republish', 'v1/websites/:id/republish'])
  @ApiParam({ name: 'id', description: 'Website UUID' })
  @ApiOperation({ summary: 'Republish website with updated menu and plans' })
  republish(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.republish(req.user, id);
  }

  @Get(['api/v1/websites/:id/status', 'v1/websites/:id/status'])
  @ApiParam({ name: 'id', description: 'Website UUID' })
  @ApiOperation({ summary: 'Get website publishing status' })
  getStatus(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getStatus(req.user, id);
  }
}

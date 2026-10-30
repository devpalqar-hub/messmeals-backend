import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BrandingService } from './branding.service';
import { UpdateBrandingDto } from './dto/branding.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Business Branding (v1)')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MESSADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class BrandingController {
  constructor(private readonly svc: BrandingService) {}

  @Get(['api/v1/businesses/:id/branding', 'v1/businesses/:id/branding'])
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiOperation({ summary: 'Get business branding configuration' })
  getBranding(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getBranding(req.user, id);
  }

  @Put(['api/v1/businesses/:id/branding', 'v1/businesses/:id/branding'])
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiOperation({
    summary: 'Update business branding',
    description: 'Updates theme, primary/secondary colors, logo, cover image, and gallery images.',
  })
  updateBranding(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.svc.updateBranding(req.user, id, dto);
  }

  @Delete(['api/v1/businesses/:id/branding/logo', 'v1/businesses/:id/branding/logo'])
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiOperation({ summary: 'Delete business logo' })
  deleteLogo(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteLogo(req.user, id);
  }

  @Delete(['api/v1/businesses/:id/branding/cover', 'v1/businesses/:id/branding/cover'])
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiOperation({ summary: 'Delete business cover image' })
  deleteCover(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteCover(req.user, id);
  }

  @Get(['api/v1/businesses/:id/branding/gallery/:imageId', 'v1/businesses/:id/branding/gallery/:imageId'])
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiParam({ name: 'imageId', description: 'Gallery Image UUID' })
  @ApiOperation({ summary: 'Get a specific gallery image' })
  getGalleryItem(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.svc.getGalleryItem(req.user, id, imageId);
  }

  @Delete(['api/v1/businesses/:id/branding/gallery/:imageId', 'v1/businesses/:id/branding/gallery/:imageId'])
  @ApiParam({ name: 'id', description: 'Business UUID' })
  @ApiParam({ name: 'imageId', description: 'Gallery Image UUID' })
  @ApiOperation({ summary: 'Delete a specific gallery image' })
  deleteGalleryItem(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.svc.deleteGalleryItem(req.user, id, imageId);
  }
}

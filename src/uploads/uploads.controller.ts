import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { GeneratePresignedUrlDto, CompleteUploadDto } from './dto/upload.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Direct S3 Uploads (v1)')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MESSADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class UploadsController {
  constructor(private readonly svc: UploadsService) {}

  @Post(['api/v1/uploads/presigned-url', 'v1/uploads/presigned-url'])
  @ApiOperation({
    summary: 'Generate presigned upload URL',
    description: 'Generates a temporary AWS S3 presigned PUT URL allowing direct frontend asset upload.',
  })
  generatePresignedUrl(@Req() req: any, @Body() dto: GeneratePresignedUrlDto) {
    return this.svc.generatePresignedUrl(req.user, dto);
  }

  @Post(['api/v1/uploads/complete', 'v1/uploads/complete'])
  @ApiOperation({
    summary: 'Confirm completed upload',
    description: 'Notifies the backend that an S3 upload has completed and links it to business logo, cover, or gallery.',
  })
  completeUpload(@Req() req: any, @Body() dto: CompleteUploadDto) {
    return this.svc.completeUpload(req.user, dto);
  }
}

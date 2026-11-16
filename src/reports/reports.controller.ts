import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ExportMessReportDto, MessReportQueryDto } from './dto/mess-report.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.MESSADMIN)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('mess')
  @ApiOperation({
    summary: 'Mess report (JSON)',
    description:
      'Revenue received, pending (brought forward from previous + total to receive), expenses with ' +
      'category-wise lists, profit, comparison with the previous period and other metrics for a mess ' +
      'over a date range.',
  })
  report(@Query() query: MessReportQueryDto, @Req() req) {
    return this.service.buildReport(req.user, query);
  }

  @Post('mess/export')
  @ApiOperation({
    summary: 'Export mess report',
    description:
      'Without `email` in the body, downloads the report as an Excel file. With `email`, the report ' +
      'is emailed (summary + Excel attachment) to that address and a JSON confirmation is returned.',
  })
  async export(
    @Body() dto: ExportMessReportDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.export(req.user, dto);
    if (result.emailed) {
      return { message: 'Report emailed', to: result.to, filename: result.filename };
    }
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });
    return new StreamableFile(result.buffer);
  }
}

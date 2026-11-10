import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { UserSubscriptionsService } from './user-subscriptions.service';
import { InvoicesService } from 'src/invoices/invoices.service';
import { UpdateDeliveryPriorityDto } from './dto/update-delivery-priority.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateUserSubscriptionDto } from './dto/update-user-subscription.dto';
import { UpdateBulkDeliveryPriorityDto } from './dto/update-bulk-delivery-priority.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('User Subscriptions')
@Controller('user-subscriptions')
export class UserSubscriptionsController {
  constructor(
    private readonly userSubscriptionsService: UserSubscriptionsService,
    private readonly invoicesService: InvoicesService,
  ) {}

  @Patch(':id/delivery-priority')
  @ApiOperation({
    summary: 'Update delivery priority',
    description: 'Updates delivery priority for a subscription.',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  updateDeliveryPriority(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryPriorityDto,
  ) {
    return this.userSubscriptionsService.updateDeliveryPriority(id, dto);
  }

  @Patch('bulk/delivery-priority')
  @ApiOperation({
    summary: 'Bulk update delivery priority',
    description: 'Updates delivery priority for multiple subscriptions.',
  })
  bulkUpdateDeliveryPriority(@Body() dto: UpdateBulkDeliveryPriorityDto) {
    return this.userSubscriptionsService.bulkUpdateDeliveryPriority(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List subscriptions',
    description:
      'Returns subscriptions with optional filters and role-based access.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'messId', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({
    name: 'userProfileId',
    required: false,
    description: 'Filter by customer profile UUID (userProfileId / customerProfileId)',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by customer user UUID',
  })
  @Get()
  getAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('messId') messId?: string,
    @Query('isActive') isActive?: string,
    @Query('userProfileId') userProfileId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.userSubscriptionsService.getAll(req.user, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      messId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      userProfileId,
      userId,
    });
  }

  /**
   * GET /user-subscriptions/:id
   */
  @ApiOperation({
    summary: 'Get subscription by id',
    description: 'Fetches a subscription by UUID.',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.userSubscriptionsService.getById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get subscription invoice details (JSON)',
    description: 'Returns invoice breakdown, line items, and payment status for this subscription.',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @Get(':id/invoice')
  async getInvoice(@Param('id') id: string) {
    const data = await this.invoicesService.getSubscriptionInvoiceData(id);
    return { success: true, invoice: data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Export subscription invoice as PDF',
    description: 'Streams a tax invoice PDF for the customer subscription.',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @Get(':id/invoice/pdf')
  async downloadInvoicePdf(
    @Req() req: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.invoicesService.getSubscriptionInvoicePdf(id, req.user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${id.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get subscription receipt details (JSON)',
    description: 'Returns receipt details for payments made against this subscription.',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @Get(':id/receipt')
  async getReceipt(@Param('id') id: string) {
    const data = await this.invoicesService.getSubscriptionReceiptData(id);
    return { success: true, receipt: data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Export subscription payment receipt as PDF',
    description: 'Streams a payment receipt PDF for the customer subscription.',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @Get(':id/receipt/pdf')
  async downloadReceiptPdf(
    @Req() req: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.invoicesService.getSubscriptionReceiptPdf(id, req.user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="receipt-${id.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update subscription',
    description: 'Updates a subscription by UUID.',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserSubscriptionDto,
  ) {
    return this.userSubscriptionsService.update(id, dto);
  }

  /**
   * Admin delete subscription (soft delete)
   */
  @ApiOperation({
    summary: 'Delete subscription',
    description: 'Deletes a subscription by UUID.',
  })
  @ApiParam({ name: 'id', description: 'Subscription UUID' })
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.userSubscriptionsService.delete(id);
  }
}

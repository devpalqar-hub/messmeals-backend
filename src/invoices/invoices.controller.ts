import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CreateCustomInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Invoices & Receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CUSTOM INVOICE CREATION
  // ───────────────────────────────────────────────────────────────────────────

  @Post('create')
  @Roles(Role.SUPERADMIN, Role.MESSADMIN)
  @ApiOperation({
    summary: 'Create custom invoice',
    description: 'Generates a custom invoice with arbitrary line items, amounts, and dates.',
  })
  @ApiResponse({ status: 201, description: 'Invoice generated successfully.' })
  async createCustomInvoice(@Req() req: any, @Body() dto: CreateCustomInvoiceDto) {
    return this.invoicesService.createCustomInvoice(dto, req.user);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SUBSCRIPTION INVOICES & RECEIPTS
  // ───────────────────────────────────────────────────────────────────────────

  @Get('subscription/:subscriptionId')
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiOperation({
    summary: 'Get subscription invoice details (JSON)',
    description: 'Returns invoice breakdown, line items, seller, customer, and balance due.',
  })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
  async getSubscriptionInvoice(
    @Req() req: any,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
  ) {
    const data = await this.invoicesService.getSubscriptionInvoiceData(subscriptionId);
    return { success: true, invoice: data };
  }

  @Get('subscription/:subscriptionId/pdf')
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiOperation({
    summary: 'Export subscription invoice as PDF',
    description: 'Streams a beautifully styled tax invoice PDF for the specified subscription.',
  })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
  async downloadSubscriptionInvoicePdf(
    @Req() req: any,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.invoicesService.getSubscriptionInvoicePdf(
      subscriptionId,
      req.user,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${subscriptionId.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('subscription/:subscriptionId/receipt')
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiOperation({
    summary: 'Get subscription payment receipt details (JSON)',
    description: 'Returns receipt breakdown for payments made against a subscription.',
  })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
  async getSubscriptionReceipt(
    @Req() req: any,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
  ) {
    const data = await this.invoicesService.getSubscriptionReceiptData(subscriptionId);
    return { success: true, receipt: data };
  }

  @Get('subscription/:subscriptionId/receipt/pdf')
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiOperation({
    summary: 'Export subscription payment receipt as PDF',
    description: 'Streams a verified payment receipt PDF for the specified subscription.',
  })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
  async downloadSubscriptionReceiptPdf(
    @Req() req: any,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.invoicesService.getSubscriptionReceiptPdf(
      subscriptionId,
      req.user,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="receipt-${subscriptionId.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. PAYMENT RECEIPT BY PAYMENT ID
  // ───────────────────────────────────────────────────────────────────────────

  @Get('payment/:paymentId/receipt/pdf')
  @Roles(Role.SUPERADMIN, Role.MESSADMIN, Role.USER)
  @ApiOperation({
    summary: 'Export payment receipt as PDF by Payment ID',
    description: 'Streams a payment receipt PDF directly from a recorded transaction or gateway payment.',
  })
  @ApiParam({ name: 'paymentId', description: 'Payment UUID' })
  async downloadPaymentReceiptPdf(
    @Req() req: any,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.invoicesService.getPaymentReceiptPdf(paymentId, req.user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="payment-receipt-${paymentId.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. MESS PLATFORM BILLING INVOICE & RECEIPT
  // ───────────────────────────────────────────────────────────────────────────

  @Get('mess/:messId/pdf')
  @Roles(Role.SUPERADMIN, Role.MESSADMIN)
  @ApiOperation({
    summary: 'Export mess platform billing invoice as PDF',
    description: 'Streams the platform billing invoice PDF for a mess.',
  })
  @ApiParam({ name: 'messId', description: 'Mess UUID' })
  @ApiQuery({ name: 'invoiceId', required: false, description: 'Optional specific invoice UUID' })
  async downloadMessInvoicePdf(
    @Req() req: any,
    @Param('messId', ParseUUIDPipe) messId: string,
    @Query('invoiceId') invoiceId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.invoicesService.getMessInvoicePdf(
      messId,
      invoiceId,
      req.user,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="mess-invoice-${messId.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('mess/:messId/receipt/pdf')
  @Roles(Role.SUPERADMIN, Role.MESSADMIN)
  @ApiOperation({
    summary: 'Export mess platform billing payment receipt as PDF',
    description: 'Streams the payment receipt PDF for a settled platform billing invoice.',
  })
  @ApiParam({ name: 'messId', description: 'Mess UUID' })
  @ApiQuery({ name: 'invoiceId', required: false, description: 'Optional specific invoice UUID' })
  async downloadMessReceiptPdf(
    @Req() req: any,
    @Param('messId', ParseUUIDPipe) messId: string,
    @Query('invoiceId') invoiceId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.invoicesService.getMessReceiptPdf(
      messId,
      invoiceId,
      req.user,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="mess-receipt-${messId.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(buffer);
  }
}


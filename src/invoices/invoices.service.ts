import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PdfService, InvoicePdfData, ReceiptPdfData } from './pdf.service';
import { InvoiceStatus, LedgerEntryType, Role } from '@prisma/client';
import { CreateCustomInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  /**
   * Asserts user has access to a customer subscription (user owns it, or mess admin of that mess, or superadmin).
   */
  async assertSubscriptionAccess(user: any, subscription: any) {
    if (!user || user.role === Role.SUPERADMIN) return;

    if (user.role === Role.USER) {
      const customerUserId = subscription.CustomerProfile?.userId;
      if (customerUserId !== user.id && subscription.CustomerProfile?.user?.id !== user.id) {
        throw new ForbiddenException('Access denied to this subscription invoice');
      }
    }

    if (user.role === Role.MESSADMIN) {
      const adminMesses = user.messIds || (user.messId ? [user.messId] : []);
      if (!adminMesses.includes(subscription.messId)) {
        throw new ForbiddenException('Access denied: subscription does not belong to your mess');
      }
    }
  }

  /**
   * Asserts user has access to a Mess (mess admin of that mess or superadmin).
   */
  async assertMessAccess(user: any, messId: string) {
    if (!user || user.role === Role.SUPERADMIN) return;

    if (user.role === Role.MESSADMIN) {
      const adminMesses = user.messIds || (user.messId ? [user.messId] : []);
      if (!adminMesses.includes(messId)) {
        throw new ForbiddenException('Access denied: mess not assigned to your account');
      }
    } else {
      throw new ForbiddenException('Access denied: requires Mess Admin or Super Admin role');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CUSTOMER SUBSCRIPTION INVOICE & RECEIPT
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Fetches full subscription details and prepares Invoice Data.
   */
  async getSubscriptionInvoiceData(subscriptionId: string): Promise<InvoicePdfData> {
    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId },
      include: {
        mess: true,
        plan: {
          include: {
            Variation: true,
          },
        },
        CustomerProfile: {
          include: {
            user: true,
            addresses: true,
          },
        },
        UserAddress: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        ledgerTransactions: {
          where: { type: LedgerEntryType.CREDIT },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with id ${subscriptionId} not found`);
    }

    const { mess, plan, CustomerProfile: profile, UserAddress: address } = subscription;
    const customer = profile?.user;

    const totalPrice = Number(subscription.totalPrice) || Number(plan.price) || 0;
    const discount = Number(subscription.discount) || 0;
    const discountedPrice = Number(subscription.discountedPrice) || totalPrice - discount;

    // Calculate total amount paid from successful payments or credits
    const successfulPaymentsTotal = subscription.payments
      .filter((p) => p.status === 'SUCCESS' || p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const ledgerCreditsTotal = subscription.ledgerTransactions.reduce(
      (sum, l) => sum + Number(l.amount),
      0,
    );

    const amountPaid = Math.max(successfulPaymentsTotal, ledgerCreditsTotal);
    const balanceDue = Math.max(0, discountedPrice - amountPaid);

    let status: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PENDING' = 'UNPAID';
    if (balanceDue <= 0 && amountPaid > 0) {
      status = 'PAID';
    } else if (amountPaid > 0) {
      status = 'PENDING';
    }

    const latestPayment = subscription.payments.find(
      (p) => p.status === 'SUCCESS' || p.status === 'PAID',
    );

    // Format address
    const fullAddress = address
      ? [address.street, address.townOrcity, address.postcode, address.country]
          .filter(Boolean)
          .join(', ')
      : profile?.address || 'Address on file';

    // Variations description
    const variationNames = plan.Variation?.map((v) => v.title).join(', ');

    const items = [
      {
        description: `${plan.planName} (${plan.isMonthlyPlan ? 'Monthly' : 'Daily'} Plan)`,
        details: [
          `Validity: ${subscription.start_date.toISOString().slice(0, 10)} to ${
            subscription.end_date?.toISOString().slice(0, 10) ?? 'Ongoing'
          }`,
          variationNames ? `Meals Included: ${variationNames}` : null,
          subscription.scheduleType ? `Schedule: ${subscription.scheduleType}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
        quantity: 1,
        unitPrice: totalPrice,
        amount: totalPrice,
      },
    ];

    const shortId = subscription.id.replace(/-/g, '').slice(0, 8).toUpperCase();

    return {
      documentTitle: 'TAX INVOICE',
      invoiceNumber: `INV-SUB-${shortId}`,
      issueDate: subscription.createdAt,
      dueDate: subscription.start_date,
      status,
      seller: {
        name: mess.name,
        address: mess.address || mess.location,
        phone: mess.phone,
        email: mess.email,
      },
      customer: {
        name: customer?.name || 'Valued Customer',
        phone: customer?.phone,
        email: customer?.email,
        address: fullAddress,
      },
      items,
      subtotal: totalPrice,
      discount,
      total: discountedPrice,
      amountPaid,
      balanceDue,
      paymentDetails:
        amountPaid > 0
          ? {
              paymentMethod: latestPayment ? 'Online (Razorpay / UPI)' : 'Advance / Ledger Settlement',
              transactionId: latestPayment?.razorpayPaymentId || undefined,
              paidAt: latestPayment?.processedAt || latestPayment?.createdAt || subscription.createdAt,
            }
          : undefined,
      notes: 'Thank you for choosing our meal subscription service. Fresh and healthy meals prepared with care.',
      terms: 'Subscriptions are non-transferable. Cancellations or pauses must be requested 24 hours in advance.',
    };
  }

  /**
   * Generates Invoice PDF for a customer subscription.
   */
  async getSubscriptionInvoicePdf(subscriptionId: string, user?: any): Promise<Buffer> {
    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId },
      include: {
        CustomerProfile: { include: { user: true } },
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }

    if (user) {
      await this.assertSubscriptionAccess(user, subscription);
    }

    const invoiceData = await this.getSubscriptionInvoiceData(subscriptionId);
    return this.pdfService.generateInvoicePdf(invoiceData);
  }

  /**
   * Fetches full subscription details and prepares Receipt Data.
   */
  async getSubscriptionReceiptData(subscriptionId: string): Promise<ReceiptPdfData> {
    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId },
      include: {
        mess: true,
        plan: true,
        CustomerProfile: {
          include: {
            user: true,
            addresses: true,
          },
        },
        UserAddress: true,
        payments: {
          where: { status: { in: ['SUCCESS', 'PAID'] } },
          orderBy: { createdAt: 'desc' },
        },
        ledgerTransactions: {
          where: { type: LedgerEntryType.CREDIT },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with id ${subscriptionId} not found`);
    }

    const { mess, plan, CustomerProfile: profile, UserAddress: address } = subscription;
    const customer = profile?.user;

    const successfulPaymentsTotal = subscription.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const ledgerCreditsTotal = subscription.ledgerTransactions.reduce(
      (sum, l) => sum + Number(l.amount),
      0,
    );

    const amountPaid = Math.max(
      successfulPaymentsTotal,
      ledgerCreditsTotal,
      Number(subscription.discountedPrice) || 0,
    );

    const latestPayment = subscription.payments[0];
    const latestCredit = subscription.ledgerTransactions[0];

    const shortId = subscription.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const fullAddress = address
      ? [address.street, address.townOrcity, address.postcode].filter(Boolean).join(', ')
      : profile?.address;

    return {
      documentTitle: 'OFFICIAL PAYMENT RECEIPT',
      receiptNumber: `REC-SUB-${shortId}`,
      paymentDate: latestPayment?.processedAt || latestPayment?.createdAt || latestCredit?.createdAt || subscription.createdAt,
      status: 'PAID',
      payee: {
        name: mess.name,
        address: mess.address || mess.location,
        phone: mess.phone,
        email: mess.email,
      },
      payer: {
        name: customer?.name || 'Valued Customer',
        phone: customer?.phone,
        email: customer?.email,
        address: fullAddress,
      },
      amountPaid,
      paymentMethod: latestPayment ? 'Online / Razorpay' : 'UPI / Cash / Advance Credit',
      transactionId: latestPayment?.razorpayPaymentId || latestPayment?.razorpayOrderId || null,
      invoiceReference: `INV-SUB-${shortId}`,
      subscriptionReference: `SUB-${shortId}`,
      forDescription: `Payment for ${plan.planName} (${subscription.start_date.toISOString().slice(0, 10)} to ${
        subscription.end_date?.toISOString().slice(0, 10) ?? 'Ongoing'
      })`,
      notes: 'Thank you for your payment! Please retain this receipt for your records.',
    };
  }

  /**
   * Generates Receipt PDF for a customer subscription.
   */
  async getSubscriptionReceiptPdf(subscriptionId: string, user?: any): Promise<Buffer> {
    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId },
      include: {
        CustomerProfile: { include: { user: true } },
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }

    if (user) {
      await this.assertSubscriptionAccess(user, subscription);
    }

    const receiptData = await this.getSubscriptionReceiptData(subscriptionId);
    return this.pdfService.generateReceiptPdf(receiptData);
  }

  /**
   * Generates Receipt PDF from a specific Payments record ID.
   */
  async getPaymentReceiptPdf(paymentId: string, user?: any): Promise<Buffer> {
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
      include: {
        userSubscriptions: {
          include: {
            mess: true,
            plan: true,
            CustomerProfile: {
              include: {
                user: true,
                addresses: true,
              },
            },
            UserAddress: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record ${paymentId} not found`);
    }

    const sub = payment.userSubscriptions;
    if (user && sub) {
      await this.assertSubscriptionAccess(user, sub);
    }

    const shortId = payment.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const subShortId = sub ? sub.id.replace(/-/g, '').slice(0, 8).toUpperCase() : 'N/A';

    const receiptData: ReceiptPdfData = {
      documentTitle: 'OFFICIAL PAYMENT RECEIPT',
      receiptNumber: `REC-PAY-${shortId}`,
      paymentDate: payment.processedAt || payment.createdAt,
      status: 'PAID',
      payee: {
        name: sub?.mess.name || 'MessMeals Partner',
        address: sub?.mess.address || sub?.mess.location,
        phone: sub?.mess.phone,
        email: sub?.mess.email,
      },
      payer: {
        name: payment.customerName || sub?.CustomerProfile?.user?.name || 'Customer',
        phone: payment.customerPhone || sub?.CustomerProfile?.user?.phone,
        email: payment.customerEmail || sub?.CustomerProfile?.user?.email,
        address: sub?.UserAddress?.street || sub?.CustomerProfile?.address,
      },
      amountPaid: Number(payment.amount) || 0,
      paymentMethod: 'Razorpay / Online',
      transactionId: payment.razorpayPaymentId || payment.razorpayOrderId,
      invoiceReference: sub ? `INV-SUB-${subShortId}` : undefined,
      subscriptionReference: sub ? `SUB-${subShortId}` : undefined,
      forDescription: sub
        ? `Payment for ${sub.plan.planName} meal subscription`
        : 'Payment for meal subscription',
      notes: 'Payment confirmed via secure gateway.',
    };

    return this.pdfService.generateReceiptPdf(receiptData);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. MESS PLATFORM BILLING INVOICE & RECEIPT (MessInvoice)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Prepares Invoice Data for a Mess platform billing invoice (MessInvoice).
   */
  async getMessInvoiceData(messId: string, invoiceId?: string): Promise<InvoicePdfData> {
    const where: any = { messId };
    if (invoiceId) {
      where.id = invoiceId;
    }

    const invoice = await this.prisma.messInvoice.findFirst({
      where,
      orderBy: { periodStart: 'desc' },
      include: {
        mess: {
          include: {
            messAdmins: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Invoice for mess ${messId} not found. Please ensure an invoice is generated first.`,
      );
    }

    const { mess } = invoice;
    const adminUser = mess.messAdmins?.[0]?.user;

    const customerCount = invoice.customerCount || 0;
    const rate = Number(invoice.rate) || 0;
    const totalAmount = Number(invoice.amount) || 0;

    const shortId = invoice.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const periodStartStr = invoice.periodStart.toISOString().slice(0, 10);
    const periodEndStr = invoice.periodEnd.toISOString().slice(0, 10);

    const isPaid = invoice.status === InvoiceStatus.PAID;
    const isOverdue =
      invoice.status === InvoiceStatus.OVERDUE ||
      (!isPaid && new Date() > invoice.dueDate);

    const items = [
      {
        description: `Platform Subscription & Management Fee (${periodStartStr} to ${periodEndStr})`,
        details: `Active Subscribers Billed: ${customerCount} customers @ Rs. ${rate.toFixed(2)} / customer`,
        quantity: Math.max(1, customerCount),
        unitPrice: rate,
        amount: totalAmount,
      },
    ];

    return {
      documentTitle: 'TAX INVOICE',
      invoiceNumber: `INV-MESS-${shortId}`,
      issueDate: invoice.createdAt,
      dueDate: invoice.dueDate,
      status: isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'UNPAID',
      seller: {
        name: 'MessMeals Platform Pvt Ltd',
        address: 'Infopark Technology Business Incubator, Kakkanad, Kochi, Kerala 682042',
        phone: '+91 9895728129',
        email: 'billing@messmeals.com',
        taxId: '32AABCM1234F1Z8',
      },
      customer: {
        name: mess.name,
        phone: mess.phone || adminUser?.phone,
        email: mess.email || adminUser?.email,
        address: mess.address || mess.location,
      },
      items,
      subtotal: totalAmount,
      total: totalAmount,
      amountPaid: isPaid ? totalAmount : 0,
      balanceDue: isPaid ? 0 : totalAmount,
      paymentDetails: isPaid
        ? {
            paymentMethod: 'Razorpay / Net Banking',
            transactionId: invoice.razorpayPaymentId || invoice.razorpayOrderId,
            paidAt: invoice.paidAt || invoice.paymentProcessedAt || invoice.updatedAt,
          }
        : undefined,
      notes: 'This invoice covers platform software hosting, delivery routing, and subscriber management fees.',
      terms: 'Payment is due within 5 days of invoice issue date. Late settlements may lead to temporary account suspension.',
    };
  }

  /**
   * Exports Mess Billing Invoice as PDF.
   */
  async getMessInvoicePdf(messId: string, invoiceId?: string, user?: any): Promise<Buffer> {
    if (user) {
      await this.assertMessAccess(user, messId);
    }
    const data = await this.getMessInvoiceData(messId, invoiceId);
    return this.pdfService.generateInvoicePdf(data);
  }

  /**
   * Prepares Receipt Data for a paid Mess platform billing invoice.
   */
  async getMessReceiptData(messId: string, invoiceId?: string): Promise<ReceiptPdfData> {
    const where: any = { messId };
    if (invoiceId) {
      where.id = invoiceId;
    }

    const invoice = await this.prisma.messInvoice.findFirst({
      where,
      orderBy: { periodStart: 'desc' },
      include: {
        mess: {
          include: {
            messAdmins: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice for mess ${messId} not found`);
    }

    if (invoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException(
        `Invoice ${invoice.id} is not yet paid (Status: ${invoice.status}). Receipts can only be generated for settled invoices.`,
      );
    }

    const { mess } = invoice;
    const adminUser = mess.messAdmins?.[0]?.user;
    const shortId = invoice.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const periodStartStr = invoice.periodStart.toISOString().slice(0, 10);
    const periodEndStr = invoice.periodEnd.toISOString().slice(0, 10);

    return {
      documentTitle: 'OFFICIAL PAYMENT RECEIPT',
      receiptNumber: `REC-MESS-${shortId}`,
      paymentDate: invoice.paidAt || invoice.paymentProcessedAt || invoice.updatedAt,
      status: 'PAID',
      payee: {
        name: 'MessMeals Platform Pvt Ltd',
        address: 'Infopark Technology Business Incubator, Kakkanad, Kochi, Kerala 682042',
        phone: '+91 9895728129',
        email: 'billing@messmeals.com',
      },
      payer: {
        name: mess.name,
        phone: mess.phone || adminUser?.phone,
        email: mess.email || adminUser?.email,
        address: mess.address || mess.location,
      },
      amountPaid: Number(invoice.amount) || 0,
      paymentMethod: 'Razorpay / Online Settlement',
      transactionId: invoice.razorpayPaymentId || invoice.razorpayOrderId || null,
      invoiceReference: `INV-MESS-${shortId}`,
      forDescription: `Settlement of Platform Billing Invoice for period ${periodStartStr} to ${periodEndStr} (${invoice.customerCount} subscribers)`,
      notes: 'Thank you for your prompt payment! Your platform services remain active without interruption.',
    };
  }

  /**
   * Exports Mess Payment Receipt as PDF.
   */
  async getMessReceiptPdf(messId: string, invoiceId?: string, user?: any): Promise<Buffer> {
    if (user) {
      await this.assertMessAccess(user, messId);
    }
    const data = await this.getMessReceiptData(messId, invoiceId);
    return this.pdfService.generateReceiptPdf(data);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. CUSTOM INVOICE CREATION & PDF
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Creates or generates a custom invoice with arbitrary line items, and returns invoice details and PDF buffer.
   */
  async createCustomInvoice(dto: CreateCustomInvoiceDto, user?: any) {
    if (user) {
      await this.assertMessAccess(user, dto.messId);
    }

    const mess = await this.prisma.mess.findUnique({
      where: { id: dto.messId },
    });

    if (!mess) {
      throw new NotFoundException(`Mess with id ${dto.messId} not found`);
    }

    let customerName = 'Customer';
    let customerPhone: string | undefined;
    let customerEmail: string | undefined;
    let customerAddress: string | undefined;

    if (dto.customerProfileId) {
      const profile = await this.prisma.customerProfile.findUnique({
        where: { id: dto.customerProfileId },
        include: { user: true, addresses: true },
      });
      if (profile) {
        customerName = profile.user.name;
        customerPhone = profile.user.phone;
        customerEmail = profile.user.email || undefined;
        customerAddress = profile.addresses?.[0]?.street || profile.address || undefined;
      }
    }

    const items = dto.items.map((item) => ({
      description: item.description,
      details: item.details,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount ?? item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((acc, i) => acc + i.amount, 0);
    const discount = dto.discount || 0;
    const tax = dto.tax || 0;
    const total = Math.max(0, subtotal - discount + tax);
    const amountPaid = dto.amountPaid || 0;
    const balanceDue = Math.max(0, total - amountPaid);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${randomSuffix}`;

    const invoiceData: InvoicePdfData = {
      documentTitle: dto.title.toUpperCase(),
      invoiceNumber,
      issueDate: new Date(),
      dueDate: new Date(dto.dueDate),
      status: balanceDue === 0 ? 'PAID' : amountPaid > 0 ? 'PENDING' : 'UNPAID',
      seller: {
        name: mess.name,
        address: mess.address || mess.location,
        phone: mess.phone,
        email: mess.email,
      },
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        address: customerAddress,
      },
      items,
      subtotal,
      discount,
      tax,
      total,
      amountPaid,
      balanceDue,
      paymentDetails:
        amountPaid > 0
          ? {
              paymentMethod: dto.paymentMethod || 'Cash / UPI',
              transactionId: dto.transactionId,
              paidAt: new Date(),
            }
          : undefined,
      notes: dto.description,
    };

    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoiceData);

    return {
      message: 'Custom invoice generated successfully',
      invoice: invoiceData,
      pdfBase64: pdfBuffer.toString('base64'),
    };
  }
}


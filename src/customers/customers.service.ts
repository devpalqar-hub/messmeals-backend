import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { PaymentsService } from 'src/payments/payments.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import {
  choosePlanDto,
  CreateCustomerDto,
  CreateSubscriptionForCustomerDto,
  UpdateCustomerDto,
} from './dto/create-customer.dto';
import { RenewSubscriptionDto } from './dto/renew-Subscription.dto';
import {
  ScheduleType,
  Prisma,
  DeliveryStatus,
  VariationStatus,
  Role,
  LedgerEntryType,
} from '@prisma/client';
import { CancelSubDto } from './dto/cancel-sub.dto';
import { PauseSubDto } from './dto/pause-sub.dto';
import { Subscription } from 'rxjs';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { SkipVariationDto } from './dto/skip-variation.dto';
import { resolvePlanSchedule } from 'src/common/utility/plan-schedule.util';
import * as XLSX from 'xlsx';
import type {
  BulkUploadCustomerRow,
  BulkUploadCustomersResult,
  BulkUploadRowResult,
} from './dto/bulk-upload-customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly paymentsService: PaymentsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  private ensureHttpsUrl(url: string): string {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }

  private getDefaultUrl(path: string): string {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL environment variable is not set');
    }
    const baseUrl = this.ensureHttpsUrl(frontendUrl);
    return `${baseUrl}${path}`;
  }

  async CreateUser(dto: CreateCustomerDto) {
    const {
      name,
      phone,
      email,
      address,
      currentLocation,
      latitude_logitude,
      is_active,
      walletAmount,
      discount,
      planId,
      start_date,
      end_date,

      // phase 2
      scheduleType,
      selectedDays, // Array of weekdays if CUSTOM (e.g. ["MONDAY", "WEDNESDAY", "FRIDAY"])
    } = dto;

    // Treat an empty/blank string the same as "not provided" — a form field left unselected
    // often submits "" rather than omitting the key, and "" is not a valid FK value.
    const deliveryPartnerId = dto.deliveryPartnerId?.trim()
      ? dto.deliveryPartnerId.trim()
      : undefined;

    if (
      ScheduleType.CUSTOM === scheduleType &&
      (!selectedDays || selectedDays.length === 0)
    ) {
      throw new BadRequestException(
        'Selected days are required for CUSTOM schedule type',
      );
    }

    // 1️⃣ Validate plan
    const plan = await this.prisma.plans.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new BadRequestException('Plan not found');

    // 2️⃣ Validate delivery partner — optional. A customer can be registered without one
    // (e.g. assigned to a delivery agent later); only cross-checked against the plan's mess when given.
    let deliveryPartner: { id: string; messId: string } | null = null;
    if (deliveryPartnerId) {
      deliveryPartner = await this.prisma.deliveryPartnerProfile.findUnique({
        where: { id: deliveryPartnerId },
      });
      if (!deliveryPartner)
        throw new BadRequestException('Delivery Partner not found');

      if (plan.messId !== deliveryPartner.messId) {
        throw new BadRequestException(
          'Plan does not belong to the specified Mess',
        );
      }
    }

    // 3️⃣ Check if a customer already exists. A phone/email already registered as a
    // customer is reused as-is — this is what lets a *different* mess admin register
    // the same person for their own mess/plan: the existing Customer + CustomerProfile
    // is shared, only a new UserSubscriptions row (scoped to plan.messId below) is created.
    let user = await this.prisma.customer.findFirst({
      where: {
        OR: [{ email: email }, { phone: phone }],
      },
    });
    const wasExistingUser = !!user;

    console.log('user found: ', user);

    let customerProfile;

    if (!user) {
      console.log('helloooo - 2');
      // 🆕 Create customer
      user = await this.prisma.customer.create({
        data: {
          name,
          email,
          phone,
          is_active,
        },
      });

      // 🆕 Create customer profile
      customerProfile = await this.prisma.customerProfile.create({
        data: {
          userId: user.id,
          address,
          current_location: currentLocation,
          latitude_logitude,
        },
      });
      console.log('user created: ', user);
    } else {
      // ✅ Fetch or create customer profile
      customerProfile = await this.prisma.customerProfile.findUnique({
        where: { userId: user.id },
      });

      if (!customerProfile) {
        customerProfile = await this.prisma.customerProfile.create({
          data: {
            userId: user.id,
            address,
            current_location: currentLocation,
            latitude_logitude,
          },
        });
      }
    }

    // Note: an existing customer is always allowed to get a new subscription here —
    // for the same plan/mess (renewal/top-up) or a different one. We no longer block
    // on an already-active subscription for the same plan; a new UserSubscriptions
    // row is simply created below, same as for a brand-new customer.

    // 4️⃣ Calculate duration and price
    const startDate = new Date(start_date);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start_date');
    }

    // ─── Derive end date ──────────────────────────────────────────────────
    let endDate: Date;

    if (end_date) {
      endDate = new Date(end_date);
    } else if (plan.isMonthlyPlan) {
      // Default: 1 calendar month, last day inclusive
      const endExclusive = new Date(
        Date.UTC(
          startDate.getUTCFullYear(),
          startDate.getUTCMonth() + 1,
          startDate.getUTCDate(),
        ),
      );
      endDate = new Date(endExclusive);
      endDate.setUTCDate(endDate.getUTCDate() - 1);
    } else {
      // Daily plan: default to startDate (single day)
      endDate = new Date(startDate);
    }

    if (isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid end_date');
    }
    if (endDate < startDate) {
      throw new BadRequestException('end_date must be >= start_date');
    }

    const parsedDiscount = Number(discount);
    const numericDiscount = Number.isFinite(parsedDiscount)
      ? parsedDiscount
      : 0;

    // The plan's own schedule (set by the mess owner) is applied as a default/limit —
    // see resolvePlanSchedule's docstring.
    const requestedScheduleType =
      scheduleType === ScheduleType.CUSTOM ||
        (Array.isArray(selectedDays) && selectedDays.length > 0)
        ? ScheduleType.CUSTOM
        : ScheduleType.EVERYDAY;

    const {
      scheduleType: normalizedScheduleType,
      selectedDays: normalizedSelectedDays,
    } = resolvePlanSchedule(plan, {
      scheduleType: requestedScheduleType,
      selectedDays: Array.isArray(selectedDays) ? selectedDays : undefined,
    });

    if (
      normalizedScheduleType === ScheduleType.CUSTOM &&
      (!normalizedSelectedDays || normalizedSelectedDays.length === 0)
    ) {
      throw new BadRequestException(
        'Selected days are required for CUSTOM schedule type',
      );
    }

    // ─── Pricing ──────────────────────────────────────────────────────────
    // plan.price is the plan's cost price; plan.minPrice (when set) is the
    // actual selling price shown to and charged to the customer — see
    // AddPlanScreen's "Selling Price" field and PlanCard's displayed price.
    const unitPrice = Number(plan.minPrice ?? plan.price);
    let totalPrice = 0;

    if (plan.isMonthlyPlan) {
      // Monthly: derive month count by dividing actual day span by 30 and rounding.
      // This treats 25-35 days as 1 month, 55-65 days as 2 months, etc.
      // Avoids the calendar-month boundary bug (e.g. Jun5 → Jul5 = 31 days ≈ 1 month).
      const msPerDay = 1000 * 60 * 60 * 24;
      const totalDays =
        Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
      const numMonths = Math.max(1, Math.round(totalDays / 30));
      totalPrice = numMonths * unitPrice;
    } else {
      // Daily: count chargeable delivery days in [startDate, endDate]
      let chargeableDays = 0;
      const tempDate = new Date(startDate);

      if (normalizedScheduleType === ScheduleType.EVERYDAY) {
        while (tempDate <= endDate) {
          chargeableDays++;
          tempDate.setDate(tempDate.getDate() + 1);
        }
      } else {
        const selectedDaysUpper = (normalizedSelectedDays ?? []).map((d) =>
          d.toUpperCase(),
        );
        const weekdayMap = [
          'SUNDAY',
          'MONDAY',
          'TUESDAY',
          'WEDNESDAY',
          'THURSDAY',
          'FRIDAY',
          'SATURDAY',
        ];
        while (tempDate <= endDate) {
          const dayName = weekdayMap[tempDate.getDay()];
          if (selectedDaysUpper.includes(dayName)) {
            chargeableDays++;
          }
          tempDate.setDate(tempDate.getDate() + 1);
        }
      }

      totalPrice = chargeableDays * unitPrice;
    }

    const appliedDiscount = Math.max(0, Math.min(numericDiscount, totalPrice));
    const discountedPrice = totalPrice - appliedDiscount;

    // 5️⃣ Create subscription
    const userSubscription = await this.prisma.userSubscriptions.create({
      data: {
        customerProfileId: customerProfile.id,
        start_date: startDate,
        end_date: endDate,
        discount: appliedDiscount,
        totalPrice,
        discountedPrice,
        messId: plan.messId,
        deliveryPartnerProfileId: deliveryPartnerId,
        planId,
        scheduleType: normalizedScheduleType,
        selectedDays:
          normalizedScheduleType === ScheduleType.CUSTOM
            ? normalizedSelectedDays
            : undefined,
      },
    });

    // Increment popular-plan counter
    await this.prisma.plans.update({
      where: { id: planId },
      data: { totalCustomers: { increment: 1 } },
    });

    // 6️⃣ Create Deliveries based on scheduleType
    const deliveriesToCreate: any[] = [];
    const currentDate = new Date(startDate);
    console.log({
      startDate,
      endDate,
      currentDate,
      comparison: currentDate <= endDate,
    });

    if (normalizedScheduleType === ScheduleType.EVERYDAY) {
      // ➤ Create deliveries for each day in range
      while (currentDate <= endDate) {
        deliveriesToCreate.push({
          date: new Date(currentDate),
          customerId: customerProfile.id,
          planId,
          subscriptionId: userSubscription.id,
          status: DeliveryStatus.PENDING,
          partnerId: deliveryPartnerId,
          messId: plan.messId,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (
      normalizedScheduleType === ScheduleType.CUSTOM &&
      Array.isArray(normalizedSelectedDays)
    ) {
      // ➤ Create deliveries only on selected weekdays
      const selectedDaysUpper = normalizedSelectedDays.map((d) =>
        d.toUpperCase(),
      );
      const weekdayMap = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
      ];

      while (currentDate <= endDate) {
        const dayName = weekdayMap[currentDate.getDay()];
        if (selectedDaysUpper.includes(dayName)) {
          deliveriesToCreate.push({
            date: new Date(currentDate),
            customerId: customerProfile.id,
            planId,
            subscriptionId: userSubscription.id,
            status: DeliveryStatus.PENDING,
            partnerId: deliveryPartnerId,
            messId: plan.messId,
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    if (deliveriesToCreate.length > 0) {
      await this.prisma.deliveries.createMany({ data: deliveriesToCreate });
      await this.createDeliveryVariationsForPlan(
        planId,
        userSubscription.id,
        deliveriesToCreate.map((d) => d.date),
      );
    }

    // 7️⃣ Billing ledger: monthly plans are charged in full now; daily plans are only
    // charged per completed delivery (see TransactionsService.chargeDailyDeliveryCompleted).
    // `walletAmount` on the DTO is the amount actually being paid right now (e.g. cash/UPI
    // collected at registration) — not a stored balance — so it's credited directly and
    // uncapped by discountedPrice (paying more than the charge is a legitimate advance).
    const amountPaidNow = Math.max(0, Number(walletAmount) || 0);
    try {
      if (plan.isMonthlyPlan) {
        await this.transactionsService.chargeMonthlyPlan({
          subscriptionId: userSubscription.id,
          customerProfileId: customerProfile.id,
          messId: plan.messId,
          amount: discountedPrice,
          note: 'Monthly plan charge at registration',
        });
      }
      if (amountPaidNow > 0) {
        await this.transactionsService.recordPayment({
          customerProfileId: customerProfile.id,
          messId: plan.messId,
          subscriptionId: userSubscription.id,
          amount: amountPaidNow,
          note: plan.isMonthlyPlan
            ? 'Payment received at registration'
            : 'Advance payment received at registration',
        });
      }
    } catch (err) {
      console.error('Failed to record ledger transaction:', err);
    }

    // ✅ Return success response
    return {
      message: wasExistingUser
        ? 'Subscription created successfully for existing customer'
        : 'New customer and subscription created successfully',
      data: {
        user,
        customerProfile,
        userSubscription,
        deliveriesCreated: deliveriesToCreate.length,
        isNewCustomer: !wasExistingUser,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // BULK CUSTOMER UPLOAD (Excel/CSV)
  // ─────────────────────────────────────────────────────────────────────

  /** Header aliases accepted in the uploaded sheet, normalized (lowercased, spaces/underscores stripped). */
  private static readonly BULK_UPLOAD_HEADER_ALIASES: Record<
    string,
    keyof BulkUploadCustomerRow
  > = {
      name: 'name',
      customername: 'name',
      phone: 'phone',
      phonenumber: 'phone',
      mobile: 'phone',
      email: 'email',
      address: 'address',
      deliveryaddress: 'address',
      planid: 'planId',
      plan: 'planName',
      planname: 'planName',
      walletamount: 'walletAmount',
      wallet: 'walletAmount',
      discount: 'discount',
      startdate: 'start_date',
      start: 'start_date',
      enddate: 'end_date',
      end: 'end_date',
      scheduletype: 'scheduleType',
      schedule: 'scheduleType',
      selecteddays: 'selectedDays',
      days: 'selectedDays',
      deliverypartnerid: 'deliveryPartnerId',
      deliverypartner: 'deliveryPartnerId',
    };

  private normalizeBulkUploadHeader(header: string): string {
    return String(header ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, '');
  }

  /** Excel may hand back a Date object (when cellDates is on), a serial number, or a plain string. */
  private normalizeBulkUploadDate(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const mm = String(parsed.m).padStart(2, '0');
        const dd = String(parsed.d).padStart(2, '0');
        return `${parsed.y}-${mm}-${dd}`;
      }
    }

    const str = String(value).trim();
    const parsedDate = new Date(str);
    if (!Number.isNaN(parsedDate.getTime())) {
      return str.match(/^\d{4}-\d{2}-\d{2}/)
        ? str.slice(0, 10)
        : parsedDate.toISOString().split('T')[0];
    }

    return str;
  }

  /** Parses the uploaded workbook's first sheet into normalized row objects. */
  private parseBulkUploadWorkbook(buffer: Buffer): BulkUploadCustomerRow[] {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestException(
        'Could not read the uploaded file — please upload a valid .xlsx, .xls, or .csv file',
      );
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('The uploaded file has no sheets');
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: true,
    });

    return rawRows.map((rawRow) => {
      const row: BulkUploadCustomerRow = {};
      for (const [rawHeader, rawValue] of Object.entries(rawRow)) {
        const key =
          CustomerService.BULK_UPLOAD_HEADER_ALIASES[
          this.normalizeBulkUploadHeader(rawHeader)
          ];
        if (!key) continue;

        if (key === 'start_date' || key === 'end_date') {
          (row as any)[key] = this.normalizeBulkUploadDate(rawValue);
        } else {
          const strValue =
            typeof rawValue === 'string' ? rawValue.trim() : rawValue;
          (row as any)[key] = strValue === '' ? undefined : strValue;
        }
      }
      return row;
    });
  }

  /**
   * Bulk-registers customers (and their plan subscriptions) from an uploaded Excel/CSV sheet.
   * Each row is processed independently through the same logic as `CreateUser` (register-user) —
   * a bad row is reported and skipped rather than failing the whole batch.
   */
  async bulkUploadCustomers(
    buffer: Buffer,
    messId?: string,
  ): Promise<BulkUploadCustomersResult> {
    const rows = this.parseBulkUploadWorkbook(buffer);

    if (rows.length === 0) {
      throw new BadRequestException('The uploaded sheet has no data rows');
    }
    if (rows.length > 500) {
      throw new BadRequestException(
        'A single upload is limited to 500 rows — please split the sheet',
      );
    }

    // Cache plan-name → plan lookups (scoped to messId when given) so repeated names in the
    // sheet don't re-query the DB per row.
    const planNameCache = new Map<
      string,
      { id: string; messId: string } | null
    >();

    const results: BulkUploadRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // header is row 1
      const name = row.name?.trim();
      const phone = row.phone?.toString().trim();

      try {
        if (!name)
          throw new BadRequestException('Missing required field: name');
        if (!phone)
          throw new BadRequestException('Missing required field: phone');
        if (!row.address?.trim())
          throw new BadRequestException('Missing required field: address');
        if (!row.start_date)
          throw new BadRequestException(
            'Missing or unparseable field: start_date',
          );

        let planId = row.planId?.trim();
        if (!planId) {
          const planName = row.planName?.trim();
          if (!planName) {
            throw new BadRequestException(
              'Row must specify either planId or planName',
            );
          }

          const cacheKey = `${messId ?? ''}::${planName.toLowerCase()}`;
          if (!planNameCache.has(cacheKey)) {
            const plan = await this.prisma.plans.findFirst({
              where: {
                planName: { equals: planName },
                ...(messId ? { messId } : {}),
              },
              select: { id: true, messId: true },
            });
            planNameCache.set(cacheKey, plan);
          }

          const cachedPlan = planNameCache.get(cacheKey);
          if (!cachedPlan) {
            throw new BadRequestException(
              `Plan named "${planName}" was not found${messId ? ' for this mess' : ''}`,
            );
          }
          planId = cachedPlan.id;
        }

        const selectedDays = row.selectedDays
          ? row.selectedDays
            .toString()
            .split(/[,/|]/)
            .map((d) => d.trim().toUpperCase())
            .filter(Boolean)
          : undefined;

        const dto: CreateCustomerDto = {
          name,
          phone,
          email: row.email?.trim() || undefined,
          address: row.address.trim(),
          walletAmount:
            row.walletAmount !== undefined ? String(row.walletAmount) : '0',
          discount:
            row.discount !== undefined ? String(row.discount) : undefined,
          planId,
          deliveryPartnerId: row.deliveryPartnerId?.trim() || undefined,
          start_date: row.start_date,
          end_date: row.end_date || '',
          scheduleType:
            (row.scheduleType?.trim().toUpperCase() as ScheduleType) ||
            undefined,
          selectedDays: selectedDays as any,
        };

        const created = await this.CreateUser(dto);

        results.push({
          row: rowNumber,
          name,
          phone,
          status: 'success',
          message: created.message,
          isNewCustomer: created.data.isNewCustomer,
          subscriptionId: created.data.userSubscription.id,
        });
      } catch (err) {
        const message =
          err instanceof BadRequestException ||
            err instanceof ForbiddenException ||
            err instanceof NotFoundException
            ? (err.getResponse() as any)?.message || err.message
            : err instanceof Error
              ? err.message
              : 'Unknown error';

        results.push({
          row: rowNumber,
          name,
          phone,
          status: 'error',
          message: Array.isArray(message)
            ? message.join(', ')
            : String(message),
        });
      }
    }

    const succeeded = results.filter((r) => r.status === 'success').length;

    return {
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      results,
    };
  }

  /** Generates a blank .xlsx template (headers + one example row) for the bulk-upload flow. */
  generateBulkUploadTemplate(): Buffer {
    const headers = [
      'name',
      'phone',
      'email',
      'address',
      'planId',
      'planName',
      'walletAmount',
      'discount',
      'start_date',
      'end_date',
      'scheduleType',
      'selectedDays',
      'deliveryPartnerId',
    ];

    const example = [
      'John Doe',
      '9876543210',
      'john@example.com',
      '123 Main Street, Bangalore',
      '',
      'Monthly Veg Plan',
      '0',
      '0',
      '2026-06-01',
      '2026-06-30',
      'EVERYDAY',
      '',
      '',
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, example]);
    worksheet['!cols'] = headers.map((h) => ({
      wch: Math.max(h.length + 4, 16),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async updateCustomerProfile(userId: string, dto: UpdateCustomerDto) {
    const {
      name,
      address,
      latitude_logitude,
      currentLocation,
      planId,
      deliveryPartnerId,
    } = dto;

    // 1️⃣ Check if customer exists
    const user = await this.prisma.customer.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user) throw new NotFoundException('User not found');

    // 2️⃣ Prepare update data
    const userUpdateData: any = {};
    const customerProfileUpdateData: any = {};

    if (name !== undefined) userUpdateData.name = name;
    if (address !== undefined) customerProfileUpdateData.address = address;
    if (latitude_logitude !== undefined)
      customerProfileUpdateData.latitude_logitude = latitude_logitude;
    if (currentLocation !== undefined)
      customerProfileUpdateData.current_location = currentLocation;

    // 3️⃣ Run atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 🧩 Update customer if needed
      if (Object.keys(userUpdateData).length > 0) {
        await tx.customer.update({
          where: { id: userId },
          data: userUpdateData,
        });
      }

      // 🧩 Update customer profile if exists, else throw error
      if (user.customerProfile) {
        await tx.customerProfile.update({
          where: { id: user.customerProfile.id },
          data: customerProfileUpdateData,
        });
      } else {
        throw new NotFoundException('Customer profile not found for this user');
      }

      // 🧩 Optionally update or create user subscription
      if (planId || deliveryPartnerId) {
        const existingSubscription = await tx.userSubscriptions.findFirst({
          where: { customerProfileId: user.customerProfile.id },
        });

        if (existingSubscription) {
          await tx.userSubscriptions.update({
            where: { id: existingSubscription.id },
            data: {
              ...(planId ? { planId } : {}),
              ...(deliveryPartnerId
                ? { deliveryPartnerProfileId: deliveryPartnerId }
                : {}),
            },
          });
        }
      }

      // 🧩 Return updated customer with relations
      return tx.customer.findUnique({
        where: { id: userId },
        include: {
          customerProfile: {
            include: { userSubscriptions: true },
          },
        },
      });
    });

    // 4️⃣ Return response
    return {
      message: 'User and customer profile updated successfully',
      data: result,
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    messId?: string,
    isActive?: boolean, // ✅ NEW
    subscriptionFilter?: string, // ✅ NEW — 'ending_soon' narrows to subscriptions ending within 7 days
  ) {
    limit = 250;
    const skip = (page - 1) * limit;

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endingSoon = subscriptionFilter === 'ending_soon';

    const where: any = {
      ...(search
        ? {
          OR: [
            {
              user: {
                name: { contains: search.toLowerCase() },
              },
            },
            {
              user: {
                email: { contains: search.toLowerCase() },
              },
            },
            {
              userSubscriptions: {
                some: {
                  plan: {
                    planName: {
                      contains: search.toLowerCase(),
                    },
                  },
                },
              },
            },
          ],
        }
        : {}),

      ...(messId
        ? {
          userSubscriptions: {
            some: { messId },
          },
        }
        : {}),

      // ✅ subscription-ending-soon filter — active subscriptions ending within 7 days
      ...(endingSoon
        ? {
          userSubscriptions: {
            some: {
              ...(messId ? { messId } : {}),
              is_active: true,
              end_date: { gte: now, lte: in7Days },
            },
          },
        }
        : {}),

      // ✅ is_active filter
      ...(isActive !== undefined
        ? {
          user: {
            is_active: isActive,
          },
        }
        : {}),
    };

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customerProfile.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: true,
          userSubscriptions: {
            where: {
              is_active: true,
              ...(messId ? { messId } : {}),
            },
            include: {
              plan: {
                include: {
                  images: true,
                  Variation: true,
                  mess: true,
                },
              },
            },
          },
          deliveries: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerProfile.count({ where }),
    ]);

    // Ledger-based wallet balance (credit - debit) per customer on this page — replaces
    // the old stored walletAmount field, scoped the same way as the rest of this query.
    const customerProfileIds = customers.map((c) => c.id);
    const ledgerTotals = customerProfileIds.length
      ? await this.prisma.customerMessTransaction.groupBy({
        by: ['customerProfileId', 'type'],
        where: {
          customerProfileId: { in: customerProfileIds },
          ...(messId ? { messId } : {}),
        },
        _sum: { amount: true },
      })
      : [];
    const walletBalanceByProfile = new Map<string, number>();
    for (const row of ledgerTotals) {
      const amount = Number(row._sum.amount ?? 0);
      const prev = walletBalanceByProfile.get(row.customerProfileId) ?? 0;
      walletBalanceByProfile.set(
        row.customerProfileId,
        prev + (row.type === LedgerEntryType.CREDIT ? amount : -amount),
      );
    }

    const result = customers.map((c) => {
      const activeSubs = c.userSubscriptions.filter(
        (sub) =>
          (!sub.end_date || sub.end_date > new Date()) &&
          (!messId || sub.messId === messId),
      );

      const totalOrders = activeSubs.length;

      const totalSpent = c.userSubscriptions
        .filter((sub) => !messId || sub.messId === messId)
        .reduce((sum, sub) => sum + Number(sub.totalPrice), 0);

      const daysLeft =
        activeSubs.length > 0 && activeSubs[0].end_date
          ? Math.ceil(
            (new Date(activeSubs[0].end_date).getTime() -
              new Date().getTime()) /
            (1000 * 60 * 60 * 24),
          )
          : null;

      return {
        id: c.user.id,
        customerProfileId: c.id,
        name: c.user.name,
        email: c.user.email,
        phone: c.user.phone,
        is_active: c.user.is_active,
        walletBalance: walletBalanceByProfile.get(c.id) ?? 0,
        address: c.address,
        current_location: c.current_location,
        latitude_logitude: c.latitude_logitude,
        noOfDaysToEnd: daysLeft,
        totalOrders,
        totalSpent,
        activeSubscriptions: activeSubs.map((sub) => ({
          id: sub.id,
          start_date: sub.start_date,
          end_date: sub.end_date,
          seletedDays: sub.selectedDays,
          scheduletype: sub.scheduleType,
          is_active: sub.is_active,
          totalPrice: Number(sub.totalPrice),
          discountedPrice: Number(sub.discountedPrice),
          deliveryPartnerProfileId: sub.deliveryPartnerProfileId,
          plan: sub.plan
            ? {
              id: sub.plan.id,
              name: sub.plan.planName,
              price: Number(sub.plan.price),
              description: sub.plan.description,
              variation: sub.plan.Variation,
              mess: sub.plan.mess,
              images: sub.plan.images.map((img) => ({
                url: img.url,
                altText: img.altText,
              })),
            }
            : null,
        })),
      };
    });

    return {
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Summary stats for the Customers page header: how many customers currently have an
   * active subscription, how many of those are ending within 7 days, and the total
   * amount owed back to the mess (sum of negative wallet balances) — all optionally
   * scoped to a single mess.
   */
  async getCustomerSummary(user: any, messId?: string) {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // ---------------------------------------------------
    // Resolve allowed mess scope (same logic as AuthService.getDashboardStats)
    // ---------------------------------------------------
    let messIdsInScope: string[] = [];

    if (user.role === 'SUPERADMIN') {
      if (messId) {
        messIdsInScope = [messId];
      } else {
        const messes = await this.prisma.mess.findMany({
          select: { id: true },
        });
        messIdsInScope = messes.map((m) => m.id);
      }
    } else if (user.role === 'MESSADMIN') {
      const adminProfile = await this.prisma.messAdminProfile.findUnique({
        where: { userId: user.id },
        select: {
          messes: {
            select: { id: true },
          },
        },
      });

      const adminMessIds = adminProfile?.messes.map((m) => m.id) || [];

      if (messId) {
        if (!adminMessIds.includes(messId)) {
          throw new ForbiddenException(
            'You are not allowed to access this mess',
          );
        }
        messIdsInScope = [messId];
      } else {
        messIdsInScope = adminMessIds;
      }
    }

    const activeWhere = {
      is_active: true,
      OR: [{ end_date: null }, { end_date: { gte: now } }],
      messId: { in: messIdsInScope },
    };

    const [activeSubs, endingSoonSubs, ledgerTotals] = await Promise.all([
      this.prisma.userSubscriptions.findMany({
        where: activeWhere,
        select: { customerProfileId: true },
        distinct: ['customerProfileId'],
      }),
      this.prisma.userSubscriptions.findMany({
        where: { ...activeWhere, end_date: { gte: now, lte: in7Days } },
        select: { customerProfileId: true },
        distinct: ['customerProfileId'],
      }),
      this.transactionsService.getTotalsForMessIds(messIdsInScope),
    ]);

    const totalDue = ledgerTotals.balanceDue;

    return {
      activeSubscriptionsCount: activeSubs.length,
      endingSoonCount: endingSoonSubs.length,
      totalDue,
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: id }, // Assuming customerProfile is linked to User
      include: {
        user: true,
        userSubscriptions: {
          include: {
            plan: {
              include: { images: true, Variation: true },
            },
          },
        },
        deliveries: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    // 🧩 Filter and compute details (same as in findAll)
    const activeSubs = customer.userSubscriptions.filter(
      (sub) => !sub.end_date || sub.end_date > new Date(),
    );

    const totalOrders = activeSubs.length;

    // 💰 Ledger-based totals: DEBIT = actually charged/consumed (monthly charge at
    // registration, or per completed delivery for daily plans) — this is "total spent".
    // CREDIT = payments received into the wallet (e.g. at registration/top-up) and is
    // deliberately excluded from spend, since receiving a payment isn't the same as
    // consuming it. outstandingPayment is whatever's still owed beyond what's been paid —
    // clamped to 0 so a customer who has paid in advance never shows a negative due amount.
    const ledgerTotals = await this.prisma.customerMessTransaction.groupBy({
      by: ['type'],
      where: { customerProfileId: customer.id },
      _sum: { amount: true },
    });
    const totalDebit = Number(
      ledgerTotals.find((t) => t.type === LedgerEntryType.DEBIT)?._sum.amount ??
      0,
    );
    const totalCredit = Number(
      ledgerTotals.find((t) => t.type === LedgerEntryType.CREDIT)?._sum
        .amount ?? 0,
    );
    const totalSpent = totalDebit;
    const outstandingPayment = Math.max(totalDebit - totalCredit, 0);

    const daysLeft =
      activeSubs.length > 0 && activeSubs[0].end_date
        ? Math.ceil(
          (new Date(activeSubs[0].end_date).getTime() -
            new Date().getTime()) /
          (1000 * 60 * 60 * 24),
        )
        : null;

    // 🧾 Final response
    return {
      id: customer.user.id,
      customerProfileId: customer.id, // ✅ Add this line
      name: customer.user.name,
      email: customer.user.email,
      phone: customer.user.phone,
      walletBalance: totalCredit - totalDebit,
      current_location: customer.current_location,
      latitude_logitude: customer.latitude_logitude,
      address: customer.address,
      noOfDaysToEnd: daysLeft,
      totalOrders,
      totalSpent,
      outstandingPayment,
      activeSubscriptions: activeSubs.map((sub) => {
        const today = new Date();
        let status: string;
        if (sub.cancelled_on) {
          status = 'CANCELLED';
        } else if (
          sub.pause_start_date &&
          sub.pause_end_date &&
          today >= new Date(sub.pause_start_date) &&
          today <= new Date(sub.pause_end_date)
        ) {
          status = 'PAUSED';
        } else if (sub.is_active) {
          status = 'ACTIVE';
        } else {
          status = 'INACTIVE';
        }

        return {
          id: sub.id,
          start_date: sub.start_date,
          end_date: sub.end_date,
          seletedDays: sub.selectedDays,
          scheduletype: sub.scheduleType,
          totalPrice: Number(sub.totalPrice),
          discountedPrice: Number(sub.discountedPrice),
          deliveryPartnerProfileId: sub.deliveryPartnerProfileId,
          status,
          plan: sub.plan
            ? {
              id: sub.plan.id,
              name: sub.plan.planName,
              price: Number(sub.plan.price),
              description: sub.plan.description,
              isMonthlyPlan: sub.plan.isMonthlyPlan,
              isDailyPlan: sub.plan.isDailyPlan,
              images: sub.plan.images.map((img) => ({
                url: img.url,
                altText: img.altText,
              })),
            }
            : null,
        };
      }),
    };
  }

  async deleteCustomer(customerId: string) {
    // The API receives Customer.id.
    // CustomerProfile.userId -> Customer.id
    // Deliveries.customerId -> CustomerProfile.id
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        customerProfile: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const customerProfileId = customer.customerProfile?.id;

    await this.prisma.$transaction(async (tx) => {
      // If a profile exists, remove all records that depend on it first.
      // We intentionally delete ALL deliveries here because the requirement
      // is a permanent customer deletion. Keeping historical deliveries
      // would prevent deleting CustomerProfile due to its foreign key.
      if (customerProfileId) {
        // DeliveryVariation has onDelete: Cascade from Deliveries,
        // so deleting deliveries also removes their variations.
        const deletedDeliveries = await tx.deliveries.deleteMany({
          where: {
            customerId: customerProfileId,
          },
        });

        // Payments cascade from UserSubscriptions, so deleting subscriptions
        // will also remove their payment records.
        await tx.userSubscriptions.deleteMany({
          where: {
            customerProfileId,
          },
        });

        // Remove addresses linked to this customer profile.
        await tx.userAddress.deleteMany({
          where: {
            profileId: customerProfileId,
          },
        });

        // Remove testimonials linked to this customer profile.
        await tx.testimonials.deleteMany({
          where: {
            customerId: customerProfileId,
          },
        });

        // Wallet has Transaction -> Wallet dependency, so transactions
        // must be deleted before the wallet itself.
        const wallet = await tx.wallet.findUnique({
          where: {
            userId: customerProfileId,
          },
          select: {
            id: true,
          },
        });

        if (wallet) {
          await tx.transaction.deleteMany({
            where: {
              walletId: wallet.id,
            },
          });

          await tx.wallet.delete({
            where: {
              id: wallet.id,
            },
          });
        }

        // CustomerProfile.userId references Customer.id.
        await tx.customerProfile.delete({
          where: {
            id: customerProfileId,
          },
        });

        // Keep the variable used so the delete operation is explicit in
        // the transaction and easy to extend later if needed.
        void deletedDeliveries;
      }

      // Finally delete the actual Customer row.
      await tx.customer.delete({
        where: {
          id: customerId,
        },
      });
    });

    return {
      message: 'Customer and all related data deleted successfully',
      deletedCustomerId: customerId,
      customerProfileId: customerProfileId ?? null,
    };
  }

  async RenewSubscription(dto: RenewSubscriptionDto) {
    const {
      subscriptionId,
      deliveryPartnerId,
      planId,
      start_date,
      end_date,
      discount,
      customerProfileId: providedCustomerProfileId,
      scheduleType,
      selectedDays,
    } = dto;

    // ─── 1. Resolve customer profile ─────────────────────────────────────
    const customerProfile = await this.prisma.customerProfile.findFirst({
      where: {
        OR: [
          { id: providedCustomerProfileId },
          { userId: providedCustomerProfileId },
        ],
      },
    });
    if (!customerProfile) {
      throw new BadRequestException(
        'Customer profile not found (customerProfileId can be CustomerProfile.id or User.id)',
      );
    }
    const customerProfileId = customerProfile.id;

    // ─── 2. Verify the subscription belongs to this customer ─────────────
    const existingSubscription = await this.prisma.userSubscriptions.findUnique(
      {
        where: { id: subscriptionId },
      },
    );
    if (!existingSubscription)
      throw new BadRequestException('Subscription not found');
    if (existingSubscription.customerProfileId !== customerProfileId) {
      throw new BadRequestException(
        'Subscription does not belong to this customer',
      );
    }

    // ─── 3. Validate delivery partner ────────────────────────────────────
    const deliveryPartner = await this.prisma.deliveryPartnerProfile.findUnique(
      {
        where: { id: deliveryPartnerId },
      },
    );
    if (!deliveryPartner)
      throw new BadRequestException('Delivery Partner not found');

    // ─── 4. Validate plan ─────────────────────────────────────────────────
    const plan = await this.prisma.plans.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plan not found');

    // ─── 5. Parse & validate dates ────────────────────────────────────────
    const startDate = new Date(start_date);
    if (isNaN(startDate.getTime()))
      throw new BadRequestException('Invalid start_date');

    const endDate = new Date(end_date);
    if (isNaN(endDate.getTime()))
      throw new BadRequestException('Invalid end_date');
    if (endDate < startDate)
      throw new BadRequestException('end_date must be >= start_date');

    // ─── 6. Normalize schedule (same as CreateUser) ──────────────────────
    const normalizedScheduleType =
      scheduleType === ScheduleType.CUSTOM ||
        (Array.isArray(selectedDays) && selectedDays.length > 0)
        ? ScheduleType.CUSTOM
        : ScheduleType.EVERYDAY;

    const normalizedSelectedDays =
      normalizedScheduleType === ScheduleType.CUSTOM
        ? Array.isArray(selectedDays)
          ? selectedDays
          : []
        : undefined;

    if (
      normalizedScheduleType === ScheduleType.CUSTOM &&
      (!normalizedSelectedDays || normalizedSelectedDays.length === 0)
    ) {
      throw new BadRequestException(
        'Selected days are required for CUSTOM schedule type',
      );
    }

    // ─── 7. Calculate total price from date range ─────────────────────────
    // plan.price is the plan's cost price; plan.minPrice (when set) is the
    // actual selling price shown to and charged to the customer — see
    // AddPlanScreen's "Selling Price" field and PlanCard's displayed price.
    const unitPrice = Number(plan.minPrice ?? plan.price);
    let totalPrice = 0;
    const weekdayMap = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    if (plan.isMonthlyPlan) {
      // Monthly: round actual day span to nearest 30-day month.
      // 25-35 days = 1 month, 55-65 days = 2 months, etc.
      const msPerDay = 1000 * 60 * 60 * 24;
      const totalDays =
        Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
      const numMonths = Math.max(1, Math.round(totalDays / 30));
      totalPrice = numMonths * unitPrice;
    } else {
      let chargeableDays = 0;
      const tempDate = new Date(startDate);
      if (normalizedScheduleType === ScheduleType.EVERYDAY) {
        while (tempDate <= endDate) {
          chargeableDays++;
          tempDate.setDate(tempDate.getDate() + 1);
        }
      } else {
        const selectedDaysUpper = (normalizedSelectedDays ?? []).map((d) =>
          d.toUpperCase(),
        );
        while (tempDate <= endDate) {
          if (selectedDaysUpper.includes(weekdayMap[tempDate.getDay()]))
            chargeableDays++;
          tempDate.setDate(tempDate.getDate() + 1);
        }
      }
      totalPrice = chargeableDays * unitPrice;
    }

    const parsedDiscount = Number(discount);
    const numericDiscount = Number.isFinite(parsedDiscount)
      ? parsedDiscount
      : 0;
    const appliedDiscount = Math.max(0, Math.min(numericDiscount, totalPrice));
    const discountedPrice = totalPrice - appliedDiscount;

    // ─── 8. Determine effective start_date ──────────────────────────────
    //
    // • Continuous renewal : new start_date is within 1 day of the previous
    //   end_date  →  keep the original start_date so the subscription
    //   timeline remains unbroken for analytics and billing purposes.
    //
    // • Restarted plan     : there is a meaningful gap between old end_date
    //   and new start_date  →  treat this as a fresh subscription and use
    //   the new start_date.
    //
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const previousEndDate = existingSubscription.end_date;
    const originalStartDate = existingSubscription.start_date;

    const isContinuousRenewal =
      previousEndDate !== null &&
      Math.abs(startDate.getTime() - new Date(previousEndDate).getTime()) <=
      ONE_DAY_MS;

    // The effective start_date written to the DB:
    //   – continuous → keep original first start_date
    //   – restarted  → use the new start_date provided in the request
    const effectiveStartDate = isContinuousRenewal
      ? originalStartDate
      : startDate;

    // ─── 9. Update existing subscription (not create a new one) ─────────
    const updatedSubscription = await this.prisma.userSubscriptions.update({
      where: { id: subscriptionId },
      data: {
        start_date: effectiveStartDate,
        end_date: endDate,
        totalPrice,
        deliveryPartnerProfileId: deliveryPartnerId,
        planId,
        discount: appliedDiscount,
        messId: plan.messId,
        discountedPrice,
        scheduleType: normalizedScheduleType,
        selectedDays:
          normalizedScheduleType === ScheduleType.CUSTOM
            ? normalizedSelectedDays
            : undefined,
        is_active: true,
        cancelled_on: null,
      },
    });

    // ─── 10. Create deliveries for the new period ────────────────────────
    const deliveriesToCreate: any[] = [];
    const currentDate = new Date(startDate);

    if (normalizedScheduleType === ScheduleType.EVERYDAY) {
      while (currentDate <= endDate) {
        deliveriesToCreate.push({
          date: new Date(currentDate),
          customerId: customerProfileId,
          planId,
          subscriptionId,
          status: DeliveryStatus.PENDING,
          partnerId: deliveryPartnerId,
          messId: plan.messId,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (
      normalizedScheduleType === ScheduleType.CUSTOM &&
      Array.isArray(normalizedSelectedDays)
    ) {
      const selectedDaysUpper = normalizedSelectedDays.map((d) =>
        d.toUpperCase(),
      );
      while (currentDate <= endDate) {
        if (selectedDaysUpper.includes(weekdayMap[currentDate.getDay()])) {
          deliveriesToCreate.push({
            date: new Date(currentDate),
            customerId: customerProfileId,
            planId,
            subscriptionId,
            status: DeliveryStatus.PENDING,
            partnerId: deliveryPartnerId,
            messId: plan.messId,
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    if (deliveriesToCreate.length > 0) {
      await this.prisma.deliveries.createMany({ data: deliveriesToCreate });
      await this.createDeliveryVariationsForPlan(
        planId,
        subscriptionId,
        deliveriesToCreate.map((d) => d.date),
      );
    }

    // ─── 10. Billing ledger — monthly plans are charged in full now, same rule as a
    // fresh registration; daily plans stay uncharged until each day's delivery completes. ───
    try {
      if (plan.isMonthlyPlan) {
        await this.transactionsService.chargeMonthlyPlan({
          subscriptionId,
          customerProfileId,
          messId: plan.messId,
          amount: discountedPrice,
          note: 'Monthly plan charge at renewal',
        });
      }
    } catch (err) {
      console.error('Failed to record ledger transaction on renewal:', err);
    }

    return {
      message: 'Subscription renewed successfully',
      data: {
        subscription: updatedSubscription,
        deliveriesCreated: deliveriesToCreate.length,
        renewalType: isContinuousRenewal ? 'continuous' : 'restarted',
        effectiveStartDate,
        newEndDate: endDate,
      },
    };
  }

  async getVariationCountByDate(dateString: string) {
    if (!dateString) {
      throw new BadRequestException('Date is required');
    }

    const inputDate = new Date(dateString);
    if (isNaN(inputDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // ✅ Find subscriptions active on that date
    const subscriptions = await this.prisma.userSubscriptions.findMany({
      where: {
        start_date: { lte: inputDate },
        OR: [{ end_date: null }, { end_date: { gte: inputDate } }],
        is_active: true,
      },
      include: {
        plan: {
          include: {
            Variation: true, // include all variations linked to plan
          },
        },
      },
    });

    // ✅ Count occurrences of each variation
    const variationCount: Record<string, number> = {};
    for (const sub of subscriptions) {
      for (const variation of sub.plan.Variation) {
        variationCount[variation.title] =
          (variationCount[variation.title] || 0) + 1;
      }
    }

    // ✅ Format output
    const result = Object.entries(variationCount).map(([title, count]) => ({
      title,
      count,
    }));

    return {
      message: `Variation count for ${dateString}`,
      totalSubscriptions: subscriptions.length,
      data: result,
    };
  }

  async getAllMesses(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // SUPERADMIN can see all active messes.
    if (user.role === Role.SUPERADMIN) {
      return this.prisma.mess.findMany({
        where: { is_active: true },
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    // MESSADMIN sees only linked messes.
    const messAdmin = await this.prisma.messAdminProfile.findUnique({
      where: { userId },
      include: {
        messes: {
          where: { is_active: true },
          select: {
            id: true,
            name: true,
            description: true,
            address: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!messAdmin) {
      return [];
    }

    return messAdmin.messes;
  }

  async addMessToMessAdmin(userId: string, messId: string) {
    // Find the messAdminProfile for this user
    console.log(messId, '-----', userId);
    const messAdmin = await this.prisma.messAdminProfile.findUnique({
      where: { userId: userId },
    });
    console.log(messAdmin, '--------messadmin');
    if (!messAdmin) {
      throw new Error('MessAdmin profile not found for this user');
    }
    const mess = await this.prisma.mess.findUnique({
      where: { id: messId },
    });
    console.log(mess, '--------mess');

    if (!mess) {
      throw new Error('Mess not found for this user');
    }

    // Connect the mess to the mess admin
    await this.prisma.messAdminProfile.update({
      where: { id: messAdmin.id },
      data: {
        messes: {
          connect: { id: messId },
        },
      },
    });

    return { message: 'Mess added to MessAdmin successfully' };
  }

  /**
   * Computes the dates that `count` deliveries should resume on after a pause,
   * landing only on days the subscription actually runs (EVERYDAY/MONTHLY = any
   * day, CUSTOM = only the selected weekdays), starting the day after pauseEnd.
   */
  private generateResumeDates(
    pauseEnd: Date,
    count: number,
    scheduleType: ScheduleType,
    selectedDays: string[] | null,
  ): Date[] {
    const weekdayMap = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    const selectedDaysUpper =
      scheduleType === ScheduleType.CUSTOM
        ? (selectedDays ?? []).map((d) => d.toUpperCase())
        : null;
    const isAllowedDay = (date: Date) =>
      !selectedDaysUpper || selectedDaysUpper.includes(weekdayMap[date.getDay()]);

    const newDates: Date[] = [];
    const cursor = new Date(pauseEnd);
    cursor.setDate(cursor.getDate() + 1);
    while (newDates.length < count) {
      if (isAllowedDay(cursor)) {
        newDates.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return newDates;
  }

  async PauseSubscription(subscriptionId: string, dto: PauseSubDto) {
    const { pause_start_date, pause_end_date } = dto;

    // 1️⃣ Validate pause dates
    if (!pause_start_date || !pause_end_date) {
      throw new BadRequestException(
        'Both pause start and pause end dates are required',
      );
    }

    const pauseStart = new Date(pause_start_date);
    const pauseEnd = new Date(pause_end_date);

    // 2️⃣ Fetch subscription
    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId },
      include: {
        DeliveryPartnerProfile: true,
      },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');

    if (!subscription.is_active)
      throw new BadRequestException(
        'Subscription is inactive and cannot be paused',
      );

    // 3️⃣ Validate pause range
    if (!subscription.end_date) {
      throw new BadRequestException('Subscription has no end date');
    }
    if (pauseEnd > subscription.end_date) {
      throw new BadRequestException(
        'Pause end date cannot exceed subscription end date',
      );
    }

    // 2️⃣.1 Validate against already paused range
    if (subscription.pause_start_date && subscription.pause_end_date) {
      const existingStart = new Date(subscription.pause_start_date);
      const existingEnd = new Date(subscription.pause_end_date);

      const isOverlapping =
        pauseStart <= existingEnd && pauseEnd >= existingStart;

      if (isOverlapping) {
        throw new BadRequestException(
          'Selected pause dates overlap with already paused dates',
        );
      }
    }

    // 4️⃣ Calculate pause duration (in days)
    const pauseDurationDays =
      Math.ceil(
        (pauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    // 5️⃣ Fetch all deliveries of this subscription
    const allDeliveries = await this.prisma.deliveries.findMany({
      where: {
        subscriptionId: subscriptionId,
      },
      orderBy: { date: 'asc' },
    });

    // 6️⃣ Separate completed vs remaining deliveries
    const completedDeliveries = allDeliveries.filter(
      (d) => d.date < pauseStart,
    );

    const remainingDeliveries = allDeliveries.filter(
      (d) => d.date >= pauseStart,
    );

    if (remainingDeliveries.length === 0) {
      throw new BadRequestException('No future deliveries found to pause.');
    }

    // 7️⃣ Reschedule remaining deliveries onto the days the plan/subscription
    // actually runs on, starting right after the pause ends — not a flat
    // day-count shift, which could land a CUSTOM-schedule delivery on a
    // weekday it was never meant to run on.
    const newDates = this.generateResumeDates(
      pauseEnd,
      remainingDeliveries.length,
      subscription.scheduleType,
      subscription.selectedDays as string[] | null,
    );

    const updates: Prisma.PrismaPromise<any>[] = remainingDeliveries.map(
      (delivery, index) =>
        this.prisma.deliveries.update({
          where: { id: delivery.id },
          data: { date: newDates[index] },
        }),
    );

    // Run all updates in one transaction
    await this.prisma.$transaction(updates);

    // 8️⃣ Extend subscription end_date to cover the last rescheduled delivery
    const newEndDate = newDates[newDates.length - 1];

    // 9️⃣ Update subscription with pause info + new end date
    await this.prisma.userSubscriptions.update({
      where: { id: subscriptionId },
      data: {
        pause_start_date: pauseStart,
        pause_end_date: pauseEnd,
        end_date: newEndDate, // extend subscription to keep total deliveries
      },
    });

    // ✅ Return summary
    return {
      message:
        'Subscription paused successfully and future deliveries rescheduled',
      pauseDurationDays,
      shiftedDeliveries: remainingDeliveries.length,
      newSubscriptionEndDate: newEndDate,
    };
  }

  /**
   * Shared pricing logic for a plan booking: validates the plan and dates, normalizes
   * the schedule, and computes totalPrice = chargeable days × plan.price. Used by both
   * choosePlan (which also creates the subscription + payment order) and calculatePlanPrice
   * (which only returns the number, with no side effects).
   */
  private async computePlanPricing(params: {
    planId: string;
    start_date: string;
    end_date?: string;
    scheduleType: ScheduleType;
    selectedDays?: string[];
  }) {
    const { planId, start_date, end_date, scheduleType, selectedDays } = params;

    //Validate plan
    const plan = await this.prisma.plans.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new BadRequestException('Plan not found');

    const requestedScheduleType =
      scheduleType === ScheduleType.MONTHLY
        ? ScheduleType.MONTHLY
        : scheduleType === ScheduleType.CUSTOM ||
          (Array.isArray(selectedDays) && selectedDays.length > 0)
          ? ScheduleType.CUSTOM
          : ScheduleType.EVERYDAY;

    // The plan's own schedule (set by the mess owner) is applied as a default/limit —
    // see resolvePlanSchedule's docstring.
    const {
      scheduleType: normalizedScheduleType,
      selectedDays: normalizedSelectedDays,
    } = resolvePlanSchedule(plan, {
      scheduleType: requestedScheduleType,
      selectedDays: Array.isArray(selectedDays) ? selectedDays : undefined,
    });

    if (
      normalizedScheduleType === ScheduleType.CUSTOM &&
      (!normalizedSelectedDays || normalizedSelectedDays.length === 0)
    ) {
      throw new BadRequestException(
        'Selected days are required for CUSTOM schedule type',
      );
    }

    // Calculate duration and price
    const startDate = new Date(start_date);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start_date');
    }

    const deriveDefaultEndDate = () => {
      if (plan.isMonthlyPlan) {
        const endExclusive = new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth() + 1,
            startDate.getUTCDate(),
            0,
            0,
            0,
          ),
        );
        const endInclusive = new Date(endExclusive);
        endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
        return endInclusive;
      }
      return new Date(startDate);
    };

    const endDate = end_date ? new Date(end_date) : deriveDefaultEndDate();
    if (isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid end_date');
    }
    if (endDate < startDate) {
      throw new BadRequestException('end_date must be >= start_date');
    }
    const diffInMs = endDate.getTime() - startDate.getTime();
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
    const totalPrice = diffInDays * Number(plan.price);

    return {
      plan,
      startDate,
      endDate,
      diffInDays,
      totalPrice,
      normalizedScheduleType,
      normalizedSelectedDays,
    };
  }

  /**
   * Price-only preview for /customer/choose/plan. Accepts the exact same body but performs
   * no writes (no subscription, no payment order) — just returns the calculated price.
   */
  async calculatePlanPrice(dto: choosePlanDto) {
    const { planId, start_date, end_date, scheduleType, selectedDays } = dto;
    const { totalPrice, diffInDays, startDate, endDate } =
      await this.computePlanPricing({
        planId,
        start_date,
        end_date,
        scheduleType,
        selectedDays,
      });

    return {
      price: totalPrice,
      chargeableDays: diffInDays,
      start_date: startDate,
      end_date: endDate,
    };
  }

  async choosePlan(dto: choosePlanDto, userId: string) {
    const {
      addressId,
      planId,
      start_date,
      end_date,
      scheduleType,
      selectedDays, // Array of weekdays if CUSTOM (e.g. ["MONDAY", "WEDNESDAY", "FRIDAY"])
      successUrl,
      cancelUrl,
    } = dto;

    const address = await this.prisma.userAddress.findUnique({
      where: { id: addressId },
    });
    if (!address) {
      throw new BadRequestException('Address not found');
    }

    const {
      plan,
      startDate,
      endDate,
      totalPrice,
      normalizedScheduleType,
      normalizedSelectedDays,
    } = await this.computePlanPricing({
      planId,
      start_date,
      end_date,
      scheduleType,
      selectedDays,
    });

    // Create a pending (inactive) subscription. It will be activated only after successful payment.
    // Include the user relation to access email/phone
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId: userId },
      include: { user: true },
    });

    if (!customerProfile) {
      throw new BadRequestException('Customer profile not found');
    }

    const userSubscription = await this.prisma.userSubscriptions.create({
      data: {
        customerProfileId: customerProfile.id,
        start_date: startDate,
        end_date: endDate,
        discount: 0,
        totalPrice,
        discountedPrice: totalPrice,
        messId: plan.messId,
        planId,
        scheduleType: normalizedScheduleType,
        selectedDays:
          normalizedScheduleType === ScheduleType.CUSTOM
            ? normalizedSelectedDays
            : undefined,
        userAddressId: addressId,
        is_active: false, // mark inactive until payment success
      },
    });

    // Increment popular-plan counter
    await this.prisma.plans.update({
      where: { id: planId },
      data: { totalCustomers: { increment: 1 } },
    });

    // Monthly plan: charge the full amount now (payment pending) — if payment fails,
    // the subscription row (and this DEBIT, via cascade) is deleted by
    // PaymentsService.handlePaymentFailure. Daily plans are never charged upfront;
    // the CREDIT for whatever is actually paid is recorded once payment succeeds.
    if (plan.isMonthlyPlan) {
      try {
        await this.transactionsService.chargeMonthlyPlan({
          subscriptionId: userSubscription.id,
          customerProfileId: customerProfile.id,
          messId: plan.messId,
          amount: totalPrice,
          note: 'Monthly plan charge (pending payment)',
        });
      } catch (err) {
        console.error('Failed to record ledger transaction (choosePlan):', err);
      }
    }

    // Create a Razorpay order and return session URL so frontend can redirect user to payment
    const paymentResult = await this.paymentsService.createPaymentOrder(
      userSubscription.id,
      Number(totalPrice),
      customerProfile.user?.email || '',
      customerProfile.user?.phone || '',
      customerProfile.user?.name || '',
      successUrl,
      cancelUrl,
    );

    return {
      message: 'Payment initiated',
      data: {
        subscription: userSubscription,
        payment: paymentResult.data,
      },
    };
  }

  /**
   * Self-service: returns the authenticated user's own subscriptions, computing the same
   * ACTIVE | PAUSED | CANCELLED | INACTIVE status used in the admin-facing findOne(). Defaults
   * to active subscriptions only; pass status='all' to include paused/cancelled/inactive too.
   */
  async getMySubscriptions(userId: string, status?: string) {
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        userSubscriptions: {
          include: {
            plan: { include: { images: true, Variation: true } },
            UserAddress: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customerProfile) {
      throw new NotFoundException('Customer profile not found');
    }

    const today = new Date();

    const withStatus = customerProfile.userSubscriptions.map((sub) => {
      let computedStatus: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'INACTIVE';
      if (sub.cancelled_on) {
        computedStatus = 'CANCELLED';
      } else if (
        sub.pause_start_date &&
        sub.pause_end_date &&
        today >= new Date(sub.pause_start_date) &&
        today <= new Date(sub.pause_end_date)
      ) {
        computedStatus = 'PAUSED';
      } else if (sub.is_active) {
        computedStatus = 'ACTIVE';
      } else {
        computedStatus = 'INACTIVE';
      }
      return { sub, computedStatus };
    });

    const wantsAll = (status || '').toLowerCase() === 'all';
    const filtered = wantsAll
      ? withStatus
      : withStatus.filter((x) => x.computedStatus === 'ACTIVE');

    return {
      data: filtered.map(({ sub, computedStatus }) => ({
        id: sub.id,
        messId: sub.messId,
        start_date: sub.start_date,
        end_date: sub.end_date,
        selectedDays: sub.selectedDays,
        scheduleType: sub.scheduleType,
        totalPrice: Number(sub.totalPrice),
        discount: Number(sub.discount),
        discountedPrice: Number(sub.discountedPrice),
        deliveryPartnerProfileId: sub.deliveryPartnerProfileId,
        pause_start_date: sub.pause_start_date,
        pause_end_date: sub.pause_end_date,
        cancellation_start_date: sub.cancellation_start_date,
        cancellation_end_date: sub.cancellation_end_date,
        cancelled_on: sub.cancelled_on,
        status: computedStatus,
        createdAt: sub.createdAt,
        plan: sub.plan
          ? {
            id: sub.plan.id,
            name: sub.plan.planName,
            price: Number(sub.plan.price),
            description: sub.plan.description,
            isMonthlyPlan: sub.plan.isMonthlyPlan,
            isDailyPlan: sub.plan.isDailyPlan,
            images: sub.plan.images.map((img) => ({
              url: img.url,
              altText: img.altText,
            })),
          }
          : null,
        address: sub.UserAddress
          ? {
            id: sub.UserAddress.id,
            name: sub.UserAddress.name,
            street: sub.UserAddress.street,
            townOrcity: sub.UserAddress.townOrcity,
            postcode: sub.UserAddress.postcode,
          }
          : null,
      })),
      meta: {
        total: filtered.length,
      },
    };
  }

  //This function is for user to cancel their active subscriptions
  async CancelUserSubscription(dto: CancelSubDto, userId: string) {
    const { cancellation_start_date, cancellation_end_date, subscriptionId } =
      dto || {};

    const cancelStartDate = cancellation_start_date
      ? new Date(cancellation_start_date)
      : null;
    const cancelEndDate = cancellation_end_date
      ? new Date(cancellation_end_date)
      : null;
    const currentDate = new Date();

    const user = await this.prisma.customerProfile.findUnique({
      where: { userId: userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    // 1️⃣ Find subscription with plan and customer profile
    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId, customerProfileId: user.id },
      include: {
        CustomerProfile: true,
        plan: true,
      },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');
    if (!subscription.is_active)
      throw new BadRequestException('Subscription is already cancelled');
    if (!subscription.CustomerProfile)
      throw new BadRequestException('Customer profile not found');

    const planPrice = Number(subscription.plan.price);

    let refundAmount = 0;
    let deletedDeliveriesCount = 0;
    let cancellationType = 'Full';

    // 2️⃣ Partial cancellation (date range provided)
    if (cancelStartDate && cancelEndDate) {
      // Ensure start is before end
      if (cancelEndDate < cancelStartDate) {
        throw new BadRequestException(
          'Cancellation end date must be after start date.',
        );
      }

      // Ensure cancellation start is at least 2 days from now
      const diffFromNowDays = Math.ceil(
        (cancelStartDate.getTime() - currentDate.getTime()) /
        (1000 * 60 * 60 * 24),
      );
      if (diffFromNowDays < 2) {
        throw new BadRequestException(
          'Cancellation can only be scheduled at least 2 days in advance.',
        );
      }

      // Calculate duration between cancellation start and end
      const diffInMs = cancelEndDate.getTime() - cancelStartDate.getTime();
      const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

      // Calculate refund amount
      refundAmount = diffInDays * planPrice;

      // Delete deliveries during cancellation period
      const result = await this.prisma.deliveries.deleteMany({
        where: {
          subscriptionId,
          date: {
            gte: cancelStartDate,
            lte: cancelEndDate,
          },
        },
      });
      deletedDeliveriesCount = result.count;

      try {
        await this.transactionsService.recordRefundAdjustment({
          customerProfileId: subscription.CustomerProfile.id,
          messId: subscription.messId,
          subscriptionId,
          amount: refundAmount,
          note: 'Subscription partial cancellation refund',
        });
      } catch (err) {
        console.error(
          'Failed to record ledger refund adjustment on user partial cancellation:',
          err,
        );
      }

      // Update subscription
      await this.prisma.userSubscriptions.update({
        where: { id: subscriptionId },
        data: {
          cancellation_start_date: cancelStartDate,
          cancellation_end_date: cancelEndDate,
          cancelled_on: new Date(),
          is_active: false,
        },
      });

      cancellationType = 'Partial';
    }
    // 3️⃣ Full cancellation (no dates provided)
    else {
      // Find undelivered deliveries
      const undeliveredDeliveries = await this.prisma.deliveries.findMany({
        where: {
          subscriptionId,
          date: { gte: currentDate },
        },
      });

      const remainingDays = undeliveredDeliveries.length;

      // Calculate refund for undelivered days
      refundAmount = remainingDays * planPrice;

      // Delete all future deliveries
      const result = await this.prisma.deliveries.deleteMany({
        where: {
          subscriptionId,
          date: { gte: currentDate },
        },
      });
      deletedDeliveriesCount = result.count;

      try {
        await this.transactionsService.recordRefundAdjustment({
          customerProfileId: subscription.CustomerProfile.id,
          messId: subscription.messId,
          subscriptionId,
          amount: refundAmount,
          note: 'Subscription full cancellation refund',
        });
      } catch (err) {
        console.error(
          'Failed to record ledger refund adjustment on user full cancellation:',
          err,
        );
      }

      // Update subscription
      await this.prisma.userSubscriptions.update({
        where: { id: subscriptionId },
        data: {
          is_active: false,
          cancelled_on: new Date(),
          cancellation_start_date: null,
          cancellation_end_date: null,
        },
      });
    }

    return {
      message: 'Subscription cancelled successfully',
      cancellationType,
      deletedDeliveries: deletedDeliveriesCount,
      refundAmount,
    };
  }

  //This function is for user to pause their subscriptions.
  async PauseUserSubscription(dto: PauseSubDto, userId: string) {
    const { pause_start_date, pause_end_date, subscriptionId } = dto;

    const user = await this.prisma.customerProfile.findUnique({
      where: { userId: userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 1️⃣ Validate pause dates
    if (!pause_start_date || !pause_end_date) {
      throw new BadRequestException(
        'Both pause start and pause end dates are required',
      );
    }

    const pauseStart = new Date(pause_start_date);
    const pauseEnd = new Date(pause_end_date);
    const currentDate = new Date();

    // 2️⃣ Ensure pause start is at least 2 days from now
    const diffFromNowDays = Math.ceil(
      (pauseStart.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffFromNowDays < 2) {
      throw new BadRequestException(
        'Pause can only be scheduled at least 2 days in advance.',
      );
    }

    // 2️⃣ Fetch subscription
    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId, customerProfileId: user.id },
      include: {
        DeliveryPartnerProfile: true,
      },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');

    if (!subscription.is_active)
      throw new BadRequestException(
        'Subscription is inactive and cannot be paused',
      );

    // 3️⃣ Validate pause range
    if (!subscription.end_date) {
      throw new BadRequestException('Subscription has no end date');
    }
    if (pauseEnd > subscription.end_date) {
      throw new BadRequestException(
        'Pause end date cannot exceed subscription end date',
      );
    }

    // 4️⃣ Calculate pause duration (in days)
    const pauseDurationDays =
      Math.ceil(
        (pauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    // 5️⃣ Fetch all deliveries of this subscription
    const allDeliveries = await this.prisma.deliveries.findMany({
      where: {
        subscriptionId: subscriptionId,
      },
      orderBy: { date: 'asc' },
    });

    // 6️⃣ Separate completed vs remaining deliveries
    const completedDeliveries = allDeliveries.filter(
      (d) => d.date < pauseStart,
    );

    const remainingDeliveries = allDeliveries.filter(
      (d) => d.date >= pauseStart,
    );

    if (remainingDeliveries.length === 0) {
      throw new BadRequestException('No future deliveries found to pause.');
    }

    // 7️⃣ Reschedule remaining deliveries onto the days the plan/subscription
    // actually runs on, starting right after the pause ends — not a flat
    // day-count shift, which could land a CUSTOM-schedule delivery on a
    // weekday it was never meant to run on.
    const newDates = this.generateResumeDates(
      pauseEnd,
      remainingDeliveries.length,
      subscription.scheduleType,
      subscription.selectedDays as string[] | null,
    );

    const updates: Prisma.PrismaPromise<any>[] = remainingDeliveries.map(
      (delivery, index) =>
        this.prisma.deliveries.update({
          where: { id: delivery.id },
          data: { date: newDates[index] },
        }),
    );

    // Run all updates in one transaction
    await this.prisma.$transaction(updates);

    // 8️⃣ Extend subscription end_date to cover the last rescheduled delivery
    const newEndDate = newDates[newDates.length - 1];

    // 9️⃣ Update subscription with pause info + new end date
    await this.prisma.userSubscriptions.update({
      where: { id: subscriptionId },
      data: {
        pause_start_date: pauseStart,
        pause_end_date: pauseEnd,
        end_date: newEndDate, // extend subscription to keep total deliveries
      },
    });

    // ✅ Return summary
    return {
      message:
        'Subscription paused successfully and future deliveries rescheduled',
      pauseDurationDays,
      shiftedDeliveries: remainingDeliveries.length,
      newSubscriptionEndDate: newEndDate,
    };
  }

  /**
   * Admin API: Create a new subscription for an existing customer.
   *
   * Pricing rules:
   *  - Monthly plan  → totalPrice = numMonths × plan.price
   *    (numMonths = ceil of calendar-month difference between startDate and endDate)
   *  - Daily plan    → totalPrice = chargeableDays × plan.price
   *    (chargeableDays = days matching the delivery schedule within the date range)
   *
   * No wallet deduction – this is an admin record-keeping operation.
   */
  async createSubscriptionForCustomer(dto: CreateSubscriptionForCustomerDto) {
    const {
      customerProfileId: rawCustomerProfileId,
      planId,
      deliveryPartnerId,
      start_date,
      end_date,
      scheduleType,
      selectedDays,
      discount,
      userAddressId,
      address,
    } = dto;

    // ─── 1. Resolve customer profile (accept CustomerProfile.id OR User.id) ───
    const customerProfile = await this.prisma.customerProfile.findFirst({
      where: {
        OR: [{ id: rawCustomerProfileId }, { userId: rawCustomerProfileId }],
      },
      include: { user: true },
    });
    if (!customerProfile) {
      throw new BadRequestException(
        'Customer profile not found. Provide a valid CustomerProfile.id or User.id.',
      );
    }

    // ─── 2. Validate plan ───────────────────────────────────────────────────
    const plan = await this.prisma.plans.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plan not found');
    if (!plan.isActive) throw new BadRequestException('Plan is not active');

    // ─── 3. Validate delivery partner & mess alignment ──────────────────────
    const deliveryPartner = await this.prisma.deliveryPartnerProfile.findUnique(
      {
        where: { id: deliveryPartnerId },
      },
    );
    if (!deliveryPartner)
      throw new BadRequestException('Delivery partner not found');
    if (plan.messId !== deliveryPartner.messId) {
      throw new BadRequestException(
        "Plan does not belong to the delivery partner's mess",
      );
    }

    // ─── 4. Resolve optional delivery address ───────────────────────────────
    // "address" (plain string) takes precedence over "userAddressId" (existing address) —
    // if both are sent, a new address is created from the string and userAddressId is ignored.
    let resolvedAddressId: string | undefined = userAddressId;
    if (address) {
      const newAddress = await this.prisma.userAddress.create({
        data: {
          name: customerProfile.user?.name || 'Customer',
          street: address,
          townOrcity: '',
          postcode: '',
          phone: customerProfile.user?.phone || undefined,
          email: customerProfile.user?.email || undefined,
          profileId: customerProfile.id,
        },
      });
      resolvedAddressId = newAddress.id;
    } else if (userAddressId) {
      const addr = await this.prisma.userAddress.findUnique({
        where: { id: userAddressId },
      });
      if (!addr) throw new BadRequestException('User address not found');
    }

    // ─── 5. Parse & validate dates ──────────────────────────────────────────
    const startDate = new Date(start_date);
    if (isNaN(startDate.getTime()))
      throw new BadRequestException('Invalid start_date');

    const deriveDefaultEndDate = () => {
      if (plan.isMonthlyPlan) {
        // Default: 1 calendar month, last day inclusive
        const endExclusive = new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth() + 1,
            startDate.getUTCDate(),
          ),
        );
        const endInclusive = new Date(endExclusive);
        endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
        return endInclusive;
      }
      return new Date(startDate); // daily plan defaults to single day
    };

    const endDate = end_date ? new Date(end_date) : deriveDefaultEndDate();
    if (isNaN(endDate.getTime()))
      throw new BadRequestException('Invalid end_date');
    if (endDate < startDate)
      throw new BadRequestException('end_date must be >= start_date');

    // ─── 6. Normalize schedule ──────────────────────────────────────────────
    // The plan's own schedule (set by the mess owner) is applied as a default/limit —
    // see resolvePlanSchedule's docstring.
    const requestedScheduleType =
      scheduleType === ScheduleType.CUSTOM ||
        (Array.isArray(selectedDays) && selectedDays.length > 0)
        ? ScheduleType.CUSTOM
        : ScheduleType.EVERYDAY;

    const {
      scheduleType: normalizedScheduleType,
      selectedDays: normalizedSelectedDays,
    } = resolvePlanSchedule(plan, {
      scheduleType: requestedScheduleType,
      selectedDays: Array.isArray(selectedDays) ? selectedDays : undefined,
    });

    if (
      normalizedScheduleType === ScheduleType.CUSTOM &&
      (!normalizedSelectedDays || normalizedSelectedDays.length === 0)
    ) {
      throw new BadRequestException(
        'selectedDays are required for CUSTOM schedule type',
      );
    }

    // ─── 7. Calculate total price ────────────────────────────────────────────
    // plan.price is the plan's cost price; plan.minPrice (when set) is the
    // actual selling price shown to and charged to the customer — see
    // AddPlanScreen's "Selling Price" field and PlanCard's displayed price.
    const unitPrice = Number(plan.minPrice ?? plan.price);
    let totalPrice = 0;

    if (plan.isMonthlyPlan) {
      // Monthly: round actual day span to nearest 30-day month.
      // This avoids the calendar-month boundary bug where Jun5 → Jul5
      // (31 days, 1 real month) was being counted as 2 months.
      // Rules: 25–35 days = 1 month | 55–65 days = 2 months | etc.
      const msPerDay = 1000 * 60 * 60 * 24;
      const totalDays =
        Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
      const numMonths = Math.max(1, Math.round(totalDays / 30));

      totalPrice = numMonths * unitPrice;
    } else {
      // Daily plan: count chargeable delivery days
      const weekdayMap = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
      ];
      const selectedDaysUpper =
        normalizedScheduleType === ScheduleType.CUSTOM
          ? (normalizedSelectedDays ?? []).map((d) => d.toUpperCase())
          : [];

      let chargeableDays = 0;
      const tempDate = new Date(startDate);
      while (tempDate <= endDate) {
        if (normalizedScheduleType === ScheduleType.EVERYDAY) {
          chargeableDays++;
        } else {
          const dayName = weekdayMap[tempDate.getUTCDay()];
          if (selectedDaysUpper.includes(dayName)) chargeableDays++;
        }
        tempDate.setUTCDate(tempDate.getUTCDate() + 1);
      }

      totalPrice = chargeableDays * unitPrice;
    }

    // ─── 8. Apply discount ──────────────────────────────────────────────────
    const numericDiscount = Number.isFinite(Number(discount))
      ? Number(discount)
      : 0;
    const appliedDiscount = Math.max(0, Math.min(numericDiscount, totalPrice));
    const discountedPrice = totalPrice - appliedDiscount;

    // ─── 9. Create subscription record ─────────────────────────────────────
    const userSubscription = await this.prisma.userSubscriptions.create({
      data: {
        customerProfileId: customerProfile.id,
        planId,
        messId: plan.messId,
        deliveryPartnerProfileId: deliveryPartnerId,
        start_date: startDate,
        end_date: endDate,
        scheduleType: normalizedScheduleType,
        selectedDays:
          normalizedScheduleType === ScheduleType.CUSTOM
            ? normalizedSelectedDays
            : undefined,
        totalPrice,
        discount: appliedDiscount,
        discountedPrice,
        is_active: true,
        ...(resolvedAddressId ? { userAddressId: resolvedAddressId } : {}),
      },
    });

    // Increment popular-plan counter
    await this.prisma.plans.update({
      where: { id: planId },
      data: { totalCustomers: { increment: 1 } },
    });

    // ─── 10. Auto-create deliveries ─────────────────────────────────────────
    const deliveriesToCreate: any[] = [];
    const weekdayMapDelivery = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    const selectedDaysUpperDelivery =
      normalizedScheduleType === ScheduleType.CUSTOM
        ? (normalizedSelectedDays ?? []).map((d) => d.toUpperCase())
        : [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const shouldCreate =
        normalizedScheduleType === ScheduleType.EVERYDAY ||
        selectedDaysUpperDelivery.includes(
          weekdayMapDelivery[currentDate.getUTCDay()],
        );

      if (shouldCreate) {
        deliveriesToCreate.push({
          date: new Date(currentDate),
          customerId: customerProfile.id,
          planId,
          subscriptionId: userSubscription.id,
          status: DeliveryStatus.PENDING,
          partnerId: deliveryPartnerId,
          messId: plan.messId,
        });
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    if (deliveriesToCreate.length > 0) {
      await this.prisma.deliveries.createMany({ data: deliveriesToCreate });
      await this.createDeliveryVariationsForPlan(
        planId,
        userSubscription.id,
        deliveriesToCreate.map((d) => d.date),
      );
    }

    // ─── 11. Billing ledger — monthly plans are charged in full now; daily plans
    // stay uncharged until each delivery completes. No payment amount is collected
    // through this endpoint, so there's nothing to credit here — any prior advance
    // balance is already netted automatically by the ledger's running balance. ───
    try {
      if (plan.isMonthlyPlan) {
        await this.transactionsService.chargeMonthlyPlan({
          subscriptionId: userSubscription.id,
          customerProfileId: customerProfile.id,
          messId: plan.messId,
          amount: discountedPrice,
          note: 'Monthly plan charge at registration',
        });
      }
    } catch (err) {
      console.error('Failed to record ledger transaction:', err);
    }

    const ledgerTotals = await this.prisma.customerMessTransaction.groupBy({
      by: ['type'],
      where: { customerProfileId: customerProfile.id },
      _sum: { amount: true },
    });
    const totalDebitAll = Number(
      ledgerTotals.find((t) => t.type === LedgerEntryType.DEBIT)?._sum.amount ??
      0,
    );
    const totalCreditAll = Number(
      ledgerTotals.find((t) => t.type === LedgerEntryType.CREDIT)?._sum
        .amount ?? 0,
    );

    // ─── 12. Return result ──────────────────────────────────────────────────
    return {
      message: 'Subscription created successfully',
      data: {
        subscription: {
          id: userSubscription.id,
          customerProfileId: customerProfile.id,
          planId,
          messId: plan.messId,
          start_date: startDate,
          end_date: endDate,
          scheduleType: normalizedScheduleType,
          selectedDays: normalizedSelectedDays ?? null,
          totalPrice,
          discount: appliedDiscount,
          discountedPrice,
          pricingMode: plan.isMonthlyPlan ? 'monthly' : 'daily',
        },
        deliveriesCreated: deliveriesToCreate.length,
        walletBalance: totalCreditAll - totalDebitAll,
      },
    };
  }

  /**
   * Cancel delivery for a single specific date.
   * - Marks that delivery as inactive (isActive = false).
   * - Daily plan: refund 1 × plan.price to wallet.
   * - Monthly plan: no wallet refund.
   */
  async CancelDeliveryForDate(subscriptionId: string, dateStr: string) {
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId },
      include: { CustomerProfile: true, plan: true },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');
    if (!subscription.is_active)
      throw new BadRequestException('Subscription is not active');
    if (!subscription.CustomerProfile)
      throw new BadRequestException('Customer profile not found');

    const startOfDay = new Date(
      Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const delivery = await this.prisma.deliveries.findFirst({
      where: {
        subscriptionId,
        date: { gte: startOfDay, lte: endOfDay },
        isActive: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException(
        `No active delivery found for subscription on ${dateStr}`,
      );
    }

    if (delivery.status === 'DELIVERED') {
      throw new BadRequestException(
        'Cannot cancel a delivery that is already delivered',
      );
    }

    // Soft-delete the delivery
    await this.prisma.deliveries.update({
      where: { id: delivery.id },
      data: { isActive: false },
    });

    // Refund only for daily plans
    let refundAmount = 0;
    if (!subscription.plan.isMonthlyPlan) {
      refundAmount = Number(subscription.plan.price);

      // Ledger: claw back the earlier advance-payment credit by this refunded amount,
      // so the outstanding/advance balance stays accurate (no DEBIT was ever recorded
      // for this day, since daily plans are only charged on successful delivery).
      try {
        await this.transactionsService.recordRefundAdjustment({
          customerProfileId: subscription.CustomerProfile.id,
          messId: subscription.messId,
          subscriptionId,
          deliveryId: delivery.id,
          amount: refundAmount,
          note: `Delivery cancelled for ${dateStr} — refunded to wallet`,
        });
      } catch (err) {
        console.error(
          'Failed to record ledger refund adjustment on delivery cancel:',
          err,
        );
      }
    }

    return {
      message: `Delivery on ${dateStr} cancelled successfully`,
      deliveryId: delivery.id,
      refundAmount,
      planType: subscription.plan.isMonthlyPlan ? 'monthly' : 'daily',
      note: subscription.plan.isMonthlyPlan
        ? 'No wallet refund for monthly plans'
        : `Refunded ₹${refundAmount} to wallet`,
    };
  }

  /**
   * Fully cancel a subscription.
   * - Marks subscription inactive.
   * - Soft-deletes all future pending deliveries.
   * - Daily plan: refund remaining delivery days × plan.price.
   * - Monthly plan: no wallet refund.
   */
  async CancelFullSubscription(subscriptionId: string) {
    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId },
      include: { CustomerProfile: true, plan: true },
    });

    if (!subscription) throw new NotFoundException('Subscription not found');
    if (!subscription.is_active)
      throw new BadRequestException('Subscription is already cancelled');
    if (!subscription.CustomerProfile)
      throw new BadRequestException('Customer profile not found');

    const currentDate = new Date();

    const futureDeliveries = await this.prisma.deliveries.findMany({
      where: {
        subscriptionId,
        date: { gte: currentDate },
        isActive: true,
      },
    });

    const remainingDays = futureDeliveries.length;

    if (remainingDays > 0) {
      await this.prisma.deliveries.updateMany({
        where: {
          subscriptionId,
          date: { gte: currentDate },
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    // Wallet refund — only for daily plans
    let refundAmount = 0;
    if (!subscription.plan.isMonthlyPlan) {
      refundAmount = remainingDays * Number(subscription.plan.price);
      if (refundAmount > 0) {
        // Ledger: claw back the earlier advance-payment credit for the remaining,
        // now-cancelled days (no DEBIT was ever recorded for them).
        try {
          await this.transactionsService.recordRefundAdjustment({
            customerProfileId: subscription.CustomerProfile.id,
            messId: subscription.messId,
            subscriptionId,
            amount: refundAmount,
            note: 'Full subscription cancellation — refunded to wallet',
          });
        } catch (err) {
          console.error(
            'Failed to record ledger refund adjustment on full cancellation:',
            err,
          );
        }
      }
    }

    await this.prisma.userSubscriptions.update({
      where: { id: subscriptionId },
      data: {
        is_active: false,
        cancelled_on: new Date(),
        cancellation_start_date: null,
        cancellation_end_date: null,
      },
    });

    return {
      message: 'Subscription fully cancelled',
      subscriptionId,
      remainingDeliveriesDeactivated: remainingDays,
      refundAmount,
      planType: subscription.plan.isMonthlyPlan ? 'monthly' : 'daily',
      note: subscription.plan.isMonthlyPlan
        ? 'No wallet refund for monthly plans'
        : `Refunded ₹${refundAmount} to wallet`,
    };
  }

  /**
   * List all deliveries for a subscription with optional filters.
   */
  async getDeliveriesForSubscription(
    subscriptionId: string,
    status?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId },
      select: { id: true, planId: true, messId: true },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');

    const where: any = { subscriptionId };

    if (status) {
      const validStatuses = [
        'PENDING',
        'PROGRESS',
        'DELIVERED',
        'COMPLETED',
        'UNDELIVERED',
      ];
      if (!validStatuses.includes(status.toUpperCase())) {
        throw new BadRequestException(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        );
      }
      where.status = status.toUpperCase();
    }

    if (startDate) {
      const parsedStart = new Date(startDate);
      if (isNaN(parsedStart.getTime()))
        throw new BadRequestException('Invalid startDate');
      where.date = { ...where.date, gte: parsedStart };
    }

    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd.getTime()))
        throw new BadRequestException('Invalid endDate');
      where.date = { ...where.date, lte: parsedEnd };
    }

    const skip = (page - 1) * limit;

    const [deliveries, total] = await this.prisma.$transaction([
      this.prisma.deliveries.findMany({
        where,
        orderBy: { date: 'asc' },
        skip,
        take: limit,
        include: {
          plan: {
            select: {
              id: true,
              planName: true,
              price: true,
              Variation: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  isActive: true,
                },
              },
            },
          },
          partner: {
            include: {
              user: {
                select: { id: true, name: true, phone: true, email: true },
              },
            },
          },
        },
      }),
      this.prisma.deliveries.count({ where }),
    ]);

    return {
      data: deliveries.map((d) => ({
        id: d.id,
        date: d.date,
        status: d.status,
        isActive: d.isActive,
        partnerId: d.partnerId,
        partner: d.partner
          ? {
            id: d.partner.id,
            name: d.partner.user.name,
            phone: d.partner.user.phone,
            email: d.partner.user.email,
          }
          : null,
        variations: (d.plan as any)?.Variation ?? [],
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  /**
   * Private helper: after deliveries are created via createMany,
   * fetch their IDs by subscriptionId + dates, then create one
   * DeliveryVariation row per delivery x plan variation.
   */
  private async createDeliveryVariationsForPlan(
    planId: string,
    subscriptionId: string,
    dates: Date[],
  ): Promise<void> {
    if (dates.length === 0) return;

    // Fetch active variations for this plan
    const plan = await this.prisma.plans.findUnique({
      where: { id: planId },
      select: {
        Variation: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });
    const variationIds = plan?.Variation?.map((v) => v.id) ?? [];
    if (variationIds.length === 0) return;

    // Fetch the delivery IDs we just created
    const deliveries = await this.prisma.deliveries.findMany({
      where: { subscriptionId, date: { in: dates } },
      select: { id: true },
    });
    if (deliveries.length === 0) return;

    // Create one DeliveryVariation per delivery x variation
    const records = deliveries.flatMap((d) =>
      variationIds.map((vid) => ({
        deliveryId: d.id,
        variationId: vid,
        status: VariationStatus.PENDING,
      })),
    );

    await this.prisma.deliveryVariation.createMany({
      data: records,
      skipDuplicates: true,
    });
  }

  /**
   * Self-service: filled in by a newly registered customer (see
   * AuthService.verifyOtp -> isNewUser) to set their name/email and an
   * initial pickup address. Safe to call again later to add another
   * address — it never overwrites existing addresses.
   */
  async completeProfile(userId: string, dto: CompleteProfileDto) {
    // Guarded by @Roles(Role.USER) at the controller — only a customer JWT ever
    // reaches this method, and customers only ever exist in the `Customer` table.
    const user = await this.prisma.customer.findUnique({
      where: { id: userId },
      include: { customerProfile: { include: { addresses: true } } },
    });
    if (!user) throw new NotFoundException('User not found');

    let customerProfile = user.customerProfile;
    if (!customerProfile) {
      customerProfile = await this.prisma.customerProfile.create({
        data: { userId: user.id },
        include: { addresses: true },
      });
    }

    if (dto.name || dto.email) {
      await this.prisma.customer.update({
        where: { id: userId },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.email ? { email: dto.email } : {}),
        },
      });
    }

    let address: any = null;
    const hasAddressData = dto.street && dto.townOrcity && dto.postcode;
    if (hasAddressData) {
      address = await this.prisma.userAddress.create({
        data: {
          name: dto.name || user.name,
          street: dto.street!,
          townOrcity: dto.townOrcity!,
          postcode: dto.postcode!,
          phone: user.phone,
          email: dto.email || user.email || undefined,
          profileId: customerProfile.id,
          ...(dto.country ? { country: dto.country } : {}),
          ...(dto.landmark ? { landmark: dto.landmark } : {}),
          ...(dto.latitudeLogitude
            ? { latitudeLogitude: dto.latitudeLogitude }
            : {}),
          ...(dto.locationLink ? { locationLink: dto.locationLink } : {}),
        },
      });
    }

    const updatedUser = await this.prisma.customer.findUnique({
      where: { id: userId },
      include: { customerProfile: { include: { addresses: true } } },
    });

    return {
      message: 'Profile completed successfully',
      data: {
        user: updatedUser,
        addressCreated: address,
      },
    };
  }

  /**
   * Self-service: extend the authenticated customer's own subscription to
   * a new (later) end date. Only the incremental days are charged, via a
   * Razorpay order — end_date is pushed and the extra deliveries are only
   * created once the payment succeeds (see PaymentsService.handlePaymentSuccess).
   */
  async ExtendSubscription(dto: ExtendSubscriptionDto, userId: string) {
    const { subscriptionId, new_end_date, successUrl, cancelUrl } = dto;

    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!customerProfile)
      throw new BadRequestException('Customer profile not found');

    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId, customerProfileId: customerProfile.id },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (!subscription.is_active)
      throw new BadRequestException(
        'Cannot extend an inactive/cancelled subscription',
      );
    if (!subscription.end_date)
      throw new BadRequestException(
        'Subscription has no end date to extend from',
      );

    const newEndDate = new Date(new_end_date);
    if (isNaN(newEndDate.getTime()))
      throw new BadRequestException('Invalid new_end_date');
    if (newEndDate <= subscription.end_date) {
      throw new BadRequestException(
        'new_end_date must be after the current end_date',
      );
    }

    const rangeStart = new Date(subscription.end_date);
    rangeStart.setDate(rangeStart.getDate() + 1);

    // ─── Price only the incremental range ────────────────────────────
    let extraPrice = 0;
    const plan = subscription.plan;
    if (plan.isMonthlyPlan) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const extraDays =
        Math.round((newEndDate.getTime() - rangeStart.getTime()) / msPerDay) +
        1;
      const numMonths = Math.max(1, Math.round(extraDays / 30));
      extraPrice = numMonths * Number(plan.price);
    } else {
      const weekdayMap = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
      ];
      const selectedDaysUpper =
        subscription.scheduleType === ScheduleType.CUSTOM
          ? ((subscription.selectedDays as string[]) ?? []).map((d) =>
            d.toUpperCase(),
          )
          : [];
      let chargeableDays = 0;
      const tempDate = new Date(rangeStart);
      while (tempDate <= newEndDate) {
        if (
          subscription.scheduleType === ScheduleType.EVERYDAY ||
          selectedDaysUpper.includes(weekdayMap[tempDate.getUTCDay()])
        ) {
          chargeableDays++;
        }
        tempDate.setUTCDate(tempDate.getUTCDate() + 1);
      }
      extraPrice = chargeableDays * Number(plan.price);
    }

    if (extraPrice <= 0) {
      throw new BadRequestException(
        'No chargeable days found in the extended range',
      );
    }

    // Monthly plan: charge the extension amount now (payment pending), same rule as
    // a fresh booking. Daily plans stay uncharged until each extra day's delivery
    // completes — only the CREDIT (if payment succeeds) is recorded upfront here.
    if (plan.isMonthlyPlan) {
      try {
        await this.transactionsService.chargeMonthlyPlan({
          subscriptionId: subscription.id,
          customerProfileId: customerProfile.id,
          messId: subscription.messId,
          amount: extraPrice,
          note: 'Monthly plan extension charge (pending payment)',
        });
      } catch (err) {
        console.error(
          'Failed to record ledger transaction (ExtendSubscription):',
          err,
        );
      }
    }

    const paymentResult = await this.paymentsService.createPaymentOrder(
      subscription.id,
      extraPrice,
      customerProfile.user?.email || '',
      customerProfile.user?.phone || '',
      customerProfile.user?.name || '',
      successUrl,
      cancelUrl,
      'EXTENSION',
      { newEndDate: newEndDate.toISOString() },
    );

    return {
      message:
        'Extension payment initiated. Subscription end date will be extended once payment succeeds.',
      data: {
        subscriptionId: subscription.id,
        currentEndDate: subscription.end_date,
        requestedEndDate: newEndDate,
        extraPrice,
        payment: paymentResult.data,
      },
    };
  }

  /**
   * Self-service: skip a single meal/variation (e.g. Lunch only) for one
   * delivery date, without cancelling the whole day. Marks that variation
   * UNDELIVERED so it is excluded from the delivery/billing counts for
   * that meal, leaving the rest of the day's variations untouched.
   */
  async SkipDeliveryVariation(
    subscriptionId: string,
    dto: SkipVariationDto,
    userId: string,
  ) {
    const { date, variationId } = dto;

    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!customerProfile)
      throw new BadRequestException('Customer profile not found');

    const subscription = await this.prisma.userSubscriptions.findUnique({
      where: { id: subscriptionId, customerProfileId: customerProfile.id },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (!subscription.is_active)
      throw new BadRequestException('Subscription is not active');

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime()))
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');

    const startOfDay = new Date(
      Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const delivery = await this.prisma.deliveries.findFirst({
      where: {
        subscriptionId,
        date: { gte: startOfDay, lte: endOfDay },
        isActive: true,
      },
    });
    if (!delivery)
      throw new NotFoundException(
        `No active delivery found for subscription on ${date}`,
      );

    const deliveryVariation = await this.prisma.deliveryVariation.findUnique({
      where: {
        deliveryId_variationId: { deliveryId: delivery.id, variationId },
      },
      include: { variation: true },
    });
    if (!deliveryVariation)
      throw new NotFoundException('Variation not found for this delivery');
    if (
      deliveryVariation.status === 'DELIVERED' ||
      deliveryVariation.status === 'COMPLETED'
    ) {
      throw new BadRequestException(
        'Cannot skip a variation that is already delivered/completed',
      );
    }

    await this.prisma.deliveryVariation.update({
      where: { id: deliveryVariation.id },
      data: { status: VariationStatus.UNDELIVERED },
    });

    return {
      message: `${deliveryVariation.variation.title} skipped for ${date}`,
      deliveryId: delivery.id,
      variationId,
    };
  }
}

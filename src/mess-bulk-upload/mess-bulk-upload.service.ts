import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BillingService } from 'src/billing/billing.service';
import { generateUniqueMessSlug } from 'src/common/utility/slug.util';
import { generateRandomPassword } from 'src/common/utility/utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseMessWorkbook, ParsedMessRow, SheetRow } from './mess-excel.parser';
import { buildMessTemplate } from './mess-excel.template';

export const OWNER_EMAIL_DOMAIN = 'messmeals.com';

export interface BulkUploadOptions {
    /// Validate and check for conflicts only — nothing is written.
    dryRun: boolean;
    /// Whether created messes appear on the public website (PATCH /mess/:id/listing controls this later).
    isListed: boolean;
    isVerified: boolean;
}

export type RowStatus = 'CREATED' | 'VALID' | 'SKIPPED' | 'FAILED';

export interface OwnerCredentials {
    userId?: string;
    /// The owner account's username — the mess name.
    username: string;
    phone: string;
    email: string;
    /// Plain-text password, present ONLY for a newly created owner and ONLY in this response
    /// (it is stored hashed and can't be recovered later).
    password?: string;
    isNewAccount: boolean;
}

export interface RowResult {
    row: number;
    name: string;
    status: RowStatus;
    messId?: string;
    slug?: string;
    owner?: OwnerCredentials;
    errors?: string[];
    warnings?: string[];
    message?: string;
}

/// State a dry run needs to behave like a real run: rows earlier in the same file that
/// "would have been" created are not in the database yet.
interface PlannedState {
    ownerPhones: Set<string>;
    ownerEmails: Set<string>;
    messKeys: Set<string>;
}

type OwnerResolution =
    | { kind: 'existing'; userId: string; profileId: string | null; email: string | null }
    | { kind: 'new'; email: string }
    | { kind: 'error'; message: string };

@Injectable()
export class MessBulkUploadService {
    private readonly logger = new Logger(MessBulkUploadService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly billingService: BillingService,
    ) { }

    /// Excel template (header row + Instructions sheet). Pass `withSamples` for example rows.
    getTemplate(withSamples = false): Promise<Buffer> {
        return buildMessTemplate(withSamples);
    }

    async upload(file: Buffer, options: BulkUploadOptions) {
        const sheetRows = await parseMessWorkbook(file);

        const planned: PlannedState = { ownerPhones: new Set(), ownerEmails: new Set(), messKeys: new Set() };
        const results: RowResult[] = [];

        // Sequential on purpose: rows may share an owner phone or slug base, and later rows
        // must see what earlier rows created.
        for (const sheetRow of sheetRows) {
            results.push(await this.processRow(sheetRow, options, planned));
        }

        const count = (status: RowStatus) => results.filter((r) => r.status === status).length;
        const ownersCreated = results.filter((r) => r.owner?.isNewAccount).length;
        const ownersReused = results.filter((r) => r.owner && !r.owner.isNewAccount).length;
        const succeeded = options.dryRun ? count('VALID') : count('CREATED');

        return {
            message: options.dryRun
                ? `Dry run: ${succeeded} of ${results.length} rows are ready to import. Nothing was saved.`
                : `${succeeded} of ${results.length} messes created.`,
            dryRun: options.dryRun,
            summary: {
                totalRows: results.length,
                [options.dryRun ? 'valid' : 'created']: succeeded,
                skipped: count('SKIPPED'),
                failed: count('FAILED'),
                ownersCreated,
                ownersReused,
            },
            results,
        };
    }

    private async processRow(sheetRow: SheetRow, options: BulkUploadOptions, planned: PlannedState): Promise<RowResult> {
        const base = { row: sheetRow.rowNumber, name: sheetRow.name };

        if (!sheetRow.validation.ok) {
            return { ...base, status: 'FAILED', errors: sheetRow.validation.errors };
        }
        const row = sheetRow.validation.row;

        try {
            const messKey = `${row.name.toLowerCase()}|${row.phone}`;
            const alreadyExists =
                planned.messKeys.has(messKey) ||
                !!(await this.prisma.mess.findFirst({
                    where: { name: row.name, phone: row.phone },
                    select: { id: true },
                }));
            if (alreadyExists) {
                return { ...base, status: 'SKIPPED', message: 'A mess with this name and phone already exists' };
            }

            const owner = await this.resolveOwner(row, options.dryRun ? planned : undefined);
            if (owner.kind === 'error') {
                return { ...base, status: 'FAILED', errors: [owner.message] };
            }

            if (options.dryRun) {
                planned.messKeys.add(messKey);
                if (owner.kind === 'new') {
                    planned.ownerPhones.add(row.phone);
                    planned.ownerEmails.add(owner.email);
                }
                return {
                    ...base,
                    status: 'VALID',
                    owner: {
                        username: row.name,
                        phone: row.phone,
                        email: owner.email ?? '',
                        isNewAccount: owner.kind === 'new',
                    },
                };
            }

            return await this.createMess(base, row, owner, options);
        } catch (e) {
            return { ...base, status: 'FAILED', errors: [this.describeError(e, sheetRow.rowNumber)] };
        }
    }

    /// Decides whether the phone maps to an existing owner (reuse), nobody (create), or a
    /// conflicting account (error).
    private async resolveOwner(row: ParsedMessRow, planned?: PlannedState): Promise<OwnerResolution> {
        const email = row.email ?? `${row.phone}@${OWNER_EMAIL_DOMAIN}`;

        // Dry run only: an earlier row in this file would already have created this owner.
        if (planned?.ownerPhones.has(row.phone)) {
            return { kind: 'existing', userId: '', profileId: null, email };
        }

        const existing = await this.prisma.user.findUnique({
            where: { phone: row.phone },
            select: { id: true, email: true, role: true, messAdminProfile: { select: { id: true } } },
        });
        if (existing) {
            if (existing.role !== Role.MESSADMIN) {
                return { kind: 'error', message: `Phone ${row.phone} already belongs to a ${existing.role} account` };
            }
            return {
                kind: 'existing',
                userId: existing.id,
                profileId: existing.messAdminProfile?.id ?? null,
                email: existing.email,
            };
        }

        const customer = await this.prisma.customer.findUnique({ where: { phone: row.phone }, select: { id: true } });
        if (customer) {
            return { kind: 'error', message: `Phone ${row.phone} already belongs to a customer account` };
        }

        const emailTaken =
            planned?.ownerEmails.has(email) ||
            (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) ||
            (await this.prisma.customer.findUnique({ where: { email }, select: { id: true } }));
        if (emailTaken) {
            return { kind: 'error', message: `Email ${email} is already used by another account` };
        }

        return { kind: 'new', email };
    }

    private async createMess(
        base: { row: number; name: string },
        row: ParsedMessRow,
        owner: Exclude<OwnerResolution, { kind: 'error' }>,
        options: BulkUploadOptions,
    ): Promise<RowResult> {
        // Hash before opening the transaction — bcrypt is the slow part.
        const password = owner.kind === 'new' ? generateRandomPassword() : undefined;
        const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

        const created = await this.prisma.$transaction(async (tx) => {
            let userId: string;
            let profileId: string;

            if (owner.kind === 'new') {
                const user = await tx.user.create({
                    data: {
                        name: row.name,
                        phone: row.phone,
                        email: owner.email,
                        password: passwordHash,
                        role: Role.MESSADMIN,
                        is_verified: true,
                        is_active: true,
                        messAdminProfile: { create: {} },
                    },
                    include: { messAdminProfile: { select: { id: true } } },
                });
                userId = user.id;
                profileId = user.messAdminProfile!.id;
            } else {
                userId = owner.userId;
                profileId =
                    owner.profileId ?? (await tx.messAdminProfile.create({ data: { userId } })).id;
            }

            const slug = await generateUniqueMessSlug(tx, row.name);
            const galleryUrls = [...new Set(row.galleryImages)];

            const mess = await tx.mess.create({
                data: {
                    name: row.name,
                    slug,
                    description: row.description,
                    address: row.address,
                    phone: row.phone,
                    // Contact email is only what the sheet provided — the generated
                    // <phone>@messmeals.com is an account login, not a public contact address.
                    email: row.email,
                    zipcode: row.zipcode,
                    latitude: row.latitude,
                    logitude: row.longitude,
                    icon: row.icon,
                    is_active: true,
                    is_verified: options.isVerified,
                    isListed: options.isListed,
                    messAdmins: { connect: { id: profileId } },
                    foodTypes: { create: row.foodTypes.map((foodType) => ({ foodType })) },
                    tags: { create: row.tags.map((tag) => ({ tag })) },
                    images: {
                        create: [
                            ...(row.coverImage ? [{ url: row.coverImage, isCover: true, sortOrder: 0 }] : []),
                            ...galleryUrls.map((url, i) => ({ url, isCover: false, sortOrder: i + 1 })),
                        ],
                    },
                },
                select: { id: true, slug: true },
            });

            return { userId, mess };
        });

        const warnings: string[] = [];
        try {
            // Same post-create hook MessService.create runs (applies the default trial period).
            await this.billingService.ensureMessBillingConfig(created.mess.id);
        } catch (e) {
            this.logger.warn(`Billing config not created for mess ${created.mess.id}: ${(e as Error).message}`);
            warnings.push('Mess was created but its billing config could not be initialised');
        }

        return {
            ...base,
            status: 'CREATED',
            messId: created.mess.id,
            slug: created.mess.slug ?? undefined,
            owner: {
                userId: created.userId,
                username: row.name,
                phone: row.phone,
                email: owner.email ?? '',
                password,
                isNewAccount: owner.kind === 'new',
            },
            ...(warnings.length && { warnings }),
        };
    }

    private describeError(e: unknown, rowNumber: number): string {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            return `Duplicate value for ${String(e.meta?.target ?? 'a unique field')}`;
        }
        if (e instanceof BadRequestException) return e.message;
        this.logger.error(`Row ${rowNumber} failed: ${(e as Error)?.message}`, (e as Error)?.stack);
        return 'Unexpected error while saving this row';
    }
}

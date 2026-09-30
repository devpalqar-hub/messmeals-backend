import * as bcrypt from 'bcrypt';
import * as ExcelJS from 'exceljs';
import { MessBulkUploadService } from './mess-bulk-upload.service';
import { MESS_COLUMNS } from './mess-excel.parser';

/// Minimal in-memory stand-in for the slice of PrismaService the service touches.
/// `$transaction` snapshots state and restores it on throw, so rollback is exercised too.
function makeFakePrisma() {
    const db = {
        users: [] as any[],
        customers: [] as any[],
        profiles: [] as any[],
        messes: [] as any[],
    };
    let seq = 0;
    const id = (p: string) => `${p}-${++seq}`;
    const failNextMessCreate = { on: false };

    const api: any = {
        user: {
            findUnique: async ({ where }: any) => {
                const u = db.users.find((x) => (where.phone ? x.phone === where.phone : x.email === where.email));
                if (!u) return null;
                const profile = db.profiles.find((p) => p.userId === u.id);
                return { ...u, messAdminProfile: profile ? { id: profile.id } : null };
            },
            create: async ({ data }: any) => {
                if (db.users.some((u) => u.phone === data.phone)) throw new Error('unique phone');
                const { messAdminProfile, ...rest } = data;
                const user = { id: id('user'), ...rest };
                db.users.push(user);
                const profile = { id: id('profile'), userId: user.id };
                if (messAdminProfile) db.profiles.push(profile);
                return { ...user, messAdminProfile: messAdminProfile ? { id: profile.id } : null };
            },
        },
        customer: {
            findUnique: async ({ where }: any) =>
                db.customers.find((x) => (where.phone ? x.phone === where.phone : x.email === where.email)) ?? null,
        },
        messAdminProfile: {
            create: async ({ data }: any) => {
                const p = { id: id('profile'), userId: data.userId };
                db.profiles.push(p);
                return p;
            },
        },
        mess: {
            findFirst: async ({ where }: any) =>
                db.messes.find((m) => m.name.toLowerCase() === where.name.toLowerCase() && m.phone === where.phone) ?? null,
            findUnique: async ({ where }: any) => db.messes.find((m) => m.slug === where.slug) ?? null,
            create: async ({ data }: any) => {
                if (failNextMessCreate.on) throw new Error('boom');
                const mess = { id: id('mess'), ...data };
                db.messes.push(mess);
                return { id: mess.id, slug: mess.slug };
            },
        },
        $transaction: async (fn: any) => {
            const snapshot = JSON.stringify(db);
            try {
                return await fn(api);
            } catch (e) {
                const restored = JSON.parse(snapshot);
                for (const k of Object.keys(db)) (db as any)[k] = restored[k];
                throw e;
            }
        },
    };
    return { api, db, failNextMessCreate };
}

const OPTS = { dryRun: false, isListed: false, isVerified: false };

const row = (over: Record<string, any> = {}) => {
    const base: Record<string, any> = {
        name: 'Amma Meals', description: 'Homely', latitude: '8.5', longitude: '76.9', phone: '9876543210',
        email: '', foodTypes: 'VEG, NON_VEG', tags: 'HOME_STYLE_FOOD', icon: '', coverImage: '', galleryImages: '',
        address: '', zipcode: '', ...over,
    };
    return MESS_COLUMNS.map((c) => base[c.key]);
};

async function sheet(rows: any[][]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Messes');
    ws.addRow(MESS_COLUMNS.map((c) => c.header));
    rows.forEach((r) => ws.addRow(r));
    return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('MessBulkUploadService', () => {
    let fake: ReturnType<typeof makeFakePrisma>;
    let billing: { ensureMessBillingConfig: jest.Mock };
    let service: MessBulkUploadService;

    beforeEach(() => {
        fake = makeFakePrisma();
        billing = { ensureMessBillingConfig: jest.fn().mockResolvedValue(undefined) };
        service = new MessBulkUploadService(fake.api, billing as any);
    });

    it('creates the mess and a MESSADMIN owner (username = mess name, hashed random password)', async () => {
        const res = await service.upload(
            await sheet([row({
                icon: 'https://cdn.x/icon.png',
                coverImage: 'https://cdn.x/cover.jpg',
                galleryImages: 'https://cdn.x/1.jpg, https://cdn.x/2.jpg, https://cdn.x/1.jpg',
            })]),
            OPTS,
        );

        expect(res.summary).toMatchObject({ totalRows: 1, created: 1, failed: 0, ownersCreated: 1, ownersReused: 0 });
        const result = res.results[0];
        expect(result.status).toBe('CREATED');
        expect(result.owner).toMatchObject({ username: 'Amma Meals', phone: '9876543210', email: '9876543210@messmeals.com', isNewAccount: true });
        expect(result.owner!.password).toMatch(/^[A-Za-z0-9]{10}$/);

        const [user] = fake.db.users;
        expect(user).toMatchObject({ name: 'Amma Meals', phone: '9876543210', role: 'MESSADMIN', email: '9876543210@messmeals.com', is_active: true });
        expect(user.password).not.toBe(result.owner!.password);
        expect(await bcrypt.compare(result.owner!.password!, user.password)).toBe(true);

        const [mess] = fake.db.messes;
        expect(mess).toMatchObject({
            name: 'Amma Meals', slug: 'amma-meals', phone: '9876543210', latitude: '8.5', logitude: '76.9',
            icon: 'https://cdn.x/icon.png', isListed: false, is_verified: false, email: undefined,
            messAdmins: { connect: { id: fake.db.profiles[0].id } },
            foodTypes: { create: [{ foodType: 'VEG' }, { foodType: 'NON_VEG' }] },
            tags: { create: [{ tag: 'HOME_STYLE_FOOD' }] },
            images: {
                create: [
                    { url: 'https://cdn.x/cover.jpg', isCover: true, sortOrder: 0 },
                    { url: 'https://cdn.x/1.jpg', isCover: false, sortOrder: 1 },
                    { url: 'https://cdn.x/2.jpg', isCover: false, sortOrder: 2 },
                ],
            },
        });
        expect(billing.ensureMessBillingConfig).toHaveBeenCalledWith(mess.id);
    });

    it('uses the sheet email for the account when given, and creates no images when photos are absent', async () => {
        const res = await service.upload(await sheet([row({ email: 'Owner@Example.com' })]), { ...OPTS, isListed: true, isVerified: true });
        expect(res.results[0].owner!.email).toBe('owner@example.com');
        expect(fake.db.users[0].email).toBe('owner@example.com');
        expect(fake.db.messes[0]).toMatchObject({ email: 'owner@example.com', isListed: true, is_verified: true, images: { create: [] } });
    });

    it('gives duplicate names unique slugs', async () => {
        await service.upload(await sheet([row(), row({ phone: '9876543211' })]), OPTS);
        expect(fake.db.messes.map((m) => m.slug)).toEqual(['amma-meals', 'amma-meals-2']);
    });

    it('links several messes in one file to one owner when they share a phone, with one password', async () => {
        const res = await service.upload(await sheet([row({ name: 'Branch A' }), row({ name: 'Branch B' })]), OPTS);
        expect(res.summary).toMatchObject({ created: 2, ownersCreated: 1, ownersReused: 1 });
        expect(fake.db.users).toHaveLength(1);
        expect(res.results[0].owner!.password).toBeDefined();
        expect(res.results[1].owner!.password).toBeUndefined();
        expect(fake.db.messes.every((m) => m.messAdmins.connect.id === fake.db.profiles[0].id)).toBe(true);
    });

    it('reuses an existing MESSADMIN (creating their profile if missing) without a new password', async () => {
        fake.db.users.push({ id: 'u-existing', phone: '9876543210', email: 'old@x.com', role: 'MESSADMIN' });
        const res = await service.upload(await sheet([row()]), OPTS);
        expect(res.results[0].owner).toMatchObject({ isNewAccount: false, email: 'old@x.com', userId: 'u-existing' });
        expect(res.results[0].owner!.password).toBeUndefined();
        expect(fake.db.users).toHaveLength(1);
        expect(fake.db.profiles).toEqual([expect.objectContaining({ userId: 'u-existing' })]);
    });

    it('is idempotent: re-uploading the same file skips existing messes', async () => {
        const file = await sheet([row()]);
        await service.upload(file, OPTS);
        const again = await service.upload(file, OPTS);
        expect(again.results[0]).toMatchObject({ status: 'SKIPPED' });
        expect(again.summary).toMatchObject({ created: 0, skipped: 1, failed: 0 });
        expect(fake.db.messes).toHaveLength(1);
        expect(fake.db.users).toHaveLength(1);
    });

    it.each([
        ['a customer', () => (f: any) => f.db.customers.push({ id: 'c1', phone: '9876543210' }), 'customer account'],
        ['a superadmin', () => (f: any) => f.db.users.push({ id: 'u1', phone: '9876543210', role: 'SUPERADMIN' }), 'SUPERADMIN account'],
        ['another account email', () => (f: any) => f.db.users.push({ id: 'u1', phone: '9000000000', email: '9876543210@messmeals.com', role: 'MESSADMIN' }), 'already used'],
    ])('fails only that row when the phone/email belongs to %s', async (_label, seed, expected) => {
        seed()(fake);
        const res = await service.upload(await sheet([row(), row({ name: 'Other', phone: '9111111111' })]), OPTS);
        expect(res.results[0].status).toBe('FAILED');
        expect(res.results[0].errors![0]).toContain(expected);
        expect(res.results[1].status).toBe('CREATED');
        expect(res.summary).toMatchObject({ created: 1, failed: 1 });
    });

    it('reports invalid rows without touching the database and keeps processing the rest', async () => {
        const res = await service.upload(await sheet([row({ phone: '123' }), row({ name: 'Good', phone: '9222222222' })]), OPTS);
        expect(res.results[0]).toMatchObject({ row: 2, status: 'FAILED' });
        expect(res.results[1]).toMatchObject({ row: 3, status: 'CREATED' });
        expect(fake.db.messes).toHaveLength(1);
    });

    it('rolls the owner back when the mess insert fails (no orphan account)', async () => {
        fake.failNextMessCreate.on = true;
        const res = await service.upload(await sheet([row()]), OPTS);
        expect(res.results[0]).toMatchObject({ status: 'FAILED', errors: ['Unexpected error while saving this row'] });
        expect(fake.db.users).toHaveLength(0);
        expect(fake.db.profiles).toHaveLength(0);
    });

    it('still reports CREATED (with a warning) if only the billing hook fails', async () => {
        billing.ensureMessBillingConfig.mockRejectedValue(new Error('no table'));
        const res = await service.upload(await sheet([row()]), OPTS);
        expect(res.results[0]).toMatchObject({ status: 'CREATED', warnings: [expect.stringContaining('billing config')] });
    });

    describe('dryRun', () => {
        it('writes nothing, but predicts in-file duplicates, shared owners and conflicts', async () => {
            fake.db.customers.push({ id: 'c1', phone: '9333333333' });
            const res = await service.upload(
                await sheet([
                    row({ name: 'A' }),
                    row({ name: 'B' }),                                 // same phone => shared owner
                    row({ name: 'A' }),                                 // same name+phone => duplicate
                    row({ name: 'C', phone: '9333333333' }),            // customer phone => fail
                    row({ name: 'D', phone: '1' }),                     // invalid
                ]),
                { ...OPTS, dryRun: true },
            );

            expect(res.dryRun).toBe(true);
            expect(res.results.map((r) => r.status)).toEqual(['VALID', 'VALID', 'SKIPPED', 'FAILED', 'FAILED']);
            expect(res.results[0].owner).toMatchObject({ isNewAccount: true });
            expect(res.results[0].owner!.password).toBeUndefined();
            expect(res.results[1].owner).toMatchObject({ isNewAccount: false });
            expect(res.summary).toMatchObject({ totalRows: 5, valid: 2, skipped: 1, failed: 2 });
            expect(fake.db.users).toHaveLength(0);
            expect(fake.db.messes).toHaveLength(0);
            expect(billing.ensureMessBillingConfig).not.toHaveBeenCalled();
        });
    });
});

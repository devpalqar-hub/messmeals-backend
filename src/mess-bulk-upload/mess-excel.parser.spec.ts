import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { MAX_ROWS_PER_UPLOAD, MESS_COLUMNS, normalizePhone, parseMessWorkbook } from './mess-excel.parser';
import { buildMessTemplate } from './mess-excel.template';

const HEADERS = MESS_COLUMNS.map((c) => c.header);

/// Builds an .xlsx buffer from raw cell values (row 1 = headers unless overridden).
async function workbookOf(rows: ExcelJS.CellValue[][], headers: string[] = HEADERS, sheetName = 'Messes') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(r));
    return Buffer.from(await wb.xlsx.writeBuffer());
}

// Name, Description, Latitude, Longitude, Phone, Email, Food, Tags, Icon, Cover, Gallery, Address, Zip
const validRow = (over: Partial<Record<string, ExcelJS.CellValue>> = {}): ExcelJS.CellValue[] => {
    const base: Record<string, ExcelJS.CellValue> = {
        name: 'Amma Meals', description: 'Homely', latitude: '8.5241', longitude: '76.9366', phone: '9876543210',
        email: '', foodTypes: 'VEG', tags: '', icon: '', coverImage: '', galleryImages: '', address: '', zipcode: '',
        ...over,
    };
    return MESS_COLUMNS.map((c) => base[c.key]);
};

describe('parseMessWorkbook', () => {
    it('parses the generated sample file with no row errors', async () => {
        const rows = await parseMessWorkbook(await buildMessTemplate(true));
        expect(rows).toHaveLength(2);
        expect(rows.every((r) => r.validation.ok)).toBe(true);

        const first = rows[0].validation;
        if (!first.ok) throw new Error('unreachable');
        expect(first.row).toMatchObject({
            name: 'Amma Home Meals',
            phone: '9876543210',
            email: 'amma@example.com',
            foodTypes: ['VEG', 'NON_VEG'],
            tags: ['HOME_STYLE_FOOD', 'MONTHLY_PLANS', 'HYGIENIC_KITCHEN'],
            coverImage: 'https://cdn.example.com/amma/cover.jpg',
            galleryImages: ['https://cdn.example.com/amma/1.jpg', 'https://cdn.example.com/amma/2.jpg'],
        });
        expect(rows[0].rowNumber).toBe(2);
    });

    it('rejects the header-only template (no data rows)', async () => {
        await expect(parseMessWorkbook(await buildMessTemplate(false))).rejects.toThrow('no data rows');
    });

    it('accepts numeric phone/coordinates, "NON VEG", lowercase, dedupes and strips +91', async () => {
        const buf = await workbookOf([
            validRow({ phone: 9876543210, latitude: 8.5241, longitude: 76.9366, foodTypes: 'veg, non veg, VEG' }),
            validRow({ name: 'B', phone: '+91 98765 43211', foodTypes: 'non-veg;mixed' }),
        ]);
        const rows = await parseMessWorkbook(buf);
        const [a, b] = rows.map((r) => (r.validation.ok ? r.validation.row : null));
        expect(a).toMatchObject({ phone: '9876543210', latitude: '8.5241', foodTypes: ['VEG', 'NON_VEG'] });
        expect(b).toMatchObject({ phone: '9876543211', foodTypes: ['NON_VEG', 'MIXED'] });
    });

    it('reads hyperlinked email cells and lowercases the email', async () => {
        const buf = await workbookOf([
            validRow({ email: { text: 'Owner@Example.COM', hyperlink: 'mailto:Owner@Example.COM' } }),
        ]);
        const [row] = await parseMessWorkbook(buf);
        expect(row.validation.ok && row.validation.row.email).toBe('owner@example.com');
    });

    it('reports every problem in a row at once', async () => {
        const buf = await workbookOf([
            validRow({
                name: '', latitude: '95', longitude: 'abc', phone: '12345', email: 'nope', foodTypes: 'SEAFOOD',
                tags: 'HOME_STYLE_FOOD, MADE_UP', icon: 'ftp://x/y.png', coverImage: 'not a url',
            }),
        ]);
        const [row] = await parseMessWorkbook(buf);
        expect(row.validation.ok).toBe(false);
        const errors = row.validation.ok ? [] : row.validation.errors;
        expect(errors).toEqual(expect.arrayContaining([
            'Name is required',
            expect.stringContaining('Latitude must be a number'),
            expect.stringContaining('Longitude must be a number'),
            expect.stringContaining('Phone Number "12345"'),
            expect.stringContaining('Email "nope"'),
            expect.stringContaining('Food Type: unknown value(s) "SEAFOOD"'),
            expect.stringContaining('Tags: unknown value(s) "MADE_UP"'),
            expect.stringContaining('Icon URL: "ftp://x/y.png"'),
        ]));
    });

    it('requires food type, phone and coordinates but not email, tags or photos', async () => {
        const [row] = await parseMessWorkbook(await workbookOf([validRow({ foodTypes: '', phone: '', latitude: '', longitude: '' })]));
        const errors = row.validation.ok ? [] : row.validation.errors;
        expect(errors).toEqual(expect.arrayContaining([
            'Food Type is required', 'Phone Number is required', 'Latitude is required', 'Longitude is required',
        ]));
        expect(errors).toHaveLength(4);
    });

    it('rejects over-long image URLs (VARCHAR(191) column) and multiple cover links', async () => {
        const long = `https://cdn.example.com/${'a'.repeat(200)}.jpg`;
        const [row] = await parseMessWorkbook(await workbookOf([
            validRow({ galleryImages: long, coverImage: 'https://a.com/1.jpg https://a.com/2.jpg' }),
        ]));
        const errors = row.validation.ok ? [] : row.validation.errors;
        expect(errors.some((e) => e.includes('longer than 191'))).toBe(true);
        expect(errors).toContain('Cover Image URL must contain a single link');
    });

    it('matches headers case-insensitively, in any order, with aliases, on the first sheet', async () => {
        const buf = await workbookOf(
            [['Amma', '8.5', '76.9', '98765 43210', 'VEG']],
            ['MESS NAME', 'lat', 'Lng', 'Mobile', 'food_type *'],
            'Sheet1',
        );
        const [row] = await parseMessWorkbook(buf);
        expect(row.validation.ok && row.validation.row).toMatchObject({ name: 'Amma', phone: '9876543210', foodTypes: ['VEG'] });
    });

    it('skips blank rows but keeps the real Excel row numbers', async () => {
        const buf = await workbookOf([validRow({ name: 'One' }), [], validRow({ name: 'Two', phone: '9876543211' })]);
        const rows = await parseMessWorkbook(buf);
        expect(rows.map((r) => [r.rowNumber, r.name])).toEqual([[2, 'One'], [4, 'Two']]);
    });

    it('rejects a workbook missing required columns', async () => {
        const buf = await workbookOf([['x', 'y']], ['Name', 'Description']);
        await expect(parseMessWorkbook(buf)).rejects.toThrow(/Missing required column\(s\).*Latitude.*Longitude.*Phone Number.*Food Type/);
    });

    it('rejects files that are not xlsx', async () => {
        await expect(parseMessWorkbook(Buffer.from('name,phone\nx,1'))).rejects.toBeInstanceOf(BadRequestException);
    });

    it(`rejects more than ${MAX_ROWS_PER_UPLOAD} rows`, async () => {
        const rows = Array.from({ length: MAX_ROWS_PER_UPLOAD + 1 }, (_, i) => validRow({ name: `M${i}` }));
        await expect(parseMessWorkbook(await workbookOf(rows))).rejects.toThrow('Too many rows');
    });
});

describe('normalizePhone', () => {
    it.each([
        ['9876543210', '9876543210'],
        ['+91 98765-43210', '9876543210'],
        ['09876543210', '9876543210'],
        ['919876543210', '9876543210'],
        ['1234567890', null],
        ['98765', null],
        ['', null],
    ])('%s -> %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));
});

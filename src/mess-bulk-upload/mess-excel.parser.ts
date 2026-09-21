import { BadRequestException } from '@nestjs/common';
import { FoodType, Tags } from '@prisma/client';
import { isEmail } from 'class-validator';
import * as ExcelJS from 'exceljs';

/// Hard limits for one upload — keeps a single request (bcrypt + one transaction per row) bounded.
export const MAX_ROWS_PER_UPLOAD = 500;
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/// Name of the sheet the template puts the data on (the parser falls back to the first sheet).
export const DATA_SHEET_NAME = 'Messes';

/// Mess.name / MessImages.url etc. are Prisma `String` => VARCHAR(191) on MySQL.
const MAX_VARCHAR = 191;

export type MessColumnKey =
    | 'name'
    | 'description'
    | 'latitude'
    | 'longitude'
    | 'phone'
    | 'email'
    | 'foodTypes'
    | 'tags'
    | 'icon'
    | 'coverImage'
    | 'galleryImages'
    | 'address'
    | 'zipcode';

export interface MessColumn {
    key: MessColumnKey;
    /// Header written into the template.
    header: string;
    required: boolean;
    /// Extra accepted spellings of the header (compared after normalizeHeader()).
    aliases: string[];
    help: string;
    example: string;
}

export const MESS_COLUMNS: MessColumn[] = [
    {
        key: 'name',
        header: 'Name',
        required: true,
        aliases: ['messname'],
        help: 'Mess name. Also used as the owner account\'s username.',
        example: 'Amma Home Meals',
    },
    {
        key: 'description',
        header: 'Description',
        required: false,
        aliases: [],
        help: 'Short description shown on the mess page.',
        example: 'Homely Kerala meals, cooked fresh every day.',
    },
    {
        key: 'latitude',
        header: 'Latitude',
        required: true,
        aliases: ['lat'],
        help: 'Decimal degrees between -90 and 90.',
        example: '8.5241',
    },
    {
        key: 'longitude',
        header: 'Longitude',
        required: true,
        aliases: ['lng', 'long', 'lon'],
        help: 'Decimal degrees between -180 and 180.',
        example: '76.9366',
    },
    {
        key: 'phone',
        header: 'Phone Number',
        required: true,
        aliases: ['phone', 'mobile', 'mobilenumber', 'contactnumber'],
        help: '10-digit Indian mobile number (a +91 / 0 prefix is stripped). Used as the owner\'s login phone.',
        example: '9876543210',
    },
    {
        key: 'email',
        header: 'Email',
        required: false,
        aliases: ['emailid', 'emailaddress'],
        help: 'Optional. When empty the owner account gets <phone>@messmeals.com.',
        example: 'amma@example.com',
    },
    {
        key: 'foodTypes',
        header: 'Food Type',
        required: true,
        aliases: ['foodtypes'],
        help: `One or more of ${Object.values(FoodType).join(', ')} separated by commas. "NON VEG" is accepted for NON_VEG.`,
        example: 'VEG, NON_VEG',
    },
    {
        key: 'tags',
        header: 'Tags',
        required: false,
        aliases: ['tag'],
        help: 'Optional, comma separated. Allowed values are listed on the Instructions sheet.',
        example: 'HOME_STYLE_FOOD, MONTHLY_PLANS, HYGIENIC_KITCHEN',
    },
    {
        key: 'icon',
        header: 'Icon URL',
        required: false,
        aliases: ['iconlink', 'iconimage', 'logo', 'logourl'],
        help: 'Optional http(s) link to the mess icon / logo.',
        example: 'https://cdn.example.com/amma/icon.png',
    },
    {
        key: 'coverImage',
        header: 'Cover Image URL',
        required: false,
        aliases: ['coverimage', 'coverimagelink', 'coverurl', 'cover'],
        help: 'Optional http(s) link to one cover image.',
        example: 'https://cdn.example.com/amma/cover.jpg',
    },
    {
        key: 'galleryImages',
        header: 'Gallery Image URLs',
        required: false,
        aliases: ['galleryimages', 'galleryimagelinks', 'galleryurls', 'gallery', 'images'],
        help: 'Optional http(s) links separated by commas or new lines.',
        example: 'https://cdn.example.com/amma/1.jpg, https://cdn.example.com/amma/2.jpg',
    },
    {
        key: 'address',
        header: 'Address',
        required: false,
        aliases: [],
        help: 'Optional street address.',
        example: 'TC 12/345, Pattom, Thiruvananthapuram',
    },
    {
        key: 'zipcode',
        header: 'Zipcode',
        required: false,
        aliases: ['pincode', 'postcode', 'postalcode'],
        help: 'Optional pincode.',
        example: '695004',
    },
];

export interface ParsedMessRow {
    name: string;
    description?: string;
    latitude: string;
    longitude: string;
    phone: string;
    /// Only set when the sheet had an email — the owner account falls back to <phone>@messmeals.com.
    email?: string;
    foodTypes: FoodType[];
    tags: Tags[];
    icon?: string;
    coverImage?: string;
    galleryImages: string[];
    address?: string;
    zipcode?: string;
}

export type RowValidation =
    | { ok: true; row: ParsedMessRow }
    | { ok: false; errors: string[] };

export interface SheetRow {
    /// 1-based row number in the Excel sheet (what the admin sees).
    rowNumber: number;
    name: string;
    validation: RowValidation;
}

/// "Phone Number", "phone_number" and "PHONE-NUMBER *" all become "phonenumber".
function normalizeHeader(header: string): string {
    return header.toLowerCase().replace(/\*/g, '').replace(/[^a-z0-9]/g, '');
}

/// Flattens whatever ExcelJS hands back for a cell (string, number, rich text, hyperlink,
/// formula result, date, ...) into a trimmed string.
export function cellToText(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();

    const v = value as any;
    if (Array.isArray(v.richText)) {
        return v.richText.map((part: { text: string }) => part.text).join('').trim();
    }
    if (v.text !== undefined) {
        // Hyperlink cell — `text` can itself be a rich-text object.
        return cellToText(v.text);
    }
    if (v.hyperlink) return String(v.hyperlink).replace(/^mailto:/i, '').trim();
    if (v.result !== undefined) return cellToText(v.result);
    if (v.error) return '';
    return '';
}

function splitList(raw: string, separators: RegExp): string[] {
    return raw
        .split(separators)
        .map((s) => s.trim())
        .filter(Boolean);
}

/// "NON VEG", "non-veg" and "NON_VEG" all normalise to the enum spelling NON_VEG.
function toEnumToken(raw: string): string {
    return raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/// Digits-only 10-digit Indian mobile number; null when it can't be read as one.
export function normalizePhone(raw: string): string | null {
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function parseCoordinate(raw: string, label: string, limit: number, errors: string[]): string | undefined {
    if (!raw) {
        errors.push(`${label} is required`);
        return undefined;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || Math.abs(n) > limit) {
        errors.push(`${label} must be a number between -${limit} and ${limit} (got "${raw}")`);
        return undefined;
    }
    return raw;
}

function parseEnumList<T extends string>(
    raw: string,
    allowed: readonly T[],
    label: string,
    errors: string[],
): T[] {
    const values: T[] = [];
    const invalid: string[] = [];

    for (const token of splitList(raw, /[,;|\n]+/)) {
        const normalized = toEnumToken(token);
        if ((allowed as readonly string[]).includes(normalized)) {
            if (!values.includes(normalized as T)) values.push(normalized as T);
        } else {
            invalid.push(token);
        }
    }

    if (invalid.length) {
        errors.push(`${label}: unknown value(s) ${invalid.map((v) => `"${v}"`).join(', ')}. Allowed: ${allowed.join(', ')}`);
    }
    return values;
}

function parseUrls(raw: string, label: string, errors: string[]): string[] {
    const urls = splitList(raw, /[\s,;|]+/);
    for (const url of urls) {
        if (!isHttpUrl(url)) errors.push(`${label}: "${url}" is not a valid http(s) URL`);
        else if (url.length > MAX_VARCHAR) errors.push(`${label}: URL is longer than ${MAX_VARCHAR} characters`);
    }
    return urls;
}

/// Validates one sheet row (already flattened to text by column key) into a ParsedMessRow.
/// Collects *all* problems in the row so the admin can fix them in one pass.
export function validateRow(cells: Record<MessColumnKey, string>): RowValidation {
    const errors: string[] = [];

    const name = cells.name;
    if (!name) errors.push('Name is required');
    else if (name.length > MAX_VARCHAR) errors.push(`Name is longer than ${MAX_VARCHAR} characters`);

    const latitude = parseCoordinate(cells.latitude, 'Latitude', 90, errors);
    const longitude = parseCoordinate(cells.longitude, 'Longitude', 180, errors);

    let phone: string | null = null;
    if (!cells.phone) errors.push('Phone Number is required');
    else {
        phone = normalizePhone(cells.phone);
        if (!phone) errors.push(`Phone Number "${cells.phone}" is not a valid 10-digit mobile number`);
    }

    let email: string | undefined;
    if (cells.email) {
        if (!isEmail(cells.email) || cells.email.length > MAX_VARCHAR) errors.push(`Email "${cells.email}" is not valid`);
        else email = cells.email.toLowerCase();
    }

    const foodTypes = cells.foodTypes
        ? parseEnumList(cells.foodTypes, Object.values(FoodType), 'Food Type', errors)
        : [];
    if (!cells.foodTypes) errors.push('Food Type is required');

    const tags = cells.tags ? parseEnumList(cells.tags, Object.values(Tags), 'Tags', errors) : [];

    const icon = cells.icon ? parseUrls(cells.icon, 'Icon URL', errors) : [];
    if (icon.length > 1) errors.push('Icon URL must contain a single link');

    const cover = cells.coverImage ? parseUrls(cells.coverImage, 'Cover Image URL', errors) : [];
    if (cover.length > 1) errors.push('Cover Image URL must contain a single link');

    const gallery = cells.galleryImages ? parseUrls(cells.galleryImages, 'Gallery Image URLs', errors) : [];

    if (cells.zipcode.length > MAX_VARCHAR) errors.push(`Zipcode is longer than ${MAX_VARCHAR} characters`);

    if (errors.length || !phone || !latitude || !longitude) return { ok: false, errors };

    return {
        ok: true,
        row: {
            name,
            description: cells.description || undefined,
            latitude,
            longitude,
            phone,
            email,
            foodTypes,
            tags,
            icon: icon[0],
            coverImage: cover[0],
            galleryImages: gallery,
            address: cells.address || undefined,
            zipcode: cells.zipcode || undefined,
        },
    };
}

/// Reads an uploaded .xlsx buffer into validated rows. Throws BadRequestException for
/// problems with the file as a whole (not a workbook, missing columns, too many rows...);
/// per-row problems come back inside each SheetRow's `validation`.
export async function parseMessWorkbook(buffer: Buffer): Promise<SheetRow[]> {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(buffer as any);
    } catch {
        throw new BadRequestException('The uploaded file is not a valid .xlsx Excel workbook');
    }

    const sheet = workbook.getWorksheet(DATA_SHEET_NAME) ?? workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The workbook has no sheets');

    // Map header text -> column number.
    const columnIndex = new Map<MessColumnKey, number>();
    const lookup = new Map<string, MessColumnKey>();
    for (const col of MESS_COLUMNS) {
        lookup.set(normalizeHeader(col.header), col.key);
        col.aliases.forEach((alias) => lookup.set(alias, col.key));
    }
    sheet.getRow(1).eachCell((cell, colNumber) => {
        const key = lookup.get(normalizeHeader(cellToText(cell.value)));
        if (key && !columnIndex.has(key)) columnIndex.set(key, colNumber);
    });

    const missing = MESS_COLUMNS.filter((c) => c.required && !columnIndex.has(c.key)).map((c) => c.header);
    if (missing.length) {
        throw new BadRequestException(
            `Missing required column(s) in row 1: ${missing.join(', ')}. Download the template from GET /admin/mess-bulk-upload/template.`,
        );
    }

    const rows: SheetRow[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const excelRow = sheet.getRow(rowNumber);
        const cells = {} as Record<MessColumnKey, string>;
        for (const col of MESS_COLUMNS) {
            const idx = columnIndex.get(col.key);
            cells[col.key] = idx ? cellToText(excelRow.getCell(idx).value) : '';
        }

        // Skip fully blank rows (Excel often reports trailing formatted-but-empty rows).
        if (Object.values(cells).every((v) => v === '')) continue;

        rows.push({ rowNumber, name: cells.name, validation: validateRow(cells) });

        if (rows.length > MAX_ROWS_PER_UPLOAD) {
            throw new BadRequestException(`Too many rows: a single upload is limited to ${MAX_ROWS_PER_UPLOAD} messes`);
        }
    }

    if (!rows.length) throw new BadRequestException('The sheet has no data rows below the header');
    return rows;
}

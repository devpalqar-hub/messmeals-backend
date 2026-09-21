import { FoodType, Tags } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { DATA_SHEET_NAME, MAX_ROWS_PER_UPLOAD, MESS_COLUMNS, MessColumnKey } from './mess-excel.parser';

const SAMPLE_ROWS: Record<MessColumnKey, string>[] = [
    {
        name: 'Amma Home Meals',
        description: 'Homely Kerala meals, cooked fresh every day.',
        latitude: '8.5241',
        longitude: '76.9366',
        phone: '9876543210',
        email: 'amma@example.com',
        foodTypes: 'VEG, NON_VEG',
        tags: 'HOME_STYLE_FOOD, MONTHLY_PLANS, HYGIENIC_KITCHEN',
        icon: 'https://cdn.example.com/amma/icon.png',
        coverImage: 'https://cdn.example.com/amma/cover.jpg',
        galleryImages: 'https://cdn.example.com/amma/1.jpg, https://cdn.example.com/amma/2.jpg',
        address: 'TC 12/345, Pattom, Thiruvananthapuram',
        zipcode: '695004',
    },
    {
        // No email and no photos — both are optional.
        name: 'Green Leaf Veg Mess',
        description: 'Pure vegetarian lunch and dinner for students.',
        latitude: '8.5074',
        longitude: '76.9730',
        phone: '9123456780',
        email: '',
        foodTypes: 'VEG',
        tags: 'STUDENT_FRIENDLY, AFFORDABLE_PRICING',
        icon: '',
        coverImage: '',
        galleryImages: '',
        address: '',
        zipcode: '',
    },
];

/// Builds the upload workbook. `withSamples` fills the data sheet with example rows
/// (for a ready-to-upload sample file); the downloadable template leaves it header-only so
/// nobody uploads the examples by accident.
export async function buildMessTemplate(withSamples = false): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MessMeals';

    // ---- Data sheet -------------------------------------------------------------------------
    const data = workbook.addWorksheet(DATA_SHEET_NAME, { views: [{ state: 'frozen', ySplit: 1 }] });
    data.columns = MESS_COLUMNS.map((col) => ({
        header: col.header,
        key: col.key,
        width: Math.max(col.header.length + 6, col.key === 'description' || col.key.endsWith('Images') ? 45 : 22),
    }));

    const header = data.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.alignment = { vertical: 'middle' };
    header.height = 22;
    MESS_COLUMNS.forEach((col, i) => {
        const cell = header.getCell(i + 1);
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: col.required ? 'FFC0392B' : 'FF2F6F4E' },
        };
        cell.note = `${col.required ? 'Required' : 'Optional'}. ${col.help}`;
    });

    // Phone, zipcode and coordinates are text so Excel never mangles them (leading zeros, 9.8E+09).
    for (const key of ['phone', 'zipcode', 'latitude', 'longitude'] as const) {
        data.getColumn(key).numFmt = '@';
    }

    if (withSamples) {
        SAMPLE_ROWS.forEach((row) => data.addRow(row));
    }

    // ---- Instructions sheet -----------------------------------------------------------------
    const info = workbook.addWorksheet('Instructions');
    info.columns = [
        { width: 24 },
        { width: 12 },
        { width: 70 },
        { width: 55 },
    ];

    info.addRow(['Mess bulk upload']).font = { bold: true, size: 14 };
    info.addRow([`Fill the "${DATA_SHEET_NAME}" sheet, one mess per row (max ${MAX_ROWS_PER_UPLOAD} rows), then POST it to /admin/mess-bulk-upload.`]);
    info.addRow(['Header names may be reordered but must not be renamed. Red headers are required.']);
    info.addRow([]);

    const tableHeader = info.addRow(['Column', 'Required', 'What to enter', 'Example']);
    tableHeader.font = { bold: true };
    MESS_COLUMNS.forEach((col) => info.addRow([col.header, col.required ? 'Yes' : 'No', col.help, col.example]));

    info.addRow([]);
    info.addRow(['Owner accounts']).font = { bold: true };
    [
        'Each mess gets an owner (MESSADMIN) account: username = mess name, login phone = the phone number.',
        'A random password is generated and returned once in the upload response — it is stored hashed.',
        'If Email is empty the account email is <phone>@messmeals.com.',
        'If the phone already belongs to an existing owner, the new mess is linked to that owner (no new account).',
        'A row whose Name + Phone already exist as a mess is skipped, so re-uploading the same file is safe.',
    ].forEach((line) => info.addRow([line]));

    info.addRow([]);
    info.addRow(['Allowed Food Type values']).font = { bold: true };
    info.addRow([Object.values(FoodType).join(', ')]);

    info.addRow([]);
    info.addRow(['Allowed Tags values']).font = { bold: true };
    Object.values(Tags).forEach((tag) => info.addRow([tag]));

    return Buffer.from(await workbook.xlsx.writeBuffer());
}

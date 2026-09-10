import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/// Query params for POST /customer/bulk-upload.
export class BulkUploadCustomersQueryDto {
    @ApiPropertyOptional({
        example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11',
        description:
            'Optional. Scopes plain "planName" lookups (rows without a planId) to this mess, and is used ' +
            "to fill in a row's planId when the sheet only has one plan column matching this mess. Not required " +
            'when every row already carries a valid planId.',
    })
    @IsOptional()
    @IsUUID()
    messId?: string;
}

/// One row of the parsed sheet, after header normalization — mirrors the columns documented
/// on GET /customer/bulk-upload/template.
export interface BulkUploadCustomerRow {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    planId?: string;
    planName?: string;
    walletAmount?: string | number;
    discount?: string | number;
    start_date?: string;
    end_date?: string;
    scheduleType?: string;
    selectedDays?: string;
    deliveryPartnerId?: string;
}

export interface BulkUploadRowResult {
    row: number;
    name?: string;
    phone?: string;
    status: 'success' | 'error';
    message: string;
    isNewCustomer?: boolean;
    subscriptionId?: string;
}

export interface BulkUploadCustomersResult {
    total: number;
    succeeded: number;
    failed: number;
    results: BulkUploadRowResult[];
}

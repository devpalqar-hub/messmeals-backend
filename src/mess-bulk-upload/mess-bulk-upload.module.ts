import { Module } from '@nestjs/common';
import { BillingModule } from 'src/billing/billing.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MessBulkUploadController } from './mess-bulk-upload.controller';
import { MessBulkUploadService } from './mess-bulk-upload.service';

@Module({
    imports: [PrismaModule, BillingModule],
    controllers: [MessBulkUploadController],
    providers: [MessBulkUploadService],
})
export class MessBulkUploadModule { }

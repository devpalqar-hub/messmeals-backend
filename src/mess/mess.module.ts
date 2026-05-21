import { Module } from '@nestjs/common';
import { MessController } from './mess.controller';
import { MessService } from './mess.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { S3Module } from 'src/s3/s3.module';
import { BillingModule } from 'src/billing/billing.module';

@Module({
    imports: [PrismaModule, S3Module, BillingModule],
    controllers: [MessController],
    providers: [MessService],
    exports: [MessService],
})
export class MessModule { }

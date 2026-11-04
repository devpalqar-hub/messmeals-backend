import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { InvoicesModule } from 'src/invoices/invoices.module';

@Module({
  imports: [TransactionsModule, InvoicesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

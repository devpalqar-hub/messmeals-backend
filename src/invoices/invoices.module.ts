import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, PdfService],
  exports: [InvoicesService, PdfService],
})
export class InvoicesModule {}


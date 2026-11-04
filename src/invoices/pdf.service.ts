import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface InvoicePdfData {
  documentTitle?: string; // "TAX INVOICE"
  invoiceNumber: string;
  issueDate: Date | string;
  dueDate?: Date | string;
  status: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PENDING' | 'CANCELLED';

  seller: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    taxId?: string | null;
  };

  customer: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };

  items: Array<{
    description: string;
    details?: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;

  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;

  paymentDetails?: {
    paymentMethod?: string | null;
    transactionId?: string | null;
    paidAt?: Date | string | null;
  };

  notes?: string;
  terms?: string;
}

export interface ReceiptPdfData {
  documentTitle?: string; // "OFFICIAL PAYMENT RECEIPT"
  receiptNumber: string;
  paymentDate: Date | string;
  status: 'SUCCESS' | 'COMPLETED' | 'PAID';

  payee: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };

  payer: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };

  amountPaid: number;
  paymentMethod: string;
  transactionId?: string | null;
  invoiceReference?: string | null;
  subscriptionReference?: string | null;
  forDescription: string;
  notes?: string;
}

@Injectable()
export class PdfService {
  /**
   * Helper to format numbers into standard Indian Rupee currency format (e.g. Rs. 4,500.00).
   * Note: uses 'Rs.' instead of Unicode '₹' to avoid font encoding issues in standard PDF viewers.
   */
  private formatCurrency(amount: number | string | undefined | null): string {
    const num = Number(amount) || 0;
    return `Rs. ${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Helper to format a date into readable format (e.g. "04 Nov 2026")
   */
  private formatDate(date: Date | string | undefined | null): string {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Draws a status pill/badge with colored background and text
   */
  private drawStatusBadge(
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    status: string,
  ) {
    let bgColor = '#FEF3C7'; // Amber (pending/unpaid)
    let textColor = '#B45309';

    const normalized = (status || '').toUpperCase();
    if (normalized === 'PAID' || normalized === 'SUCCESS' || normalized === 'COMPLETED') {
      bgColor = '#DCFCE7'; // Green
      textColor = '#15803D';
    } else if (normalized === 'OVERDUE' || normalized === 'CANCELLED' || normalized === 'FAILED') {
      bgColor = '#FEE2E2'; // Red
      textColor = '#B91C1C';
    }

    const badgeWidth = 90;
    const badgeHeight = 22;

    doc
      .save()
      .roundedRect(x, y, badgeWidth, badgeHeight, 11)
      .fill(bgColor);

    doc
      .fillColor(textColor)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(text.toUpperCase(), x, y + 6, {
        width: badgeWidth,
        align: 'center',
      })
      .restore();
  }

  /**
   * Generates a PDF buffer for an Invoice
   */
  async generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Invoice ${data.invoiceNumber}`,
            Author: data.seller.name || 'MessMeals',
            Subject: data.documentTitle || 'Tax Invoice',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const pageWidth = 595.28;
        const pageMargin = 40;
        const contentWidth = pageWidth - pageMargin * 2; // 515.28

        // 1. Top Decorative Brand Bar
        doc
          .save()
          .rect(pageMargin, pageMargin, contentWidth, 5)
          .fill('#2563EB') // Modern Royal Blue accent
          .restore();

        // 2. Header Section
        let y = pageMargin + 20;

        // Seller Title / Brand
        doc
          .fillColor('#0F172A')
          .fontSize(20)
          .font('Helvetica-Bold')
          .text(data.seller.name, pageMargin, y);

        // Document Title (Right Aligned)
        doc
          .fillColor('#2563EB')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(data.documentTitle || 'TAX INVOICE', pageMargin, y, {
            width: contentWidth,
            align: 'right',
          });

        y += 28;

        // Subtitle / Invoice Number
        doc
          .fillColor('#64748B')
          .fontSize(10)
          .font('Helvetica')
          .text('Invoice Ref: ', pageMargin, y, { continued: true })
          .font('Helvetica-Bold')
          .fillColor('#1E293B')
          .text(data.invoiceNumber);

        // Status Badge (Right Aligned)
        this.drawStatusBadge(doc, data.status, pageMargin + contentWidth - 90, y - 4, data.status);

        y += 25;

        // Divider
        doc
          .save()
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .moveTo(pageMargin, y)
          .lineTo(pageMargin + contentWidth, y)
          .stroke()
          .restore();

        y += 15;

        // 3. Two-Column Info Block (Billed By vs Billed To & Dates)
        const colWidth = (contentWidth - 20) / 2;
        const col1X = pageMargin;
        const col2X = pageMargin + colWidth + 20;
        const infoBlockStartY = y;

        // Column 1: Billed By (Supplier)
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#64748B')
          .text('BILLED BY (SUPPLIER)', col1X, y);

        y += 14;
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#0F172A')
          .text(data.seller.name, col1X, y);

        y += 14;
        doc.fontSize(9).font('Helvetica').fillColor('#334155');
        if (data.seller.address) {
          doc.text(data.seller.address, col1X, y, { width: colWidth });
          y = doc.y + 3;
        }
        if (data.seller.phone) {
          doc.text(`Phone: ${data.seller.phone}`, col1X, y);
          y = doc.y + 3;
        }
        if (data.seller.email) {
          doc.text(`Email: ${data.seller.email}`, col1X, y);
          y = doc.y + 3;
        }
        if (data.seller.taxId) {
          doc.text(`GSTIN / Tax ID: ${data.seller.taxId}`, col1X, y);
          y = doc.y + 3;
        }

        const col1EndY = y;

        // Column 2: Billed To (Customer) & Invoice Dates
        y = infoBlockStartY;
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#64748B')
          .text('BILLED TO (CUSTOMER)', col2X, y);

        y += 14;
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#0F172A')
          .text(data.customer.name, col2X, y);

        y += 14;
        doc.fontSize(9).font('Helvetica').fillColor('#334155');
        if (data.customer.address) {
          doc.text(data.customer.address, col2X, y, { width: colWidth });
          y = doc.y + 3;
        }
        if (data.customer.phone) {
          doc.text(`Phone: ${data.customer.phone}`, col2X, y);
          y = doc.y + 3;
        }
        if (data.customer.email) {
          doc.text(`Email: ${data.customer.email}`, col2X, y);
          y = doc.y + 3;
        }

        y += 6;
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#475569')
          .text(`Issue Date: `, col2X, y, { continued: true })
          .font('Helvetica')
          .text(this.formatDate(data.issueDate));

        if (data.dueDate) {
          y += 12;
          doc
            .font('Helvetica-Bold')
            .text(`Due Date: `, col2X, y, { continued: true })
            .font('Helvetica')
            .text(this.formatDate(data.dueDate));
        }

        y = Math.max(col1EndY, doc.y) + 20;

        // 4. Line Items Table Header
        const tableX = pageMargin;
        const colW = {
          seq: 30,
          desc: 250,
          qty: 55,
          unitPrice: 85,
          amount: 95.28,
        };

        doc
          .save()
          .rect(tableX, y, contentWidth, 24)
          .fill('#F1F5F9')
          .restore();

        const headerY = y + 7;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
        doc.text('#', tableX + 8, headerY);
        doc.text('ITEM & DESCRIPTION', tableX + colW.seq + 5, headerY);
        doc.text('QTY', tableX + colW.seq + colW.desc, headerY, {
          width: colW.qty,
          align: 'right',
        });
        doc.text('RATE', tableX + colW.seq + colW.desc + colW.qty, headerY, {
          width: colW.unitPrice,
          align: 'right',
        });
        doc.text(
          'AMOUNT',
          tableX + colW.seq + colW.desc + colW.qty + colW.unitPrice,
          headerY,
          { width: colW.amount - 8, align: 'right' },
        );

        y += 24;

        // Table Rows
        let seq = 1;
        for (const item of data.items) {
          const rowStartY = y;

          // Item description & sub-details
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E293B');
          doc.text(String(seq), tableX + 8, y + 8);
          doc.text(item.description, tableX + colW.seq + 5, y + 8, {
            width: colW.desc - 10,
          });

          let textEndY = doc.y;
          if (item.details) {
            doc.fontSize(8).font('Helvetica').fillColor('#64748B');
            doc.text(item.details, tableX + colW.seq + 5, textEndY + 2, {
              width: colW.desc - 10,
            });
            textEndY = doc.y;
          }

          const rowHeight = Math.max(28, textEndY - rowStartY + 8);

          doc.fontSize(9).font('Helvetica').fillColor('#334155');
          doc.text(String(item.quantity), tableX + colW.seq + colW.desc, y + 8, {
            width: colW.qty,
            align: 'right',
          });
          doc.text(
            this.formatCurrency(item.unitPrice),
            tableX + colW.seq + colW.desc + colW.qty,
            y + 8,
            { width: colW.unitPrice, align: 'right' },
          );
          doc.font('Helvetica-Bold').fillColor('#0F172A');
          doc.text(
            this.formatCurrency(item.amount),
            tableX + colW.seq + colW.desc + colW.qty + colW.unitPrice,
            y + 8,
            { width: colW.amount - 8, align: 'right' },
          );

          y += rowHeight;

          // Row separator
          doc
            .save()
            .strokeColor('#F1F5F9')
            .lineWidth(1)
            .moveTo(tableX, y)
            .lineTo(tableX + contentWidth, y)
            .stroke()
            .restore();

          seq++;
        }

        y += 15;

        // 5. Totals / Summary Section (Right-aligned)
        const summaryWidth = 220;
        const summaryX = pageMargin + contentWidth - summaryWidth;

        const printSummaryLine = (
          label: string,
          value: string,
          isBold = false,
          color = '#1E293B',
        ) => {
          doc
            .fontSize(9)
            .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
            .fillColor('#64748B')
            .text(label, summaryX, y);
          doc
            .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
            .fillColor(color)
            .text(value, summaryX, y, {
              width: summaryWidth - 8,
              align: 'right',
            });
          y += 16;
        };

        printSummaryLine('Subtotal:', this.formatCurrency(data.subtotal));

        if (data.discount && data.discount > 0) {
          printSummaryLine(
            'Discount:',
            `- ${this.formatCurrency(data.discount)}`,
            false,
            '#16A34A',
          );
        }

        if (data.tax !== undefined && data.tax > 0) {
          printSummaryLine('Taxes / GST:', this.formatCurrency(data.tax));
        }

        // Grand Total Box
        y += 2;
        doc
          .save()
          .rect(summaryX - 5, y, summaryWidth + 5, 26)
          .fill('#F8FAFC')
          .strokeColor('#CBD5E1')
          .lineWidth(1)
          .stroke()
          .restore();

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#0F172A')
          .text('Grand Total:', summaryX + 5, y + 7);
        doc.text(this.formatCurrency(data.total), summaryX, y + 7, {
          width: summaryWidth - 8,
          align: 'right',
        });

        y += 34;

        if (data.amountPaid !== undefined && data.amountPaid > 0) {
          printSummaryLine('Amount Paid:', this.formatCurrency(data.amountPaid), false, '#15803D');
        }

        if (data.balanceDue !== undefined && data.balanceDue > 0) {
          printSummaryLine(
            'Balance Due:',
            this.formatCurrency(data.balanceDue),
            true,
            '#DC2626',
          );
        }

        // 6. Payment Information Card (if paid / partially paid)
        if (data.paymentDetails && (data.status === 'PAID' || data.amountPaid)) {
          y += 10;
          doc
            .save()
            .roundedRect(pageMargin, y, contentWidth, 42, 6)
            .fill('#F0FDF4')
            .strokeColor('#BBF7D0')
            .lineWidth(1)
            .stroke()
            .restore();

          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#15803D')
            .text('PAYMENT DETAILS', pageMargin + 12, y + 8);

          const payText = [
            data.paymentDetails.paymentMethod
              ? `Method: ${data.paymentDetails.paymentMethod}`
              : null,
            data.paymentDetails.transactionId
              ? `Ref / Txn ID: ${data.paymentDetails.transactionId}`
              : null,
            data.paymentDetails.paidAt
              ? `Date: ${this.formatDate(data.paymentDetails.paidAt)}`
              : null,
          ]
            .filter(Boolean)
            .join('  |  ');

          doc
            .fontSize(8.5)
            .font('Helvetica')
            .fillColor('#166534')
            .text(payText || 'Payment settled in full', pageMargin + 12, y + 22);

          y += 50;
        }

        // 7. Notes and Terms (Left aligned)
        if (data.notes || data.terms) {
          y += 10;
          if (data.notes) {
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#64748B').text('Notes:');
            doc.font('Helvetica').fillColor('#334155').text(data.notes, { width: contentWidth - 200 });
            y = doc.y + 6;
          }
          if (data.terms) {
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#64748B').text('Terms & Conditions:');
            doc.font('Helvetica').fillColor('#334155').text(data.terms, { width: contentWidth - 200 });
            y = doc.y + 6;
          }
        }

        // 8. Footer (Fixed at bottom)
        const footerY = 780;
        doc
          .save()
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .moveTo(pageMargin, footerY)
          .lineTo(pageMargin + contentWidth, footerY)
          .stroke()
          .restore();

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#94A3B8')
          .text(
            'Thank you for your business! This is a system-generated document and requires no physical signature.',
            pageMargin,
            footerY + 10,
            { align: 'center', width: contentWidth },
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generates a PDF buffer for an Official Payment Receipt
   */
  async generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Payment Receipt ${data.receiptNumber}`,
            Author: data.payee.name || 'MessMeals',
            Subject: data.documentTitle || 'Payment Receipt',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const pageWidth = 595.28;
        const pageMargin = 40;
        const contentWidth = pageWidth - pageMargin * 2;

        // 1. Top Decorative Green Accent Bar
        doc
          .save()
          .rect(pageMargin, pageMargin, contentWidth, 5)
          .fill('#10B981') // Green for completed payment
          .restore();

        let y = pageMargin + 20;

        // Header Title
        doc
          .fillColor('#0F172A')
          .fontSize(20)
          .font('Helvetica-Bold')
          .text(data.payee.name, pageMargin, y);

        doc
          .fillColor('#059669')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(data.documentTitle || 'PAYMENT RECEIPT', pageMargin, y, {
            width: contentWidth,
            align: 'right',
          });

        y += 28;

        doc
          .fillColor('#64748B')
          .fontSize(10)
          .font('Helvetica')
          .text('Receipt No: ', pageMargin, y, { continued: true })
          .font('Helvetica-Bold')
          .fillColor('#1E293B')
          .text(data.receiptNumber);

        // Status Badge
        this.drawStatusBadge(doc, 'PAID', pageMargin + contentWidth - 90, y - 4, 'PAID');

        y += 25;

        // Divider
        doc
          .save()
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .moveTo(pageMargin, y)
          .lineTo(pageMargin + contentWidth, y)
          .stroke()
          .restore();

        y += 20;

        // 2. Main Amount Received Highlight Box
        doc
          .save()
          .roundedRect(pageMargin, y, contentWidth, 75, 8)
          .fill('#F0FDF4')
          .strokeColor('#86EFAC')
          .lineWidth(1.5)
          .stroke()
          .restore();

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#166534')
          .text('AMOUNT RECEIVED IN FULL', pageMargin, y + 16, {
            width: contentWidth,
            align: 'center',
          });

        doc
          .fontSize(24)
          .font('Helvetica-Bold')
          .fillColor('#059669')
          .text(this.formatCurrency(data.amountPaid), pageMargin, y + 36, {
            width: contentWidth,
            align: 'center',
          });

        y += 95;

        // 3. Two-Column Details (Received From vs Received By)
        const colWidth = (contentWidth - 20) / 2;
        const col1X = pageMargin;
        const col2X = pageMargin + colWidth + 20;
        const detailsStartY = y;

        // Column 1: Received From (Payer)
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#64748B')
          .text('RECEIVED FROM (PAYER)', col1X, y);

        y += 14;
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#0F172A')
          .text(data.payer.name, col1X, y);

        y += 14;
        doc.fontSize(9).font('Helvetica').fillColor('#334155');
        if (data.payer.phone) {
          doc.text(`Phone: ${data.payer.phone}`, col1X, y);
          y = doc.y + 3;
        }
        if (data.payer.email) {
          doc.text(`Email: ${data.payer.email}`, col1X, y);
          y = doc.y + 3;
        }
        if (data.payer.address) {
          doc.text(`Address: ${data.payer.address}`, col1X, y, { width: colWidth });
          y = doc.y + 3;
        }

        const col1EndY = y;

        // Column 2: Payment Metadata
        y = detailsStartY;
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#64748B')
          .text('PAYMENT DETAILS', col2X, y);

        y += 14;
        const printDetail = (label: string, value: string) => {
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#475569')
            .text(`${label}: `, col2X, y, { continued: true })
            .font('Helvetica')
            .fillColor('#0F172A')
            .text(value);
          y += 14;
        };

        printDetail('Payment Date', this.formatDate(data.paymentDate));
        printDetail('Payment Method', data.paymentMethod || 'Online / Razorpay');
        if (data.transactionId) {
          printDetail('Transaction ID', data.transactionId);
        }
        if (data.invoiceReference) {
          printDetail('Invoice Ref', data.invoiceReference);
        }
        if (data.subscriptionReference) {
          printDetail('Subscription Ref', data.subscriptionReference);
        }

        y = Math.max(col1EndY, y) + 20;

        // 4. Payment Purpose / Description Card
        doc
          .save()
          .rect(pageMargin, y, contentWidth, 48)
          .fill('#F8FAFC')
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .stroke()
          .restore();

        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#475569')
          .text('FOR / PURPOSE', pageMargin + 12, y + 10);

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#0F172A')
          .text(data.forDescription, pageMargin + 12, y + 24, {
            width: contentWidth - 24,
          });

        y += 65;

        // 5. Notes
        if (data.notes) {
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#64748B').text('Notes:');
          doc.font('Helvetica').fillColor('#334155').text(data.notes, { width: contentWidth });
          y = doc.y + 10;
        }

        // 6. Verification / Stamp Badge
        y += 20;
        doc
          .save()
          .roundedRect(pageMargin + contentWidth - 180, y, 180, 50, 4)
          .strokeColor('#059669')
          .lineWidth(1)
          .dash(3, { space: 3 })
          .stroke()
          .restore();

        doc
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor('#059669')
          .text('VERIFIED PAYMENT', pageMargin + contentWidth - 180, y + 12, {
            width: 180,
            align: 'center',
          });

        doc
          .fontSize(7.5)
          .font('Helvetica')
          .fillColor('#047857')
          .text('Electronic Confirmation via MessMeals', pageMargin + contentWidth - 180, y + 26, {
            width: 180,
            align: 'center',
          });

        // 7. Footer
        const footerY = 780;
        doc
          .save()
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .moveTo(pageMargin, footerY)
          .lineTo(pageMargin + contentWidth, footerY)
          .stroke()
          .restore();

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#94A3B8')
          .text(
            'This official receipt acknowledges receipt of payment. Thank you for your patronage!',
            pageMargin,
            footerY + 10,
            { align: 'center', width: contentWidth },
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}


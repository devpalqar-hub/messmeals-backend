# Frontend Integration Guide: Invoices & Receipts

This document provides complete instructions for frontend teams (Web, Admin Portal, and Mobile Apps) to integrate the **Invoice Creation**, **Receipt Generation**, and **PDF Export** features provided by the MessMeals backend.

---

## 1. Overview & Architectural Scope

The backend provides two primary financial workflows:

1. **Customer Meal Subscription Invoices & Receipts**
   - **Target Audience:** Customers (Mobile App / Web) and Mess Admins (Mess Management Portal).
   - **Scope:** Invoices for meal plans, schedule details, total prices, discounts, and payment receipts once settled.
2. **Mess Platform Billing Invoices & Receipts**
   - **Target Audience:** Mess Admins and SuperAdmins (SaaS Billing Portal).
   - **Scope:** Invoices issued by MessMeals Platform to Mess owners based on active subscriber counts and tier rates.
3. **Custom Invoice Generation**
   - **Target Audience:** Mess Admins / SuperAdmins creating one-off custom invoices with custom line items.

---

## 2. Authentication & Authorization

All endpoints require standard JWT Bearer Authentication passed in the HTTP header:

```http
Authorization: Bearer <access_token>
```

### Role-Based Access Matrix

| Endpoint Group | `USER` (Customer) | `MESSADMIN` | `SUPERADMIN` |
| :--- | :---: | :---: | :---: |
| **Subscription Invoice/Receipt** | Own Subscriptions only | Subscriptions for own Mess(es) | All |
| **Mess Platform Billing** | ❌ Forbidden | Own Mess(es) only | All |
| **Custom Invoice Creation** | ❌ Forbidden | Own Mess(es) | All |

---

## 3. API Reference

### 3.1 Customer Subscription Invoices & Receipts

#### A. Get Subscription Invoice Details (JSON)
Fetches structured JSON metadata suitable for rendering an in-app invoice view.

- **URL:** `GET /user-subscriptions/:id/invoice` *(or `GET /invoices/subscription/:id`)*
- **Param:** `:id` — Subscription UUID.
- **Success Response (200 OK):**
```json
{
  "success": true,
  "invoice": {
    "documentTitle": "TAX INVOICE",
    "invoiceNumber": "INV-SUB-37B15D84",
    "issueDate": "2026-11-01T07:15:20.000Z",
    "dueDate": "2026-11-01T07:15:20.000Z",
    "status": "PAID",
    "seller": {
      "name": "Malabar Kitchen & Mess",
      "address": "Near Infopark Phase 1, Kakkanad, Kochi, Kerala 682042",
      "phone": "9876543211",
      "email": "malabar.kitchen@messmeals.com"
    },
    "customer": {
      "name": "Arjun Menon",
      "phone": "9700000001",
      "email": "arjun.menon@example.com",
      "address": "Infopark Expressway, Kakkanad, Kochi, 682030, India"
    },
    "items": [
      {
        "description": "Executive Monthly Full Meals (Monthly Plan)",
        "details": "Validity: 2026-11-01 to 2026-12-01 | Meals Included: Breakfast, Lunch, Dinner | Schedule: EVERYDAY",
        "quantity": 1,
        "unitPrice": 4500,
        "amount": 4500
      }
    ],
    "subtotal": 4500,
    "discount": 300,
    "total": 4200,
    "amountPaid": 4200,
    "balanceDue": 0,
    "paymentDetails": {
      "paymentMethod": "Online (Razorpay / UPI)",
      "transactionId": "pay_O7w8xYz12345",
      "paidAt": "2026-11-01T07:16:00.000Z"
    },
    "notes": "Thank you for choosing our meal subscription service.",
    "terms": "Subscriptions are non-transferable."
  }
}
```

---

#### B. Download Subscription Invoice as PDF
Streams the formatted A4 Tax Invoice PDF.

- **URL:** `GET /user-subscriptions/:id/invoice/pdf` *(or `GET /invoices/subscription/:id/pdf`)*
- **Param:** `:id` — Subscription UUID.
- **Headers Returned:**
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="invoice-<id_short>.pdf"`
- **Response:** Raw Binary PDF Stream.

---

#### C. Get Subscription Payment Receipt Details (JSON)
Fetches payment receipt metadata for a settled or partially paid subscription.

- **URL:** `GET /user-subscriptions/:id/receipt` *(or `GET /invoices/subscription/:id/receipt`)*
- **Param:** `:id` — Subscription UUID.
- **Success Response (200 OK):**
```json
{
  "success": true,
  "receipt": {
    "documentTitle": "OFFICIAL PAYMENT RECEIPT",
    "receiptNumber": "REC-SUB-37B15D84",
    "paymentDate": "2026-11-01T07:16:00.000Z",
    "status": "PAID",
    "payee": {
      "name": "Malabar Kitchen & Mess",
      "address": "Near Infopark Phase 1, Kakkanad, Kochi, Kerala 682042",
      "phone": "9876543211",
      "email": "malabar.kitchen@messmeals.com"
    },
    "payer": {
      "name": "Arjun Menon",
      "phone": "9700000001",
      "email": "arjun.menon@example.com",
      "address": "Infopark Expressway, Kakkanad, Kochi, 682030"
    },
    "amountPaid": 4200,
    "paymentMethod": "Online / Razorpay",
    "transactionId": "pay_O7w8xYz12345",
    "invoiceReference": "INV-SUB-37B15D84",
    "subscriptionReference": "SUB-37B15D84",
    "forDescription": "Payment for Executive Monthly Full Meals (2026-11-01 to 2026-12-01)",
    "notes": "Thank you for your payment! Please retain this receipt for your records."
  }
}
```

---

#### D. Download Subscription Payment Receipt as PDF
Streams the verified Payment Receipt PDF.

- **URL:** `GET /user-subscriptions/:id/receipt/pdf` *(or `GET /invoices/subscription/:id/receipt/pdf`)*
- **Param:** `:id` — Subscription UUID.
- **Response:** Raw Binary PDF Stream (`application/pdf`).

---

#### E. Download Receipt by Direct Payment UUID
- **URL:** `GET /payments/:paymentId/receipt/pdf` *(or `GET /invoices/payment/:paymentId/receipt/pdf`)*
- **Param:** `:paymentId` — UUID of the `Payments` table record.
- **Response:** Raw Binary PDF Stream (`application/pdf`).

---

### 3.2 Mess Platform Billing (Platform ↔ Mess)

#### A. Download Mess Billing Invoice as PDF
- **URL:** `GET /billing/mess/:messId/invoice/pdf`
- **Query Params:**
  - `invoiceId` *(optional)* — Specific invoice UUID. If omitted, downloads the current / latest invoice.
- **Alternative URL:** `GET /billing/mess/:messId/invoice/:invoiceId/pdf`
- **Response:** Raw Binary PDF Stream (`application/pdf`).

#### B. Download Mess Billing Payment Receipt as PDF
Available once the invoice is marked `PAID`. Returns `400 Bad Request` if unsettled.

- **URL:** `GET /billing/mess/:messId/invoice/:invoiceId/receipt/pdf`
- **Response:** Raw Binary PDF Stream (`application/pdf`).

---

### 3.3 Custom Invoice Creation

- **URL:** `POST /invoices/create`
- **Headers:** `Content-Type: application/json`
- **Request Body (`CreateCustomInvoiceDto`):**
```json
{
  "messId": "2d9ba720-63cf-4c41-bdcd-6711986a0343",
  "customerProfileId": "1107255c-739a-4a0c-a8cc-d9137303f951",
  "title": "Catering & Special Event Meals",
  "description": "Special weekend catering service provided for corporate lunch",
  "periodStart": "2026-11-10",
  "periodEnd": "2026-11-10",
  "dueDate": "2026-11-15",
  "items": [
    {
      "description": "Special Kerala Sadhya (Buffet)",
      "details": "Includes 24 items + Payasam for 30 persons",
      "quantity": 30,
      "unitPrice": 250,
      "amount": 7500
    },
    {
      "description": "Transportation & Eco Packaging",
      "quantity": 1,
      "unitPrice": 500,
      "amount": 500
    }
  ],
  "discount": 500,
  "tax": 0,
  "amountPaid": 7500,
  "paymentMethod": "UPI / Bank Transfer",
  "transactionId": "UPI/20261110/987654"
}
```
- **Response (201 Created):**
```json
{
  "message": "Custom invoice generated successfully",
  "invoice": { ... },
  "pdfBase64": "JVBERi0xLjMKJcfs..."
}
```

---

## 4. Frontend Data Models (TypeScript)

Copy these interfaces into your frontend project (e.g. `src/types/invoice.ts`):

```typescript
export type InvoiceStatus = 'PAID' | 'UNPAID' | 'OVERDUE' | 'PENDING' | 'CANCELLED';

export interface InvoiceLineItem {
  description: string;
  details?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoicePartyDetails {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
}

export interface InvoiceDetails {
  documentTitle?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  status: InvoiceStatus;
  seller: InvoicePartyDetails;
  customer: InvoicePartyDetails;
  items: InvoiceLineItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  paymentDetails?: {
    paymentMethod?: string | null;
    transactionId?: string | null;
    paidAt?: string | null;
  };
  notes?: string;
  terms?: string;
}

export interface PaymentReceiptDetails {
  documentTitle?: string;
  receiptNumber: string;
  paymentDate: string;
  status: 'PAID' | 'SUCCESS';
  payee: InvoicePartyDetails;
  payer: InvoicePartyDetails;
  amountPaid: number;
  paymentMethod: string;
  transactionId?: string | null;
  invoiceReference?: string | null;
  subscriptionReference?: string | null;
  forDescription: string;
  notes?: string;
}
```

---

## 5. Web Frontend Implementation Examples (React / Next.js)

### 5.1 API Client Setup with Axios

> [!IMPORTANT]
> When requesting PDF binary endpoints, you **must** specify `responseType: 'blob'`. Without this, Axios parses the binary PDF stream as UTF-8 text, corrupting the PDF file.

```typescript
// src/api/invoices.ts
import axios from 'axios';
import { InvoiceDetails, PaymentReceiptDetails } from '../types/invoice';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
});

// Attach Authorization Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const invoiceApi = {
  // 1. Fetch JSON details
  getSubscriptionInvoice: async (subscriptionId: string): Promise<InvoiceDetails> => {
    const res = await api.get(`/user-subscriptions/${subscriptionId}/invoice`);
    return res.data.invoice;
  },

  getSubscriptionReceipt: async (subscriptionId: string): Promise<PaymentReceiptDetails> => {
    const res = await api.get(`/user-subscriptions/${subscriptionId}/receipt`);
    return res.data.receipt;
  },

  // 2. Fetch PDF as Blob
  downloadSubscriptionInvoicePdf: async (subscriptionId: string): Promise<Blob> => {
    const res = await api.get(`/user-subscriptions/${subscriptionId}/invoice/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },

  downloadSubscriptionReceiptPdf: async (subscriptionId: string): Promise<Blob> => {
    const res = await api.get(`/user-subscriptions/${subscriptionId}/receipt/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },

  downloadMessInvoicePdf: async (messId: string, invoiceId?: string): Promise<Blob> => {
    const res = await api.get(`/billing/mess/${messId}/invoice/pdf`, {
      params: { invoiceId },
      responseType: 'blob',
    });
    return res.data;
  },

  downloadMessReceiptPdf: async (messId: string, invoiceId: string): Promise<Blob> => {
    const res = await api.get(`/billing/mess/${messId}/invoice/${invoiceId}/receipt/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },
};
```

---

### 5.2 Helper: In-Browser Preview & Direct File Download

```typescript
// src/utils/fileDownloader.ts

/**
 * Directly downloads the PDF blob to user's device
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Opens the PDF blob in a new browser tab for preview/printing
 */
export function openPdfInNewTab(blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Revoke after preview window opens
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}
```

---

### 5.3 React UI Component Example

```tsx
// src/components/SubscriptionInvoiceCard.tsx
import React, { useState } from 'react';
import { invoiceApi } from '../api/invoices';
import { triggerFileDownload, openPdfInNewTab } from '../utils/fileDownloader';

interface Props {
  subscriptionId: string;
  planName: string;
  isPaid: boolean;
}

export const SubscriptionInvoiceCard: React.FC<Props> = ({
  subscriptionId,
  planName,
  isPaid,
}) => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownloadInvoice = async (preview = false) => {
    try {
      setDownloading('invoice');
      const blob = await invoiceApi.downloadSubscriptionInvoicePdf(subscriptionId);
      if (preview) {
        openPdfInNewTab(blob);
      } else {
        triggerFileDownload(blob, `Invoice-${subscriptionId.slice(0, 8)}.pdf`);
      }
    } catch (err) {
      alert('Failed to download invoice. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadReceipt = async () => {
    try {
      setDownloading('receipt');
      const blob = await invoiceApi.downloadSubscriptionReceiptPdf(subscriptionId);
      triggerFileDownload(blob, `Receipt-${subscriptionId.slice(0, 8)}.pdf`);
    } catch (err) {
      alert('Receipt unavailable or payment pending.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-800">{planName}</h4>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {isPaid ? 'PAID' : 'PAYMENT PENDING'}
        </span>
      </div>

      <div className="flex gap-2 mt-2">
        {/* Invoice Action Buttons */}
        <button
          onClick={() => handleDownloadInvoice(false)}
          disabled={downloading !== null}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {downloading === 'invoice' ? 'Generating...' : 'Download Invoice (PDF)'}
        </button>

        <button
          onClick={() => handleDownloadInvoice(true)}
          disabled={downloading !== null}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Preview Invoice
        </button>

        {/* Receipt Action Button (Shown when paid) */}
        {isPaid && (
          <button
            onClick={handleDownloadReceipt}
            disabled={downloading !== null}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {downloading === 'receipt' ? 'Generating...' : 'Payment Receipt (PDF)'}
          </button>
        )}
      </div>
    </div>
  );
};
```

---

## 6. Mobile Apps Implementation (React Native / Expo)

In mobile environments, use `FileSystem` and `Sharing` (or `rn-fetch-blob`):

```typescript
// Expo React Native Example
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function downloadPdfOnMobile(endpointUrl: string, token: string, filename: string) {
  const localUri = `${FileSystem.documentDirectory}${filename}`;

  const downloadRes = await FileSystem.downloadAsync(
    endpointUrl,
    localUri,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloadRes.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'View or Share PDF',
    });
  }
}
```

---

## 7. Status Badges & UI Styling Reference

Use consistent badge colors aligned with backend status definitions:

| Status | Badge Background | Text Color | Meaning |
| :--- | :--- | :--- | :--- |
| **`PAID` / `SUCCESS`** | `#DCFCE7` (Light Green) | `#15803D` (Dark Green) | Fully settled, zero balance due |
| **`PENDING`** | `#FEF3C7` (Light Amber) | `#B45309` (Dark Amber) | Partially paid or awaiting gateway settlement |
| **`UNPAID`** | `#F1F5F9` (Light Slate) | `#475569` (Dark Slate) | Fresh invoice issued, not yet paid |
| **`OVERDUE`** | `#FEE2E2` (Light Red) | `#B91C1C` (Dark Red) | Past due date, action required |

---

## 8. Summary Checklist for Frontend Integration

- [ ] Add `responseType: 'blob'` on all PDF download requests.
- [ ] Provide two distinct actions where applicable: **Download PDF** and **Print/Preview**.
- [ ] Render the **Payment Receipt** button after a successful checkout / registration screen.
- [ ] Display the invoice line items and schedule details using the JSON endpoint for quick mobile cards before triggering full PDF downloads.
- [ ] Handle `400 Bad Request` gracefully when a user attempts to download a receipt for an unpaid invoice (display "Receipt available after payment completion").


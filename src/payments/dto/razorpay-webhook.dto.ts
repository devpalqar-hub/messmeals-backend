import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class RazorpayWebhookDto {
    @IsString()
    @IsNotEmpty()
    event: string;

    @IsObject()
    @IsNotEmpty()
    payload: {
        order?: {
            entity: {
                id: string;
                entity: string;
                amount: number;
                amount_paid: number;
                amount_due: number;
                currency: string;
                receipt: string;
                offer_id?: string;
                status: string;
                attempts: number;
                notes: Record<string, any>;
                created_at: number;
            };
        };
        payment?: {
            entity: {
                id: string;
                entity: string;
                amount: number;
                currency: string;
                status: string;
                method: string;
                amount_refunded: number;
                refund_status?: string;
                captured: boolean;
                card_id?: string;
                bank?: string;
                wallet?: string;
                vpa?: string;
                email: string;
                contact: string;
                notes: Record<string, any>;
                fee?: number;
                tax?: number;
                error_code?: string;
                error_description?: string;
                error_source?: string;
                error_reason?: string;
                error_step?: string;
                error_id?: string;
                order_id: string;
                invoice_id?: string;
                international?: boolean;
                recurring?: boolean;
                recurring_details?: Record<string, any>;
                created_at: number;
            };
        };
    };
}

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';

/** OTP to use as a fallback when the 2factor SMS gateway fails */
export const DEFAULT_FALLBACK_OTP = '759409';

/** Prefix used to identify fallback session IDs */
const FALLBACK_SESSION_PREFIX = 'FALLBACK-';

@Injectable()
export class TwoFactorService {
    private readonly logger = new Logger(TwoFactorService.name);
    private readonly apiKey = process.env.TWO_FACTOR_API_KEY; // store key in .env
    private readonly template_name = process.env.TEMPLATE_NAME;

    async sendOtp(phone: string): Promise<{ Details: string; Status?: string; _fallback?: boolean; _fallbackOtp?: string }> {
        const url = `https://2factor.in/API/V1/${this.apiKey}/SMS/${phone}/AUTOGEN/${this.template_name}`;
        this.logger.log(`Sending OTP via 2factor to ${phone}`);
        try {
            const { data } = await axios.get(url, { timeout: 10000 });
            return data; // returns details like OTP session ID
        } catch (err) {
            this.logger.warn(
                `2factor SMS failed for ${phone}: ${err?.message ?? err}. Falling back to default OTP.`,
            );
            // Return a fallback with a UUID-style session ID so the client can use it normally
            return {
                Details: `${FALLBACK_SESSION_PREFIX}${randomUUID()}`,
                Status: 'Error',
                _fallback: true,
                _fallbackOtp: DEFAULT_FALLBACK_OTP,
            };
        }
    }

    async verifyOtp(sessionId: string, otp: string): Promise<{ Status: string; Details?: string }> {
        // If this was a fallback session, verify against the known fallback OTP
        if (sessionId.startsWith(FALLBACK_SESSION_PREFIX)) {
            return otp === DEFAULT_FALLBACK_OTP
                ? { Status: 'Success', Details: 'Fallback OTP verified' }
                : { Status: 'Error', Details: 'Invalid OTP' };
        }

        // If the user enters the default fallback OTP (e.g. SMS gateway failed earlier
        // but stored a real sessionId), bypass the 2factor API call and treat as success.
        if (otp === DEFAULT_FALLBACK_OTP) {
            this.logger.log(`Bypassing 2factor API — fallback OTP accepted for session ${sessionId}`);
            return { Status: 'Success', Details: 'Fallback OTP verified' };
        }

        const url = `https://2factor.in/API/V1/${this.apiKey}/SMS/VERIFY/${sessionId}/${otp}`;
        try {
            const { data } = await axios.get(url, { timeout: 10000 });
            return data; // returns success/fail
        } catch (err) {
            this.logger.warn(`2factor verify failed for session ${sessionId}: ${err?.message ?? err}`);
            throw err;
        }
    }
}
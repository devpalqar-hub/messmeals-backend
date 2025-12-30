import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TwoFactorService {
    private readonly apiKey = process.env.TWO_FACTOR_API_KEY; // store key in .env
    private readonly template_name = process.env.TEMPLATE_NAME;
    async sendOtp(phone: string) {
        const url = `https://2factor.in/API/V1/${this.apiKey}/SMS/${phone}/AUTOGEN3/MESSMEALS+OTP`;
        console.log(url)
        const { data } = await axios.get(url);
        return data;  // returns details like OTP session ID
    }

    async verifyOtp(sessionId: string, otp: string) {
        const url = `https://2factor.in/API/V1/${this.apiKey}/SMS/VERIFY/${sessionId}/${otp}`;

        const { data } = await axios.get(url);
        return data;  // returns success/fail
    }
}
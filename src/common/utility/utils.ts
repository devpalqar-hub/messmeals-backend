import { randomBytes } from 'crypto';

export function generateOrderNumber(prefix = 'ORD'): string {
  // Current timestamp in YYYYMMDDHHMMSS format
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  // Random 4-character string (hex)
  const randomStr = randomBytes(2).toString('hex').toUpperCase();

  // Final order number
  return `${prefix}-${timestamp}-${randomStr}`;
}

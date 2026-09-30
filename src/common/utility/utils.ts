import { randomBytes, randomInt } from 'crypto';

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

// utils/otp.util.ts
export function generate6DigitOtp(): string {
  // Generates a random integer between 100000 and 999999
  return Math.floor(100000 + Math.random() * 900000).toString();
}


// Alphabet without look-alike characters (0/O, 1/l/I) so a generated password survives being read out or retyped.
const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PASSWORD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PASSWORD_DIGITS = '23456789';

/**
 * Cryptographically random password of `length` characters, always containing at least
 * one upper-case letter, one lower-case letter and one digit.
 */
export function generateRandomPassword(length = 10): string {
  const pick = (chars: string) => chars[randomInt(chars.length)];
  const all = PASSWORD_UPPER + PASSWORD_LOWER + PASSWORD_DIGITS;

  const chars = [pick(PASSWORD_UPPER), pick(PASSWORD_LOWER), pick(PASSWORD_DIGITS)];
  while (chars.length < length) chars.push(pick(all));

  // Fisher–Yates shuffle so the guaranteed characters aren't always at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

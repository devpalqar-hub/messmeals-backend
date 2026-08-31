// src/common/utility/identity.util.ts
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Phone/email uniqueness now spans two tables — the staff/admin `User` table
 * (MESSADMIN/SUPERADMIN/DELIVERYAGENT) and the customer `Customer` table — since MySQL
 * can't express a `@unique` constraint across two tables. This preserves the guarantee
 * that used to come for free from `User.phone`/`User.email` being globally unique: one
 * phone/email can only ever belong to one account, regardless of role.
 *
 * Pass `excludeUserId`/`excludeCustomerId` when checking during an *update* (so the
 * record being updated doesn't collide with itself).
 */
export async function isPhoneOrEmailTaken(
  prisma: PrismaService,
  params: {
    phone?: string | null;
    email?: string | null;
    excludeUserId?: string;
    excludeCustomerId?: string;
  },
): Promise<boolean> {
  const { phone, email, excludeUserId, excludeCustomerId } = params;

  const orConditions: any[] = [];
  if (phone) orConditions.push({ phone });
  if (email) orConditions.push({ email });

  if (orConditions.length === 0) return false;

  const [userHit, customerHit] = await Promise.all([
    prisma.user.findFirst({
      where: {
        OR: orConditions,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true },
    }),
    prisma.customer.findFirst({
      where: {
        OR: orConditions,
        ...(excludeCustomerId ? { NOT: { id: excludeCustomerId } } : {}),
      },
      select: { id: true },
    }),
  ]);

  return !!(userHit || customerHit);
}

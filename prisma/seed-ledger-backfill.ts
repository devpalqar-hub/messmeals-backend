// One-off migration: backfill CustomerMessTransaction ledger rows for subscriptions
// created before the ledger existed. For each UserSubscriptions row with no ledger
// entry yet, this records:
//   - one DEBIT for the subscription's charge amount (what should have been billed)
//   - one CREDIT for whatever the legacy wallet Transaction history shows was actually
//     paid toward that subscription (0 if no matching legacy record exists, leaving it
//     as real outstanding debt rather than guessing)
//
// Idempotent: subscriptions that already have a ledger row are skipped, so re-running
// this script is always safe.
//
// Usage: npm run seed:ledger-backfill

import { LedgerEntryReason, LedgerEntryType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Running (DEBIT - CREDIT) balance for a (customer, mess) pair, as of a point in time. */
async function balanceAsOf(
  customerProfileId: string,
  messId: string,
  asOf: Date,
): Promise<number> {
  const totals = await prisma.customerMessTransaction.groupBy({
    by: ['type'],
    where: { customerProfileId, messId, createdAt: { lte: asOf } },
    _sum: { amount: true },
  });
  const debit = Number(
    totals.find((t) => t.type === LedgerEntryType.DEBIT)?._sum.amount ?? 0,
  );
  const credit = Number(
    totals.find((t) => t.type === LedgerEntryType.CREDIT)?._sum.amount ?? 0,
  );
  return debit - credit;
}

async function main() {
  console.log('🌱 Ledger backfill started...');

  const subscriptions = await prisma.userSubscriptions.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      customerProfileId: true,
      messId: true,
      totalPrice: true,
      discountedPrice: true,
      createdAt: true,
      plan: { select: { isMonthlyPlan: true } },
    },
  });

  // Cache legacy wallet transactions per customerProfileId so a customer with several
  // subscriptions doesn't re-query their wallet history for each one.
  const legacyTxnCache = new Map<
    string,
    { amount: unknown; meta: unknown }[]
  >();

  async function legacyTransactionsFor(customerProfileId: string) {
    const cached = legacyTxnCache.get(customerProfileId);
    if (cached) return cached;

    const wallet = await prisma.wallet.findUnique({
      where: { userId: customerProfileId },
    });
    const txns = wallet
      ? await prisma.transaction.findMany({
          where: { walletId: wallet.id },
          select: { amount: true, meta: true },
        })
      : [];
    legacyTxnCache.set(customerProfileId, txns);
    return txns;
  }

  let processed = 0;
  let skippedExisting = 0;
  let skippedZeroAmount = 0;
  let totalDebitBackfilled = 0;
  let totalCreditBackfilled = 0;

  for (const sub of subscriptions) {
    if (!sub.customerProfileId) {
      skippedZeroAmount++;
      continue;
    }

    const existing = await prisma.customerMessTransaction.findFirst({
      where: { subscriptionId: sub.id },
      select: { id: true },
    });
    if (existing) {
      skippedExisting++;
      continue;
    }

    const debitAmount = Number(sub.discountedPrice || sub.totalPrice || 0);
    if (debitAmount <= 0) {
      skippedZeroAmount++;
      continue;
    }

    const currentBalance = await balanceAsOf(
      sub.customerProfileId,
      sub.messId,
      sub.createdAt,
    );
    const balanceAfterDebit = currentBalance + debitAmount;

    await prisma.customerMessTransaction.create({
      data: {
        customerProfileId: sub.customerProfileId,
        messId: sub.messId,
        subscriptionId: sub.id,
        type: LedgerEntryType.DEBIT,
        reason: sub.plan?.isMonthlyPlan
          ? LedgerEntryReason.MONTHLY_PLAN_CHARGE
          : LedgerEntryReason.MANUAL_ADJUSTMENT,
        amount: debitAmount,
        balanceAfter: balanceAfterDebit,
        note: sub.plan?.isMonthlyPlan
          ? 'Backfilled from legacy data (pre-ledger subscription)'
          : 'Backfilled from legacy data (pre-ledger daily-plan subscription, lump sum)',
        createdAt: sub.createdAt,
      },
    });
    totalDebitBackfilled += debitAmount;

    // Sum whatever the legacy wallet Transaction history shows was actually paid
    // toward this specific subscription (createWalletTransaction always wrote
    // { note, subscriptionId } into `meta`; a payment is a negative wallet amount).
    const legacyTxns = await legacyTransactionsFor(sub.customerProfileId);
    const creditAmount = legacyTxns.reduce((sum, t) => {
      const meta = t.meta as { subscriptionId?: string } | null;
      if (meta?.subscriptionId !== sub.id) return sum;
      const amount = Number(t.amount);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);

    if (creditAmount > 0) {
      await prisma.customerMessTransaction.create({
        data: {
          customerProfileId: sub.customerProfileId,
          messId: sub.messId,
          subscriptionId: sub.id,
          type: LedgerEntryType.CREDIT,
          reason: LedgerEntryReason.PAYMENT_RECEIVED,
          amount: creditAmount,
          balanceAfter: balanceAfterDebit - creditAmount,
          note: 'Backfilled from legacy wallet transaction history',
          createdAt: sub.createdAt,
        },
      });
      totalCreditBackfilled += creditAmount;
    }

    processed++;
    console.log(
      `  [${processed}] subscription ${sub.id}: DEBIT ₹${debitAmount}${
        creditAmount > 0 ? `, CREDIT ₹${creditAmount}` : ''
      }`,
    );
  }

  console.log('✅ Ledger backfill completed');
  console.log(
    `   processed=${processed} skippedExisting=${skippedExisting} skippedZeroAmount=${skippedZeroAmount}`,
  );
  console.log(
    `   totalDebitBackfilled=₹${totalDebitBackfilled} totalCreditBackfilled=₹${totalCreditBackfilled}`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Ledger backfill failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

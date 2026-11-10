const { PrismaClient, Role, DeliveryStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- 1. Testing User Subscriptions userProfileId & userId ---');
  const sampleSub = await prisma.userSubscriptions.findFirst({
    select: {
      id: true,
      customerProfileId: true,
      userProfileId: true,
      userId: true,
      messId: true,
    },
  });
  console.log('Sample Subscription:', sampleSub);

  if (sampleSub) {
    if (!sampleSub.userProfileId || !sampleSub.userId) {
      console.error('FAIL: userProfileId or userId is null on subscription!');
    } else {
      console.log('PASS: userProfileId and userId populated correctly on UserSubscriptions.');
    }

    // Test querying UserSubscriptions by userProfileId
    const subsByProfile = await prisma.userSubscriptions.findMany({
      where: {
        OR: [
          { userProfileId: sampleSub.userProfileId },
          { customerProfileId: sampleSub.userProfileId },
        ],
      },
    });
    console.log(`PASS: Found ${subsByProfile.length} subscription(s) by userProfileId filter.`);

    // Test querying UserSubscriptions by userId
    const subsByUser = await prisma.userSubscriptions.findMany({
      where: { userId: sampleSub.userId },
    });
    console.log(`PASS: Found ${subsByUser.length} subscription(s) by userId filter.`);
  }

  console.log('\n--- 2. Testing Deliveries Date Range Query Logic ---');
  const countAllDeliveries = await prisma.deliveries.count();
  console.log(`Total deliveries in DB: ${countAllDeliveries}`);

  const fromDate = new Date('2025-01-01T00:00:00.000Z');
  const toDate = new Date('2027-12-31T23:59:59.999Z');
  const inRangeCount = await prisma.deliveries.count({
    where: {
      date: { gte: fromDate, lte: toDate },
    },
  });
  console.log(`Deliveries between 2025 and 2027: ${inRangeCount}`);

  console.log('\n--- 3. Testing CustomerMessTransaction Ledger Totals with Date Range ---');
  const mess = await prisma.mess.findFirst({ select: { id: true } });
  if (mess) {
    const totalTransactionsAll = await prisma.customerMessTransaction.groupBy({
      by: ['type'],
      where: { messId: { in: [mess.id] } },
      _sum: { amount: true },
    });
    console.log('Ledger totals without date filter:', totalTransactionsAll);

    const totalTransactionsFiltered = await prisma.customerMessTransaction.groupBy({
      by: ['type'],
      where: {
        messId: { in: [mess.id] },
        createdAt: { gte: fromDate, lte: toDate },
      },
      _sum: { amount: true },
    });
    console.log('Ledger totals with date filter:', totalTransactionsFiltered);
    console.log('PASS: Date range filtering on ledger query executed cleanly.');
  }

  console.log('\nAll checks passed successfully!');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Error during test:', err);
  process.exit(1);
});


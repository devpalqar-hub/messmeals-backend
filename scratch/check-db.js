const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const subs = await prisma.userSubscriptions.findMany({
    select: { id: true, customerProfileId: true, userProfileId: true, userId: true },
  });
  console.log('Current subscriptions in DB:', subs);
  await prisma.$disconnect();
}

check().catch(console.error);


import { PrismaClient } from '@prisma/client';
import { seedMessData } from './seed-mess';

const prisma = new PrismaClient();

async function main() {
    await seedMessData();
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

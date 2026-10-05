import { PrismaClient, DeliveryStatus, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding started...');

    // -------------------------------

    const messAdminUser = await prisma.user.create({
        data: {
            name: 'Suresh Mess Admin',
            phone: '9895728129',
            email: 'admin@messmeals.com',
            password: "DevPalqar@2026",
            role: Role.SUPERADMIN,
            is_verified: true,
        },
    });

    console.log('✅ Seeding completed successfully');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

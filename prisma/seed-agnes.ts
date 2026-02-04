import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1️⃣ District
    const district = await prisma.district.create({
        data: {
            name: 'Test District',
            image: 'district.jpg',
        },
    });

    // 2️⃣ Mess
    const mess = await prisma.mess.create({
        data: {
            name: 'Annapurna Mess',
            email: 'mess@test.com',
            phone: '9999999995',
            is_active: true,
            is_verified: true,
            districtId: district.id,
        },
    });

    // 3️⃣ Mess Admin
    const adminUser = await prisma.user.create({
        data: {
            name: 'Mess Admin',
            phone: '8888888188',
            email: 'admin@mess.com',
            role: Role.MESSADMIN,
            is_verified: true,
            messAdminProfile: {
                create: {
                    messes: {
                        connect: { id: mess.id },
                    },
                },
            },
        },
    });

    // 4️⃣ Plans
    const plan1 = await prisma.plans.create({
        data: {
            planName: 'Monthly Veg',
            price: 3000,
            messId: mess.id,
            isMonthlyPlan: true,
        },
    });

    const plan2 = await prisma.plans.create({
        data: {
            planName: 'Daily Meal',
            price: 120,
            messId: mess.id,
        },
    });

    // 5️⃣ Customers + Subscriptions
    for (let i = 1; i <= 5; i++) {
        const user = await prisma.user.create({
            data: {
                name: `Customer ${i}`,
                phone: `700001000${i}`,
                email: `customer${i}@test.com`,
                role: Role.USER,
                is_verified: true,
                customerProfile: {
                    create: {},
                },
            },
            include: { customerProfile: true },
        });

        await prisma.userSubscriptions.create({
            data: {
                start_date: new Date(),
                totalPrice: 3000,
                discountedPrice: 2800,
                is_active: i % 2 === 0,
                messId: mess.id,
                planId: plan1.id,
                customerProfileId: user.customerProfile!.id,
            },
        });
    }

    // 6️⃣ Delivery Partners
    for (let i = 1; i <= 2; i++) {
        await prisma.user.create({
            data: {
                name: `Delivery Agent ${i}`,
                phone: `604000000${i}`,
                email: `agent${i}@test.com`,
                role: Role.DELIVERYAGENT,
                is_active: i === 1,
                deliveryPartnerProfile: {
                    create: {
                        messId: mess.id,
                        deliveryRegion: 'Central',
                    },
                },
            },
        });
    }

    console.log('✅ Seed data inserted successfully');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

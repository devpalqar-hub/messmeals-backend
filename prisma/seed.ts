import { PrismaClient, DeliveryStatus, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding started...');

    // -------------------------------
    // 1️⃣ Create Mess
    // -------------------------------
    const mess = await prisma.mess.create({
        data: {
            name: 'Test Mess',
            description: 'Mess for delivery stats testing',
            phone: '9999999999',
            email: 'testmess@mail.com',
            is_verified: true,
        },
    });

    // -------------------------------
    // 2️⃣ Create Variations
    // -------------------------------
    const [breakfast, lunch, dinner] = await Promise.all([
        prisma.variation.create({ data: { title: 'Breakfast' } }),
        prisma.variation.create({ data: { title: 'Lunch' } }),
        prisma.variation.create({ data: { title: 'Dinner' } }),
    ]);

    // -------------------------------
    // 3️⃣ Create Plans (linked to variations)
    // -------------------------------
    const breakfastPlan = await prisma.plans.create({
        data: {
            planName: 'Breakfast Plan',
            price: 50,
            messId: mess.id,
            Variation: {
                connect: [{ id: breakfast.id }],
            },
        },
    });

    const lunchPlan = await prisma.plans.create({
        data: {
            planName: 'Lunch Plan',
            price: 100,
            messId: mess.id,
            Variation: {
                connect: [{ id: lunch.id }],
            },
        },
    });

    const dinnerPlan = await prisma.plans.create({
        data: {
            planName: 'Dinner Plan',
            price: 120,
            messId: mess.id,
            Variation: {
                connect: [{ id: dinner.id }],
            },
        },
    });

    const plans = [breakfastPlan, lunchPlan, dinnerPlan];

    // -------------------------------
    // 4️⃣ Create Delivery Agent User
    // -------------------------------
    const deliveryUser = await prisma.user.create({
        data: {
            name: 'Delivery Agent',
            phone: '1234567890',
            email: 'delivery@test.com',
            role: Role.DELIVERYAGENT,
            is_verified: true,
            deliveryPartnerProfile: {
                create: {
                    messId: mess.id,
                    deliveryRegion: 'Test Area',
                },
            },
        },
        include: {
            deliveryPartnerProfile: true,
        },
    });

    // -------------------------------
    // 5️⃣ Create Customer
    // -------------------------------
    const customerUser = await prisma.user.create({
        data: {
            name: 'Test Customer',
            phone: '8888888888',
            email: 'customer@test.com',
            is_verified: true,
            customerProfile: {
                create: {},
            },
        },
        include: {
            customerProfile: true,
        },
    });

    // -------------------------------
    // 6️⃣ Create Subscription
    // -------------------------------
    const subscription = await prisma.userSubscriptions.create({
        data: {
            planId: lunchPlan.id,
            messId: mess.id,
            is_active: true,
            customerProfileId: customerUser.customerProfile!.id,
            deliveryPartnerProfileId: deliveryUser.deliveryPartnerProfile!.id,
            start_date: new Date(),
        },
    });

    // -------------------------------
    // 7️⃣ Create 50 Deliveries
    // -------------------------------
    const statuses = [
        DeliveryStatus.PENDING,
        DeliveryStatus.PROGRESS,
        DeliveryStatus.DELIVERED,
    ];

    const deliveriesData = Array.from({ length: 50 }).map((_, i) => {
        const randomDaysAgo = Math.floor(Math.random() * 30);
        const randomStatus =
            statuses[Math.floor(Math.random() * statuses.length)];
        const randomPlan = plans[Math.floor(Math.random() * plans.length)];

        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() - randomDaysAgo);

        return {
            date: deliveryDate,
            status: randomStatus,
            customerId: customerUser.customerProfile!.id,
            planId: randomPlan.id,
            messId: mess.id,
            partnerId: deliveryUser.deliveryPartnerProfile!.id,
            subscriptionId: subscription.id,
        };
    });

    await prisma.deliveries.createMany({
        data: deliveriesData,
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

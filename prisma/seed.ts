import { PrismaClient, Roles, DeliveryStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting full database seeding...');

    // 1️⃣ Create Roles and Users
    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin@mess.com' },
        update: {},
        create: {
            name: 'Super Admin',
            email: 'superadmin@mess.com',
            phone: '9999999999',
            is_verified: true,
            role: Roles.SUPERADMIN,
        },
    });

    const admin = await prisma.user.upsert({
        where: { email: 'admin@mess.com' },
        update: {},
        create: {
            name: 'Admin User',
            email: 'admin@mess.com',
            phone: '8888888888',
            is_verified: true,
            role: Roles.ADMIN,
        },
    });

    const deliveryAgent = await prisma.user.upsert({
        where: { email: 'agent@mess.com' },
        update: {},
        create: {
            name: 'Delivery Agent',
            email: 'agent@mess.com',
            phone: '7777777777',
            is_verified: true,
            role: Roles.DELIVERYAGENT,
        },
    });

    const customer = await prisma.user.upsert({
        where: { email: 'customer@mess.com' },
        update: {},
        create: {
            name: 'John Customer',
            email: 'customer@mess.com',
            phone: '6666666666',
            is_verified: true,
            role: Roles.USER,
        },
    });

    console.log('✅ Users created.');

    // 2️⃣ Create Profiles
    const customerProfile = await prisma.customerProfile.create({
        data: {
            address: '123 Main Street, Pune',
            current_location: 'Pune Station',
            latitude_logitude: '18.5204,73.8567',
            walletAmount: 200.0,
            userId: customer.id,
        },
    });

    const deliveryProfile = await prisma.deliveryPartnerProfile.create({
        data: {
            address: '45 Delivery Lane, Pune',
            deliveryCounts: 20,
            deliveryRegion: 'Pune East',
            userId: deliveryAgent.id,
        },
    });

    console.log('✅ Profiles created.');

    // 3️⃣ Create Variations
    const variations = await prisma.variation.createMany({
        data: [
            { title: 'Breakfast', description: 'Morning meal served 7–10 AM' },
            { title: 'Lunch', description: 'Midday meal served 12–2 PM' },
            { title: 'Dinner', description: 'Evening meal served 7–10 PM' },
        ],
        skipDuplicates: true,
    });

    console.log('✅ Variations created.');

    // 4️⃣ Create Plans
    const breakfastVar = await prisma.variation.findFirst({ where: { title: 'Breakfast' } });
    const lunchVar = await prisma.variation.findFirst({ where: { title: 'Lunch' } });
    const dinnerVar = await prisma.variation.findFirst({ where: { title: 'Dinner' } });

    const plan1 = await prisma.plans.create({
        data: {
            planName: 'Healthy Breakfast Plan',
            price: 80.0,
            minPrice: 60.0,
            description: 'Includes poha, upma, idli, and tea.',
            Variation: { connect: [{ id: breakfastVar?.id }] },
        },
    });

    const plan2 = await prisma.plans.create({
        data: {
            planName: 'Regular Lunch Plan',
            price: 120.0,
            minPrice: 100.0,
            description: 'Includes roti, rice, dal, and sabzi.',
            Variation: { connect: [{ id: lunchVar?.id }] },
        },
    });

    const plan3 = await prisma.plans.create({
        data: {
            planName: 'Special Dinner Plan',
            price: 150.0,
            minPrice: 130.0,
            description: 'Includes chapati, paneer curry, rice, and dessert.',
            Variation: { connect: [{ id: dinnerVar?.id }] },
        },
    });

    console.log('✅ Plans created.');

    // 5️⃣ Create Plan Images
    await prisma.planImages.createMany({
        data: [
            { planId: plan1.id, url: 'uploads/breakfast1.jpg', altText: 'Breakfast Meal' },
            { planId: plan2.id, url: 'uploads/lunch1.jpg', altText: 'Lunch Meal' },
            { planId: plan3.id, url: 'uploads/dinner1.jpg', altText: 'Dinner Meal' },
        ],
    });

    console.log('✅ Plan images added.');

    // 6️⃣ Create User Subscription
    const userSub = await prisma.userSubscriptions.create({
        data: {
            start_date: new Date(),
            end_date: new Date(new Date().setDate(new Date().getDate() + 30)),
            totalPrice: 3000.0,
            discount: 200.0,
            discountedPrice: 2800.0,
            deliveryPartnerProfileId: deliveryProfile.id,
            planId: plan2.id,
            customerProfileId: customerProfile.id,
        },
    });

    console.log('✅ User subscription created.');

    // 7️⃣ Create Deliveries
    await prisma.deliveries.createMany({
        data: [
            {
                date: new Date(),
                status: DeliveryStatus.PLACED,
                customerId: customerProfile.id,
                planId: plan2.id,
                partnerId: deliveryProfile.id,
            },
            {
                date: new Date(),
                status: DeliveryStatus.DISPATCHED,
                customerId: customerProfile.id,
                planId: plan2.id,
                partnerId: deliveryProfile.id,
            },
            {
                date: new Date(),
                status: DeliveryStatus.COMPLETED,
                customerId: customerProfile.id,
                planId: plan2.id,
                partnerId: deliveryProfile.id,
            },
        ],
    });

    console.log('✅ Deliveries created.');

    console.log('🎉 All seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

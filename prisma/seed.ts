import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
    // ------------------------------
    // USERS (10)
    // ------------------------------
    const users = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
            prisma.user.create({
                data: {
                    name: faker.person.fullName(),
                    phone: faker.number.int({ min: 6000000000, max: 9999999999 }).toString(),
                    email: faker.internet.email().toLowerCase(),
                    role: i < 3 ? 'DELIVERYAGENT' : i < 6 ? 'MESSADMIN' : 'USER',
                },
            })
        )
    );


    const deliveryAgents = users.filter((u) => u.role === 'DELIVERYAGENT');
    const messAdmins = users.filter((u) => u.role === 'MESSADMIN');
    const customers = users.filter((u) => u.role === 'USER');

    // ------------------------------
    // MESS (10)
    // ------------------------------
    const messes = await Promise.all(
        Array.from({ length: 10 }).map(() =>
            prisma.mess.create({
                data: {
                    name: faker.company.name(),
                    description: faker.lorem.sentence(),
                    address: faker.location.streetAddress(),
                    phone: faker.phone.number(),
                    email: faker.internet.email(),
                },
            })
        )
    );

    // ------------------------------
    // MESS ADMIN PROFILES
    // ------------------------------
    await Promise.all(
        messAdmins.map((admin, i) =>
            prisma.messAdminProfile.create({
                data: {
                    userId: admin.id,
                    messes: {
                        connect: [{ id: messes[i % messes.length].id }],
                    },
                },
            })
        )
    );

    // ------------------------------
    // DELIVERY PARTNER PROFILES
    // ------------------------------
    await Promise.all(
        deliveryAgents.map((agent, i) =>
            prisma.deliveryPartnerProfile.create({
                data: {
                    userId: agent.id,
                    messId: messes[i % messes.length].id,
                    deliveryCounts: faker.number.int({ min: 0, max: 200 }),
                    deliveryRegion: faker.location.city(),
                },
            })
        )
    );

    // ------------------------------
    // CUSTOMER PROFILES
    // ------------------------------
    const customerProfiles = await Promise.all(
        customers.map((cu) =>
            prisma.customerProfile.create({
                data: {
                    userId: cu.id,
                    address: faker.location.streetAddress(),
                    current_location: faker.location.city(),
                },
            })
        )
    );

    // ------------------------------
    // PLANS
    // ------------------------------
    const plans = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
            prisma.plans.create({
                data: {
                    planName: `Plan ${i + 1}`,
                    price: faker.number.float({ min: 100, max: 500 }),
                    messId: messes[i % messes.length].id,
                },
            })
        )
    );

    // ------------------------------
    // PLAN IMAGES
    // ------------------------------
    await Promise.all(
        plans.map((p) =>
            prisma.planImages.create({
                data: {
                    planId: p.id,
                    url: faker.image.url(),
                    altText: faker.lorem.words(3),
                },
            })
        )
    );

    // ------------------------------
    // VARIATIONS
    // ------------------------------
    await Promise.all(
        Array.from({ length: 10 }).map(() =>
            prisma.variation.create({
                data: {
                    title: faker.commerce.productName(),
                },
            })
        )
    );

    // ------------------------------
    // USER ADDRESS
    // ------------------------------
    const addresses = await Promise.all(
        customerProfiles.map((profile) =>
            prisma.userAddress.create({
                data: {
                    name: faker.person.fullName(),
                    street: faker.location.street(),
                    townOrcity: faker.location.city(),
                    postcode: faker.location.zipCode(),
                    phone: faker.phone.number(),
                    email: faker.internet.email(),
                    profileId: profile.id,
                },
            })
        )
    );

    // ------------------------------
    // USER SUBSCRIPTIONS
    // ------------------------------
    const subscriptions = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
            prisma.userSubscriptions.create({
                data: {
                    start_date: faker.date.past(),
                    scheduleType: 'EVERYDAY',
                    totalPrice: faker.number.float({ min: 200, max: 700 }),
                    discountedPrice: faker.number.float({ min: 100, max: 500 }),
                    planId: plans[i % plans.length].id,
                    messId: messes[i % messes.length].id,
                    customerProfileId: customerProfiles[i % customerProfiles.length].id,
                    userAddressId: addresses[i % addresses.length].id,
                },
            })
        )
    );

    // ------------------------------
    // DELIVERIES
    // ------------------------------
    const deliveryPartners = await prisma.deliveryPartnerProfile.findMany();

    await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
            prisma.deliveries.create({
                data: {
                    date: faker.date.recent(),
                    status: 'PENDING',
                    customerId: customerProfiles[i % customerProfiles.length].id,
                    planId: plans[i % plans.length].id,
                    messId: messes[i % messes.length].id,
                    partnerId: deliveryPartners[i % deliveryPartners.length]?.id,
                    subscriptionId: subscriptions[i % subscriptions.length]?.id,
                },
            })
        )
    );

    // ------------------------------
    // WALLET
    // ------------------------------
    const wallets = await Promise.all(
        customerProfiles.map((p) =>
            prisma.wallet.create({
                data: {
                    userId: p.id,
                    walletAmount: faker.number.float({ min: 100, max: 1000 }),
                },
            })
        )
    );

    // ------------------------------
    // TRANSACTIONS
    // ------------------------------
    await Promise.all(
        wallets.map((w) =>
            prisma.transaction.create({
                data: {
                    walletId: w.id,
                    amount: faker.number.float({ min: -100, max: 300 }),
                    balanceAfter: faker.number.float({ min: 0, max: 2000 }),
                },
            })
        )
    );

    console.log('Seeding completed successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

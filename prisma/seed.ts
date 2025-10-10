import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Explicitly type arrays 👇
    const users: any[] = [];
    const deliveryAgents: any[] = [];
    const plans: any[] = [];
    const customers: any[] = [];
    const deliveries: any[] = [];

    // Create delivery agents
    for (let i = 0; i < 5; i++) {
        const agent = await prisma.user.create({
            data: {
                name: faker.person.fullName(),
                phone: faker.phone.number(),
                email: faker.internet.email(),
                role: 'DELIVERYAGENT',
                password: faker.internet.password(),
                deliveryPartnerProfile: {
                    create: {
                        deliveryCounts: faker.number.int({ min: 10, max: 100 }),
                    },
                },
            },
            include: { deliveryPartnerProfile: true },
        });
        deliveryAgents.push(agent);
    }

    // Create plans with variations and images
    for (let i = 0; i < 5; i++) {
        const plan = await prisma.plans.create({
            data: {
                planName: `Plan ${i + 1}`,
                price: new Decimal(faker.number.float({ min: 100, max: 1000, multipleOf: 0.01 })),
                minPrice: new Decimal(faker.number.float({ min: 50, max: 200, multipleOf: 0.01 })),
                images: {
                    create: Array.from({ length: 3 }).map(() => ({
                        url: faker.image.urlPicsumPhotos(),
                        altText: faker.commerce.productName(),
                    })),
                },
                Variation: {
                    create: Array.from({ length: 2 }).map(() => ({
                        title: faker.commerce.productName(),
                        timeRange: `${faker.number.int({ min: 5, max: 30 })} days`,
                        description: faker.lorem.sentence(),
                        images: {
                            create: Array.from({ length: 2 }).map(() => ({
                                url: faker.image.urlPicsumPhotos(),
                                altText: faker.commerce.productMaterial(),
                            })),
                        },
                    })),
                },
            },
            include: {
                images: true,
                Variation: { include: { images: true } },
            },
        });
        plans.push(plan);
    }

    // Create customers
    for (let i = 0; i < 10; i++) {
        const plan = plans[Math.floor(Math.random() * plans.length)];
        const customer = await prisma.user.create({
            data: {
                name: faker.person.fullName(),
                phone: faker.phone.number(),
                email: faker.internet.email(),
                role: 'USER',
                password: faker.internet.password(),
                customerProfile: {
                    create: {
                        start_date: faker.date.past(),
                        walletAmount: new Decimal(faker.number.float({ min: 100, max: 500, multipleOf: 0.01 })),
                        planId: plan.id,
                    },
                },
            },
            include: { customerProfile: true },
        });
        customers.push(customer);
    }

    // Create deliveries
    for (let i = 0; i < 20; i++) {
        const customer = customers[Math.floor(Math.random() * customers.length)];
        const plan = plans[Math.floor(Math.random() * plans.length)];
        const partner = deliveryAgents[Math.floor(Math.random() * deliveryAgents.length)];

        const delivery = await prisma.deliveries.create({
            data: {
                date: faker.date.recent(),
                status: faker.helpers.arrayElement(['DISPATCHED', 'COMPLETED', 'RETURNED', 'PACKDAMAGED']),
                action: faker.lorem.word(),
                customerId: customer.customerProfile!.id,
                planId: plan.id,
                partnerId: partner.deliveryPartnerProfile!.id,
            },
        });
        deliveries.push(delivery);
    }

    console.log('✅ Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

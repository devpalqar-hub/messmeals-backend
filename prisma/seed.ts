import { DeliveryStatus, PrismaClient, Roles } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    const users: any[] = [];
    const deliveryAgents: any[] = [];
    const plans: any[] = [];
    const customers: any[] = [];
    const deliveries: any[] = [];

    // 🌍 1️⃣ Create Delivery Agents + Profiles
    for (let i = 0; i < 5; i++) {
        const agent = await prisma.user.create({
            data: {
                name: faker.person.fullName(),
                phone: faker.phone.number(),
                email: faker.internet.email(),
                role: Roles.DELIVERYAGENT,
                deliveryPartnerProfile: {
                    create: {
                        deliveryCounts: faker.number.int({ min: 10, max: 100 }),
                        address: faker.location.streetAddress(),
                    },
                },
            },
            include: { deliveryPartnerProfile: true },
        });
        deliveryAgents.push(agent);
    }

    // 📦 2️⃣ Create Plans (with variations & images)
    for (let i = 0; i < 5; i++) {
        const plan = await prisma.plans.create({
            data: {
                planName: `Plan ${i + 1}`,
                price: new Decimal(faker.number.float({ min: 100, max: 1000, multipleOf: 0.01 })),
                minPrice: new Decimal(faker.number.float({ min: 50, max: 200, multipleOf: 0.01 })),
                description: faker.commerce.productDescription(),
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

    // 👤 3️⃣ Create Customers + Profiles
    for (let i = 0; i < 10; i++) {
        const plan = plans[Math.floor(Math.random() * plans.length)];
        const customer = await prisma.user.create({
            data: {
                name: faker.person.fullName(),
                phone: faker.phone.number(),
                email: faker.internet.email(),
                role: Roles.USER,
                customerProfile: {
                    create: {
                        start_date: faker.date.past(),
                        end_date: faker.date.future(),
                        walletAmount: new Decimal(
                            faker.number.float({ min: 100, max: 500, multipleOf: 0.01 })
                        ),
                        address: faker.location.streetAddress(),
                        plan: { connect: { id: plan.id } },
                    },
                },
            },
            include: { customerProfile: true },
        });
        customers.push(customer);
    }

    // 🚚 4️⃣ Create Deliveries
    for (let i = 0; i < 20; i++) {
        const customer = customers[Math.floor(Math.random() * customers.length)];
        const plan = plans[Math.floor(Math.random() * plans.length)];
        const partner = deliveryAgents[Math.floor(Math.random() * deliveryAgents.length)];

        const delivery = await prisma.deliveries.create({
            data: {
                date: faker.date.recent(),
                status: faker.helpers.arrayElement([
                    DeliveryStatus.PLACED,
                    DeliveryStatus.DISPATCHED,
                    DeliveryStatus.COMPLETED,
                    DeliveryStatus.RETURNED,
                    DeliveryStatus.PACKDAMAGED,
                ]),
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

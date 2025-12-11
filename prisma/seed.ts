// import { PrismaClient, Roles } from '@prisma/client';
// const prisma = new PrismaClient();

// async function main() {
//     console.log('🌱 Seeding database...');

//     // Create common variations
//     const [breakfast, lunch, dinner] = await Promise.all([
//         prisma.variation.create({
//             data: { title: 'Breakfast', description: 'Morning meal' },
//         }),
//         prisma.variation.create({
//             data: { title: 'Lunch', description: 'Afternoon meal' },
//         }),
//         prisma.variation.create({
//             data: { title: 'Dinner', description: 'Evening meal' },
//         }),
//     ]);

//     // Helper: Create a mess with plans and delivery agents
//     async function createMess(
//         name: string,
//         email: string,
//         plans: {
//             planName: string;
//             price: number;
//             description: string;
//             variations: string[];
//         }[],
//     ) {
//         const mess = await prisma.mess.create({
//             data: {
//                 name,
//                 email,
//                 phone: '9876543210',
//                 description: `${name} provides healthy and delicious meals.`,
//                 address: '123 Food Street, Cityville',
//                 plans: {
//                     create: await Promise.all(
//                         plans.map(async (p) => ({
//                             planName: p.planName,
//                             price: p.price,
//                             description: p.description,
//                             Variation: {
//                                 connect: p.variations.map((v) => {
//                                     if (v === 'Breakfast') return { id: breakfast.id };
//                                     if (v === 'Lunch') return { id: lunch.id };
//                                     return { id: dinner.id };
//                                 }),
//                             },
//                         })),
//                     ),
//                 },
//             },
//         });

//         // Create Mess Admin
//         const messAdminUser = await prisma.user.create({
//             data: {
//                 name: `${name} Admin`,
//                 phone: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
//                 email: `${name.toLowerCase().replace(/\s/g, '')}@admin.com`,
//                 role: Roles.MESSADMIN,
//                 is_verified: true,
//                 messAdminProfile: {
//                     create: {
//                         messes: { connect: [{ id: mess.id }] },
//                     },
//                 },
//             },
//         });

//         // Create Delivery Agents
//         for (let i = 1; i <= 2; i++) {
//             const agentUser = await prisma.user.create({
//                 data: {
//                     name: `${name} Agent ${i}`,
//                     phone: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
//                     email: `${name.toLowerCase().replace(/\s/g, '')}agent${i}@mail.com`,
//                     role: Roles.DELIVERYAGENT,
//                     is_verified: true,
//                     deliveryPartnerProfile: {
//                         create: {
//                             messId: mess.id,
//                             address: 'Delivery Area, Cityville',
//                             deliveryRegion: 'Zone A',
//                             deliveryCounts: Math.floor(Math.random() * 50),
//                         },
//                     },
//                 },
//             });
//         }

//         return mess;
//     }

//     // Create Messes
//     await createMess('GreenLeaf Mess', 'greenleaf@mess.com', [
//         {
//             planName: 'Healthy Combo Plan',
//             price: 1800,
//             description: 'Includes nutritious lunch and dinner meals.',
//             variations: ['Lunch', 'Dinner'],
//         },
//         {
//             planName: 'Morning Bliss',
//             price: 900,
//             description: 'Light and healthy breakfast plan.',
//             variations: ['Breakfast'],
//         },
//     ]);

//     await createMess('DailyEats', 'dailyeats@mess.com', [
//         {
//             planName: 'All-Day Feast',
//             price: 2500,
//             description: 'Breakfast, lunch and dinner all included.',
//             variations: ['Breakfast', 'Lunch', 'Dinner'],
//         },
//         {
//             planName: 'Lunch Saver',
//             price: 1200,
//             description: 'Simple and filling lunch meals.',
//             variations: ['Lunch'],
//         },
//     ]);

//     await createMess('UrbanTiffin', 'urbantiffin@mess.com', [
//         {
//             planName: 'Dinner Delight',
//             price: 1500,
//             description: 'Perfectly balanced dinner meals.',
//             variations: ['Dinner'],
//         },
//         {
//             planName: 'Energy Start',
//             price: 800,
//             description: 'Power breakfast for early risers.',
//             variations: ['Breakfast'],
//         },
//     ]);

//     console.log('✅ Seeding completed successfully!');
// }

// main()
//     .catch((e) => {
//         console.error(e);
//         process.exit(1);
//     })
//     .finally(async () => {
//         await prisma.$disconnect();
//     });

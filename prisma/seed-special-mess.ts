// import { PrismaClient, Role, DeliveryStatus, ScheduleType } from '@prisma/client';

// const prisma = new PrismaClient();

// async function main() {
//     console.log('Seeding single mess-admin ecosystem...');

//     /* ----------------------------------------------------
//      * 1. CREATE MESS ADMIN USER (FIXED PHONE)
//      * -------------------------------------------------- */
//     const messAdminUser = await prisma.user.create({
//         data: {
//             name: 'Rahul Mess Admin',
//             phone: '8921856638',
//             email: 'rahul.messadmin@example.com',
//             role: Role.MESSADMIN,
//             is_verified: true,
//         },
//     });

//     const messAdminProfile = await prisma.messAdminProfile.create({
//         data: {
//             userId: messAdminUser.id,
//         },
//     });

//     /* ----------------------------------------------------
//      * 2. CREATE MESSES
//      * -------------------------------------------------- */
//     const mess1 = await prisma.mess.create({
//         data: {
//             name: 'Green Leaf Mess',
//             description: 'Pure vegetarian Kerala-style meals',
//             address: 'MG Road, Kochi',
//             phone: '9991112222',
//             email: 'greenleaf@mess.com',
//             messAdmins: {
//                 connect: { id: messAdminProfile.id },
//             },
//         },
//     });

//     const mess2 = await prisma.mess.create({
//         data: {
//             name: 'Spice Route Mess',
//             description: 'Home-style non-veg meals',
//             address: 'Kakkanad, Kochi',
//             phone: '9993334444',
//             email: 'spiceroute@mess.com',
//             messAdmins: {
//                 connect: { id: messAdminProfile.id },
//             },
//         },
//     });

//     /* ----------------------------------------------------
//      * 3. CREATE DELIVERY AGENTS
//      * -------------------------------------------------- */
//     const deliveryAgent1 = await prisma.user.create({
//         data: {
//             name: 'Anil Delivery',
//             phone: '9000000001',
//             email: 'anil.delivery@example.com',
//             role: Role.DELIVERYAGENT,
//         },
//     });

//     const deliveryAgent2 = await prisma.user.create({
//         data: {
//             name: 'Sunil Delivery',
//             phone: '9000000002',
//             email: 'sunil.delivery@example.com',
//             role: Role.DELIVERYAGENT,
//         },
//     });

//     const partner1 = await prisma.deliveryPartnerProfile.create({
//         data: {
//             userId: deliveryAgent1.id,
//             messId: mess1.id,
//             deliveryCounts: 120,
//             deliveryRegion: 'Ernakulam',
//         },
//     });

//     const partner2 = await prisma.deliveryPartnerProfile.create({
//         data: {
//             userId: deliveryAgent2.id,
//             messId: mess2.id,
//             deliveryCounts: 85,
//             deliveryRegion: 'Kakkanad',
//         },
//     });

//     /* ----------------------------------------------------
//      * 4. CREATE CUSTOMERS
//      * -------------------------------------------------- */
//     const customers = await Promise.all(
//         ['Amit', 'Neha', 'Priya'].map((name, i) =>
//             prisma.user.create({
//                 data: {
//                     name,
//                     phone: `811111111${i}`,
//                     email: `${name.toLowerCase()}@example.com`,
//                     role: Role.USER,
//                 },
//             })
//         )
//     );

//     const customerProfiles = await Promise.all(
//         customers.map((user) =>
//             prisma.customerProfile.create({
//                 data: {
//                     userId: user.id,
//                     address: 'Vyttila, Kochi',
//                     current_location: 'Kochi',
//                 },
//             })
//         )
//     );

//     /* ----------------------------------------------------
//      * 5. CREATE PLANS
//      * -------------------------------------------------- */
//     const vegPlan = await prisma.plans.create({
//         data: {
//             planName: 'Veg Monthly Plan',
//             price: 2500,
//             description: 'Lunch + Dinner (Veg)',
//             messId: mess1.id,
//         },
//     });

//     const nonVegPlan = await prisma.plans.create({
//         data: {
//             planName: 'Non-Veg Monthly Plan',
//             price: 3200,
//             description: 'Lunch + Dinner (Non-Veg)',
//             messId: mess2.id,
//         },
//     });

//     /* ----------------------------------------------------
//      * 6. USER ADDRESS
//      * -------------------------------------------------- */
//     const addresses = await Promise.all(
//         customerProfiles.map((profile) =>
//             prisma.userAddress.create({
//                 data: {
//                     name: 'Home',
//                     street: 'Street 10',
//                     townOrcity: 'Kochi',
//                     postcode: '682030',
//                     phone: '8888888888',
//                     email: 'home@example.com',
//                     profileId: profile.id,
//                 },
//             })
//         )
//     );

//     /* ----------------------------------------------------
//      * 7. SUBSCRIPTIONS
//      * -------------------------------------------------- */
//     const subscriptions = await Promise.all(
//         customerProfiles.map((profile, i) =>
//             prisma.userSubscriptions.create({
//                 data: {
//                     start_date: new Date(),
//                     scheduleType: ScheduleType.EVERYDAY,
//                     totalPrice: i % 2 === 0 ? 2500 : 3200,
//                     discountedPrice: i % 2 === 0 ? 2300 : 3000,
//                     planId: i % 2 === 0 ? vegPlan.id : nonVegPlan.id,
//                     messId: i % 2 === 0 ? mess1.id : mess2.id,
//                     customerProfileId: profile.id,
//                     userAddressId: addresses[i].id,
//                     deliveryPartnerProfileId: i % 2 === 0 ? partner1.id : partner2.id,
//                 },
//             })
//         )
//     );

//     /* ----------------------------------------------------
//      * 8. DELIVERIES
//      * -------------------------------------------------- */
//     await Promise.all(
//         subscriptions.map((sub, i) =>
//             prisma.deliveries.create({
//                 data: {
//                     date: new Date(),
//                     status: DeliveryStatus.PENDING,
//                     customerId: sub.customerProfileId!,
//                     planId: sub.planId,
//                     messId: sub.messId,
//                     partnerId: sub.deliveryPartnerProfileId!,
//                     subscriptionId: sub.id,
//                 },
//             })
//         )
//     );

//     console.log('Single mess-admin ecosystem seeded successfully.');
// }

// main()
//     .catch((e) => {
//         console.error(e);
//         process.exit(1);
//     })
//     .finally(async () => {
//         await prisma.$disconnect();
//     });

// import {
//     PrismaClient,
//     Role,
//     DeliveryStatus,
//     ScheduleType,
// } from '@prisma/client';

// const prisma = new PrismaClient();

// async function main() {
//     console.log('Seeding mess admin 9895728129 ecosystem...');

//     /* ----------------------------------------------------
//      * 1. MESS ADMIN USER
//      * -------------------------------------------------- */
//     const messAdminUser = await prisma.user.create({
//         data: {
//             name: 'Suresh Mess Admin',
//             phone: '9895728129',
//             email: 'suresh.messadmin@example.com',
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
//      * 2. MESSES
//      * -------------------------------------------------- */
//     const messA = await prisma.mess.create({
//         data: {
//             name: 'Annapoorna Mess',
//             description: 'Affordable home-style meals',
//             address: 'Palarivattom, Kochi',
//             phone: '9070000001',
//             email: 'annapoorna@mess.com',
//             messAdmins: {
//                 connect: { id: messAdminProfile.id },
//             },
//         },
//     });

//     const messB = await prisma.mess.create({
//         data: {
//             name: 'Malabar Treats',
//             description: 'Malabar special meals & curries',
//             address: 'Edappally, Kochi',
//             phone: '9070000002',
//             email: 'malabar@mess.com',
//             messAdmins: {
//                 connect: { id: messAdminProfile.id },
//             },
//         },
//     });

//     /* ----------------------------------------------------
//      * 3. DELIVERY AGENTS
//      * -------------------------------------------------- */
//     const agentUser1 = await prisma.user.create({
//         data: {
//             name: 'Ravi Delivery',
//             phone: '9111111111',
//             email: 'ravi.delivery@example.com',
//             role: Role.DELIVERYAGENT,
//         },
//     });

//     const agentUser2 = await prisma.user.create({
//         data: {
//             name: 'Manoj Delivery',
//             phone: '9222222222',
//             email: 'manoj.delivery@example.com',
//             role: Role.DELIVERYAGENT,
//         },
//     });

//     const partner1 = await prisma.deliveryPartnerProfile.create({
//         data: {
//             userId: agentUser1.id,
//             messId: messA.id,
//             deliveryCounts: 60,
//             deliveryRegion: 'Palarivattom',
//         },
//     });

//     const partner2 = await prisma.deliveryPartnerProfile.create({
//         data: {
//             userId: agentUser2.id,
//             messId: messB.id,
//             deliveryCounts: 45,
//             deliveryRegion: 'Edappally',
//         },
//     });

//     /* ----------------------------------------------------
//      * 4. CUSTOMERS
//      * -------------------------------------------------- */
//     const customerUsers = await Promise.all(
//         ['Arjun', 'Meera', 'Lakshmi'].map((name, i) =>
//             prisma.user.create({
//                 data: {
//                     name,
//                     phone: `833333333${i}`,
//                     email: `${name.toLowerCase()}@customer.com`,
//                     role: Role.USER,
//                 },
//             })
//         )
//     );

//     const customerProfiles = await Promise.all(
//         customerUsers.map((user) =>
//             prisma.customerProfile.create({
//                 data: {
//                     userId: user.id,
//                     address: 'Kaloor, Kochi',
//                     current_location: 'Kochi',
//                 },
//             })
//         )
//     );

//     /* ----------------------------------------------------
//      * 5. PLANS
//      * -------------------------------------------------- */
//     const basicPlan = await prisma.plans.create({
//         data: {
//             planName: 'Basic Monthly Plan',
//             price: 2200,
//             description: 'Daily lunch (veg)',
//             messId: messA.id,
//         },
//     });

//     const premiumPlan = await prisma.plans.create({
//         data: {
//             planName: 'Premium Monthly Plan',
//             price: 3000,
//             description: 'Lunch + dinner (veg & non-veg)',
//             messId: messB.id,
//         },
//     });

//     /* ----------------------------------------------------
//      * 6. USER ADDRESSES
//      * -------------------------------------------------- */
//     const addresses = await Promise.all(
//         customerProfiles.map((profile) =>
//             prisma.userAddress.create({
//                 data: {
//                     name: 'Home',
//                     street: 'Street 5',
//                     townOrcity: 'Kochi',
//                     postcode: '682025',
//                     phone: '9009998888',
//                     email: 'address@example.com',
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
//                     totalPrice: i % 2 === 0 ? 2200 : 3000,
//                     discountedPrice: i % 2 === 0 ? 2100 : 2850,
//                     planId: i % 2 === 0 ? basicPlan.id : premiumPlan.id,
//                     messId: i % 2 === 0 ? messA.id : messB.id,
//                     customerProfileId: profile.id,
//                     userAddressId: addresses[i].id,
//                     deliveryPartnerProfileId:
//                         i % 2 === 0 ? partner1.id : partner2.id,
//                 },
//             })
//         )
//     );

//     /* ----------------------------------------------------
//      * 8. DELIVERIES
//      * -------------------------------------------------- */
//     await Promise.all(
//         subscriptions.map((sub) =>
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

//     console.log('Seeder completed: Mess Admin 9895728129');
// }

// main()
//     .catch((e) => {
//         console.error(e);
//         process.exit(1);
//     })
//     .finally(async () => {
//         await prisma.$disconnect();
//     });

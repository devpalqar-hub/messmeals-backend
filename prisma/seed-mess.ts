// import { PrismaClient, FoodType, Tags } from '@prisma/client';

// const prisma = new PrismaClient();

// async function main() {

//     // -----------------------------
//     // USERS + CUSTOMERS
//     // -----------------------------
//     const users = await Promise.all(
//         Array.from({ length: 5 }).map((_, i) =>
//             prisma.user.create({
//                 data: {
//                     name: `Customer ${i + 1}`,
//                     email: `customers${i + 1}@test.com`,
//                     phone: `99999919${i}`,
//                     is_verified: true,
//                 },
//             })
//         )
//     );

//     const customers = await Promise.all(
//         users.map(u =>
//             prisma.customerProfile.create({
//                 data: {
//                     userId: u.id,
//                 },
//             })
//         )
//     );

//     // -----------------------------
//     // DISTRICTS
//     // -----------------------------
//     const ernakulam = await prisma.district.create({
//         data: {
//             name: "Ernakulam",
//             image: "district.jpg",
//         },
//     });

//     const thrissur = await prisma.district.create({
//         data: {
//             name: "Thrissur",
//             image: "district.jpg",
//         },
//     });

//     // -----------------------------
//     // MESSES
//     // -----------------------------
//     const messes = await Promise.all([
//         prisma.mess.create({
//             data: {
//                 name: "Home Style Mess",
//                 location: "Kakkanad",
//                 latitude: "10.0159",
//                 logitude: "76.3419",
//                 is_verified: true,
//                 districtId: ernakulam.id,
//             },
//         }),
//         prisma.mess.create({
//             data: {
//                 name: "Student Mess",
//                 location: "Edappally",
//                 latitude: "10.0261",
//                 logitude: "76.3089",
//                 is_verified: true,
//                 districtId: ernakulam.id,
//             },
//         }),
//         prisma.mess.create({
//             data: {
//                 name: "Family Mess",
//                 location: "Aluva",
//                 latitude: "10.1076",
//                 logitude: "76.3516",
//                 is_verified: true,
//                 districtId: ernakulam.id,
//             },
//         }),
//         prisma.mess.create({
//             data: {
//                 name: "Budget Mess",
//                 location: "Thrissur Town",
//                 latitude: "10.5276",
//                 logitude: "76.2144",
//                 is_verified: true,
//                 districtId: thrissur.id,
//             },
//         }),
//         prisma.mess.create({
//             data: {
//                 name: "Premium Mess",
//                 location: "Kaloor",
//                 latitude: "9.9981",
//                 logitude: "76.2999",
//                 is_verified: true,
//                 districtId: ernakulam.id,
//             },
//         }),
//     ]);

//     // -----------------------------
//     // PLANS
//     // -----------------------------
//     for (const mess of messes) {
//         await prisma.plans.createMany({
//             data: [
//                 {
//                     planName: "Daily Plan",
//                     price: 120,
//                     messId: mess.id,
//                     isDailyPlan: true,
//                     isMonthlyPlan: false,
//                     isActive: true,
//                 },
//                 {
//                     planName: "Monthly Plan",
//                     price: 3000,
//                     minPrice: 2800,
//                     messId: mess.id,
//                     isDailyPlan: false,
//                     isMonthlyPlan: true,
//                     isActive: true,
//                 },
//             ],
//         });
//     }

//     // -----------------------------
//     // FOOD TYPES
//     // -----------------------------
//     await prisma.messFoodType.createMany({
//         data: [
//             { messId: messes[0].id, foodType: FoodType.VEG },
//             { messId: messes[1].id, foodType: FoodType.NON_VEG },
//             { messId: messes[2].id, foodType: FoodType.MIXED },
//         ],
//     });

//     // -----------------------------
//     // TAGS
//     // -----------------------------
//     await prisma.messTag.createMany({
//         data: [
//             { messId: messes[0].id, tag: Tags.HOME_STYLE_FOOD },
//             { messId: messes[1].id, tag: Tags.STUDENT_FRIENDLY },
//         ],
//     });

//     // -----------------------------
//     // TESTIMONIALS (IMPORTANT FOR SORTING)
//     // -----------------------------
//     // mess[0] -> 5 ratings
//     // mess[1] -> 3 ratings
//     // mess[2] -> 1 rating

//     await prisma.testimonials.createMany({
//         data: [
//             ...Array.from({ length: 5 }).map((_, i) => ({
//                 messId: messes[0].id,
//                 ratings: 5,
//                 reviews: "Good food",
//                 customerId: customers[i % customers.length].id,
//             })),
//             ...Array.from({ length: 3 }).map((_, i) => ({
//                 messId: messes[1].id,
//                 ratings: 4,
//                 reviews: "Nice",
//                 customerId: customers[i % customers.length].id,
//             })),
//             {
//                 messId: messes[2].id,
//                 ratings: 3,
//                 reviews: "Average",
//                 customerId: customers[0].id,
//             },
//         ],
//     });

//     console.log("✅ Seed completed");
// }

// main()
//     .catch(e => console.error(e))
//     .finally(async () => {
//         await prisma.$disconnect();
//     });

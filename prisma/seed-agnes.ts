// import { PrismaClient, FoodType } from "@prisma/client";

// const prisma = new PrismaClient();

// async function main() {

//     // ---------------- DISTRICT ----------------
//     const district = await prisma.district.create({
//         data: {
//             name: "Ernakulam",
//             image: "test.png"
//         }
//     });

//     // --------------- VARIATIONS ---------------
//     const breakfast = await prisma.variation.create({
//         data: { title: "Breakfast" }
//     });

//     const lunch = await prisma.variation.create({
//         data: { title: "Lunch" }
//     });

//     const dinner = await prisma.variation.create({
//         data: { title: "Dinner" }
//     });

//     // ------------- COMMON FUNCTION ------------
//     async function createMess(
//         name: string,
//         foodType: FoodType,
//         lat: string,
//         lng: string,
//         dailyPrice?: number,
//         monthlyPrice?: number
//     ) {

//         const mess = await prisma.mess.create({
//             data: {
//                 name,
//                 location: "Kochi",
//                 latitude: lat,
//                 logitude: lng,
//                 districtId: district.id,
//                 is_active: true,
//                 is_verified: true,
//             }
//         });

//         // 🔴 REQUIRED FOR FOOD FILTER TESTING
//         await prisma.messFoodType.create({
//             data: {
//                 messId: mess.id,
//                 foodType
//             }
//         });

//         // DAILY PLAN
//         if (dailyPrice) {
//             const dailyPlan = await prisma.plans.create({
//                 data: {
//                     planName: `${name} Daily`,
//                     messId: mess.id,
//                     price: dailyPrice,
//                     isDailyPlan: true,
//                     isMonthlyPlan: false,
//                 }
//             });

//             await prisma.plans.update({
//                 where: { id: dailyPlan.id },
//                 data: {
//                     Variation: {
//                         connect: [
//                             { id: breakfast.id },
//                             { id: lunch.id }
//                         ]
//                     }
//                 }
//             });
//         }

//         // MONTHLY PLAN
//         if (monthlyPrice) {
//             const monthlyPlan = await prisma.plans.create({
//                 data: {
//                     planName: `${name} Monthly`,
//                     messId: mess.id,
//                     price: monthlyPrice,
//                     minPrice: monthlyPrice,
//                     isDailyPlan: false,
//                     isMonthlyPlan: true,
//                 }
//             });

//             await prisma.plans.update({
//                 where: { id: monthlyPlan.id },
//                 data: {
//                     Variation: {
//                         connect: [{ id: dinner.id }]
//                     }
//                 }
//             });
//         }

//         // RATINGS DATA
//         for (let i = 0; i < 5; i++) {
//             const user = await prisma.user.create({
//                 data: {
//                     name: "test",
//                     phone: Math.random().toString().slice(2, 12),
//                     email: Math.random() + "@mail.com"
//                 }
//             });

//             const profile = await prisma.customerProfile.create({
//                 data: {
//                     userId: user.id
//                 }
//             });

//             await prisma.testimonials.create({
//                 data: {
//                     messId: mess.id,
//                     customerId: profile.id,
//                     ratings: 4,
//                     reviews: "good"
//                 }
//             });
//         }
//     }

//     // ------------------ MESSES ------------------

//     await createMess("Mess A", FoodType.VEG, "9.98", "76.28", 120, 3000);
//     await createMess("Mess B", FoodType.NON_VEG, "9.99", "76.27", 150, 3500);
//     await createMess("Mess C", FoodType.MIXED, "9.97", "76.29", 100, 2800);

//     // only daily
//     await createMess("Mess D", FoodType.VEG, "9.96", "76.25", 90);

//     // only monthly
//     await createMess("Mess E", FoodType.NON_VEG, "9.95", "76.26", undefined, 2500);

// }

// main()
//     .then(() => {
//         console.log("✔ Test Mess Seeded");
//     })
//     .catch(console.error)
//     .finally(() => prisma.$disconnect());
import {
    PrismaClient,
    Role,
    FoodType,
    Tags,
    DeliveryStatus,
    VariationStatus,
    ScheduleType,
    DayOfWeek,
    LedgerEntryType,
    LedgerEntryReason,
    ExpenseStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function seedMessData() {
    console.log('🌱 Starting full Mess, MessAdmin, Customer, Delivery & Ecosystem seed...');

    const saltRounds = 10;
    const defaultPasswordHash = await bcrypt.hash('DevPalqar@2026', saltRounds);
    const messAdminPasswordHash = await bcrypt.hash('MessAdmin@123', saltRounds);
    const customerPasswordHash = await bcrypt.hash('Customer@123', saltRounds);
    const agentPasswordHash = await bcrypt.hash('Agent@123', saltRounds);

    /* --------------------------------------------------------------------------
     * 1. SUPERADMIN USER (Safe Upsert)
     * -------------------------------------------------------------------------- */
    console.log('👤 Seeding SuperAdmin...');
    const superAdmin = await prisma.user.upsert({
        where: { phone: '9895728129' },
        update: {
            name: 'Suresh Super Admin',
            email: 'admin@messmeals.com',
            role: Role.SUPERADMIN,
            is_verified: true,
            is_active: true,
            password: defaultPasswordHash,
        },
        create: {
            name: 'Suresh Super Admin',
            phone: '9895728129',
            email: 'admin@messmeals.com',
            password: defaultPasswordHash,
            role: Role.SUPERADMIN,
            is_verified: true,
            is_active: true,
        },
    });

    /* --------------------------------------------------------------------------
     * 2. DISTRICTS
     * -------------------------------------------------------------------------- */
    console.log('📍 Seeding Districts...');
    let ernakulam = await prisma.district.findFirst({ where: { name: 'Ernakulam' } });
    if (!ernakulam) {
        ernakulam = await prisma.district.create({
            data: {
                name: 'Ernakulam',
                image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
            },
        });
    }

    let thrissur = await prisma.district.findFirst({ where: { name: 'Thrissur' } });
    if (!thrissur) {
        thrissur = await prisma.district.create({
            data: {
                name: 'Thrissur',
                image: 'https://images.unsplash.com/photo-1590073242678-70ee3fc28e8e?auto=format&fit=crop&w=800&q=80',
            },
        });
    }

    /* --------------------------------------------------------------------------
     * 3. CATEGORIES
     * -------------------------------------------------------------------------- */
    console.log('🏷️  Seeding Categories...');
    const categoryConfigs = [
        {
            name: 'Homely Meals',
            description: 'Traditional home-cooked Kerala meals made with fresh local ingredients',
            image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        },
        {
            name: 'Student Friendly',
            description: 'Budget-friendly, highly nutritious meal plans crafted for students and PGs',
            image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
        },
        {
            name: 'Corporate Tiffin',
            description: 'Timely and mess-free office lunch deliveries tailored for professionals',
            image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
        },
    ];

    const categories: any[] = [];
    for (const cat of categoryConfigs) {
        let existing = await prisma.category.findFirst({ where: { name: cat.name } });
        if (!existing) {
            existing = await prisma.category.create({ data: cat });
        }
        categories.push(existing);
    }

    /* --------------------------------------------------------------------------
     * 4. GLOBAL VARIATIONS (Breakfast, Lunch, Dinner)
     * -------------------------------------------------------------------------- */
    console.log('🍱 Seeding Meal Variations...');
    const variationConfigs = [
        {
            title: 'Breakfast',
            description: 'Morning breakfast items: Appam, Idli, Dosa, Puttu, Kadala curry, Chutney & Tea/Coffee',
        },
        {
            title: 'Lunch',
            description: 'Full Kerala meal: Kerala Matta Rice, Sambar, Moru curry, Thoran, Aviyal, Pickle & Fish/Chicken',
        },
        {
            title: 'Dinner',
            description: 'Light night dinner: Soft Chapathi / Wheat Parotta with Veg Kurma or Chicken roast',
        },
    ];

    const variations: Record<string, any> = {};
    for (const v of variationConfigs) {
        let variation = await prisma.variation.findFirst({ where: { title: v.title } });
        if (!variation) {
            variation = await prisma.variation.create({ data: v });
        }
        variations[v.title] = variation;
    }

    /* --------------------------------------------------------------------------
     * 5. MESS ADMIN (User + MessAdminProfile)
     * -------------------------------------------------------------------------- */
    console.log('👨‍🍳 Seeding Mess Admin...');
    let messAdminUser = await prisma.user.findUnique({
        where: { phone: '9876543210' },
        include: { messAdminProfile: true },
    });

    if (!messAdminUser) {
        messAdminUser = await prisma.user.create({
            data: {
                name: 'Rahul Mess Admin',
                phone: '9876543210',
                email: 'rahul.messadmin@messmeals.com',
                password: messAdminPasswordHash,
                role: Role.MESSADMIN,
                is_verified: true,
                is_active: true,
                messAdminProfile: {
                    create: {},
                },
            },
            include: { messAdminProfile: true },
        });
    } else if (!messAdminUser.messAdminProfile) {
        await prisma.messAdminProfile.create({
            data: { userId: messAdminUser.id },
        });
        messAdminUser = await prisma.user.findUnique({
            where: { id: messAdminUser.id },
            include: { messAdminProfile: true },
        });
    }

    if (!messAdminUser || !messAdminUser.messAdminProfile) {
        throw new Error('Failed to create or retrieve Mess Admin Profile');
    }

    const messAdminProfileId = messAdminUser.messAdminProfile.id;

    /* --------------------------------------------------------------------------
     * 6. MESSES (Malabar Kitchen & Annapoorna Veg)
     * -------------------------------------------------------------------------- */
    console.log('🏪 Seeding Messes...');

    // Mess 1: Malabar Kitchen & Mess
    let mess1 = await prisma.mess.findUnique({
        where: { slug: 'malabar-kitchen-mess' },
    });

    if (!mess1) {
        mess1 = await prisma.mess.create({
            data: {
                name: 'Malabar Kitchen & Mess',
                slug: 'malabar-kitchen-mess',
                description: 'Authentic Malabar home-style breakfast, lunch, and dinner delivered fresh to your doorstep in Kakkanad.',
                address: 'Near Infopark Phase 1, Kakkanad, Kochi, Kerala 682042',
                location: 'Kakkanad, Kochi',
                latitude: '10.0159',
                logitude: '76.3419',
                zipcode: '682042',
                phone: '9876543211',
                email: 'malabar.kitchen@messmeals.com',
                is_verified: true,
                is_active: true,
                isListed: true,
                isFeatured: true,
                isPremium: true,
                districtId: ernakulam.id,
                openingHours: {
                    monday: '07:00 - 22:00',
                    tuesday: '07:00 - 22:00',
                    wednesday: '07:00 - 22:00',
                    thursday: '07:00 - 22:00',
                    friday: '07:00 - 22:00',
                    saturday: '07:00 - 22:00',
                    sunday: '08:00 - 21:00',
                },
                categories: {
                    connect: categories.map((c) => ({ id: c.id })),
                },
                messAdmins: {
                    connect: { id: messAdminProfileId },
                },
                foodTypes: {
                    create: [
                        { foodType: FoodType.MIXED },
                        { foodType: FoodType.NON_VEG },
                        { foodType: FoodType.VEG },
                    ],
                },
                tags: {
                    create: [
                        { tag: Tags.HOME_STYLE_FOOD },
                        { tag: Tags.DAILY_FRESH_MEALS },
                        { tag: Tags.MONTHLY_PLANS },
                        { tag: Tags.HYGIENIC_KITCHEN },
                        { tag: Tags.QUALITY_INGREDIENTS },
                        { tag: Tags.STUDENT_FRIENDLY },
                    ],
                },
                images: {
                    create: [
                        {
                            url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
                            altText: 'Malabar Kitchen Front',
                            isCover: true,
                            sortOrder: 0,
                        },
                        {
                            url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
                            altText: 'Fresh Meal Prep',
                            isCover: false,
                            sortOrder: 1,
                        },
                    ],
                },
                MessBillingConfig: {
                    create: {
                        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        perCustomerRateOverride: 4.0,
                    },
                },
            },
        });
    }

    // Mess 2: Annapoorna Pure Veg Mess
    let mess2 = await prisma.mess.findUnique({
        where: { slug: 'annapoorna-pure-veg-mess' },
    });

    if (!mess2) {
        mess2 = await prisma.mess.create({
            data: {
                name: 'Annapoorna Pure Veg Mess',
                slug: 'annapoorna-pure-veg-mess',
                description: 'Wholesome pure-vegetarian South Indian meals and traditional Kerala thalis prepared with organic vegetables.',
                address: 'Stadium Link Road, Palarivattom, Kochi, Kerala 682025',
                location: 'Palarivattom, Kochi',
                latitude: '10.0050',
                logitude: '76.3050',
                zipcode: '682025',
                phone: '9876543212',
                email: 'annapoorna.veg@messmeals.com',
                is_verified: true,
                is_active: true,
                isListed: true,
                isFeatured: true,
                isPremium: false,
                districtId: ernakulam.id,
                openingHours: {
                    monday: '07:30 - 21:30',
                    tuesday: '07:30 - 21:30',
                    wednesday: '07:30 - 21:30',
                    thursday: '07:30 - 21:30',
                    friday: '07:30 - 21:30',
                    saturday: '07:30 - 21:30',
                    sunday: '08:00 - 20:30',
                },
                categories: {
                    connect: [{ id: categories[0].id }],
                },
                messAdmins: {
                    connect: { id: messAdminProfileId },
                },
                foodTypes: {
                    create: [{ foodType: FoodType.VEG }],
                },
                tags: {
                    create: [
                        { tag: Tags.HOME_STYLE_FOOD },
                        { tag: Tags.HYGIENIC_KITCHEN },
                        { tag: Tags.QUALITY_INGREDIENTS },
                        { tag: Tags.CONSISTENT_TASTE },
                    ],
                },
                images: {
                    create: [
                        {
                            url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
                            altText: 'Annapoorna Veg Thali',
                            isCover: true,
                            sortOrder: 0,
                        },
                    ],
                },
                MessBillingConfig: {
                    create: {
                        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        perCustomerRateOverride: 4.0,
                    },
                },
            },
        });
    }

    /* --------------------------------------------------------------------------
     * 7. EXPENSE CATEGORIES & EXPENSES
     * -------------------------------------------------------------------------- */
    console.log('💰 Seeding Expenses for Mess 1...');
    const expenseCategoryNames = ['Groceries & Provisions', 'Vegetables & Milk', 'Cooking Gas', 'Staff Wages'];
    for (const name of expenseCategoryNames) {
        const expCat = await prisma.expenseCategory.upsert({
            where: {
                messId_name: {
                    messId: mess1.id,
                    name,
                },
            },
            update: {},
            create: {
                name,
                messId: mess1.id,
            },
        });

        // Add a sample expense
        const existingExpense = await prisma.expense.findFirst({
            where: { messId: mess1.id, categoryId: expCat.id },
        });

        if (!existingExpense) {
            await prisma.expense.create({
                data: {
                    messId: mess1.id,
                    categoryId: expCat.id,
                    title: `Monthly ${name}`,
                    description: `Recorded payment for ${name.toLowerCase()}`,
                    amount: 3500,
                    paidAmount: 3500,
                    status: ExpenseStatus.PAID,
                    expenseDate: new Date(),
                    createdById: messAdminUser.id,
                },
            });
        }
    }

    /* --------------------------------------------------------------------------
     * 8. DELIVERY PARTNERS
     * -------------------------------------------------------------------------- */
    console.log('🚴 Seeding Delivery Partners...');
    const partnerData = [
        {
            name: 'Anil Kumar (Delivery)',
            phone: '9800000001',
            email: 'anil.delivery@messmeals.com',
            messId: mess1.id,
            deliveryRegion: 'Kakkanad & Infopark Zone',
            deliveryCounts: 140,
        },
        {
            name: 'Manoj V (Delivery)',
            phone: '9800000002',
            email: 'manoj.delivery@messmeals.com',
            messId: mess2.id,
            deliveryRegion: 'Palarivattom & Edappally Zone',
            deliveryCounts: 85,
        },
    ];

    const deliveryPartners: any[] = [];
    for (const p of partnerData) {
        let user = await prisma.user.findUnique({
            where: { phone: p.phone },
            include: { deliveryPartnerProfile: true },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: p.name,
                    phone: p.phone,
                    email: p.email,
                    password: agentPasswordHash,
                    role: Role.DELIVERYAGENT,
                    is_verified: true,
                    is_active: true,
                    deliveryPartnerProfile: {
                        create: {
                            messId: p.messId,
                            deliveryRegion: p.deliveryRegion,
                            deliveryCounts: p.deliveryCounts,
                            isonline: true,
                            address: `${p.deliveryRegion}, Kochi`,
                        },
                    },
                },
                include: { deliveryPartnerProfile: true },
            });
        }
        deliveryPartners.push(user.deliveryPartnerProfile!);
    }

    const partnerMess1 = deliveryPartners[0];
    const partnerMess2 = deliveryPartners[1];

    /* --------------------------------------------------------------------------
     * 9. PLANS
     * -------------------------------------------------------------------------- */
    console.log('📋 Seeding Plans...');

    // Plan 1: Daily Meals (Mess 1)
    let plan1 = await prisma.plans.findFirst({
        where: { messId: mess1.id, planName: 'Standard Daily Meals (Lunch + Dinner)' },
        include: { Variation: true },
    });
    if (!plan1) {
        plan1 = await prisma.plans.create({
            data: {
                messId: mess1.id,
                planName: 'Standard Daily Meals (Lunch + Dinner)',
                description: 'Fresh lunch and dinner delivered on a flexible daily basis.',
                price: 150,
                minPrice: 140,
                isDailyPlan: true,
                isMonthlyPlan: false,
                isActive: true,
                scheduleType: ScheduleType.EVERYDAY,
                totalCustomers: 2,
                Variation: {
                    connect: [
                        { id: variations['Lunch'].id },
                        { id: variations['Dinner'].id },
                    ],
                },
            },
            include: { Variation: true },
        });
    }

    // Plan 2: Executive Monthly Plan (Mess 1)
    let plan2 = await prisma.plans.findFirst({
        where: { messId: mess1.id, planName: 'Executive Monthly Full Meals' },
        include: { Variation: true },
    });
    if (!plan2) {
        plan2 = await prisma.plans.create({
            data: {
                messId: mess1.id,
                planName: 'Executive Monthly Full Meals',
                description: 'All 3 daily meals (Breakfast + Lunch + Dinner) delivered every single day.',
                price: 4500,
                minPrice: 4200,
                isDailyPlan: false,
                isMonthlyPlan: true,
                isActive: true,
                scheduleType: ScheduleType.EVERYDAY,
                totalCustomers: 3,
                Variation: {
                    connect: [
                        { id: variations['Breakfast'].id },
                        { id: variations['Lunch'].id },
                        { id: variations['Dinner'].id },
                    ],
                },
            },
            include: { Variation: true },
        });
    }

    // Plan 3: Weekday Corporate Lunch (Mess 1)
    let plan3 = await prisma.plans.findFirst({
        where: { messId: mess1.id, planName: 'Corporate Weekday Lunch (Mon-Fri)' },
        include: { Variation: true },
    });
    if (!plan3) {
        plan3 = await prisma.plans.create({
            data: {
                messId: mess1.id,
                planName: 'Corporate Weekday Lunch (Mon-Fri)',
                description: 'Nutritious hot lunch box delivered to your office on working days.',
                price: 2400,
                minPrice: 2200,
                isDailyPlan: false,
                isMonthlyPlan: true,
                isActive: true,
                scheduleType: ScheduleType.CUSTOM,
                availableDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
                totalCustomers: 1,
                Variation: {
                    connect: [{ id: variations['Lunch'].id }],
                },
            },
            include: { Variation: true },
        });
    }

    // Plan 4: Pure Veg Daily Thali (Mess 2)
    let plan4 = await prisma.plans.findFirst({
        where: { messId: mess2.id, planName: 'Pure Veg Daily Thali' },
        include: { Variation: true },
    });
    if (!plan4) {
        plan4 = await prisma.plans.create({
            data: {
                messId: mess2.id,
                planName: 'Pure Veg Daily Thali',
                description: 'Traditional pure veg lunch thali with rice, sambar, kootu, rasam, thoran and payasam.',
                price: 120,
                minPrice: 110,
                isDailyPlan: true,
                isMonthlyPlan: false,
                isActive: true,
                scheduleType: ScheduleType.EVERYDAY,
                totalCustomers: 1,
                Variation: {
                    connect: [{ id: variations['Lunch'].id }],
                },
            },
            include: { Variation: true },
        });
    }

    // Plan 5: Pure Veg Monthly Feast (Mess 2)
    let plan5 = await prisma.plans.findFirst({
        where: { messId: mess2.id, planName: 'Pure Veg Monthly Feast' },
        include: { Variation: true },
    });
    if (!plan5) {
        plan5 = await prisma.plans.create({
            data: {
                messId: mess2.id,
                planName: 'Pure Veg Monthly Feast',
                description: 'Wholesome pure veg lunch and dinner for 30 days.',
                price: 3200,
                minPrice: 3000,
                isDailyPlan: false,
                isMonthlyPlan: true,
                isActive: true,
                scheduleType: ScheduleType.EVERYDAY,
                totalCustomers: 1,
                Variation: {
                    connect: [
                        { id: variations['Lunch'].id },
                        { id: variations['Dinner'].id },
                    ],
                },
            },
            include: { Variation: true },
        });
    }

    /* --------------------------------------------------------------------------
     * 10. WEEKLY MENU (Menu)
     * -------------------------------------------------------------------------- */
    console.log('🍽️  Seeding Weekly Menu...');
    const existingMenu = await prisma.menu.findFirst({ where: { messId: mess1.id } });
    if (!existingMenu) {
        await prisma.menu.create({
            data: {
                messId: mess1.id,
                name: 'Weekly Standard Menu',
                isActive: true,
                schedule: {
                    MONDAY: [
                        { variationId: variations['Breakfast'].id, items: 'Idli, Sambar, Coconut Chutney' },
                        { variationId: variations['Lunch'].id, items: 'Kerala Matta Rice, Moru Curry, Cabbage Thoran, Fish Fry' },
                        { variationId: variations['Dinner'].id, items: '3 Wheat Chapathis, Chicken Curry / Dal Tadka' },
                    ],
                    TUESDAY: [
                        { variationId: variations['Breakfast'].id, items: 'Appam, Veg Stew / Egg Roast' },
                        { variationId: variations['Lunch'].id, items: 'White Rice, Sambar, Aviyal, Omelette' },
                        { variationId: variations['Dinner'].id, items: 'Wheat Parotta, Paneer Butter Masala' },
                    ],
                    WEDNESDAY: [
                        { variationId: variations['Breakfast'].id, items: 'Dosa, Tomato Chutney, Sambar' },
                        { variationId: variations['Lunch'].id, items: 'Kerala Rice, Pulissery, Beans Mezhukkupuratti, Chicken Curry' },
                        { variationId: variations['Dinner'].id, items: 'Chapathi, Green Peas Masala' },
                    ],
                    THURSDAY: [
                        { variationId: variations['Breakfast'].id, items: 'Puttu, Kadala Curry' },
                        { variationId: variations['Lunch'].id, items: 'Matta Rice, Theeyal, Kalan, Papad, Curd' },
                        { variationId: variations['Dinner'].id, items: 'Phulka, Mixed Veg Sabzi' },
                    ],
                    FRIDAY: [
                        { variationId: variations['Breakfast'].id, items: 'Idiyappam, Egg Curry / Veg Kurma' },
                        { variationId: variations['Lunch'].id, items: 'Special Chicken Biryani / Veg Pulao, Raita, Pickle' },
                        { variationId: variations['Dinner'].id, items: 'Chapathi, Dal Fry, Jeera Rice' },
                    ],
                    SATURDAY: [
                        { variationId: variations['Breakfast'].id, items: 'Poori, Potato Masala' },
                        { variationId: variations['Lunch'].id, items: 'Kerala Rice, Rasam, Beetroot Thoran, Fish Curry' },
                        { variationId: variations['Dinner'].id, items: 'Fried Rice, Gobi Manchurian' },
                    ],
                    SUNDAY: [
                        { variationId: variations['Breakfast'].id, items: 'Masala Dosa, Sambar, Chutney' },
                        { variationId: variations['Lunch'].id, items: 'Sunday Feast: Kerala Meals with Payasam & Special Fry' },
                        { variationId: variations['Dinner'].id, items: 'Soft Chapathis with Chicken Roast / Kadai Paneer' },
                    ],
                },
                plans: {
                    connect: [{ id: plan1.id }, { id: plan2.id }, { id: plan3.id }],
                },
            },
        });
    }

    /* --------------------------------------------------------------------------
     * 11. CUSTOMERS (Customer + CustomerProfile + UserAddress + Wallet)
     * -------------------------------------------------------------------------- */
    console.log('👥 Seeding Customers & Profiles...');
    const customerSeedConfigs = [
        {
            name: 'Arjun Menon',
            phone: '9700000001',
            email: 'arjun.menon@example.com',
            address: 'Flat 4B, Skyline Apartments, Kakkanad, Kochi',
            street: 'Infopark Expressway, Kakkanad',
            townOrcity: 'Kochi',
            postcode: '682030',
            walletAmount: 500,
        },
        {
            name: 'Sneha Patel',
            phone: '9700000002',
            email: 'sneha.patel@example.com',
            address: 'Room 201, Green Living PG, Infopark Road, Kakkanad',
            street: 'Infopark South Gate Road',
            townOrcity: 'Kochi',
            postcode: '682042',
            walletAmount: 250,
        },
        {
            name: 'Rohan Thomas',
            phone: '9700000003',
            email: 'rohan.thomas@example.com',
            address: '12/450, Civil Station Road, Kakkanad, Kochi',
            street: 'Civil Station Cross Road',
            townOrcity: 'Kochi',
            postcode: '682030',
            walletAmount: 1000,
        },
        {
            name: 'Meera Krishnan',
            phone: '9700000004',
            email: 'meera.krishnan@example.com',
            address: 'Villa 8, Lotus Gardens, Palarivattom, Kochi',
            street: 'Stadium Link Road',
            townOrcity: 'Kochi',
            postcode: '682025',
            walletAmount: 0,
        },
        {
            name: 'Karthik Nair',
            phone: '9700000005',
            email: 'karthik.nair@example.com',
            address: 'B-302, Cyber Heights, Kakkanad, Kochi',
            street: 'Kakkanad Hill Valley',
            townOrcity: 'Kochi',
            postcode: '682042',
            walletAmount: 150,
        },
        {
            name: 'Divya S',
            phone: '9700000006',
            email: 'divya.s@example.com',
            address: 'House 15, Stadium Road, Palarivattom, Kochi',
            street: 'Jawaharlal Nehru Stadium Link Road',
            townOrcity: 'Kochi',
            postcode: '682025',
            walletAmount: 300,
        },
    ];

    const customerProfiles: any[] = [];
    for (const c of customerSeedConfigs) {
        let customer = await prisma.customer.findUnique({
            where: { phone: c.phone },
            include: {
                customerProfile: {
                    include: {
                        addresses: true,
                        Wallet: true,
                    },
                },
            },
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    name: c.name,
                    phone: c.phone,
                    email: c.email,
                    password: customerPasswordHash,
                    is_verified: true,
                    is_active: true,
                    customerProfile: {
                        create: {
                            address: c.address,
                            current_location: c.townOrcity,
                            latitude_logitude: '10.0159,76.3419',
                            walletAmount: c.walletAmount,
                            Wallet: {
                                create: {
                                    walletAmount: c.walletAmount,
                                },
                            },
                            addresses: {
                                create: {
                                    name: 'Home',
                                    street: c.street,
                                    townOrcity: c.townOrcity,
                                    postcode: c.postcode,
                                    phone: c.phone,
                                    email: c.email,
                                    country: 'India',
                                    isActive: true,
                                },
                            },
                        },
                    },
                },
                include: {
                    customerProfile: {
                        include: {
                            addresses: true,
                            Wallet: true,
                        },
                    },
                },
            });
        }
        customerProfiles.push(customer.customerProfile!);
    }

    /* --------------------------------------------------------------------------
     * 12. SUBSCRIPTIONS (UserSubscriptions)
     * -------------------------------------------------------------------------- */
    console.log('💳 Seeding Subscriptions...');
    const now = new Date();
    const startDate = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // started 4 days ago
    const endDate = new Date(now.getTime() + 26 * 24 * 60 * 60 * 1000);  // ends in 26 days

    const subscriptionConfigs = [
        {
            customerProfile: customerProfiles[0],
            mess: mess1,
            plan: plan2, // Monthly Full Meals
            partner: partnerMess1,
            priority: 1,
            totalPrice: 4500,
            discount: 300,
            discountedPrice: 4200,
            scheduleType: ScheduleType.EVERYDAY,
        },
        {
            customerProfile: customerProfiles[1],
            mess: mess1,
            plan: plan3, // Weekday Lunch
            partner: partnerMess1,
            priority: 2,
            totalPrice: 2400,
            discount: 200,
            discountedPrice: 2200,
            scheduleType: ScheduleType.CUSTOM,
            selectedDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
        },
        {
            customerProfile: customerProfiles[2],
            mess: mess1,
            plan: plan1, // Daily Meals
            partner: partnerMess1,
            priority: 3,
            totalPrice: 150,
            discount: 0,
            discountedPrice: 150,
            scheduleType: ScheduleType.EVERYDAY,
        },
        {
            customerProfile: customerProfiles[4],
            mess: mess1,
            plan: plan2, // Monthly Full Meals
            partner: partnerMess1,
            priority: 4,
            totalPrice: 4500,
            discount: 300,
            discountedPrice: 4200,
            scheduleType: ScheduleType.EVERYDAY,
        },
        // Mess 2 subscriptions
        {
            customerProfile: customerProfiles[3],
            mess: mess2,
            plan: plan5, // Pure Veg Monthly
            partner: partnerMess2,
            priority: 1,
            totalPrice: 3200,
            discount: 200,
            discountedPrice: 3000,
            scheduleType: ScheduleType.EVERYDAY,
        },
        {
            customerProfile: customerProfiles[5],
            mess: mess2,
            plan: plan4, // Pure Veg Daily
            partner: partnerMess2,
            priority: 2,
            totalPrice: 120,
            discount: 0,
            discountedPrice: 120,
            scheduleType: ScheduleType.EVERYDAY,
        },
    ];

    const subscriptions: any[] = [];
    for (const sub of subscriptionConfigs) {
        let userSub = await prisma.userSubscriptions.findFirst({
            where: {
                customerProfileId: sub.customerProfile.id,
                planId: sub.plan.id,
                messId: sub.mess.id,
            },
        });

        if (!userSub) {
            userSub = await prisma.userSubscriptions.create({
                data: {
                    customerProfileId: sub.customerProfile.id,
                    messId: sub.mess.id,
                    planId: sub.plan.id,
                    deliveryPartnerProfileId: sub.partner.id,
                    userAddressId: sub.customerProfile.addresses?.[0]?.id,
                    start_date: startDate,
                    end_date: endDate,
                    scheduleType: sub.scheduleType,
                    selectedDays: sub.selectedDays || undefined,
                    totalPrice: sub.totalPrice,
                    discount: sub.discount,
                    discountedPrice: sub.discountedPrice,
                    deliveryPriority: sub.priority,
                    is_active: true,
                    isActive: true,
                },
            });

            // If monthly plan, create initial ledger transaction
            if (sub.plan.isMonthlyPlan) {
                await prisma.customerMessTransaction.create({
                    data: {
                        customerProfileId: sub.customerProfile.id,
                        messId: sub.mess.id,
                        subscriptionId: userSub.id,
                        type: LedgerEntryType.DEBIT,
                        reason: LedgerEntryReason.MONTHLY_PLAN_CHARGE,
                        amount: sub.discountedPrice,
                        balanceAfter: sub.discountedPrice,
                        note: 'Monthly plan initial subscription charge',
                    },
                });

                // Customer advance payment
                await prisma.customerMessTransaction.create({
                    data: {
                        customerProfileId: sub.customerProfile.id,
                        messId: sub.mess.id,
                        subscriptionId: userSub.id,
                        type: LedgerEntryType.CREDIT,
                        reason: LedgerEntryReason.PAYMENT_RECEIVED,
                        amount: sub.discountedPrice,
                        balanceAfter: 0,
                        note: 'Initial subscription payment via UPI',
                    },
                });
            }
        }
        subscriptions.push({
            ...userSub,
            plan: sub.plan,
        });
    }

    /* --------------------------------------------------------------------------
     * 13. DELIVERIES & DELIVERY VARIATIONS
     * -------------------------------------------------------------------------- */
    console.log('📦 Seeding Deliveries & Daily Variations...');
    // Create deliveries for 7 days: 3 past days, today, and 3 upcoming days
    const dayOffsets = [-3, -2, -1, 0, 1, 2, 3];

    for (const sub of subscriptions) {
        const planWithVariations = await prisma.plans.findUnique({
            where: { id: sub.planId },
            include: { Variation: true },
        });

        const variationsForPlan = planWithVariations?.Variation ?? [];

        for (const offset of dayOffsets) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + offset);
            targetDate.setHours(12, 0, 0, 0); // Normalized time

            // Check if weekday matches if plan is custom Mon-Fri
            if (sub.scheduleType === ScheduleType.CUSTOM) {
                const dayNum = targetDate.getDay();
                if (dayNum === 0 || dayNum === 6) continue; // Skip Saturday/Sunday for Mon-Fri plan
            }

            // Check if delivery already exists
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            let delivery = await prisma.deliveries.findFirst({
                where: {
                    subscriptionId: sub.id,
                    date: { gte: startOfDay, lte: endOfDay },
                },
            });

            let deliveryStatus: DeliveryStatus = DeliveryStatus.PENDING;
            let actionText = 'Scheduled';

            if (offset < 0) {
                deliveryStatus = DeliveryStatus.DELIVERED;
                actionText = 'Delivered to customer doorstep';
            } else if (offset === 0) {
                deliveryStatus = DeliveryStatus.PENDING;
                actionText = 'In progress - out for lunch delivery';
            } else {
                deliveryStatus = DeliveryStatus.PENDING;
                actionText = 'Scheduled delivery';
            }

            if (!delivery) {
                delivery = await prisma.deliveries.create({
                    data: {
                        date: targetDate,
                        status: deliveryStatus,
                        action: actionText,
                        customerId: sub.customerProfileId,
                        planId: sub.planId,
                        partnerId: sub.deliveryPartnerProfileId,
                        messId: sub.messId,
                        subscriptionId: sub.id,
                        sequence: Math.abs(offset) + 1,
                        isActive: true,
                    },
                });

                // Create DeliveryVariation for each plan variation
                for (const v of variationsForPlan) {
                    let varStatus: VariationStatus = VariationStatus.PENDING;

                    if (offset < 0) {
                        varStatus = VariationStatus.DELIVERED;
                    } else if (offset === 0) {
                        // Today: Breakfast delivered, Lunch pending, Dinner pending
                        if (v.title.toLowerCase().includes('breakfast')) {
                            varStatus = VariationStatus.DELIVERED;
                        } else {
                            varStatus = VariationStatus.PENDING;
                        }
                    } else {
                        varStatus = VariationStatus.PENDING;
                    }

                    await prisma.deliveryVariation.upsert({
                        where: {
                            deliveryId_variationId: {
                                deliveryId: delivery.id,
                                variationId: v.id,
                            },
                        },
                        update: {},
                        create: {
                            deliveryId: delivery.id,
                            variationId: v.id,
                            status: varStatus,
                        },
                    });
                }

                // If daily plan and past delivery was completed, add ledger charge
                if (offset < 0 && sub.plan.isDailyPlan) {
                    await prisma.customerMessTransaction.upsert({
                        where: {
                            deliveryId_reason: {
                                deliveryId: delivery.id,
                                reason: LedgerEntryReason.DAILY_DELIVERY_CHARGE,
                            },
                        },
                        update: {},
                        create: {
                            customerProfileId: sub.customerProfileId,
                            messId: sub.messId,
                            subscriptionId: sub.id,
                            deliveryId: delivery.id,
                            type: LedgerEntryType.DEBIT,
                            reason: LedgerEntryReason.DAILY_DELIVERY_CHARGE,
                            amount: sub.plan.price,
                            balanceAfter: sub.plan.price,
                            note: `Daily delivery charge completed for ${targetDate.toISOString().slice(0, 10)}`,
                        },
                    });
                }
            }
        }
    }

    /* --------------------------------------------------------------------------
     * 14. TESTIMONIALS (Customer Reviews & Ratings)
     * -------------------------------------------------------------------------- */
    console.log('⭐ Seeding Testimonials...');
    const testimonialData = [
        {
            customerId: customerProfiles[0].id,
            messId: mess1.id,
            DeliveryagentId: partnerMess1.id,
            ratings: 5,
            reviews: 'The food tastes exactly like home-cooked meals! Always delivered hot and on time by Anil.',
        },
        {
            customerId: customerProfiles[1].id,
            messId: mess1.id,
            DeliveryagentId: partnerMess1.id,
            ratings: 5,
            reviews: 'Best corporate weekday lunch service in Kakkanad. Healthy, non-oily and super affordable.',
        },
        {
            customerId: customerProfiles[2].id,
            messId: mess1.id,
            DeliveryagentId: partnerMess1.id,
            ratings: 4,
            reviews: 'Generous portions and very consistent taste. Fish curry is exceptional!',
        },
        {
            customerId: customerProfiles[3].id,
            messId: mess2.id,
            DeliveryagentId: partnerMess2.id,
            ratings: 5,
            reviews: 'Authentic pure vegetarian Kerala sadhya feel everyday. Clean and hygienic kitchen.',
        },
    ];

    for (const t of testimonialData) {
        const existing = await prisma.testimonials.findFirst({
            where: { customerId: t.customerId, messId: t.messId },
        });

        if (!existing) {
            await prisma.testimonials.create({ data: t });
        }
    }

    console.log('✅ Seeding completed successfully!');
    console.log('────────────────────────────────────────────────────────────');
    console.log('📋 SUMMARY OF SEEDED CREDENTIALS:');
    console.log('Super Admin:');
    console.log('  Phone: 9895728129 | Email: admin@messmeals.com | Pass: DevPalqar@2026');
    console.log('Mess Admin:');
    console.log('  Phone: 9876543210 | Email: rahul.messadmin@messmeals.com | Pass: MessAdmin@123');
    console.log('Delivery Partners:');
    console.log('  Phone: 9800000001 (Anil) | Pass: Agent@123');
    console.log('  Phone: 9800000002 (Manoj) | Pass: Agent@123');
    console.log('Customers:');
    console.log('  Phone: 9700000001 (Arjun) | Pass: Customer@123');
    console.log('  Phone: 9700000002 (Sneha) | Pass: Customer@123');
    console.log('  Phone: 9700000003 (Rohan) | Pass: Customer@123');
    console.log('  Phone: 9700000004 (Meera) | Pass: Customer@123');
    console.log('Messes Seeded:');
    console.log('  1. Malabar Kitchen & Mess (Slug: malabar-kitchen-mess)');
    console.log('  2. Annapoorna Pure Veg Mess (Slug: annapoorna-pure-veg-mess)');
    console.log('────────────────────────────────────────────────────────────');
}

// Allow direct execution
if (require.main === module) {
    seedMessData()
        .catch((e) => {
            console.error('❌ Seeding failed:', e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}

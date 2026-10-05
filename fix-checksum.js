const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const content = fs.readFileSync('prisma/migrations/20261001093040_added_delivery_sequence/migration.sql');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    console.log("New hash:", hash);
    
    await prisma.$executeRawUnsafe(`UPDATE _prisma_migrations SET checksum='${hash}' WHERE migration_name='20261001093040_added_delivery_sequence'`);
    console.log("Updated checksum.");
}

main().finally(() => prisma.$disconnect());

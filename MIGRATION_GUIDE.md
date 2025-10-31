# Multi-Mess Platform Migration Guide

This guide will help you migrate your single-mess Super Meals application to a multi-mess platform.

## Changes Overview

### Database Schema Changes
1. **New `Mess` model** - Represents individual messes in the platform
2. **New `MessAdminProfile` model** - Manages mess administrators
3. **New `MESSADMIN` role** - Added to the Roles enum
4. **Updated `Plans` model** - Now includes `messId` field (required)
5. **Many-to-many relationship** - Between MessAdminProfile and Mess

### New Features
- Multiple messes can be managed within a single platform
- Mess administrators can be assigned to one or multiple messes
- Plans are now mess-specific
- Mess-level statistics and reporting
- Comprehensive API documentation

## Migration Steps

### 1. Backup Your Database
Before proceeding, **backup your existing database**:
```bash
# For MySQL
mysqldump -u username -p database_name > backup_$(date +%Y%m%d).sql
```

### 2. Generate Prisma Migration
```bash
npx prisma migrate dev --name add_multi_mess_support
```

This will:
- Create a new migration file
- Update your database schema
- Regenerate the Prisma Client

### 3. Handle Existing Data

Since `Plans` now requires a `messId`, you'll need to create at least one mess and assign existing plans to it:

```typescript
// Create a migration script: prisma/migrations/assign-default-mess.ts

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create a default mess
  const defaultMess = await prisma.mess.create({
    data: {
      name: 'Default Mess',
      description: 'Default mess for existing plans',
      is_active: true,
    },
  });

  console.log(`Created default mess: ${defaultMess.id}`);
  
  // Note: If you have existing plans, you'll need to manually update them
  // or handle this in the migration SQL directly
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
```

### 4. Install Dependencies (if needed)
```bash
npm install
```

### 5. Start the Application
```bash
npm run start:dev
```

## API Changes

### Breaking Changes
1. **Plans endpoints now require `messId`**:
   - `POST /plans` - Now requires `messId` in request body
   - `GET /plans` - Optionally filter by `messId` query parameter
   - Plan responses now include mess information

### New Endpoints

#### Mess Management
- `POST /mess` - Create a new mess
- `GET /mess` - List all messes (with pagination)
- `GET /mess/:id` - Get mess details
- `PATCH /mess/:id` - Update mess
- `DELETE /mess/:id` - Delete mess
- `GET /mess/:id/stats` - Get mess statistics

#### Mess Admin Management
- `POST /mess-admin` - Create a new mess admin
- `POST /mess-admin/assign` - Assign user as mess admin
- `DELETE /mess-admin/remove` - Remove mess admin from mess
- `GET /mess-admin` - List all mess admins
- `GET /mess-admin/by-mess/:messId` - Get admins for a mess
- `GET /mess-admin/:userId` - Get mess admin details

### Updated Endpoints
- `POST /auth/send-reg-otp` - Now accepts optional `role` field (can be MESSADMIN)
- `GET /plans` - Now accepts optional `messId` query parameter
- All plan responses now include mess information

## User Roles

### New Role: MESSADMIN
- Can manage plans within assigned messes
- Can view mess-specific statistics
- Cannot create/delete messes (requires ADMIN or SUPERADMIN)
- Can be assigned to multiple messes

### Role Hierarchy
1. **SUPERADMIN** - Full platform access
2. **ADMIN** - Can manage messes, users, and all plans
3. **MESSADMIN** - Can manage assigned messes and their plans
4. **DELIVERYAGENT** - Can update delivery status
5. **USER** - Regular customers

## Testing the Migration

### 1. Create a Test Mess
```bash
curl -X POST http://localhost:3000/mess \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test Mess",
    "description": "A test mess",
    "address": "123 Test Street",
    "phone": "1234567890",
    "email": "test@mess.com"
  }'
```

### 2. Create a Mess Admin
```bash
curl -X POST http://localhost:3000/mess-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "John Doe",
    "phone": "9876543210",
    "email": "john@example.com",
    "messIds": ["MESS_ID_FROM_STEP_1"]
  }'
```

### 3. Create a Plan for the Mess
```bash
curl -X POST http://localhost:3000/plans \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "planName=Lunch Plan" \
  -F "price=150" \
  -F "description=Daily lunch plan" \
  -F "messId=MESS_ID_FROM_STEP_1" \
  -F "planImages=@image1.jpg"
```

## Rollback Plan

If you need to rollback the migration:

```bash
# Restore from backup
mysql -u username -p database_name < backup_YYYYMMDD.sql

# Or use Prisma migrate
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

## Additional Resources

- Full API documentation: `api.json`
- Prisma schema: `prisma/schema.prisma`
- Environment variables: `.env`

## Support

For issues or questions:
1. Check the API documentation in `api.json`
2. Review the Prisma schema for data model relationships
3. Ensure all required environment variables are set

## Next Steps After Migration

1. **Create initial messes** for your organization
2. **Assign mess admins** to manage each mess
3. **Migrate existing plans** to appropriate messes
4. **Update frontend** to handle multi-mess selection
5. **Set up proper authentication** and role-based access control
6. **Test all workflows** with different user roles

---

**Important Notes:**
- The migration will fail if you have existing plans without a `messId`
- You must create at least one mess before creating new plans
- Deleting a mess will cascade delete all its plans and subscriptions
- Mess admins can be assigned to multiple messes

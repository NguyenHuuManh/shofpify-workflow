/**
 * Purpose:
 * Database seed script for development and testing.
 * Creates initial data required for the platform to function.
 *
 * Responsibilities:
 * - Seed default settings
 * - Create a default admin user
 * - Create sample data for development
 *
 * Dependencies:
 * - @prisma/client
 * - @/lib/prisma (avoided - uses standalone PrismaClient for seed runs)
 *
 * Usage:
 *   npx tsx prisma/seed.ts
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // -------------------------------------------------------------------------
  // Default Settings
  // -------------------------------------------------------------------------
  const defaultSettings = [
    { key: 'DEFAULT_AI_MODEL', value: { model: 'claude-3-5-sonnet-20240620' } },
    { key: 'DEFAULT_RETRY_COUNT', value: { count: 3 } },
    { key: 'PUBLISHING_RULES', value: { requireApproval: true } },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log('  ✓ Settings seeded');

  // -------------------------------------------------------------------------
  // Default Admin User
  // -------------------------------------------------------------------------
  await prisma.user.upsert({
    where: { email: 'admin@shopify-autonomous.com' },
    update: {},
    create: {
      email: 'admin@shopify-autonomous.com',
      name: 'Platform Admin',
      role: UserRole.ADMIN,
    },
  });
  console.log('  ✓ Admin user seeded');

  // -------------------------------------------------------------------------
  // Default Reviewer User
  // -------------------------------------------------------------------------
  await prisma.user.upsert({
    where: { email: 'reviewer@shopify-autonomous.com' },
    update: {},
    create: {
      email: 'reviewer@shopify-autonomous.com',
      name: 'Content Reviewer',
      role: UserRole.REVIEWER,
    },
  });
  console.log('  ✓ Reviewer user seeded');

  console.log('✅ Seed complete');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('❌ Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

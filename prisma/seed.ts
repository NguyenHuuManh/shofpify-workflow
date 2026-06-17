/**
 * Purpose:
 * Database seed script for development and testing.
 * Creates initial data required for the platform to function.
 *
 * Responsibilities:
 * - Seed default settings
 * - Create a default admin user with hashed password
 * - Create a default reviewer user with hashed password
 * - Create sample data for development
 *
 * Dependencies:
 * - @prisma/client
 * - bcryptjs (for password hashing)
 *
 * Usage:
 *   npx tsx prisma/seed.ts
 */

import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

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
  // Default Passwords (development only — change in production!)
  // -------------------------------------------------------------------------
  const adminPasswordHash = await hash('Admin123!', 12);
  const reviewerPasswordHash = await hash('Reviewer123!', 12);

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
      passwordHash: adminPasswordHash,
    },
  });
  console.log('  ✓ Admin user seeded (admin@shopify-autonomous.com / Admin123!)');

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
      passwordHash: reviewerPasswordHash,
    },
  });
  console.log('  ✓ Reviewer user seeded (reviewer@shopify-autonomous.com / Reviewer123!)');

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

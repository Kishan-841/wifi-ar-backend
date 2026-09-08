import { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth';

/**
 * One-time admin bootstrap:  ADMIN_NAME=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin
 * The auth migration inserted a placeholder admin (admin@local, unusable
 * password) that owns all pre-existing data; this gives it real credentials.
 * Refuses to run if a real admin already exists.
 */
const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!name || !email || !password || password.length < 8) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars)');
  }
  const admins = await prisma.user.findMany({ where: { role: 'admin' } });
  const placeholder = admins.find((a) => a.email === 'admin@local');
  const real = admins.find((a) => a.email !== 'admin@local');
  if (real) throw new Error(`An admin already exists (${real.email}). Refusing to overwrite.`);

  const passwordHash = await hashPassword(password);
  const admin = placeholder
    ? await prisma.user.update({ where: { id: placeholder.id }, data: { name, email, passwordHash } })
    : await prisma.user.create({ data: { name, email, passwordHash, role: 'admin' } });
  console.log(`admin ready: ${admin.name} <${admin.email}>`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

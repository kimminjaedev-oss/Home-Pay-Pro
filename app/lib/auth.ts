import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db, usersTable } from './db';

export async function getDbUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  return user ?? null;
}

export async function getAdminUser() {
  const user = await getDbUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function requireUserId() {
  const { userId } = await auth();
  return userId ?? null;
}

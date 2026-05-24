import { NextRequest, NextResponse } from 'next/server';
import { db, householdsTable, importedHouseholdDataTable, usersTable } from '@/app/lib/db';
import { eq, or } from 'drizzle-orm';
import { requireUserId } from '@/app/lib/auth';

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized: set DEV_AUTH_USER_ID' }, { status: 401 });

  const { name, email, unitNumber } = await req.json();
  if (!name || !email) return NextResponse.json({ error: 'name and email are required' }, { status: 400 });

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (existing) return NextResponse.json(existing);

  const cond = [] as any[];
  if (unitNumber) cond.push(eq(householdsTable.unitNumber, unitNumber));
  if (email) cond.push(eq(householdsTable.email, email));

  let unpaid = 0;
  let matched = unitNumber ?? null;
  if (cond.length) {
    const [h] = await db.select().from(householdsTable).where(or(...cond)).limit(1);
    if (h) {
      unpaid = parseFloat(h.unpaidBalance);
      matched = h.unitNumber;
    }
  }

  const [u] = await db
    .insert(usersTable)
    .values({ clerkId: userId, name, email, role: 'user', unitNumber: matched, unpaidBalance: String(unpaid) })
    .returning();

  if (matched) {
    await db
      .update(importedHouseholdDataTable)
      .set({ isMatched: true, matchedUserId: u.id })
      .where(eq(importedHouseholdDataTable.unitNumber, matched));
  }

  return NextResponse.json(u, { status: 201 });
}

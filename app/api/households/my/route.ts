import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, householdsTable } from '@/app/lib/db';
import { getDbUser } from '@/app/lib/auth';

export async function GET(){
 const user=await getDbUser(); if(!user) return NextResponse.json({error:'Unauthorized'},{status:401});
 const [h]=await db.select().from(householdsTable).where(eq(householdsTable.userId,user.id)).limit(1);
 return NextResponse.json(h ?? null);
}

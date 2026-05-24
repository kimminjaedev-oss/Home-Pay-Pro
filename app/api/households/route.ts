import { NextRequest, NextResponse } from 'next/server';
import { ilike, or } from 'drizzle-orm';
import { db, householdsTable } from '@/app/lib/db';
import { getAdminUser } from '@/app/lib/auth';

export async function GET(req:NextRequest){
 const admin=await getAdminUser(); if(!admin) return NextResponse.json({error:'Forbidden'},{status:403});
 const q=req.nextUrl.searchParams.get('search');
 const rows= q ? await db.select().from(householdsTable).where(or(ilike(householdsTable.unitNumber,`%${q}%`),ilike(householdsTable.ownerName,`%${q}%`),ilike(householdsTable.email,`%${q}%`))) : await db.select().from(householdsTable);
 return NextResponse.json({households:rows});
}

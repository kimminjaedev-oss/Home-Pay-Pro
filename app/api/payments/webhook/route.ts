import Stripe from 'stripe';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { db, householdsTable, paymentsTable, usersTable } from '@/app/lib/db';
import { eq } from 'drizzle-orm';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' }) : null;

export async function POST(req:NextRequest){
 if(!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({error:'Stripe not configured'},{status:500});
 const body = await req.text();
 const sig = (await headers()).get('stripe-signature');
 if(!sig) return NextResponse.json({error:'Missing signature'},{status:400});
 let event:Stripe.Event;
 try{event=stripe.webhooks.constructEvent(body,sig,process.env.STRIPE_WEBHOOK_SECRET);}catch(e){return NextResponse.json({error:'Invalid signature'},{status:400});}
 if(event.type==='checkout.session.completed'){
   const s=event.data.object as Stripe.Checkout.Session; const pid=Number(s.metadata?.paymentId||0); const uid=Number(s.metadata?.userId||0); const amount=(s.amount_total||0)/100;
   if(pid&&uid){ await db.update(paymentsTable).set({status:'completed'}).where(eq(paymentsTable.id,pid)); const [u]=await db.select().from(usersTable).where(eq(usersTable.id,uid)).limit(1); if(u){ const n=Math.max(0,parseFloat(u.unpaidBalance)-amount); await db.update(usersTable).set({unpaidBalance:String(n)}).where(eq(usersTable.id,uid)); await db.update(householdsTable).set({unpaidBalance:String(n)}).where(eq(householdsTable.userId,uid)); }}
 }
 return NextResponse.json({received:true});
}

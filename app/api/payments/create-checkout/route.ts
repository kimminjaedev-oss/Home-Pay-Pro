import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db, paymentsTable } from '@/app/lib/db';
import { eq } from 'drizzle-orm';
import { getDbUser } from '@/app/lib/auth';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' }) : null;

export async function POST(req:NextRequest){
  const user=await getDbUser(); if(!user) return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!stripe) return NextResponse.json({error:'STRIPE_SECRET_KEY missing'},{status:500});
  const {amount,description}=await req.json();
  const [payment]=await db.insert(paymentsTable).values({userId:user.id,amount:String(amount),status:'pending'}).returning();
  const baseUrl=process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],line_items:[{price_data:{currency:'usd',product_data:{name:description||'Maintenance Fee'},unit_amount:Math.round(Number(amount)*100)},quantity:1}],success_url:`${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${baseUrl}/payment/cancel`,metadata:{userId:String(user.id),paymentId:String(payment.id)}});
  await db.update(paymentsTable).set({stripeSessionId:session.id}).where(eq(paymentsTable.id,payment.id));
  return NextResponse.json({url:session.url,sessionId:session.id});
}

import { NextResponse } from 'next/server';
import { getDbUser } from '@/app/lib/auth';

export async function GET(){
 const user=await getDbUser();
 if(!user) return NextResponse.json({error:'Unauthorized'},{status:401});
 return NextResponse.json({...user, unpaidBalance: parseFloat(user.unpaidBalance)});
}

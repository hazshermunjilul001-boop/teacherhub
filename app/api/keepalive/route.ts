// app/api/keepalive/route.ts
// Ping this every 3 days via cron-job.org to keep Supabase free tier alive
// URL: https://yourapp.vercel.app/api/keepalive

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Lightweight ping — just check sections table exists
    const { error } = await supabase
      .from('sections')
      .select('id')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      status:  'alive',
      time:    new Date().toISOString(),
      message: 'TeacherHub PH database is active',
    });

  } catch (err: any) {
    return NextResponse.json({
      status:  'error',
      message: err.message,
    }, { status: 500 });
  }
}
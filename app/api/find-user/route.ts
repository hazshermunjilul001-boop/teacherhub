// app/api/find-user/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const user = data.users.find(
    u => u.email?.toLowerCase() === email.toLowerCase().trim()
  );

  if (!user) {
    return NextResponse.json({ error: 'User not found' });
  }

  return NextResponse.json({ userId: user.id });
}
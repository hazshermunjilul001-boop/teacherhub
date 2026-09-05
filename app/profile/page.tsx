'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, UserCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return; }
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const saved = [metadata.full_name, metadata.name, metadata.display_name]
        .find(value => typeof value === 'string' && value.trim()) as string | undefined;
      setEmail(user.email ?? '');
      setFullName(saved?.trim() || '');
      setLoading(false);
    });
  }, [router]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const name = fullName.trim();
    if (!name) { setError('Enter your actual full name.'); return; }
    setSaving(true); setError(''); setMessage('');
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: name, display_name: name },
    });
    if (updateError) setError(updateError.message);
    else setMessage('Your actual name was saved. It will be used on linked class-record signatories.');
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-gray-950 text-gray-300 flex items-center justify-center">Loading profile…</div>;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8">
          <ArrowLeft size={18}/> Back
        </button>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <UserCircle size={32} className="text-blue-400"/>
            <div><h1 className="text-xl font-bold">Teacher Profile</h1><p className="text-sm text-gray-500">Set the name used on official class-record signatories.</p></div>
          </div>
          <form onSubmit={save} className="space-y-5">
            <div><label className="block text-sm text-gray-400 mb-1">Login email</label><div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-gray-500">{email}</div><p className="text-xs text-gray-600 mt-1">Your email remains unchanged and is used for login and invitations.</p></div>
            <div><label className="block text-sm text-gray-400 mb-1">Actual full name</label><input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. JUAN DELA CRUZ" className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500" autoComplete="name"/><p className="text-xs text-gray-500 mt-1">This name replaces the email address on linked class-record teacher/signatory fields.</p></div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-emerald-400">{message}</p>}
            <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl px-4 py-3 font-semibold"><Save size={17}/>{saving ? 'Saving…' : 'Save Actual Name'}</button>
          </form>
        </div>
      </div>
    </main>
  );
}

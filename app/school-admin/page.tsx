'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  XCircle, Users, RefreshCw,
  ArrowLeft, UserPlus, Shield, Clock, CheckCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TeacherRow {
  user_id:    string;
  user_email: string;
  plan_id:    string;
  status:     string;
  expires_at: string | null;
}

interface InviteRow {
  id:         string;
  email:      string;
  claimed:    boolean;
  created_at: string;
}

interface School {
  id:            string;
  name:          string;
  school_id_str: string;
  division:      string;
  expires_at:    string | null;
  max_teachers:  number;
}

export default function SchoolAdminPage() {
  const router = useRouter();

  const [school,     setSchool]     = useState<School | null>(null);
  const [teachers,   setTeachers]   = useState<TeacherRow[]>([]);
  const [invites,    setInvites]    = useState<InviteRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [newEmail,   setNewEmail]   = useState('');
  const [adding,     setAdding]     = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [addError,   setAddError]   = useState('');
  const [schoolId,   setSchoolId]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      const { data: adminRow } = await supabase
        .from('school_admins')
        .select('school_id')
        .eq('user_id', user.id)
        .single();

      if (!adminRow) { router.push('/'); return; }

      setSchoolId(adminRow.school_id);

      const { data: schoolData } = await supabase
        .from('schools')
        .select('*')
        .eq('id', adminRow.school_id)
        .single();

      setSchool(schoolData);
      await loadAll(adminRow.school_id);
      setLoading(false);
    })();
  }, []);

  const loadAll = async (sid: string) => {
    const { data: teacherData } = await supabase
      .from('subscriptions')
      .select('user_id, user_email, plan_id, status, expires_at')
      .eq('school_id', sid)
      .eq('plan_id', 'school');
    setTeachers(teacherData ?? []);

    const { data: inviteData } = await supabase
      .from('school_invites')
      .select('id, email, claimed, created_at')
      .eq('school_id', sid)
      .order('created_at', { ascending: false });
    setInvites(inviteData ?? []);
  };

  // Add a teacher email to the whitelist — works even if they haven't registered yet.
  // When they sign up with this exact email, they're auto-activated to the School Plan.
  const inviteTeacher = async () => {
    if (!newEmail.trim() || !schoolId) return;
    setAdding(true);
    setAddError('');

    const email = newEmail.trim().toLowerCase();

    // Check if already invited
    const { data: existing } = await supabase
      .from('school_invites')
      .select('id')
      .ilike('email', email)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (existing) {
      setAddError(`${email} is already on the list.`);
      setAdding(false);
      return;
    }

    const { error } = await supabase.from('school_invites').insert({
      school_id: schoolId,
      email,
      claimed:   false,
    });

    if (error) {
      setAddError('Error adding teacher: ' + error.message);
    } else {
      setNewEmail('');
      await loadAll(schoolId);
    }
    setAdding(false);
  };

  const removeInvite = async (inviteId: string) => {
    if (!confirm('Remove this email from the list?')) return;
    setProcessing(inviteId);
    await supabase.from('school_invites').delete().eq('id', inviteId);
    await loadAll(schoolId!);
    setProcessing(null);
  };

  const removeTeacher = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from the School Plan?\n\nThey will revert to the Free plan.`)) return;
    setProcessing(userId);

    await supabase.from('subscriptions').update({
      plan_id:    'free',
      status:     'active',
      school_id:  null,
      expires_at: null,
    }).eq('user_id', userId);

    await loadAll(schoolId!);
    setProcessing(null);
  };

  const daysLeft = school?.expires_at
    ? Math.max(0, Math.ceil(
        (new Date(school.expires_at).getTime() - Date.now()) / 86400000
      ))
    : null;

  // Pending invites = added to whitelist but haven't registered/claimed yet
  const pendingInvites = invites.filter(i => !i.claimed);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <RefreshCw size={24} className="animate-spin text-teal-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">{school?.name}</h1>
          <p className="text-gray-500 text-xs flex items-center gap-2">
            <Shield size={12} className="text-purple-400" />
            School Admin Panel
            {daysLeft !== null && (
              <span className="text-amber-400 ml-1">· {daysLeft} days remaining</span>
            )}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-teal-900/30 border border-teal-800 px-3 py-1.5 rounded-xl text-sm text-teal-400">
            <CheckCircle size={14} />
            <span>{teachers.length} active</span>
          </div>
          {pendingInvites.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-800 px-3 py-1.5 rounded-xl text-sm text-amber-400">
              <Clock size={14} />
              <span>{pendingInvites.length} pending</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto">

        {/* School Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'School ID',    value: school?.school_id_str || '—' },
            { label: 'Division',     value: school?.division || '—' },
            { label: 'Plan expires', value: school?.expires_at
                ? new Date(school.expires_at).toLocaleDateString('en-PH')
                : '—' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
              <p className="text-gray-500 text-xs">{stat.label}</p>
              <p className="text-white font-semibold mt-1 text-sm">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Add Teacher */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-1">Add a Teacher</h2>
          <p className="text-gray-400 text-sm mb-4">
            Add the teacher's email even if they haven't registered yet. As soon as they
            sign up at <span className="text-blue-400">teacherhub-one.vercel.app</span> with
            this exact email, they'll be automatically upgraded to the School Plan.
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setAddError(''); }}
              onKeyDown={e => e.key === 'Enter' && inviteTeacher()}
              placeholder="teacher@deped.gov.ph"
              className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 text-sm"
            />
            <button
              onClick={inviteTeacher}
              disabled={adding || !newEmail.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-teal-700 hover:bg-teal-600 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {adding
                ? <RefreshCw size={16} className="animate-spin" />
                : <UserPlus size={16} />}
              Add to List
            </button>
          </div>
          {addError && (
            <p className="mt-3 text-amber-400 text-xs bg-amber-900/20 border border-amber-800 rounded-xl px-3 py-2 whitespace-pre-line">
              {addError}
            </p>
          )}
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="font-bold flex items-center gap-2">
                <Clock size={16} className="text-amber-400" />
                Waiting to Register ({pendingInvites.length})
              </h2>
              <p className="text-gray-500 text-xs mt-1">
                These teachers were added but haven't created their account yet.
              </p>
            </div>
            <div className="divide-y divide-gray-800">
              {pendingInvites.map(inv => (
                <div key={inv.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">{inv.email}</p>
                    <p className="text-gray-500 text-xs">
                      Added {new Date(inv.created_at).toLocaleDateString('en-PH')}
                    </p>
                  </div>
                  <button
                    onClick={() => removeInvite(inv.id)}
                    disabled={processing === inv.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 rounded-xl text-xs text-red-400 transition disabled:opacity-50"
                  >
                    {processing === inv.id
                      ? <RefreshCw size={12} className="animate-spin" />
                      : <XCircle size={12} />}
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Teachers List */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-bold">Active Teachers</h2>
            <button
              onClick={() => schoolId && loadAll(schoolId)}
              className="text-gray-400 hover:text-white transition"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {teachers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No teachers activated yet.</p>
              <p className="text-xs mt-1 text-gray-600">
                Add a teacher email above to get started.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Email', 'Status', 'Plan Expires', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-400 text-xs font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.user_id} className="border-t border-gray-800 hover:bg-gray-800/40">
                    <td className="px-4 py-3 text-white text-sm">{t.user_email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        t.status === 'active'
                          ? 'bg-teal-900/50 text-teal-400 border border-teal-700'
                          : 'bg-gray-800 text-gray-500'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {t.expires_at
                        ? new Date(t.expires_at).toLocaleDateString('en-PH')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeTeacher(t.user_id, t.user_email)}
                        disabled={processing === t.user_id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 rounded-xl text-xs text-red-400 transition disabled:opacity-50"
                      >
                        {processing === t.user_id
                          ? <RefreshCw size={12} className="animate-spin" />
                          : <XCircle size={12} />}
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
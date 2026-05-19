'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Lock, Menu, LogOut, BookOpen, Users, Calendar,
  Heart, Award, FileText, ChevronRight, BarChart2,
  GraduationCap, Bell, ChevronDown, Settings, Plus,
  CheckCircle, CreditCard, Shield,
} from 'lucide-react';
import { useSubscription } from '../lib/useSubscription';
import { supabase } from '../lib/supabase';
import { useSection, type Section } from '../context/SectionContext';

// ─────────────────────────────────────────────────────────────────────────────
// NAV ITEMS
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { name: 'Dashboard',                icon: BookOpen,      path: '/',             status: 'active' },
  { name: 'Class Record',             icon: Users,         path: '/class-record', status: 'active' },
  { name: 'Attendance (SF2)',         icon: Calendar,      path: '/attendance',   status: 'active' },
  { name: 'MPS & Item Analysis',      icon: BarChart2,     path: '/mps',          status: 'active' },
  { name: 'Health & Nutrition (SF8)', icon: Heart,         path: '/sf8',          status: 'active' },
  { name: 'Behavior Record',          icon: Award,         path: '/behavior',     status: 'active' },
  { name: 'SF5 / LIS Export',         icon: FileText,      path: '/sf5',          status: 'active' },
  { name: 'Report Card (SF9)',         icon: GraduationCap, path: '/sf9',          status: 'active' },
];

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [isLogin,  setIsLogin]  = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setError(error.message);
        else setError('✓ Registered! Check your email to confirm, or sign in if confirmation is disabled.');
      }
    } catch { setError('Unexpected error. Please try again.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"/>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"/>
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-2xl mb-4">
            <GraduationCap size={40} className="text-blue-700"/>
          </div>
          <h1 className="text-4xl font-bold text-white">TeacherHub PH</h1>
          <p className="text-blue-200 mt-2">All-in-1 DepEd Tools for Filipino Teachers</p>
        </div>
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white text-center mb-6">
            {isLogin ? 'Welcome back!' : 'Create account'}
          </h2>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-blue-300" size={18}/>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-blue-300 focus:outline-none focus:border-blue-400 focus:bg-white/20 transition"
                  placeholder="teacher@deped.gov.ph"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-blue-300" size={18}/>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-blue-300 focus:outline-none focus:border-blue-400 focus:bg-white/20 transition"
                  placeholder="••••••••"/>
              </div>
            </div>
            {error && (
              <div className={`text-sm px-4 py-3 rounded-xl ${error.startsWith('✓') ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'}`}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-white text-blue-800 font-bold py-3.5 rounded-2xl hover:bg-blue-50 transition disabled:opacity-70 text-lg mt-2">
              {loading ? 'Please wait…' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          <p className="text-center mt-5 text-blue-200 text-sm">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-white font-semibold hover:underline">
              {isLogin ? 'Register free' : 'Sign in'}
            </button>
          </p>
        </div>
        <p className="text-center text-blue-300/60 text-xs mt-6">
          For DepEd public school teachers 🇵🇭 · Revised K-12 Curriculum
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION SWITCHER (inside sidebar)
// ─────────────────────────────────────────────────────────────────────────────

function SectionSwitcher({ sidebarOpen, onManage }: { sidebarOpen: boolean; onManage: () => void }) {
  const { sections, activeSection, setActiveSection } = useSection();
  const [open, setOpen] = useState(false);

  if (!sidebarOpen) {
    return (
      <button onClick={onManage} title="Manage Sections"
        className="w-full flex items-center justify-center py-3 rounded-xl hover:bg-gray-800 transition text-blue-400">
        <BookOpen size={20}/>
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Current section button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl px-3 py-2.5 transition group">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
          {activeSection?.grade_number ?? '?'}
        </div>
        <div className="flex-1 text-left overflow-hidden">
          {activeSection ? (
            <>
              <div className="text-white text-sm font-semibold truncate leading-tight">{activeSection.name}</div>
              <div className="text-gray-400 text-xs truncate">{activeSection.grade_level}</div>
            </>
          ) : (
            <div className="text-gray-400 text-sm">No section selected</div>
          )}
        </div>
        <ChevronDown size={14} className={`text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="p-2 border-b border-gray-700">
            <p className="text-xs text-gray-500 px-2 py-1">Switch Section</p>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {sections.map(sec => (
              <button key={sec.id}
                onClick={() => { setActiveSection(sec); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition hover:bg-gray-700
                  ${activeSection?.id === sec.id ? 'bg-blue-900/40' : ''}`}>
                <div className="w-7 h-7 bg-blue-900 rounded-lg flex items-center justify-center text-blue-400 font-black text-sm flex-shrink-0">
                  {sec.grade_number}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-white text-sm font-medium truncate">{sec.name}</div>
                  <div className="text-gray-400 text-xs truncate">{sec.grade_level}</div>
                </div>
                {activeSection?.id === sec.id && <CheckCircle size={14} className="text-blue-400 flex-shrink-0"/>}
              </button>
            ))}
          </div>
          <div className="p-1 border-t border-gray-700">
            <button onClick={() => { onManage(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:bg-gray-700 hover:text-white transition text-sm">
              <Settings size={14}/> Manage Sections
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD (logged-in)
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard({ user }: { user: any }) {
  const router = useRouter();
  const { activeSection, sections } = useSection();
  const { planName, isFree, daysLeft } = useSubscription();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePath,  setActivePath]  = useState('/');
  const [stats, setStats] = useState({ students: 0, average: 0, passing: 0, days: 0 });

  const emailDisplay = user?.email?.split('@')[0] ?? 'Teacher';

  // Load live stats for active section
  useEffect(() => {
    if (!activeSection) return;
    (async () => {
      const { count } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('section_id', activeSection.id);

      const { count: days } = await supabase
        .from('attendance')
        .select('date', { count: 'exact', head: true })
        .eq('section_id', activeSection.id);

      setStats(prev => ({
        ...prev,
        students: count ?? 0,
        days: days ?? 0,
      }));
    })();
  }, [activeSection]);

  const handleNav = (item: typeof NAV_ITEMS[0]) => {
    if (item.status === 'coming') return;
    setActivePath(item.path);
    router.push(item.path);
  };

  const STAT_CARDS = [
    { label: 'Total Learners', value: stats.students || '—', sub: activeSection?.name ?? 'no section', color: 'from-blue-600 to-blue-800' },
    { label: 'Class Average',  value: '—',                    sub: 'this term',                         color: 'from-emerald-600 to-emerald-800' },
    { label: 'Passing Rate',   value: '—',                    sub: 'above 75',                          color: 'from-purple-600 to-purple-800' },
    { label: 'Days Recorded',  value: stats.days || '—',      sub: 'attendance',                        color: 'from-amber-600 to-amber-800' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* ── SIDEBAR ── */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-20'} bg-gray-900 border-r border-gray-800 h-screen flex flex-col transition-all duration-300 sticky top-0 flex-shrink-0`}>

        {/* Logo */}
        <div className="p-5 border-b border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <GraduationCap size={22} className="text-white"/>
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="font-bold text-white text-lg leading-tight">TeacherHub PH</div>
              <div className="text-blue-400 text-xs">Revised K-12 Curriculum</div>
            </div>
          )}
        </div>

        {/* Section switcher */}
        <div className="px-3 py-3 border-b border-gray-800">
          <SectionSwitcher
            sidebarOpen={sidebarOpen}
            onManage={() => router.push('/sections')}
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = activePath === item.path;
            const isComing = item.status === 'coming';
            return (
              <button key={item.name} onClick={() => handleNav(item)}
                title={!sidebarOpen ? item.name : undefined}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all
                  ${isActive  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : ''}
                  ${isComing  ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-800 text-gray-300'}`}>
                <item.icon size={20} className="flex-shrink-0"/>
                {sidebarOpen && (
                  <div className="flex-1 flex items-center justify-between overflow-hidden">
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    {isComing
                      ? <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">Soon</span>
                      : <ChevronRight size={14} className="text-gray-500 flex-shrink-0"/>}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Plan badge + upgrade prompt */}
        {sidebarOpen && (
          <div className="px-3 pb-1 space-y-1">
            {/* Current plan indicator */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${
              isFree ? 'bg-gray-800 text-gray-400' : 'bg-blue-900/40 text-blue-300'
            }`}>
              <div className="flex items-center gap-1.5">
                {isFree ? <CreditCard size={12}/> : <Shield size={12}/>}
                <span className="font-semibold">{planName}</span>
              </div>
              {daysLeft !== null && daysLeft <= 7 && (
                <span className="text-amber-400 text-xs">{daysLeft}d left</span>
              )}
            </div>
            {/* Upgrade button for free users */}
            {isFree && (
              <button onClick={() => router.push('/subscribe')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 transition text-xs font-semibold border border-blue-800">
                ⭐ Upgrade to Pro ⭐
              </button>
            )}
            <button onClick={() => router.push('/sections')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition text-sm">
              <Settings size={16} className="flex-shrink-0"/>
              <span>Manage Sections</span>
            </button>
            {/* Admin link — only visible to admin */}
            {user?.email === 'hazsher.munjilul001@deped.gov.ph' && (
              <button onClick={() => router.push('/admin')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-purple-500 hover:bg-purple-900/20 hover:text-purple-400 transition text-sm">
                <Shield size={14} className="flex-shrink-0"/>
                <span>Admin Panel</span>
              </button>
            )}
          </div>
        )}

        {/* Sign out */}
        <div className="p-3 border-t border-gray-800 space-y-1">
          {sidebarOpen && (
            <div className="px-3 py-2 text-xs text-gray-500 truncate">
              Signed in as <span className="text-gray-300">{user?.email}</span>
            </div>
          )}
          <button onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition">
            <LogOut size={18} className="flex-shrink-0"/>
            {sidebarOpen && <span className="text-sm">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* Top bar */}
        <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-4 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white transition">
            <Menu size={22}/>
          </button>
          <div className="flex-1 flex items-center gap-3">
            <div>
              <span className="text-gray-300 text-sm">Good day, </span>
              <span className="text-white font-semibold capitalize">{emailDisplay}!</span>
            </div>
            {/* Active section chip */}
            {activeSection && (
              <div className="hidden md:flex items-center gap-2 bg-blue-900/40 border border-blue-800 rounded-xl px-3 py-1.5">
                <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center text-white font-black text-xs">
                  {activeSection.grade_number}
                </div>
                <span className="text-blue-300 text-sm font-medium">{activeSection.name}</span>
                <span className="text-blue-500 text-xs">·</span>
                <span className="text-blue-400 text-xs">{activeSection.grade_level}</span>
              </div>
            )}
            {/* No section warning */}
            {sections.length === 0 && (
              <button onClick={() => router.push('/sections')}
                className="flex items-center gap-2 bg-amber-900/40 border border-amber-700 rounded-xl px-3 py-1.5 text-amber-400 text-sm hover:bg-amber-900/60 transition">
                ⚠️ No sections yet — click to set up
              </button>
            )}
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition">
            <Bell size={18}/>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8 overflow-y-auto">

          {/* Upgrade banner for free users */}
          {isFree && sections.length > 0 && (
            <div className="bg-blue-950/30 border border-blue-800 rounded-2xl p-4 mb-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-400 font-bold">⭐ Unlock All 8 Modules</span>
                  <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">Free Plan</span>
                </div>
                <p className="text-gray-400 text-sm">Upgrade to Teacher Pro for SF9, SF5, MPS, Behavior Record, SF8 and more.</p>
              </div>
              <button onClick={() => router.push('/subscribe')}
                className="flex-shrink-0 ml-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition">
                <CreditCard size={16}/> ₱99/mo
              </button>
            </div>
          )}

          {/* No section prompt */}
          {sections.length === 0 && (
            <div className="bg-amber-950/30 border border-amber-800 rounded-2xl p-6 mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-amber-400 font-bold text-lg">👋 Welcome to TeacherHub PH!</h3>
                <p className="text-amber-300/80 text-sm mt-1">
                  Start by setting up your class sections. Import your SF1 files from the LIS website to auto-populate your student roster.
                </p>
              </div>
              <button onClick={() => router.push('/sections')}
                className="flex-shrink-0 flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-5 py-3 rounded-xl font-semibold transition ml-4">
                <Plus size={18}/> Set Up Sections
              </button>
            </div>
          )}

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 mt-1">
              {activeSection
                ? `${activeSection.name} · ${activeSection.grade_level} · SY ${activeSection.school_year}`
                : 'School Year 2026–2027 · Revised K-12 Curriculum'}
              {' · Term 1'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {STAT_CARDS.map(stat => (
              <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-2xl p-5 shadow-lg`}>
                <p className="text-white/70 text-sm">{stat.label}</p>
                <p className="text-4xl font-bold text-white mt-1">{stat.value}</p>
                <p className="text-white/60 text-xs mt-1 truncate">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Modules */}
          <h2 className="text-lg font-semibold text-white mb-4">Modules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {NAV_ITEMS.filter(i => i.path !== '/').map(item => {
              const isComing = item.status === 'coming';
              return (
                <button key={item.name} onClick={() => handleNav(item)} disabled={isComing}
                  className={`relative bg-gray-900 border rounded-2xl p-6 text-left transition-all group
                    ${isComing
                      ? 'border-gray-800 opacity-50 cursor-not-allowed'
                      : 'border-gray-700 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-900/20 hover:-translate-y-0.5'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors
                    ${isComing ? 'bg-gray-800' : 'bg-blue-900/50 group-hover:bg-blue-800/60'}`}>
                    <item.icon size={24} className={isComing ? 'text-gray-600' : 'text-blue-400'}/>
                  </div>
                  <p className="font-semibold text-white text-sm leading-tight">{item.name}</p>
                  {isComing && (
                    <span className="absolute top-4 right-4 text-xs bg-gray-800 text-gray-500 px-2 py-1 rounded-full">
                      Coming soon
                    </span>
                  )}
                  {!isComing && (
                    <ChevronRight size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-600 group-hover:text-blue-400 transition-colors"/>
                  )}
                </button>
              );
            })}

            {/* Manage Sections card */}
            <button onClick={() => router.push('/sections')}
              className="relative bg-gray-900 border border-gray-700 hover:border-emerald-500 rounded-2xl p-6 text-left transition-all group hover:shadow-lg hover:shadow-emerald-900/20 hover:-translate-y-0.5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-emerald-900/50 group-hover:bg-emerald-800/60 transition-colors">
                <Settings size={24} className="text-emerald-400"/>
              </div>
              <p className="font-semibold text-white text-sm leading-tight">Manage Sections</p>
              <p className="text-gray-500 text-xs mt-1">{sections.length} section{sections.length !== 1 ? 's' : ''}</p>
              <ChevronRight size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-600 group-hover:text-emerald-400 transition-colors"/>
            </button>
          </div>

          <div className="mt-12 text-center text-gray-600 text-sm">
            TeacherHub PH · Built for Filipino DepEd Teachers · 🇵🇭 · Revised K-12 Curriculum
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherHub() {
  const [user,    setUser]    = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-gray-400">Loading TeacherHub…</p>
      </div>
    </div>
  );

  return user ? <Dashboard user={user}/> : <LoginScreen/>;
}
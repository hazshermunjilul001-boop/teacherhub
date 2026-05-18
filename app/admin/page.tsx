'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle, XCircle, RefreshCw, ArrowLeft,
  Users, DollarSign, Clock, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// âš ï¸ Replace with your actual admin email
const ADMIN_EMAIL = 'hazsher.munjilul001@deped.gov.ph';

interface PaymentRequest {
  id:             string;
  user_id:        string;
  user_email:     string;
  plan_id:        string;
  billing_cycle:  string;
  amount_php:     number;
  payment_method: string;
  reference_no:   string;
  status:         string;
  created_at:     string;
  processed_at:   string | null;
  notes:          string | null;
}

interface Subscription {
  billing_cycle?: string
  user_id:    string;
  plan_id:    string;
  status:     string;
  expires_at: string | null;
  user_email?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin,    setIsAdmin]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [requests,   setRequests]   = useState<PaymentRequest[]>([]);
  const [subs,       setSubs]       = useState<Subscription[]>([]);
  const [activeTab,  setActiveTab]  = useState<'pending'|'all'|'subscribers'>('pending');
  const [processing, setProcessing] = useState<string|null>(null);
  const [stats,      setStats]      = useState({ total:0, pro:0, school:0, pending:0, revenue:0 });

  // Check admin access
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push('/');
        return;
      }
      setIsAdmin(true);
      await loadData();
      setLoading(false);
    })();
  }, []);

  const loadData = async () => {
    // Load payment requests
    const { data: reqs } = await supabase
      .from('payment_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests(reqs ?? []);

    // Load subscriptions
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    setSubs(subData ?? []);

    // Compute stats
    const pending = (reqs ?? []).filter(r => r.status === 'pending').length;
    const pro     = (subData ?? []).filter(s => s.plan_id === 'pro'    && s.status === 'active').length;
    const school  = (subData ?? []).filter(s => s.plan_id === 'school' && s.status === 'active').length;
    const revenue = (reqs ?? [])
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.amount_php ?? 0), 0);
    setStats({ total: (subData??[]).length, pro, school, pending, revenue });
  };

  const approve = async (req: PaymentRequest) => {
    if (!confirm(`Approve â‚±${req.amount_php} from ${req.user_email}?`)) return;
    setProcessing(req.id);

    // Calculate expiry
    const now      = new Date();
    const expires  = new Date(now);
    if (req.billing_cycle === 'yearly') {
      expires.setFullYear(expires.getFullYear() + 1);
    } else {
      expires.setMonth(expires.getMonth() + 1);
    }

    // Update payment request
    await supabase.from('payment_requests').update({
      status:       'approved',
      processed_at: now.toISOString(),
      processed_by: ADMIN_EMAIL,
    }).eq('id', req.id);

    // Upsert subscription
    await supabase.from('subscriptions').upsert({
      user_id:       req.user_id,
      plan_id:       req.plan_id,
      status:        'active',
      billing_cycle: req.billing_cycle,
      started_at:    now.toISOString(),
      expires_at:    expires.toISOString(),
      gcash_ref:     req.payment_method === 'gcash' ? req.reference_no : null,
      paymaya_ref:   req.payment_method === 'maya'  ? req.reference_no : null,
    }, { onConflict: 'user_id' });

    await loadData();
    setProcessing(null);
    alert(`âœ… Approved! ${req.user_email} is now on ${req.plan_id} plan until ${expires.toLocaleDateString('en-PH')}`);
  };

  const reject = async (req: PaymentRequest) => {
    const reason = prompt('Reason for rejection (will be noted):');
    if (reason === null) return;
    setProcessing(req.id);

    await supabase.from('payment_requests').update({
      status:       'rejected',
      processed_at: new Date().toISOString(),
      processed_by: ADMIN_EMAIL,
      notes:        reason,
    }).eq('id', req.id);

    await loadData();
    setProcessing(null);
  };

  const downgrade = async (userId: string, email: string) => {
    if (!confirm(`Downgrade ${email} to Free plan?`)) return;
    await supabase.from('subscriptions').update({
      plan_id:    'free',
      status:     'active',
      expires_at: null,
    }).eq('user_id', userId);
    await loadData();
  };

  const statusBadge = (status: string) => {
    const styles: Record<string,string> = {
      pending:  'bg-yellow-900/50 text-yellow-400 border border-yellow-700',
      approved: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700',
      rejected: 'bg-red-900/50 text-red-400 border border-red-700',
      active:   'bg-blue-900/50 text-blue-400 border border-blue-700',
      expired:  'bg-gray-800 text-gray-500 border border-gray-700',
    };
    return `px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? styles.pending}`;
  };

  const planBadge = (plan: string) => {
    const styles: Record<string,string> = {
      free:   'bg-gray-800 text-gray-400',
      pro:    'bg-blue-900/60 text-blue-300',
      school: 'bg-purple-900/60 text-purple-300',
    };
    return `px-2 py-0.5 rounded-lg text-xs font-bold ${styles[plan] ?? ''}`;
  };

  const pendingReqs  = requests.filter(r => r.status === 'pending');
  const displayReqs  = activeTab === 'pending' ? pendingReqs : requests;

  if (loading || !isAdmin) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <RefreshCw size={24} className="animate-spin text-blue-400"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition">
            <ArrowLeft size={20}/>
          </button>
          <div>
            <h1 className="text-xl font-bold">TeacherHub PH â€” Admin</h1>
            <p className="text-gray-500 text-xs">Payment & Subscription Management</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition">
          <RefreshCw size={16}/> Refresh
        </button>
      </div>

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label:'Total Users',     value:stats.total,         color:'from-blue-600 to-blue-800',    icon: Users },
            { label:'Pro Teachers',    value:stats.pro,           color:'from-blue-500 to-blue-700',    icon: CheckCircle },
            { label:'School Plans',    value:stats.school,        color:'from-purple-600 to-purple-800', icon: Users },
            { label:'Pending',         value:stats.pending,       color:'from-amber-600 to-amber-800',  icon: Clock },
            { label:'Total Revenue',   value:`â‚±${stats.revenue.toLocaleString()}`, color:'from-emerald-600 to-emerald-800', icon: DollarSign },
          ].map(stat => (
            <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-2xl p-4 shadow-lg`}>
              <p className="text-white/70 text-xs">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-800">
          {[
            { key:'pending',     label:`â³ Pending (${pendingReqs.length})` },
            { key:'all',         label:'ðŸ“‹ All Requests' },
            { key:'subscribers', label:'ðŸ‘¥ Subscribers' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                activeTab===tab.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Payment Requests Table */}
        {activeTab !== 'subscribers' && (
          <div className="overflow-x-auto">
            {displayReqs.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <CheckCircle size={40} className="mx-auto mb-3 opacity-30"/>
                <p>No {activeTab === 'pending' ? 'pending' : ''} payment requests</p>
              </div>
            ) : (
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    {['Date','Email','Plan','Billing','Amount','Method','Reference #','Status','Actions'].map(h => (
                      <th key={h} className="bg-gray-800 text-left px-3 py-3 first:rounded-tl-xl last:rounded-tr-xl border-b border-gray-700 text-gray-400 text-xs font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayReqs.map(req => (
                    <tr key={req.id} className="border-t border-gray-800 hover:bg-gray-900/40">
                      <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(req.created_at).toLocaleDateString('en-PH')}
                      </td>
                      <td className="px-3 py-3 text-white font-medium">{req.user_email}</td>
                      <td className="px-3 py-3">
                        <span className={planBadge(req.plan_id)}>{req.plan_id}</span>
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs capitalize">{req.billing_cycle}</td>
                      <td className="px-3 py-3 text-white font-bold">â‚±{req.amount_php?.toLocaleString()}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                          req.payment_method==='gcash' ? 'bg-blue-900/50 text-blue-300' : 'bg-green-900/50 text-green-300'
                        }`}>
                          {req.payment_method?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-gray-300 text-xs">{req.reference_no}</td>
                      <td className="px-3 py-3">
                        <span className={statusBadge(req.status)}>{req.status}</span>
                      </td>
                      <td className="px-3 py-3">
                        {req.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => approve(req)}
                              disabled={processing === req.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-xl text-xs font-semibold transition disabled:opacity-50">
                              {processing===req.id ? <RefreshCw size={12} className="animate-spin"/> : <CheckCircle size={12}/>}
                              Approve
                            </button>
                            <button
                              onClick={() => reject(req)}
                              disabled={processing === req.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 rounded-xl text-xs font-semibold transition text-red-400 disabled:opacity-50">
                              <XCircle size={12}/> Reject
                            </button>
                          </div>
                        )}
                        {req.status !== 'pending' && (
                          <span className="text-gray-600 text-xs">
                            {req.processed_at ? new Date(req.processed_at).toLocaleDateString('en-PH') : 'â€”'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Subscribers Tab */}
        {activeTab === 'subscribers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  {['User ID','Plan','Status','Billing','Expires','Actions'].map(h => (
                    <th key={h} className="bg-gray-800 text-left px-3 py-3 first:rounded-tl-xl last:rounded-tr-xl border-b border-gray-700 text-gray-400 text-xs font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map(sub => (
                  <tr key={sub.user_id} className="border-t border-gray-800 hover:bg-gray-900/40">
                    <td className="px-3 py-3 font-mono text-gray-400 text-xs">{sub.user_id.slice(0,16)}â€¦</td>
                    <td className="px-3 py-3">
                      <span className={planBadge(sub.plan_id)}>{sub.plan_id}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={statusBadge(sub.status)}>{sub.status}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs capitalize">{sub.billing_cycle ?? 'monthly'}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">
                      {sub.expires_at
                        ? new Date(sub.expires_at).toLocaleDateString('en-PH')
                        : <span className="text-gray-600">No expiry</span>}
                    </td>
                    <td className="px-3 py-3">
                      {sub.plan_id !== 'free' && (
                        <button onClick={() => downgrade(sub.user_id, sub.user_id)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs text-gray-400 transition">
                          Downgrade to Free
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

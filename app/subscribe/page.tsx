'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Star, Shield, ArrowLeft, Copy, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSubscription } from '../../lib/useSubscription';

// ─── YOUR GCASH / Landbank DETAILS ────────────────────────────────────────────────
// ⚠️ Replace these with your actual payment details
const PAYMENT_INFO = {
  gcash_number:    '0933-349-6704',
  gcash_name:      'HAZSHER M.',
  landbank_acc:    '0167-1603-52',       // ← key must have no spaces
  landbank_name:   'HAZSHER MUNJILUL',
  admin_email:     'hazsher.munjilul001@deped.gov.ph',
};

const PLANS = [
  {
    id:       'free',
    name:     'Free',
    monthly:  0,
    yearly:   0,
    color:    'border-gray-700',
    badge:    null,
    features: [
      '✓ 1 section only',
      '✓ Up to 45 students',
      '✓ Class Record',
      '✓ Attendance (SF2)',
      '✗ MPS & Item Analysis',
      '✗ SF8 Health & Nutrition',
      '✗ Behavior Record',
      '✗ SF5 / LIS Export',
      '✗ SF9 Report Card',
      '✗ Subject Teacher Sharing',
    ],
  },
  {
    id:       'pro',
    name:     'Teacher Pro',
    monthly:  99,
    yearly:   799,
    color:    'border-blue-500',
    badge:    '⭐ Most Popular',
    features: [
      '✓ Unlimited sections',
      '✓ Unlimited students',
      '✓ ALL 8 modules',
      '✓ Class Record + SF2',
      '✓ MPS & Item Analysis',
      '✓ SF8 Health & Nutrition',
      '✓ Behavior Record',
      '✓ SF5 / LIS Export',
      '✓ SF9 Report Card',
      '✓ Subject Teacher Sharing',
    ],
  },
  {
    id:       'school',
    name:     'School Plan',
    monthly:  499,
    yearly:   3999,
    color:    'border-purple-500',
    badge:    '🏫 Best for Schools',
    features: [
      '✓ Everything in Teacher Pro',
      '✓ All teachers in 1 school',
      '✓ School admin dashboard',
      '✓ LIS bulk export',
      '✓ Priority support',
      '✓ Setup assistance',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SubscribePage() {
  const router   = useRouter();
  const { subscription, isPro, isSchool, isFree, planName, daysLeft, loading } = useSubscription();

  const [billing,       setBilling]       = useState<'monthly'|'yearly'>('monthly');
  const [selectedPlan,  setSelectedPlan]  = useState<string|null>(null);
  const [step,          setStep]          = useState<'plans'|'payment'|'confirm'>('plans');
  const [payMethod,     setPayMethod]     = useState<'gcash'|'landbank'>('gcash');
  const [refNo,         setRefNo]         = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [user,          setUser]          = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPrice = (plan: typeof PLANS[0]) =>
    billing === 'yearly' ? plan.yearly : plan.monthly;

  const selectedPlanData = PLANS.find(p => p.id === selectedPlan);

  const submitPayment = async () => {
    if (!refNo.trim() || !selectedPlan || !user) return;
    setSubmitting(true);

    const amount = billing === 'yearly'
      ? PLANS.find(p=>p.id===selectedPlan)?.yearly ?? 0
      : PLANS.find(p=>p.id===selectedPlan)?.monthly ?? 0;

    const { error } = await supabase.from('payment_requests').insert({
      user_id:        user.id,
      user_email:     user.email,
      plan_id:        selectedPlan,
      billing_cycle:  billing,
      amount_php:     amount,
      payment_method: payMethod,
      reference_no:   refNo.trim(),
      status:         'pending',
    });

    if (!error) {
      setSubmitted(true);
      setStep('confirm');
    } else {
      alert('Error submitting: ' + error.message);
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <RefreshCw size={24} className="animate-spin text-blue-400"/>
    </div>
  );

  // ── CONFIRMATION SCREEN ───────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-emerald-900/40 border border-emerald-700 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-emerald-400"/>
        </div>
        <h2 className="text-3xl font-bold mb-3">Payment Submitted!</h2>
        <p className="text-gray-400 mb-6">
          We received your payment reference <strong className="text-white">{refNo}</strong>.
          Your account will be upgraded within <strong className="text-blue-400">24 hours</strong> after verification.
        </p>
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-6 text-left text-sm">
          <div className="text-gray-400 mb-3 font-semibold">What happens next:</div>
          <div className="space-y-2 text-gray-300">
            <div>1. We verify your payment reference number</div>
            <div>2. Your account is manually upgraded</div>
            <div>3. You receive an email confirmation</div>
            <div>4. All locked modules unlock immediately</div>
          </div>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Questions? Email <span className="text-blue-400">{PAYMENT_INFO.admin_email}</span>
        </p>
        <button onClick={() => router.push('/')}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-2xl font-semibold transition">
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  // ── PAYMENT SCREEN ────────────────────────────────────────────────────────
  if (step === 'payment' && selectedPlanData) {
    const price = getPrice(selectedPlanData);
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <button onClick={() => setStep('plans')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition">
          <ArrowLeft size={18}/> Back to Plans
        </button>

        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold mb-2">Complete Payment</h2>
          <p className="text-gray-400 mb-8">
            Upgrading to <strong className="text-blue-400">{selectedPlanData.name}</strong> —
            ₱{price.toLocaleString()}/{billing === 'yearly' ? 'year' : 'month'}
          </p>

          {/* Payment method toggle */}
          <div className="flex gap-3 mb-6">
            {(['gcash','landbank'] as const).map(m => (
              <button key={m} onClick={() => setPayMethod(m)}
                className={`flex-1 py-3 rounded-2xl font-semibold border transition text-sm uppercase ${
                  payMethod===m
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}>
                {m === 'gcash' ? '💙 GCash' : '💚 landbank'}
              </button>
            ))}
          </div>

          {/* Payment details card */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">{payMethod === 'gcash' ? '💙' : '💚'}</div>
              <div className="text-2xl font-black text-white">
                {payMethod === 'gcash' ? PAYMENT_INFO.gcash_number : PAYMENT_INFO.landbank_acc}
              </div>
              <div className="text-gray-400">
                {payMethod === 'gcash' ? PAYMENT_INFO.gcash_name : PAYMENT_INFO.landbank_name}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 text-center mb-4">
              <div className="text-gray-400 text-sm mb-1">Amount to Send</div>
              <div className="text-4xl font-black text-white">₱{price.toLocaleString()}</div>
              <div className="text-gray-500 text-xs mt-1">
                {selectedPlanData.name} · {billing === 'yearly' ? '1 Year' : '1 Month'}
              </div>
            </div>

            <button
              onClick={() => handleCopy(payMethod === 'gcash' ? PAYMENT_INFO.gcash_number : PAYMENT_INFO.Landbank_acc)}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition flex items-center justify-center gap-2">
              <Copy size={14}/> {copied ? '✓ Copied!' : 'Copy Number'}
            </button>
          </div>

          {/* Steps */}
          <div className="bg-blue-950/30 border border-blue-800 rounded-2xl p-5 mb-6 text-sm">
            <div className="font-semibold text-blue-400 mb-3">📋 How to Pay:</div>
            <ol className="space-y-2 text-blue-200 text-sm list-decimal list-inside">
              <li>Open your {payMethod === 'gcash' ? 'GCash' : 'Landbank'} app</li>
              <li>Send <strong>₱{price.toLocaleString()}</strong> to the number above</li>
              <li>Copy your <strong>reference/transaction number</strong></li>
              <li>Paste it below and submit</li>
            </ol>
          </div>

          {/* Reference number input */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">
              {payMethod === 'gcash' ? 'GCash' : 'Landbank'} Reference / Transaction Number
            </label>
            <input
              value={refNo}
              onChange={e => setRefNo(e.target.value)}
              placeholder="e.g. 1234567890"
              className="w-full bg-gray-900 border border-gray-600 rounded-2xl px-5 py-4 text-white text-lg font-mono focus:outline-none focus:border-blue-500 tracking-wider"
            />
            <p className="text-gray-600 text-xs mt-2">
              Found in your {payMethod === 'gcash' ? 'GCash' : 'Landbank'} transaction history after sending
            </p>
          </div>

          <button
            onClick={submitPayment}
            disabled={submitting || !refNo.trim()}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <><RefreshCw size={20} className="animate-spin"/> Submitting…</> : '✓ Submit Payment'}
          </button>

          <p className="text-center text-gray-600 text-xs mt-4">
            Your account will be activated within 24 hours after payment verification.
          </p>
        </div>
      </div>
    );
  }

  // ── PLANS SCREEN ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition">
          <ArrowLeft size={22}/>
        </button>
        <div>
          <h1 className="text-2xl font-bold">TeacherHub PH Plans</h1>
          <p className="text-gray-400 text-sm">Current plan: <span className="text-blue-400 font-semibold">{planName}</span>
            {daysLeft !== null && <span className="ml-2 text-amber-400">({daysLeft} days left)</span>}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Hero */}
        <div className="text-center mb-10 pt-4">
          <h2 className="text-4xl font-black mb-3">
            Built for Filipino Teachers 🇵🇭
          </h2>
          <p className="text-gray-400 text-lg">
            All DepEd school forms automated. Affordable for every teacher.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <span className={`text-sm ${billing==='monthly'?'text-white':'text-gray-500'}`}>Monthly</span>
            <button onClick={() => setBilling(b => b==='monthly'?'yearly':'monthly')}
              className={`w-14 h-7 rounded-full transition-colors relative ${billing==='yearly'?'bg-blue-600':'bg-gray-700'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${billing==='yearly'?'translate-x-8':'translate-x-1'}`}/>
            </button>
            <span className={`text-sm ${billing==='yearly'?'text-white':'text-gray-500'}`}>
              Yearly <span className="text-emerald-400 font-semibold text-xs">Save 33%</span>
            </span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {PLANS.map(plan => {
            const price       = getPrice(plan);
            const isCurrent   = subscription.plan_id === plan.id;
            const isSelected  = selectedPlan === plan.id;

            return (
              <div key={plan.id}
                onClick={() => plan.id !== 'free' && setSelectedPlan(plan.id)}
                className={`relative rounded-3xl border-2 p-6 transition-all
                  ${plan.id !== 'free' ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'}
                  ${isSelected ? 'border-blue-500 shadow-2xl shadow-blue-900/30' : plan.color}
                  ${isCurrent ? 'bg-blue-950/20' : 'bg-gray-900'}`}>

                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 right-4 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Current Plan
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <div className="mt-2">
                    {price === 0 ? (
                      <span className="text-4xl font-black text-white">Free</span>
                    ) : (
                      <>
                        <span className="text-4xl font-black text-white">₱{price.toLocaleString()}</span>
                        <span className="text-gray-400 text-sm">/{billing==='yearly'?'year':'month'}</span>
                        {billing === 'yearly' && (
                          <div className="text-emerald-400 text-xs mt-1">
                            ₱{Math.round(price/12).toLocaleString()}/month billed yearly
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`text-sm flex items-start gap-2
                      ${f.startsWith('✓') ? 'text-gray-200' : 'text-gray-600'}`}>
                      <span className="flex-shrink-0 mt-0.5">{f.slice(0,1)}</span>
                      <span>{f.slice(2)}</span>
                    </li>
                  ))}
                </ul>

                {plan.id === 'free' ? (
                  <div className="w-full py-3 rounded-2xl text-center text-gray-600 border border-gray-700 text-sm">
                    {isCurrent ? 'Your current plan' : 'No payment needed'}
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedPlan(plan.id); }}
                    disabled={isCurrent}
                    className={`w-full py-3 rounded-2xl font-semibold text-sm transition
                      ${isCurrent
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : isSelected
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600'
                      }`}>
                    {isCurrent ? 'Current Plan' : isSelected ? '✓ Selected' : 'Select Plan'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Proceed button */}
        {selectedPlan && selectedPlan !== 'free' && (
          <div className="text-center">
            <button onClick={() => setStep('payment')}
              className="px-12 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-lg transition shadow-xl shadow-blue-900/30">
              Proceed to Payment →
            </button>
            <p className="text-gray-600 text-sm mt-3">
              Pay via GCash or Landbank. Activated within 24 hours. ₱{
                getPrice(PLANS.find(p=>p.id===selectedPlan)!).toLocaleString()
              }/{billing==='yearly'?'year':'month'}
            </p>
          </div>
        )}

        {/* Trust badges */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <Shield size={16} className="text-emerald-500"/>
            <span>Your data stays private</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle size={16} className="text-blue-500"/>
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Star size={16} className="text-amber-500"/>
            <span>Made for DepEd teachers</span>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-10 border-t border-gray-800 pt-8">
          <h3 className="text-lg font-bold text-white mb-4 text-center">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { q: 'How do I pay?', a: 'Send via GCash or Landbank to our number, then submit your reference number. We activate your account within 24 hours.' },
              { q: 'What if I stop paying?', a: 'Your account reverts to the Free plan. Your data stays safe — you just lose access to the Pro modules.' },
              { q: 'Can I upgrade mid-year?', a: 'Yes! Pay anytime and your plan activates from that date for the billing period you choose.' },
              { q: 'Is the data safe?', a: 'Yes. All data is stored securely in Supabase (enterprise-grade PostgreSQL). We never share your data.' },
              { q: 'What about the School Plan?', a: 'Contact us directly for School Plan setup. We help onboard all teachers in your school.' },
              { q: 'Do I need internet?', a: 'Yes, TeacherHub PH is a web app. A basic internet connection is enough — it works on any browser.' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-gray-900 rounded-2xl p-4">
                <div className="font-semibold text-white text-sm mb-1">{q}</div>
                <div className="text-gray-400 text-xs">{a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center text-gray-600 text-xs">
          TeacherHub PH · Questions? Email {PAYMENT_INFO.admin_email}
        </div>
      </div>
    </div>
  );
}
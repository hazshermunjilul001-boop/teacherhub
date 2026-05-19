'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Star, Shield, ArrowLeft, Copy, RefreshCw, X, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSubscription } from '../../lib/useSubscription';

const PAYMENT_INFO = {
  gcash_number:  '0933-349-6704',
  gcash_name:    'HAZSHER M.',
  landbank_acc:  '0167-1603-52',
  landbank_name: 'HAZSHER MUNJILUL',
  admin_email:   'hazsher.munjilul001@deped.gov.ph',
};

const PLANS = [
  {
    id:       'free',
    name:     'Free',
    price:    0,
    color:    'border-gray-700',
    badge:    null,
    features: [
      { text: '1 section only',            included: true  },
      { text: 'Up to 75 students',          included: true  },
      { text: 'Class Record',               included: true  },
      { text: 'Attendance (SF2)',            included: true  },
      { text: 'MPS & Item Analysis',         included: false },
      { text: 'SF8 Health & Nutrition',      included: false },
      { text: 'Behavior Record',             included: false },
      { text: 'SF5 / LIS Export',            included: false },
      { text: 'SF9 Report Card',             included: false },
      { text: 'Subject Teacher Sharing',     included: false },
    ],
  },
  {
    id:       'pro',
    name:     'Teacher Pro',
    price:    199,
    color:    'border-blue-500',
    badge:    'Most Popular',
    features: [
      { text: 'Unlimited sections',          included: true },
      { text: 'Unlimited students',          included: true },
      { text: 'ALL 8 modules',               included: true },
      { text: 'Class Record + SF2',          included: true },
      { text: 'MPS & Item Analysis',         included: true },
      { text: 'SF8 Health & Nutrition',      included: true },
      { text: 'Behavior Record',             included: true },
      { text: 'SF5 / LIS Export',            included: true },
      { text: 'SF9 Report Card',             included: true },
      { text: 'Subject Teacher Sharing',     included: true },
    ],
  },
  {
    id:       'school',
    name:     'School Plan',
    price:    2999,
    color:    'border-purple-500',
    badge:    'Best for Schools',
    features: [
      { text: 'Everything in Teacher Pro',   included: true },
      { text: 'All teachers in 1 school',    included: true },
      { text: 'School admin dashboard',      included: true },
      { text: 'LIS bulk export',             included: true },
      { text: 'Priority support',            included: true },
      { text: 'Setup assistance',            included: true },
    ],
  },
];

export default function SubscribePage() {
  const router = useRouter();
  const { subscription, planName, daysLeft, loading } = useSubscription();

  const [selectedPlan,  setSelectedPlan]  = useState<string|null>(null);
  const [step,          setStep]          = useState<'plans'|'payment'|'confirm'>('plans');
  const [payMethod,     setPayMethod]     = useState<'gcash'|'landbank'>('gcash');
  const [refNo,         setRefNo]         = useState('');
  const [submitting,    setSubmitting]    = useState(false);
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

  const selectedPlanData = PLANS.find(p => p.id === selectedPlan);

  const submitPayment = async () => {
    if (!refNo.trim() || !selectedPlan || !user) return;
    setSubmitting(true);

    const amount = PLANS.find(p => p.id === selectedPlan)?.price ?? 0;

    const { error } = await supabase.from('payment_requests').insert({
      user_id:        user.id,
      user_email:     user.email,
      plan_id:        selectedPlan,
      billing_cycle:  'yearly',
      amount_php:     amount,
      payment_method: payMethod,
      reference_no:   refNo.trim(),
      status:         'pending',
    });

    if (!error) {
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
    const price = selectedPlanData.price;
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <button onClick={() => setStep('plans')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition">
          <ArrowLeft size={18}/> Back to Plans
        </button>

        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold mb-2">Complete Payment</h2>
          <p className="text-gray-400 mb-8">
            Upgrading to <strong className="text-blue-400">{selectedPlanData.name}</strong> &mdash; PHP {price.toLocaleString()}/year
          </p>

          {/* Payment method toggle */}
          <div className="flex gap-3 mb-6">
            {(['gcash', 'landbank'] as const).map(m => (
              <button key={m} onClick={() => setPayMethod(m)}
                className={`flex-1 py-3 rounded-2xl font-semibold border transition text-sm uppercase ${
                  payMethod === m
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}>
                {m === 'gcash' ? 'GCash' : 'Landbank'}
              </button>
            ))}
          </div>

          {/* Payment details card */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-6">
            <div className="text-center mb-4">
              <div className="text-sm font-bold text-blue-400 uppercase tracking-wide mb-2">
                {payMethod === 'gcash' ? 'GCash' : 'Landbank'}
              </div>
              <div className="text-2xl font-black text-white">
                {payMethod === 'gcash' ? PAYMENT_INFO.gcash_number : PAYMENT_INFO.landbank_acc}
              </div>
              <div className="text-gray-400 text-sm mt-1">
                {payMethod === 'gcash' ? PAYMENT_INFO.gcash_name : PAYMENT_INFO.landbank_name}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 text-center mb-4">
              <div className="text-gray-400 text-sm mb-1">Amount to Send</div>
              <div className="text-4xl font-black text-white">PHP {price.toLocaleString()}</div>
              <div className="text-gray-500 text-xs mt-1">
                {selectedPlanData.name} &middot; 1 Year
              </div>
            </div>

            <button
              onClick={() => handleCopy(payMethod === 'gcash' ? PAYMENT_INFO.gcash_number : PAYMENT_INFO.landbank_acc)}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition flex items-center justify-center gap-2">
              <Copy size={14}/> {copied ? 'Copied!' : 'Copy Number'}
            </button>
          </div>

          {/* Steps */}
          <div className="bg-blue-950/30 border border-blue-800 rounded-2xl p-5 mb-6 text-sm">
            <div className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
              <BookOpen size={14}/> How to Pay:
            </div>
            <ol className="space-y-2 text-blue-200 text-sm list-decimal list-inside">
              <li>Open your {payMethod === 'gcash' ? 'GCash' : 'Landbank'} app</li>
              <li>Send <strong>PHP {price.toLocaleString()}</strong> to the number above</li>
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
            {submitting
              ? <><RefreshCw size={20} className="animate-spin"/> Submitting...</>
              : <><CheckCircle size={20}/> Submit Payment</>}
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
          <p className="text-gray-400 text-sm">
            Current plan: <span className="text-blue-400 font-semibold">{planName}</span>
            {daysLeft !== null && <span className="ml-2 text-amber-400">({daysLeft} days left)</span>}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Hero */}
        <div className="text-center mb-10 pt-4">
          <h2 className="text-4xl font-black mb-3">Built for Filipino Teachers</h2>
          <p className="text-gray-400 text-lg">All DepEd school forms automated. Affordable for every teacher.</p>
          <div className="mt-4 inline-block bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-sm font-semibold px-4 py-2 rounded-full">
            Annual billing &mdash; pay once, use all year
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {PLANS.map(plan => {
            const isCurrent  = subscription?.plan_id === plan.id;
            const isSelected = selectedPlan === plan.id;

            return (
              <div key={plan.id}
                onClick={() => plan.id !== 'free' && setSelectedPlan(plan.id)}
                className={`relative rounded-3xl border-2 p-6 transition-all
                  ${plan.id !== 'free' ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'}
                  ${isSelected ? 'border-blue-500 shadow-2xl shadow-blue-900/30' : plan.color}
                  ${isCurrent ? 'bg-blue-950/20' : 'bg-gray-900'}`}>

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
                    {plan.price === 0 ? (
                      <span className="text-4xl font-black text-white">Free</span>
                    ) : (
                      <>
                        <span className="text-4xl font-black text-white">PHP {plan.price.toLocaleString()}</span>
                        <span className="text-gray-400 text-sm">/year</span>
                        <div className="text-emerald-400 text-xs mt-1">
                          PHP {Math.round(plan.price / 12).toLocaleString()}/month billed annually
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`text-sm flex items-start gap-2 ${f.included ? 'text-gray-200' : 'text-gray-600'}`}>
                      {f.included
                        ? <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
                        : <X size={14} className="text-gray-600 flex-shrink-0 mt-0.5"/>}
                      <span>{f.text}</span>
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
                    {isCurrent ? 'Current Plan' : isSelected ? 'Selected' : 'Select Plan'}
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
              Proceed to Payment &rarr;
            </button>
            <p className="text-gray-600 text-sm mt-3">
              Pay via GCash or Landbank. Activated within 24 hours.
              PHP {PLANS.find(p => p.id === selectedPlan)!.price.toLocaleString()}/year
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
              { q: 'How do I pay?',             a: 'Send via GCash or Landbank, then submit your reference number. We activate your account within 24 hours.' },
              { q: 'What if I stop paying?',    a: 'Your account reverts to the Free plan after expiry. Your data stays safe - you just lose access to Pro modules.' },
              { q: 'Is billing yearly only?',   a: 'Yes! We charge annually to keep the price low. Teacher Pro is only PHP 199/year - less than PHP 17/month.' },
              { q: 'Is the data safe?',         a: 'Yes. All data is stored securely in Supabase (enterprise-grade PostgreSQL). We never share your data.' },
              { q: 'What about School Plan?',   a: 'Contact us directly for School Plan setup. We help onboard all teachers in your school.' },
              { q: 'Do I need internet?',       a: 'Yes, TeacherHub PH is a web app. A basic internet connection is enough - it works on any browser.' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-gray-900 rounded-2xl p-4">
                <div className="font-semibold text-white text-sm mb-1">{q}</div>
                <div className="text-gray-400 text-xs">{a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center text-gray-600 text-xs">
          TeacherHub PH &middot; Questions? Email {PAYMENT_INFO.admin_email}
        </div>
      </div>
    </div>
  );
}
'use client';

// components/SubscriptionGate.tsx
// Wrap any Pro-only module with this component.
// Shows an upgrade prompt if the user is on the Free plan.

import { useRouter } from 'next/navigation';
import { Lock, Star } from 'lucide-react';
import { useSubscription } from '../lib/useSubscription';

interface Props {
  feature: keyof ReturnType<typeof useSubscription>['canUse'];
  children: React.ReactNode;
  moduleName?: string;
}

export default function SubscriptionGate({ feature, children, moduleName }: Props) {
  const router = useRouter();
  const { canUse, loading, planName } = useSubscription();

  // Still loading — show nothing to avoid flicker
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  // Has access — render the module normally
  if (canUse[feature]) return <>{children}</>;

  // No access — show upgrade wall
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        {/* Lock icon */}
        <div className="w-24 h-24 bg-gray-900 border border-gray-700 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Lock size={40} className="text-gray-500"/>
        </div>

        <h2 className="text-3xl font-bold mb-3">
          {moduleName ?? 'This Module'} is a Pro Feature
        </h2>
        <p className="text-gray-400 mb-2">
          You are currently on the <span className="text-white font-semibold">{planName}</span> plan.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Upgrade to <span className="text-blue-400 font-semibold">Teacher Pro</span> to unlock all 8 modules,
          unlimited sections, subject teacher sharing, and more.
        </p>

        {/* Feature highlights */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-6 text-left">
          <div className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Star size={16} className="text-amber-400"/> What you get with Teacher Pro
          </div>
          <ul className="space-y-2 text-sm text-gray-300">
            {[
              'All 8 modules — Class Record, SF2, MPS, SF8, Behavior, SF5, SF9',
              'Unlimited sections and students',
              'Subject teacher collaboration',
              'Manual grade entry for SF9',
              'LIS-ready CSV export',
              'Print-ready school forms',
            ].map(f => (
              <li key={f} className="flex items-start gap-2">
                <span className="text-emerald-400 flex-shrink-0">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-gray-900 border border-blue-700 rounded-2xl p-4 text-center">
            <div className="text-xs text-gray-400 mb-1">Monthly</div>
            <div className="text-2xl font-black text-white">₱99</div>
            <div className="text-gray-500 text-xs">/month</div>
          </div>
          <div className="flex-1 bg-blue-900/30 border border-blue-500 rounded-2xl p-4 text-center relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              Save 33%
            </div>
            <div className="text-xs text-gray-400 mb-1">Yearly</div>
            <div className="text-2xl font-black text-white">₱799</div>
            <div className="text-gray-500 text-xs">/year</div>
          </div>
        </div>

        <button
          onClick={() => router.push('/subscribe')}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-lg transition shadow-xl shadow-blue-900/30 mb-3">
          Upgrade to Teacher Pro →
        </button>

        <button
          onClick={() => window.history.back()}
          className="w-full py-3 text-gray-500 hover:text-gray-300 transition text-sm">
          ← Go back
        </button>
      </div>
    </div>
  );
}
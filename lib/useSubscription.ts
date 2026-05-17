'use client';
// lib/useSubscription.ts
// Checks the current user's subscription plan and enforces feature limits

import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface Subscription {
  plan_id:       'free' | 'pro' | 'school';
  status:        'active' | 'expired' | 'cancelled';
  billing_cycle: 'monthly' | 'yearly';
  expires_at:    string | null;
}

const DEFAULT_FREE: Subscription = {
  plan_id:       'free',
  status:        'active',
  billing_cycle: 'monthly',
  expires_at:    null,
};

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription>(DEFAULT_FREE);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
        setSubscription({
          ...data,
          status:  isExpired ? 'expired' : data.status,
          plan_id: isExpired ? 'free'    : data.plan_id,
        });
      }
      setLoading(false);
    })();
  }, []);

  const isPro    = subscription.plan_id === 'pro'    && subscription.status === 'active';
  const isSchool = subscription.plan_id === 'school' && subscription.status === 'active';
  const isFree   = !isPro && !isSchool;

  const canUse = {
    classRecord:      true,
    attendance:       true,
    mps:              isPro || isSchool,
    sf8:              isPro || isSchool,
    behavior:         isPro || isSchool,
    sf5:              isPro || isSchool,
    sf9:              isPro || isSchool,
    multipleSections: isPro || isSchool,
    subjectTeachers:  isPro || isSchool,
    manualGrades:     isPro || isSchool,
  };

  const maxSections = isFree ? 1   : 999;
  const maxStudents = isFree ? 45  : 999;

  const daysLeft = subscription.expires_at
    ? Math.max(0, Math.ceil(
        (new Date(subscription.expires_at).getTime() - Date.now()) / 86400000
      ))
    : null;

  return {
    subscription,
    loading,
    isPro,
    isSchool,
    isFree,
    canUse,
    maxSections,
    maxStudents,
    daysLeft,
    planName: subscription.plan_id === 'free'   ? 'Free'         :
              subscription.plan_id === 'pro'    ? 'Teacher Pro'  : 'School Plan',
  };
}
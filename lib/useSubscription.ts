'use client';
// lib/useSubscription.ts

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
  const [subscription,    setSubscription]    = useState<Subscription>(DEFAULT_FREE);
  const [isCollaborator,  setIsCollaborator]  = useState(false);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Load subscription
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

      // Check if this user is an active collaborator on any section
      // Even on Free plan, collaborators get Class Record access for their subjects
      const { data: collabData } = await supabase
        .from('section_collaborators')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1);

      // Also check by email in case user_id wasn't set on invite
      const { data: collabByEmail } = await supabase
        .from('section_collaborators')
        .select('id')
        .eq('email', user.email)
        .eq('status', 'active')
        .limit(1);

      setIsCollaborator(
        (collabData?.length ?? 0) > 0 ||
        (collabByEmail?.length ?? 0) > 0
      );

      setLoading(false);
    })();
  }, []);

  const isPro    = subscription.plan_id === 'pro'    && subscription.status === 'active';
  const isSchool = subscription.plan_id === 'school' && subscription.status === 'active';
  const isFree   = !isPro && !isSchool;

  // A collaborator on Free plan gets Class Record access only
  // for the sections they were invited to (section filtering happens in SectionContext)
  const canUse = {
    classRecord:      true,                          // always true — collaborators need this
    attendance:       true,
    mps:              isPro || isSchool,
    sf8:              isPro || isSchool,
    behavior:         isPro || isSchool,
    sf5:              isPro || isSchool,
    sf9:              isPro || isSchool,
    multipleSections: isPro || isSchool || isCollaborator, // collaborators see shared sections
    subjectTeachers:  isPro || isSchool,
    manualGrades:     isPro || isSchool,
  };

  const maxSections = isFree && !isCollaborator ? 1   : 999;
  const maxStudents = isFree                    ? 45  : 999;

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
    isCollaborator,
    canUse,
    maxSections,
    maxStudents,
    daysLeft,
    planName: subscription.plan_id === 'free'   ? 'Free'        :
              subscription.plan_id === 'pro'    ? 'Teacher Pro' : 'School Plan',
  };
}
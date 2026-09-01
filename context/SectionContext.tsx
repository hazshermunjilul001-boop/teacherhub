'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// ── TYPES ─────────────────────────────────────────────────────────────────────

export interface Section {
  id: string;
  teacher_id: string;
  name: string;
  grade_level: string;
  grade_number: number;
  school_year: string;
  school_name: string;
  school_id: string;
  district?: string;
  division: string;
  region: string;
  adviser: string;
  school_head?: string;
  student_count?: number;
  created_at?: string;
  // Extra fields for shared sections
  _role?: 'owner' | 'subject_teacher';
  _subjects?: string[]; // subjects this teacher can access in shared section
  _gradingPeriods?: number[];
  _components?: string[];
}

interface SectionContextType {
  sections:         Section[];
  activeSection:    Section | null;
  setActiveSection: (s: Section) => void;
  loadSections:     () => Promise<void>;
  loading:          boolean;
  linkNotifications: number;
  clearLinkNotifications: () => void;
}

// ── CONTEXT ───────────────────────────────────────────────────────────────────

const SectionContext = createContext<SectionContextType>({
  sections:         [],
  activeSection:    null,
  setActiveSection: () => {},
  loadSections:     async () => {},
  loading:          true,
  linkNotifications: 0,
  clearLinkNotifications: () => {},
});

export function SectionProvider({ children }: { children: ReactNode }) {
  const [sections,      setSections]          = useState<Section[]>([]);
  const [activeSection, setActiveSectionState] = useState<Section | null>(null);
  const [loading,       setLoading]            = useState(true);
  const [linkNotifications, setLinkNotifications] = useState(0);

  const loadSections = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // ── Step 1: Auto-accept pending invites for this user's normalized email ─────
    // Advisers save invite emails in lowercase. Auth providers may return a
    // differently-cased address, so every lookup must use the same normalized value.
    const normalizedEmail = user.email?.trim().toLowerCase();
    if (!normalizedEmail) { setLoading(false); return; }

    const { count: pendingCount } = await supabase
      .from('section_collaborators')
      .select('id', { count: 'exact', head: true })
      .eq('email', normalizedEmail)
      .eq('status', 'pending');
    setLinkNotifications(pendingCount ?? 0);

    await supabase
      .from('section_collaborators')
      .update({ status: 'active', user_id: user.id })
      .eq('email', normalizedEmail)
      .eq('status', 'pending');

    // ── Step 2: Load own sections (teacher_id = this user) ────────────────────
    const { data: ownSections, error: ownError } = await supabase
      .from('sections')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at');

    const owned: Section[] = (ownSections ?? []).map(s => ({ ...s, _role: 'owner' as const }));

    // ── Step 3: Load shared sections via section_collaborators ────────────────
    const { data: collabRows, error: collabErr1 } = await supabase
      .from('section_collaborators')
      .select('section_id, subjects, grading_periods, components, status')
      .eq('user_id', user.id)
      .eq('status', 'active');

    // Also try matching by email in case user_id wasn't set yet
    const { data: collabByEmail, error: collabErr2 } = await supabase
      .from('section_collaborators')
      .select('section_id, subjects, grading_periods, components, status')
      .eq('email', normalizedEmail)
      .eq('status', 'active');

    if (collabErr1) console.error('Collab by user_id error:', collabErr1);
    if (collabErr2) console.error('Collab by email error:', collabErr2);

    const collabSectionIds = [
      ...(collabRows ?? []),
      ...(collabByEmail ?? []),
    ].filter((c, i, arr) => arr.findIndex(x => x.section_id === c.section_id) === i); // dedupe

    let sharedSections: Section[] = [];
    if (collabSectionIds.length > 0) {
      const ids = collabSectionIds.map(c => c.section_id);
      const { data: sharedData, error: sharedErr } = await supabase
        .from('sections')
        .select('*')
        .in('id', ids);

      if (sharedErr) console.error('Shared sections fetch error (likely RLS):', sharedErr);

      sharedSections = (sharedData ?? [])
        .filter(s => s.teacher_id !== user.id) // don't duplicate own sections
        .map(s => {
          const collab = collabSectionIds.find(c => c.section_id === s.id);
          return {
            ...s,
            _role: 'subject_teacher' as const,
            _subjects: collab?.subjects ?? [],
            _gradingPeriods: (collab?.grading_periods ?? [1, 2, 3]).map(Number),
            _components: collab?.components ?? ['ww', 'pt', 'st', 'te'],
          };
        });
    }

    // ── Step 4: Merge and set ─────────────────────────────────────────────────
    const all = [...owned, ...sharedSections];

    if (!ownError && all.length > 0) {
      setSections(all);
      const savedId = localStorage.getItem('activeSection_id');
      const saved   = all.find((s: Section) => s.id === savedId);
      if (saved) {
        setActiveSectionState(saved);
      } else if (all.length > 0) {
        setActiveSectionState(all[0]);
        localStorage.setItem('activeSection_id', all[0].id);
      }
    } else if (!ownError) {
      setSections([]);
    }

    setLoading(false);
  };

  const setActiveSection = (s: Section) => {
    setActiveSectionState(s);
    localStorage.setItem('activeSection_id', s.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN')  loadSections();
      if (event === 'SIGNED_OUT') { setSections([]); setActiveSectionState(null); }
    });
    loadSections();
    return () => subscription.unsubscribe();
  }, []);

  const clearLinkNotifications = () => setLinkNotifications(0);

  return (
    <SectionContext.Provider value={{ sections, activeSection, setActiveSection, loadSections, loading, linkNotifications, clearLinkNotifications }}>
      {children}
    </SectionContext.Provider>
  );
}

// ── HOOK ──────────────────────────────────────────────────────────────────────

export function useSection() {
  return useContext(SectionContext);
}
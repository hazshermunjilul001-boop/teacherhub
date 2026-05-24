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
}

interface SectionContextType {
  sections:         Section[];
  activeSection:    Section | null;
  setActiveSection: (s: Section) => void;
  loadSections:     () => Promise<void>;
  loading:          boolean;
}

// ── CONTEXT ───────────────────────────────────────────────────────────────────

const SectionContext = createContext<SectionContextType>({
  sections:         [],
  activeSection:    null,
  setActiveSection: () => {},
  loadSections:     async () => {},
  loading:          true,
});

export function SectionProvider({ children }: { children: ReactNode }) {
  const [sections,      setSections]          = useState<Section[]>([]);
  const [activeSection, setActiveSectionState] = useState<Section | null>(null);
  const [loading,       setLoading]            = useState(true);

  const loadSections = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // ── Step 1: Auto-accept any pending invites for this user's email ──────────
    await supabase
      .from('section_collaborators')
      .update({ status: 'active', user_id: user.id })
      .eq('email', user.email)
      .eq('status', 'pending');

    // ── Step 2: Load own sections (teacher_id = this user) ────────────────────
    const { data: ownSections, error: ownError } = await supabase
      .from('sections')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at');

    const owned: Section[] = (ownSections ?? []).map(s => ({ ...s, _role: 'owner' as const }));

    // ── Step 3: Load shared sections via section_collaborators ────────────────
    const { data: collabRows } = await supabase
      .from('section_collaborators')
      .select('section_id, subjects, status')
      .eq('user_id', user.id)
      .eq('status', 'active');

    // Also try matching by email in case user_id wasn't set yet
    const { data: collabByEmail } = await supabase
      .from('section_collaborators')
      .select('section_id, subjects, status')
      .eq('email', user.email)
      .eq('status', 'active');

    const collabSectionIds = [
      ...(collabRows ?? []),
      ...(collabByEmail ?? []),
    ].filter((c, i, arr) => arr.findIndex(x => x.section_id === c.section_id) === i); // dedupe

    let sharedSections: Section[] = [];
    if (collabSectionIds.length > 0) {
      const ids = collabSectionIds.map(c => c.section_id);
      const { data: sharedData } = await supabase
        .from('sections')
        .select('*')
        .in('id', ids);

      sharedSections = (sharedData ?? [])
        .filter(s => s.teacher_id !== user.id) // don't duplicate own sections
        .map(s => {
          const collab = collabSectionIds.find(c => c.section_id === s.id);
          return { ...s, _role: 'subject_teacher' as const, _subjects: collab?.subjects ?? [] };
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

  return (
    <SectionContext.Provider value={{ sections, activeSection, setActiveSection, loadSections, loading }}>
      {children}
    </SectionContext.Provider>
  );
}

// ── HOOK ──────────────────────────────────────────────────────────────────────

export function useSection() {
  return useContext(SectionContext);
}
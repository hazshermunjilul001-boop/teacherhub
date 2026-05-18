'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

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
}

interface SectionContextType {
  sections: Section[];
  activeSection: Section | null;
  setActiveSection: (s: Section) => void;
  loadSections: () => Promise<void>;
  loading: boolean;
}

const SectionContext = createContext<SectionContextType>({
  sections: [],
  activeSection: null,
  setActiveSection: () => {},
  loadSections: async () => {},
  loading: true,
});

export function SectionProvider({ children }: { children: ReactNode }) {
  const [sections,      setSections]          = useState<Section[]>([]);
  const [activeSection, setActiveSectionState] = useState<Section | null>(null);
  const [loading,       setLoading]            = useState(true);

  const loadSections = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at');

    if (!error && data) {
      setSections(data);
      const savedId = localStorage.getItem('activeSection_id');
      const saved   = data.find((s: Section) => s.id === savedId);
      if (saved) {
        setActiveSectionState(saved);
      } else if (data.length > 0) {
        setActiveSectionState(data[0]);
        localStorage.setItem('activeSection_id', data[0].id);
      }
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

export function useSection() {
  return useContext(SectionContext);
}

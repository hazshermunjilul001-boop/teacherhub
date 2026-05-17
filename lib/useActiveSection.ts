// lib/useActiveSection.ts
// Drop-in replacement for all hardcoded school constants.
// Import this in every module page instead of hardcoded strings.

import { useSection } from '../context/SectionContext';

export function useActiveSection() {
  const { activeSection, sections, loading } = useSection();

  return {
    // Section identifiers
    sectionId:   activeSection?.id          ?? 'default-section',
    sectionName: activeSection?.name        ?? 'STARGAZER',
    gradeLevel:  activeSection?.grade_level ?? 'Grade 7 (Year I)',
    gradeNumber: activeSection?.grade_number ?? 7,

    // School info
    schoolName:  activeSection?.school_name ?? 'Sta. Ana National High School',
    schoolId:    activeSection?.school_id   ?? '304393',
    division:    activeSection?.division    ?? 'Davao City',
    region:      activeSection?.region      ?? 'Region XI',
    schoolYear:  activeSection?.school_year ?? '2025 - 2026',
    adviser:     activeSection?.adviser     ?? '',

    // Meta
    activeSection,
    sections,
    hasSection:  !!activeSection,
    loading,
  };
}
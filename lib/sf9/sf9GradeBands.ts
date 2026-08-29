// ============================================================================
// SF9 Multi-Grade Revamp — Phase 1: Grade-band config (v2)
//
// v2 change per review: existing JHS grade data keeps its exact storage
// strings (e.g. 'Edukasyon sa Pagpapakatao (EsP)', 'MAPEH - Music & Arts').
// Only the DISPLAY LABEL is updated to the new official SF9 wording. Nothing
// needs to migrate — old class records keep working unchanged.
// ============================================================================

export type HeaderScope = 'district' | 'cluster';
export type SHSTrack = 'academic' | 'techpro';

export interface SF9SubjectRow {
  /** Storage key used in `grades.subject` / `manual_grades.subject`.
   *  For computed rows (MAPEH, Effective Communication) this is a SYNTHETIC
   *  identifier, not a real stored subject — see isComputed below. */
  key: string;
  /** What prints on the SF9 — independent of `key`, so relabeling never
   *  touches stored data. */
  label: string;
  /** Nested display-only rows (e.g. MAPEH's Music and Arts / PE and Health).
   *  Sub-rows have their own real storage key and do NOT get their own slot
   *  in the General Average — only the parent row does. */
  subRows?: SF9SubjectRow[];
  /** True for parent rows whose Term/Final grade is the average of its
   *  subRows rather than its own stored grade (mirrors the current MAPEH
   *  logic: term average of components, then average of the 3 term averages
   *  for the Final Rating — apply the same pattern to any isComputed row). */
  isComputed?: boolean;
}

export interface SF9GradeBandConfig {
  id: string;
  label: string;
  gradeLevels: number[];
  coreSubjects: SF9SubjectRow[];
  hasElectives: boolean;
  /** Keys counted toward General Average + Promoted/Conditionally
   *  Promoted/Failed. For computed rows this is the parent's synthetic key
   *  (e.g. 'MAPEH'), not the sub-row keys — matching how the current code
   *  folds mapehFinal into genAverage as one value, not two. */
  gaCoreKeys: string[];
}

export const GRADE_BANDS: SF9GradeBandConfig[] = [
  {
    id: 'grade2',
    label: 'Grade 2',
    gradeLevels: [2],
    coreSubjects: [
      { key: 'Filipino',  label: 'Filipino' },
      { key: 'English',   label: 'English' },
      { key: 'Mathematics', label: 'Mathematics' },
      { key: 'GMRC / Values Education', label: 'GMRC / Values Education' },
      { key: 'Makabansa', label: 'Makabansa' },
    ],
    hasElectives: false,
    gaCoreKeys: ['Filipino', 'English', 'Mathematics', 'GMRC / Values Education', 'Makabansa'],
  },
  {
    id: 'grade3',
    label: 'Grade 3',
    gradeLevels: [3],
    coreSubjects: [
      { key: 'Filipino',  label: 'Filipino' },
      { key: 'English',   label: 'English' },
      { key: 'Mathematics', label: 'Mathematics' },
      { key: 'Science',   label: 'Science' },
      { key: 'GMRC / Values Education', label: 'GMRC / Values Education' },
      { key: 'Makabansa', label: 'Makabansa' },
    ],
    hasElectives: false,
    gaCoreKeys: ['Filipino', 'English', 'Mathematics', 'Science', 'GMRC / Values Education', 'Makabansa'],
  },
  {
    id: 'grade4to10',
    label: 'Grade 4–10',
    // Elementary G4-6 are new to TeacherHub (no legacy data — clean labels
    // used directly as keys, same as G2/G3). G7-10 (JHS) MUST keep the exact
    // legacy storage strings below so existing class records don't break.
    gradeLevels: [4, 5, 6, 7, 8, 9, 10],
    coreSubjects: [
      { key: 'Filipino',  label: 'Filipino' },
      { key: 'English',   label: 'English' },
      { key: 'Mathematics', label: 'Mathematics' },
      { key: 'Science',   label: 'Science' },
      { key: 'Araling Panlipunan (AP)', label: 'Araling Panlipunan (AP)' },
      // legacy key preserved; label updated to new official wording
      { key: 'Edukasyon sa Pagpapakatao (EsP)', label: 'GMRC / Values Education' },
      { key: 'EPP/TLE', label: 'EPP/TLE' },
      {
        key: 'MAPEH', label: 'MAPEH', isComputed: true,
        subRows: [
          { key: 'MAPEH - Music & Arts', label: 'Music and Arts' },
          { key: 'MAPEH - PE & Health',  label: 'Physical Education and Health' },
        ],
      },
    ],
    hasElectives: false,
    gaCoreKeys: [
      'Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan (AP)',
      'Edukasyon sa Pagpapakatao (EsP)', 'EPP/TLE', 'MAPEH',
    ],
  },
  {
    id: 'shs_core',
    label: 'Grade 11–12 (SHS)',
    gradeLevels: [11, 12],
    // Brand new to TeacherHub — no legacy data, clean keys used throughout.
    coreSubjects: [
      {
        key: 'Effective Communication /Mabisang Komunikasyon',
        label: 'Effective Communication /Mabisang Komunikasyon',
        isComputed: true,
        subRows: [
          { key: 'Effective Communication', label: 'Effective Communication' },
          { key: 'Mabisang Komunikasyon',   label: 'Mabisang Komunikasyon' },
        ],
      },
      { key: 'General Mathematics', label: 'General Mathematics' },
      { key: 'General Science',     label: 'General Science' },
      { key: 'Life and Career Skills', label: 'Life and Career Skills' },
      { key: 'Pag-Aaral ng Kasanayan at Lipunang Pilipino', label: 'Pag-Aaral ng Kasanayan at Lipunang Pilipino' },
    ],
    hasElectives: true, // elective/work-immersion rows appended dynamically — see buildSubjectRows()
    gaCoreKeys: [
      'Effective Communication /Mabisang Komunikasyon',
      'General Mathematics', 'General Science', 'Life and Career Skills',
      'Pag-Aaral ng Kasanayan at Lipunang Pilipino',
    ],
  },
];

export const SHS_TRACK_CONFIG: Record<SHSTrack, {
  electivePrefix: string;
  maxElectives: number;
  frontPageElectiveSlots: number;
  hasWorkImmersion: boolean;
}> = {
  academic: { electivePrefix: 'Academic Elective', maxElectives: 12, frontPageElectiveSlots: 3, hasWorkImmersion: false },
  techpro:  { electivePrefix: 'TechPro Elective',   maxElectives: 5,  frontPageElectiveSlots: 1, hasWorkImmersion: true },
};

export function getGradeBand(gradeLevel: number): SF9GradeBandConfig | undefined {
  return GRADE_BANDS.find(b => b.gradeLevels.includes(gradeLevel));
}

/** District (Grade ≤6) vs Cluster (Grade 7-12) — confirmed boundary. */
export function getHeaderScope(gradeLevel: number): HeaderScope {
  return gradeLevel <= 6 ? 'district' : 'cluster';
}

export function buildSubjectRows(
  gradeLevel: number,
  shsTrack: SHSTrack | null,
  electiveSubjectNames: string[] = [],
): { frontPage: SF9SubjectRow[]; continuationPage: SF9SubjectRow[]; gaKeys: string[] } {
  const band = getGradeBand(gradeLevel);
  if (!band) return { frontPage: [], continuationPage: [], gaKeys: [] };

  if (!band.hasElectives) {
    return { frontPage: band.coreSubjects, continuationPage: [], gaKeys: band.gaCoreKeys };
  }

  const track = shsTrack ?? 'academic';
  const trackCfg = SHS_TRACK_CONFIG[track];

  const electiveRows: SF9SubjectRow[] = electiveSubjectNames
    .slice(0, trackCfg.maxElectives)
    .map((name, i) => ({
      key: `elective_${i + 1}`,
      label: name?.trim() ? name : `${trackCfg.electivePrefix} ${i + 1}`,
    }));

  const frontElectives = electiveRows.slice(0, trackCfg.frontPageElectiveSlots);
  const overflowElectives = electiveRows.slice(trackCfg.frontPageElectiveSlots);

  const workImmersionRow: SF9SubjectRow[] = trackCfg.hasWorkImmersion
    ? [{ key: 'work_immersion', label: `Work Immersion for ${track === 'techpro' ? 'TechPro' : 'Academic'}Track` }]
    : [];

  const gaKeys = [
    ...band.gaCoreKeys,
    ...electiveRows.map(r => r.key),
    ...(trackCfg.hasWorkImmersion ? ['work_immersion'] : []),
  ];

  return {
    frontPage: [...band.coreSubjects, ...frontElectives],
    continuationPage: [...overflowElectives, ...workImmersionRow],
    gaKeys,
  };
}

/**
 * Compute a row's final grade, handling isComputed rows (MAPEH, Effective
 * Communication) the same way the current app computes MAPEH: term-by-term
 * average of subRow values, then average of the 3 term averages — only once
 * every subRow has all 3 terms filled.
 *
 * `termValuesByKey`: subject key -> [term1, term2, term3] raw values (0 = not entered)
 */
export function computeFinalGrade(row: SF9SubjectRow, termValuesByKey: Record<string, number[]>): number {
  if (!row.isComputed || !row.subRows?.length) {
    const terms = termValuesByKey[row.key] ?? [];
    return terms.length === 3 && terms.every(v => v > 0)
      ? Math.round(terms.reduce((a, b) => a + b, 0) / 3)
      : 0;
  }
  const termAverages = [0, 1, 2].map(ti => {
    const scores = row.subRows!.map(sr => termValuesByKey[sr.key]?.[ti] ?? 0).filter(v => v > 0);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  });
  return termAverages.every(v => v > 0)
    ? Math.round(termAverages.reduce((a, b) => a + b, 0) / 3)
    : 0;
}

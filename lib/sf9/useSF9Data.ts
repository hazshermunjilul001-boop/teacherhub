// ============================================================================
// SF9 Multi-Grade Revamp — Phase 3: useSF9Data hook
//
// Replaces the `loadData` callback currently inline in page.tsx. Same
// priority logic (Class Record beats Manual Entry), same "all 3 terms
// required before a Final Rating counts" rule — just driven by
// buildSubjectRows() instead of the hardcoded JHS_SUBJECTS/MAPEH_COMPONENTS.
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  buildSubjectRows, computeFinalGrade, getGradeBand,
  SUBJECT_KEY_ALIASES,
  type SF9SubjectRow, type SHSTrack,
} from '../../lib/sf9/sf9GradeBands';
import { getPromotionRemark, type PromotionRemark } from '../../lib/sf9/sf9Promotion';
import { computeFromClassRecord } from '../../lib/sf9/sf9ClassRecordScoring';

export interface Student { id:string; lrn:string; full_name:string; middle_name?:string; sex:string; birthdate?:string; }
export interface Collaborator {
  id: string;
  email: string;
  subjects: string[];
  grading_periods?: number[];
  components?: string[];
  status: string;
  role: string;
}
export interface GradeCell { value: number; source: 'class_record'|'manual'|'none'; }

export interface MonthlyAttendance { monthLabel: string; days: number; present: number; absent: number; }

export interface LearnerSF9 {
  student:      Student;
  grades:       Record<string, GradeCell[]>;   // leaf subject key -> [t1,t2,t3]
  finalGrades:  Record<string, number>;        // leaf key AND computed-row synthetic key -> final grade
  genAverage:   number;
  attendance:   MonthlyAttendance[];            // Jun through Apr, in order
  conduct:      Record<string,string>;
  comments?:    Record<string,string>;
  promotionRemark: PromotionRemark | null;
}

// Jun (this school-year-start) through Apr (next year) — matches the new
// SF9's attendance table columns exactly.
const MONTH_SEQ = [
  {m:'06',label:'Jun',yr:'first'}, {m:'07',label:'Jul',yr:'first'}, {m:'08',label:'Aug',yr:'first'},
  {m:'09',label:'Sep',yr:'first'}, {m:'10',label:'Oct',yr:'first'}, {m:'11',label:'Nov',yr:'first'},
  {m:'12',label:'Dec',yr:'first'}, {m:'01',label:'Jan',yr:'second'},{m:'02',label:'Feb',yr:'second'},
  {m:'03',label:'Mar',yr:'second'},{m:'04',label:'Apr',yr:'second'},
] as const;

function buildMonthKeys(schoolYear: string): { key: string; label: string }[] {
  const [y1, y2] = (schoolYear ?? '').split('-').map(s => s.trim());
  const first  = y1 || new Date().getFullYear().toString();
  const second = y2 || (parseInt(first) + 1).toString();
  return MONTH_SEQ.map(({ m, label, yr }) => ({
    key: `${yr === 'first' ? first : second}-${m}`,
    label,
  }));
}

function monthDates(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  return Array.from({ length: last }, (_, i) =>
    `${yearMonth}-${String(i + 1).padStart(2, '0')}`
  );
}

function isSchoolDay(date: string, holidaySet: Set<string>): boolean {
  const d = new Date(`${date}T00:00:00`);
  return d.getDay() !== 0 && d.getDay() !== 6 && !holidaySet.has(date);
}

function attendanceThroughToday(yearMonth: string, records: any[], holidaySet: Set<string>) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const days = monthDates(yearMonth).filter(date => date <= todayKey && isSchoolDay(date, holidaySet));
  const absentDates = new Set(records.filter(r => r.status === 'A').map(r => r.date));
  const absent = days.filter(date => absentDates.has(date)).length;
  return { days: days.length, present: days.length - absent, absent };
}

/** Flatten front+continuation page rows to real storage keys (sub-row keys
 *  for computed parents, the row's own key otherwise). */
function getLeafKeys(rows: SF9SubjectRow[]): string[] {
  return rows.flatMap(r => (r.isComputed && r.subRows?.length ? r.subRows.map(sr => sr.key) : [r.key]));
}

function subjectStorageKeys(subject: string): string[] {
  return [subject, ...(SUBJECT_KEY_ALIASES[subject] ?? [])];
}

export function useSF9Data(
  sectionId: string | undefined,
  gradeLevel: number | undefined,
  shsTrack: SHSTrack | null,
  electiveSubjectNames: string[],
  schoolYear: string,
  dataVersion: number,
  gmrcSource: string = '',
) {
  const [students,    setStudents]    = useState<Student[]>([]);
  const [sf9Data,      setSF9Data]     = useState<LearnerSF9[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [gradeSource,  setGradeSource] = useState<Record<string,string>>({});

  const band = gradeLevel ? getGradeBand(gradeLevel) : undefined;
  const { frontPage, continuationPage, gaKeys } = gradeLevel
    ? buildSubjectRows(gradeLevel, shsTrack, electiveSubjectNames)
    : { frontPage: [] as SF9SubjectRow[], continuationPage: [] as SF9SubjectRow[], gaKeys: [] as string[] };

  const allRows  = [...frontPage, ...continuationPage];
  const leafKeys = getLeafKeys(allRows);
  const displayFrontPage = frontPage.map(row =>
    row.key === 'Edukasyon sa Pagpapakatao (EsP)' && gmrcSource === 'Values Education (JHS)'
      ? { ...row, label: 'Values Education' }
      : row
  );

  const loadData = useCallback(async () => {
    if (!sectionId || sectionId === 'default-section' || !gradeLevel || !band) { setLoading(false); return; }
    setLoading(true);

    const { data: studs } = await supabase
      .from('students').select('*').eq('section_id', sectionId).order('full_name');
    const studentList: Student[] = (studs ?? []).sort((a: Student, b: Student) => {
      const sa = a.sex === 'M' ? 0 : 1, sb = b.sex === 'M' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.full_name.localeCompare(b.full_name);
    });
    setStudents(studentList);
    if (!studentList.length) { setSF9Data([]); setLoading(false); return; }

    const studentIds = studentList.map(s => s.id);
    const { data: sectionMeta } = await supabase.from('sections').select('gmrc_ve_source').eq('id', sectionId).maybeSingle();
    const storedGmrcSource = sectionMeta?.gmrc_ve_source as string | null;
    const selectedGmrcSource = gmrcSource || storedGmrcSource || '';

    const gradeStorageKeys = Array.from(new Set(leafKeys.flatMap(subjectStorageKeys)));
    const { data: gradesRaw } = await supabase
      .from('grades').select('*')
      .in('term', [1,2,3])
      .in('subject', gradeStorageKeys.length ? gradeStorageKeys : ['none'])
      .in('student_id', studentIds);

    const { data: manualRaw } = await supabase
      .from('manual_grades').select('*').eq('section_id', sectionId);

    const { data: conductRaw } = await supabase
      .from('conduct_records').select('*').in('term',[1,2,3]);

    const monthKeys = buildMonthKeys(schoolYear);
    const attendanceDates = monthKeys.flatMap(month => monthDates(month.key));
    const [{ data: attendRaw }, { data: holidayRaw }] = await Promise.all([
      supabase.from('attendance').select('student_id,date,status')
        .eq('section_id', sectionId).in('student_id', studentIds).in('date', attendanceDates),
      supabase.from('holidays').select('date').eq('section_id', sectionId).in('date', attendanceDates),
    ]);
    const holidaySet = new Set((holidayRaw ?? []).map((row: any) => row.date));

    const sourceMap: Record<string,string> = {};

    const result: LearnerSF9[] = studentList.map(student => {
      const grades:      Record<string, GradeCell[]> = {};
      const finalGrades: Record<string, number>       = {};
      const termValuesByKey: Record<string, number[]> = {};

      leafKeys.forEach(subj => {
        const termCells = [1,2,3].map(t => {
          const resolvedGmrcSource = !selectedGmrcSource || selectedGmrcSource === 'GMRC/VE'
            ? (Number(gradeLevel) <= 6 ? 'GMRC (Elem)' : 'Values Education (JHS)')
            : selectedGmrcSource;
          const sourceKeys = (subj === 'Edukasyon sa Pagpapakatao (EsP)' || subj === 'GMRC / Values Education') && resolvedGmrcSource
            ? subjectStorageKeys(resolvedGmrcSource)
            : subjectStorageKeys(subj);
          const matchingClassRecordRows = gradesRaw?.filter(g =>
            g.student_id === student.id && sourceKeys.includes(g.subject) && g.term === t
          ) ?? [];
          const crRow = matchingClassRecordRows.find(g => g.subject === resolvedGmrcSource)
            ?? matchingClassRecordRows.find(g => g.subject === subj)
            ?? matchingClassRecordRows.find(g => g.domain_scores && Object.keys(g.domain_scores).length > 0)
            ?? matchingClassRecordRows[0];
          if (crRow) {
            const v = computeFromClassRecord(crRow, subj);
            if (v > 0) { sourceMap[subj] = 'Class Record'; return { value: v, source: 'class_record' } as GradeCell; }
          }
          const manRow = manualRaw?.find(g =>
            g.student_id === student.id && subjectStorageKeys(subj).includes(g.subject) && g.term === t
          );
          if (manRow && manRow.grade >= 60) {
            if (!sourceMap[subj]) sourceMap[subj] = 'Manual Entry';
            return { value: manRow.grade, source: 'manual' } as GradeCell;
          }
          return { value: 0, source: 'none' } as GradeCell;
        });

        grades[subj] = termCells;
        termValuesByKey[subj] = termCells.map(c => c.value);
        const allTermsFilled = termCells.every(c => c.value > 0);
        finalGrades[subj] = allTermsFilled
          ? Math.round(termCells.reduce((a,c)=>a+c.value,0)/termCells.length) : 0;
      });

      // Computed parent rows (MAPEH, Effective Communication) — same
      // term-average-of-components-then-average-terms logic as before,
      // generalized via computeFinalGrade().
      allRows.forEach(row => {
        if (row.isComputed) {
          finalGrades[row.key] = computeFinalGrade(row, termValuesByKey);
        }
      });

      // General average — only once every GA-counted row has a completed
      // Final Rating (matches the existing "no premature average" rule).
      const gaFinals = gaKeys.map(k => finalGrades[k] ?? 0);
      const gaComplete = gaFinals.length > 0 && gaFinals.every(v => v > 0);
      const genAverage = gaComplete
        ? Math.round(gaFinals.reduce((a,b)=>a+b,0)/gaFinals.length) : 0;

      const promotionRemark = getPromotionRemark(finalGrades, gaKeys);

      // The report covers the school-year months from June through April. Future
      // dates are excluded; unmarked school days through today count as present,
      // while an explicit A is absent, keeping days = present + absent.
      const attendance: MonthlyAttendance[] = monthKeys.map(({ key, label }) => {
        const monthlyRecords = (attendRaw ?? []).filter((row: any) =>
          row.student_id === student.id && row.date.startsWith(`${key}-`)
        );
        return { monthLabel: label, ...attendanceThroughToday(key, monthlyRecords, holidaySet) };
      });

      const conduct: Record<string,string> = {};
      [1,2,3].forEach(term => {
        const rec = conductRaw?.find((c:any)=>c.student_id===student.id&&c.term===term);
        if (rec?.ratings) {
          Object.entries(rec.ratings).forEach(([behavior, rating]) => {
            conduct[`${behavior}_${term}`] = rating as string;
          });
        }
      });

      return { student, grades, finalGrades, genAverage, attendance, conduct, promotionRemark };
    });

    setSF9Data(result);
    setGradeSource(sourceMap);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, gradeLevel, shsTrack, JSON.stringify(electiveSubjectNames), schoolYear, dataVersion, gmrcSource]);

  useEffect(() => { loadData(); }, [loadData]);

  return { students, sf9Data, loading, gradeSource, frontPage: displayFrontPage, continuationPage, gaKeys, band };
}

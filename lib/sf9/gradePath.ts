import { buildSubjectRows, SUBJECT_KEY_ALIASES, type SF9SubjectRow, type SHSTrack } from './sf9GradeBands';
import { computeFromClassRecord } from './sf9ClassRecordScoring';

export interface ResolvedGradeSource {
  key: string;
  label: string;
  storageKeys: string[];
}

export function isGMRCValuesRowKey(key: string): boolean {
  return key === 'Edukasyon sa Pagpapakatao (EsP)' || key === 'GMRC / Values Education' || key === 'GMRC/VE';
}

export function resolveSF9GradeSource(gradeLevel: number, configuredSource?: string | null): ResolvedGradeSource {
  const configured = (configuredSource ?? '').trim();
  const key = !configured || configured === 'GMRC/VE'
    ? (gradeLevel <= 6 ? 'GMRC (Elem)' : 'Values Education (JHS)')
    : configured;
  const label = key === 'GMRC (Elem)' ? 'GMRC'
    : key === 'Values Education (JHS)' ? 'Values Education'
    : key === 'Edukasyon sa Pagpapakatao (EsP)' ? 'EsP' : key;
  return { key, label, storageKeys: [key, ...(SUBJECT_KEY_ALIASES[key] ?? [])] };
}

export function sf9RowsForSection(
  gradeLevel: number,
  track: SHSTrack | null | undefined,
  electiveSubjectNames: string[] = [],
  configuredSource?: string | null,
): { rows: SF9SubjectRow[]; leafRows: SF9SubjectRow[]; gaKeys: string[]; gradeSource: ResolvedGradeSource } {
  const built = buildSubjectRows(gradeLevel, track ?? null, electiveSubjectNames);
  const gradeSource = resolveSF9GradeSource(gradeLevel, configuredSource);
  const rows = [...built.frontPage, ...built.continuationPage].map(row =>
    isGMRCValuesRowKey(row.key)
      ? { ...row, label: gradeSource.label }
      : row
  );
  const leafRows = rows.flatMap(row => row.isComputed && row.subRows?.length ? row.subRows : [row]);
  return { rows, leafRows, gaKeys: built.gaKeys, gradeSource };
}

export function gradeFromClassRecord(row: any, subject: string): number {
  return computeFromClassRecord(row, subject);
}

export function finalGradeFromTerms(values: number[]): number {
  return values.length === 3 && values.every(value => value > 0)
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / 3)
    : 0;
}

export function subjectStorageKeys(subject: string): string[] {
  return [subject, ...(SUBJECT_KEY_ALIASES[subject] ?? [])];
}

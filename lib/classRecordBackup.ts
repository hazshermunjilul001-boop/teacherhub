export type ClassRecordBackupTerm = {
  scores: Record<string, unknown>;
  highest?: unknown;
};

export type ClassRecordBackup = {
  format: 'TeacherHub Class Record Backup';
  version: 1;
  recordType: 'regular' | 'gmrc-values';
  createdAt: string;
  sectionId: string;
  sectionName?: string;
  schoolYear?: string;
  subject: string;
  terms: Record<string, ClassRecordBackupTerm>;
};

export function downloadClassRecordBackup(payload: ClassRecordBackup, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function readClassRecordBackup(file: File): Promise<ClassRecordBackup> {
  const parsed = JSON.parse(await file.text()) as Partial<ClassRecordBackup>;
  if (
    parsed.format !== 'TeacherHub Class Record Backup' ||
    parsed.version !== 1 ||
    (parsed.recordType !== 'regular' && parsed.recordType !== 'gmrc-values') ||
    typeof parsed.sectionId !== 'string' ||
    typeof parsed.subject !== 'string' ||
    !parsed.terms || typeof parsed.terms !== 'object'
  ) {
    throw new Error('This file is not a valid TeacherHub class-record backup.');
  }
  return parsed as ClassRecordBackup;
}

export function safeBackupFilename(subject: string, sectionName?: string) {
  return `TeacherHub_${subject}_${sectionName || 'ClassRecord'}_Backup.json`.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export const BACKUP_REMINDER =
  'After entering all scores for the day, please download a backup copy of this class record. Keep the file in a safe location. If the online record is not saved successfully, you may upload the backup copy to restore your work.';

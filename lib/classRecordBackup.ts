export type ClassRecordBackupTerm = {
  scores: Record<string, unknown>;
  highest?: unknown;
};

export type ClassRecordBackup = {
  format: 'TeacherHub Class Record Backup';
  version: 2;
  recordType: 'regular' | 'gmrc-values';
  createdAt: string;
  sectionId: string;
  sectionName?: string;
  schoolYear?: string;
  subject: string;
  terms: Record<string, ClassRecordBackupTerm>;
  students?: Record<string, { id: string; full_name?: string; lrn?: string; sex?: string; status?: string }>;
};

const METADATA_SHEET = 'TeacherHub Backup';
const DATA_HEADER = 'Term';

function cleanFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'ClassRecord';
}

export function safeBackupFilename(subject: string, sectionName?: string, extension = 'xlsx') {
  return `TeacherHub_${cleanFilenamePart(subject)}_${cleanFilenamePart(sectionName || 'ClassRecord')}_Restore_Backup.${extension}`;
}

export function countBackupRows(payload: ClassRecordBackup) {
  return Object.values(payload.terms).reduce((total, term) => total + Object.keys(term.scores || {}).length, 0);
}

function jsonCell(value: unknown) {
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

function parseJsonCell(value: unknown, fallback: unknown = {}) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export async function downloadClassRecordExcel(payload: ClassRecordBackup, filename: string) {
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TeacherHub';
  workbook.created = new Date(payload.createdAt);
  const sheet = workbook.addWorksheet(METADATA_SHEET);
  sheet.columns = Array.from({ length: 12 }, (_, index) => ({ width: index === 2 ? 30 : 18 }));
  sheet.getCell('A1').value = 'TeacherHub Class Record Restore Backup';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  const metadata: [string, string | number][] = [
    ['Format Version', payload.version], ['Record Type', payload.recordType], ['Created At', payload.createdAt],
    ['Section ID', payload.sectionId], ['Section Name', payload.sectionName || ''], ['School Year', payload.schoolYear || ''],
    ['Subject', payload.subject], ['Backup Rows', countBackupRows(payload)],
  ];
  metadata.forEach(([label, value], index) => {
    sheet.getCell(index + 2, 1).value = label;
    sheet.getCell(index + 2, 1).font = { bold: true };
    sheet.getCell(index + 2, 2).value = value;
  });
  const dataStart = metadata.length + 4;
  const headers = ['Term', 'Student ID', 'Student Name', 'LRN', 'Sex', 'Status', 'Written Scores', 'Performance Task Scores', 'Summative Test Scores', 'Term Exam Score', 'Domain Scores', 'Highest Possible Scores'];
  headers.forEach((header, index) => {
    const cell = sheet.getCell(dataStart, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  let row = dataStart + 1;
  Object.entries(payload.terms).sort(([a], [b]) => Number(a) - Number(b)).forEach(([termKey, termData]) => {
    Object.entries(termData.scores || {}).forEach(([studentId, raw]) => {
      const score: any = raw || {};
      const student: any = payload.students?.[studentId] || {};
      const highestForStudent = payload.recordType === 'gmrc-values' ? ((termData.highest as any)?.[studentId] || {}) : termData.highest;
      const domainValue = payload.recordType === 'gmrc-values' ? score : score.domains;
      const values = [Number(termKey), studentId, student.full_name || '', student.lrn || '', student.sex || '', student.status || '', jsonCell(score.ww), jsonCell(score.pt), jsonCell(score.st), score.te ?? '', jsonCell(domainValue), jsonCell(highestForStudent)];
      values.forEach((value, index) => { sheet.getCell(row, index + 1).value = value; });
      row += 1;
    });
  });
  sheet.freezePanes = { xSplit: 0, ySplit: dataStart };
  sheet.autoFilter = { from: { row: dataStart, column: 1 }, to: { row: Math.max(dataStart, row - 1), column: headers.length } };
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function readClassRecordExcel(file: File): Promise<ClassRecordBackup> {
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet(METADATA_SHEET) || workbook.worksheets[0];
  if (!sheet) throw new Error('The Excel file does not contain a TeacherHub backup sheet.');
  if (sheet.getCell('A1').value !== 'TeacherHub Class Record Restore Backup') throw new Error('This Excel file is not a valid TeacherHub restore backup.');
  const metadata: Record<string, any> = {};
  for (let row = 1; row <= 12; row += 1) {
    const label = String(sheet.getCell(row, 1).value || '').trim();
    if (label) metadata[label] = sheet.getCell(row, 2).value;
  }
  if (Number(metadata['Format Version'] || 0) !== 2) throw new Error('This backup format version is not supported. Please download a new backup from the current app.');
  const recordType = String(metadata['Record Type'] || '');
  if (recordType !== 'regular' && recordType !== 'gmrc-values') throw new Error('The backup record type is invalid.');
  let dataHeaderRow = 0;
  for (let row = 1; row <= Math.min(sheet.rowCount, 30); row += 1) {
    if (String(sheet.getCell(row, 1).value || '') === DATA_HEADER) { dataHeaderRow = row; break; }
  }
  if (!dataHeaderRow) throw new Error('The Excel backup does not contain score rows.');
  const terms: Record<string, ClassRecordBackupTerm> = {};
  for (let row = dataHeaderRow + 1; row <= sheet.rowCount; row += 1) {
    const term = Number(sheet.getCell(row, 1).value || 0);
    const studentId = String(sheet.getCell(row, 2).value || '').trim();
    if (!term || !studentId) continue;
    const score: any = recordType === 'regular'
      ? { ww: parseJsonCell(sheet.getCell(row, 7).value), pt: parseJsonCell(sheet.getCell(row, 8).value), st: parseJsonCell(sheet.getCell(row, 9).value), te: Number(sheet.getCell(row, 10).value || 0), domains: parseJsonCell(sheet.getCell(row, 11).value) }
      : parseJsonCell(sheet.getCell(row, 11).value);
    if (!terms[String(term)]) terms[String(term)] = { scores: {}, highest: recordType === 'gmrc-values' ? {} : parseJsonCell(sheet.getCell(row, 12).value) };
    terms[String(term)].scores[studentId] = score;
    if (recordType === 'gmrc-values') (terms[String(term)].highest as any)[studentId] = parseJsonCell(sheet.getCell(row, 12).value);
  }
  const payload: ClassRecordBackup = {
    format: 'TeacherHub Class Record Backup', version: 2, recordType,
    createdAt: String(metadata['Created At'] || new Date().toISOString()), sectionId: String(metadata['Section ID'] || ''),
    sectionName: String(metadata['Section Name'] || ''), schoolYear: String(metadata['School Year'] || ''), subject: String(metadata.Subject || ''), terms,
  };
  if (!payload.sectionId || !payload.subject || !countBackupRows(payload)) throw new Error('The Excel backup contains incomplete or empty class-record data.');
  return payload;
}

function scoreText(recordType: ClassRecordBackup['recordType'], raw: any) {
  if (recordType === 'regular') {
    return [['WW', raw?.ww], ['PT', raw?.pt], ['ST', raw?.st], ['TE', raw?.te], ['Domains', raw?.domains]]
      .filter(([, value]) => value !== undefined && value !== null && (typeof value !== 'object' || Object.keys(value).length))
      .map(([label, value]) => `${label}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' | ');
  }
  return Object.entries(raw || {}).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(' | ');
}

export async function downloadClassRecordPdf(payload: ClassRecordBackup, filename: string) {
  const [{ jsPDF }] = await Promise.all([import('jspdf')]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const left = 10;
  const pageWidth = 277;
  let y = 12;
  const addLine = (text: string, size = 8, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, pageWidth);
    if (y + lines.length * 4.5 > 195) { pdf.addPage(); y = 12; }
    pdf.text(lines, left, y);
    y += lines.length * 4.5;
  };
  addLine('TeacherHub Class Record Backup Copy', 14, true);
  addLine(`Subject: ${payload.subject}    Section: ${payload.sectionName || ''}    School Year: ${payload.schoolYear || ''}`, 9, true);
  addLine(`Created: ${new Date(payload.createdAt).toLocaleString()}    Record type: ${payload.recordType}`, 8);
  addLine('This PDF is a readable verification copy. Use the Excel Restore Backup to restore scores automatically.', 8);
  y += 3;
  Object.entries(payload.terms).sort(([a], [b]) => Number(a) - Number(b)).forEach(([term, termData]) => {
    addLine(`TERM ${term}`, 11, true);
    Object.entries(termData.scores || {}).forEach(([studentId, raw]) => {
      const learner = payload.students?.[studentId]?.full_name || studentId;
      addLine(`${learner} (${studentId})  ${scoreText(payload.recordType, raw)}`, 7);
    });
    y += 2;
  });
  pdf.save(filename);
}

export const BACKUP_REMINDER = 'After entering all scores for the day, please download both a readable PDF copy and an Excel restore backup of this class record. Keep both files in a safe location. If the online record is not saved successfully, the Excel restore backup may be uploaded to recover your work.';

// lib/parseSF1.ts
// Parses DepEd LIS-generated SF1 Excel files (.xls / .xlsx)
// Returns school metadata + student list ready for Supabase insert

import * as XLSX from 'xlsx';

export interface SF1School {
  school_id:    string;
  school_name:  string;
  region:       string;
  division:     string;
  school_year:  string;
  grade_level:  string;   // e.g. "Grade 7 (Year I)"
  grade_number: number;   // e.g. 7
  section:      string;   // e.g. "STARGAZER"
}

export interface SF1Student {
  lrn:       string;
  full_name: string;   // "LASTNAME, FIRSTNAME MI." — normalized
  sex:       'M' | 'F';
  birthdate: string;   // raw string from file
}

export interface SF1ParseResult {
  school:   SF1School;
  students: SF1Student[];
  errors:   string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function safeStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function isLRN(val: any): boolean {
  const s = safeStr(val).replace(/\s/g, '');
  return /^\d{12}$/.test(s);
}

function isTotalRow(val: any): boolean {
  const s = safeStr(val);
  return s.includes('TOTAL') || s.includes('COMBINED') || s.includes('<===');
}

function normalizeName(raw: string): string {
  // SF1 format: "LASTNAME,FIRSTNAME, MIDDLENAME" or "LASTNAME,FIRSTNAME MI"
  // We want: "LASTNAME, FIRSTNAME MI."
  const cleaned = raw.replace(/\s+/g, ' ').trim().toUpperCase();
  const commaIdx = cleaned.indexOf(',');
  if (commaIdx === -1) return cleaned;

  const lastName  = cleaned.substring(0, commaIdx).trim();
  const rest      = cleaned.substring(commaIdx + 1).trim();

  // rest might be "FIRSTNAME, MIDDLENAME" or "FIRSTNAME MIDDLENAME"
  const parts     = rest.split(',').map(s => s.trim()).filter(Boolean);
  const firstName = parts[0] ?? '';
  const midName   = parts[1] ?? '';

  // Build: LASTNAME, FIRSTNAME [MI].
  let name = `${lastName}, ${firstName}`;
  if (midName && midName !== '-') {
    const mi = midName.split(' ')[0];
    if (mi && mi !== '-') name += ` ${mi.charAt(0)}.`;
  }
  return name;
}

function extractGradeNumber(gradeLevel: string): number {
  const match = gradeLevel.match(/\d+/);
  return match ? parseInt(match[0]) : 7;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PARSER
// ─────────────────────────────────────────────────────────────────────────────

export function parseSF1(fileBuffer: ArrayBuffer): SF1ParseResult {
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: false });
  } catch (e) {
    return {
      school: { school_id:'', school_name:'', region:'', division:'', school_year:'', grade_level:'', grade_number:7, section:'' },
      students: [],
      errors: ['Could not read file. Make sure it is a valid SF1 Excel file (.xls or .xlsx).'],
    };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const raw: any[][]  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // ── Extract school metadata ────────────────────────────────────────────────
  // Row 2 (index 2): col 5=School ID, col 10=Region, col 19=Division label, col 20=Division value
  // Row 3 (index 3): col 5=School Name, col 19=School Year label, col 20=SY value,
  //                   col 30=Grade Level value, col 36=Section value

  const r2 = raw[2] ?? [];
  const r3 = raw[3] ?? [];

  // School ID: find cell with 6-digit number near "School ID"
  let school_id   = safeStr(r2[5]);
  let region      = safeStr(r2[10]);
  let division    = '';
  // Division value is usually at col 20 or 21
  for (let c = 18; c <= 25; c++) {
    const v = safeStr(r2[c]);
    if (v && !v.toLowerCase().includes('division') && !v.toLowerCase().includes('region')) {
      division = v; break;
    }
  }

  let school_name = safeStr(r3[5]);
  let school_year = '';
  let grade_level = '';
  let section     = '';

  // Find school year
  for (let c = 18; c <= 25; c++) {
    const v = safeStr(r3[c]);
    if (v && v.includes('-')) { school_year = v; break; }
  }
  // Find grade level (usually contains "Grade")
  for (let c = 28; c <= 38; c++) {
    const v = safeStr(r3[c]);
    if (v && v.toLowerCase().includes('grade')) { grade_level = v; break; }
  }
  // Find section (after grade level columns)
  for (let c = 34; c <= 42; c++) {
    const v = safeStr(r3[c]);
    if (v && !v.toLowerCase().includes('section') && !v.toLowerCase().includes('grade') && v.length > 1) {
      section = v; break;
    }
  }

  // Fallbacks if parsing missed
  if (!school_id)   errors.push('Could not read School ID from row 3.');
  if (!school_name) errors.push('Could not read School Name from row 4.');
  if (!grade_level) errors.push('Could not read Grade Level — please enter manually.');
  if (!section)     errors.push('Could not read Section name — please enter manually.');
  if (!school_year) school_year = '2026 - 2027';

  const school: SF1School = {
    school_id,
    school_name,
    region,
    division,
    school_year,
    grade_level,
    grade_number: extractGradeNumber(grade_level),
    section,
  };

  // ── Extract students ───────────────────────────────────────────────────────
  // Students start at row index 6 (after 2 header rows at 4 and 5)
  // Col 0 = LRN (12-digit number)
  // Col 2 = Name
  // Col 6 = Sex (M/F)
  // Col 7 = Birthdate
  // Stop when we hit a "TOTAL" row or end of data

  const students: SF1Student[] = [];

  for (let i = 6; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;

    const lrnRaw = safeStr(row[0]);
    const nameRaw = safeStr(row[2]);

    // Stop at total/combined rows
    if (isTotalRow(lrnRaw) || isTotalRow(nameRaw)) continue;

    // Skip non-student rows
    if (!isLRN(lrnRaw)) continue;
    if (!nameRaw) { errors.push(`Row ${i+1}: LRN ${lrnRaw} has no name — skipped.`); continue; }

    const sexRaw = safeStr(row[6]).toUpperCase();
    const sex: 'M' | 'F' = sexRaw === 'F' ? 'F' : 'M';
    const birthdate = safeStr(row[7]);

    students.push({
      lrn:       lrnRaw.trim(),
      full_name: normalizeName(nameRaw),
      sex,
      birthdate,
    });
  }

  if (students.length === 0) {
    errors.push('No students found. Make sure this is a valid SF1 file from LIS.');
  }

  return { school, students, errors };
}
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// Parses a plain classroom masterlist (the format teachers make by hand or
// export from school-level tools) — NOT the official LIS SF1 export.
//
// Expected shape (see masterlist_einstein.xlsx):
//   Row 1   SCHOOL NAME
//   Row 2   Address (ignored)
//   Row 3   "Grade 9 - EINSTEIN"
//   ...
//   "MALE"
//   1  LASTNAME, FIRSTNAME MIDDLE.
//   2  LASTNAME, FIRSTNAME MIDDLE.
//   "FEMALE"
//   1  LASTNAME, FIRSTNAME MIDDLE.
//   ...
//   (blank rows)
//   ADVISER NAME
//   "Subject Teacher"
//
// There is no LRN or birthdate column in this format, so every student gets
// a placeholder LRN that the teacher can fill in later from the roster editor.
// ─────────────────────────────────────────────────────────────────────────────

export interface MasterlistStudent {
  lrn: string;
  full_name: string;
  sex: 'M' | 'F';
  birthdate?: string;
}

export interface MasterlistParseResult {
  school: {
    school_name: string;
    section: string;
    grade_level: string;
    grade_number: number;
    school_year: string;
    region: string;
    division: string;
    school_id: string;
    adviser: string;
  };
  students: MasterlistStudent[];
  errors: string[];
}

export function parseMasterlist(buf: ArrayBuffer): MasterlistParseResult {
  const errors: string[] = [];
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

  // ── School name: first non-empty row, first cell ──────────────────────────
  const firstContentRow = rows.find(r => r.some(c => String(c).trim() !== ''));
  const school_name = String(firstContentRow?.[0] ?? '').trim();
  if (!school_name) errors.push('Could not detect the school name from row 1.');

  // ── "Grade X - SECTION" line — scan the first several rows ────────────────
  let section = '';
  let grade_number = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cell = String(rows[i][0] ?? '').trim();
    const m = cell.match(/grade\s*(\d+)\s*-\s*(.+)/i);
    if (m) {
      grade_number = parseInt(m[1], 10);
      section = m[2].trim();
      break;
    }
  }
  const grade_level = grade_number ? `Grade ${grade_number}` : '';
  if (!section) errors.push('Could not detect the section name — look for a "Grade X - SECTION" row and fix it below.');

  // ── Walk the sheet, collecting names under MALE / FEMALE headers ──────────
  const students: MasterlistStudent[] = [];
  let currentSex: 'M' | 'F' | null = null;
  let lrnCounter = 1;
  let lastNameRowIndex = -1;

  rows.forEach((row, i) => {
    const c0 = String(row[0] ?? '').trim();
    const c1 = String(row[1] ?? '').trim();

    if (/^male$/i.test(c0) || /^male$/i.test(c1)) { currentSex = 'M'; return; }
    if (/^female$/i.test(c0) || /^female$/i.test(c1)) { currentSex = 'F'; return; }

    const num = Number(c0);
    const looksLikeNumberedRow = c0 !== '' && Number.isFinite(num) && num > 0;

    if (currentSex && looksLikeNumberedRow && c1) {
      students.push({
        lrn: `TEMP-${String(lrnCounter++).padStart(4, '0')}`,
        full_name: c1.toUpperCase(),
        sex: currentSex,
      });
      lastNameRowIndex = i;
    }
  });

  // ── Adviser: the "Subject Teacher" / "Adviser" label row, name is the row above it ──
  let adviser = '';
  for (let i = lastNameRowIndex + 1; i < rows.length; i++) {
    const label = String(rows[i][1] ?? '').trim();
    if (/subject teacher|class adviser|^adviser$/i.test(label)) {
      const nameAbove = String(rows[i - 1]?.[1] ?? '').trim();
      if (nameAbove) adviser = nameAbove;
      break;
    }
  }

  if (students.length === 0) {
    errors.push('No students were detected. Please check that names are under "MALE" / "FEMALE" headers, numbered starting at 1.');
  } else {
    errors.push(`This masterlist has no LRN column — ${students.length} placeholder LRN${students.length === 1 ? '' : 's'} were assigned (TEMP-0001, TEMP-0002, …). Update each student's real LRN later from the roster editor once available.`);
  }

  return {
    school: {
      school_name,
      section,
      grade_level,
      grade_number,
      school_year: '',
      region: '',
      division: '',
      school_id: '',
      adviser,
    },
    students,
    errors,
  };
}
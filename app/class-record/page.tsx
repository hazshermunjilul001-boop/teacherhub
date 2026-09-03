'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Plus, Printer, Users, RefreshCw, FileText, X, UserX, ArrowRightLeft, UserCheck, UserPlus, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';
import { useSubscription } from '../../lib/useSubscription';
import { useSection } from '../../context/SectionContext';
import { SUBJECT_KEY_ALIASES } from '../../lib/sf9/sf9GradeBands';

// ── EXCEL EXPORT HELPERS ───────────────────────────────────────────────────
// Shared by EClassRecordView and SummaryOfGradesView so the downloaded .xlsx
// mirrors the same layout/labels shown in the print preview.
async function saveWorkbook(workbook: any, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const XLSX_BORDER = { style: 'thin' as const, color: { argb: 'FF999999' } };
const XLSX_ALL_BORDERS = { top: XLSX_BORDER, left: XLSX_BORDER, bottom: XLSX_BORDER, right: XLSX_BORDER };

function setCell(
  ws: any, row: number, col: number, value: any,
  opts: { bold?: boolean; fill?: string; align?: 'left'|'center'; size?: number; color?: string } = {}
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.border = XLSX_ALL_BORDERS;
  cell.alignment = { horizontal: opts.align ?? 'center', vertical: 'middle', wrapText: true };
  cell.font = { bold: !!opts.bold, size: opts.size ?? 9, ...(opts.color ? { color: { argb: opts.color } } : {}) };
  if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
  return cell;
}

async function loadExcelJS(): Promise<any> {
  const mod: any = await import('exceljs');
  return mod.default ?? mod;
}

// Splits `total` columns into `parts` as-equal-as-possible chunks (remainder
// goes to the last chunk) — used to lay out the info header the same way the
// print preview's 4-column table does, instead of cramming a label into a
// single narrow column (which was wrapping into "Regio / n:").
function splitCols(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rem = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i === parts - 1 ? rem : 0));
}

// Writes a "Label: Value" cell merged across [colStart, colEnd] so the label
// always has room to sit on one line, with the label bold and value regular —
// matching the <strong>Label:</strong> Value styling in the HTML print preview.
function setLabelValue(
  ws: any, row: number, colStart: number, colEnd: number,
  label: string, value: string, opts: { size?: number } = {}
) {
  for (let c = colStart; c <= colEnd; c++) ws.getCell(row, c).border = XLSX_ALL_BORDERS;
  if (colEnd > colStart) ws.mergeCells(row, colStart, row, colEnd);
  const size = opts.size ?? 9;
  const master = ws.getCell(row, colStart);
  master.value = { richText: [
    { font: { bold: true, size }, text: `${label}: ` },
    { font: { size }, text: value ?? '' },
  ]};
  master.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
}

// Plain merged text cell (no bold label prefix) — used for signature names/lines
// so a long teacher/school-head name gets a wide enough span instead of being
// crammed into one narrow column.
function setMergedText(
  ws: any, row: number, colStart: number, colEnd: number, value: any,
  opts: { bold?: boolean; align?: 'left'|'center'; size?: number; color?: string } = {}
) {
  for (let c = colStart; c <= colEnd; c++) ws.getCell(row, c).border = XLSX_ALL_BORDERS;
  if (colEnd > colStart) ws.mergeCells(row, colStart, row, colEnd);
  const cell = ws.getCell(row, colStart);
  cell.value = value;
  cell.font = { bold: !!opts.bold, size: opts.size ?? 9, ...(opts.color ? { color: { argb: opts.color } } : {}) };
  cell.alignment = { horizontal: opts.align ?? 'center', vertical: 'middle', wrapText: true };
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const normalizeSubjectKey = (subject: string) =>
  Object.entries(SUBJECT_KEY_ALIASES).find(([, aliases]) => aliases.includes(subject))?.[0] ?? subject;

const subjectStorageKeys = (subject: string) => [
  subject,
  ...(SUBJECT_KEY_ALIASES[subject] ?? []),
];

const SUBJECTS_JHS = [
  'Filipino', 'English', 'Mathematics', 'Science',
  'Araling Panlipunan (AP)', 'GMRC/VE',
  'EPP/TLE',
  'MAPEH - Music & Arts', 'MAPEH - PE & Health',
  // Special Curricular Program subjects — each shares the assessment-component
  // weights (WW/PT/TA) of its parent regular subject (see SUBJECT_WEIGHTS below).
  'SPJ (Journalism)',        // follows English
  'STE Mathematics',         // follows Mathematics
  'STE Science',             // follows Science
  'STE Foreign Language',    // follows English
  'SPA (Arts)',              // follows MAPEH
  'STE Research',            // follows Science
];
const SUBJECTS_SHS_RESTORED = [
  'SHS Core Subjects',
  'SHS Applied Track',
  'SHS Specialized Subjects',
  'SHS Work Immersion',
  'SHS Research / Capstone',
  '21st Century Literature form the Philippines and the World',
];
const SUBJECTS_SHS_G11 = [
  ...SUBJECTS_SHS_RESTORED,
  'Mabisang Komunikasyon',
  'Effective Communication',
  'Life and Career Skills',
  'General Science',
  'General Mathematics',
  'Pag-Aaral ng Kasanayan at Lipunang Pilipino',
  'STEM - Biology 1',
  'ARSSH - Contemporary Literature 1',
  'Business - Introduction to Organization and Management',
];
const SUBJECTS_SHS_G12 = [
  ...SUBJECTS_SHS_RESTORED,
  'Philippine Politics and Governance',
  'Personal Development',
  'Introduction to Philosophy of the Human Person',
  'Filipino sa Piling Larang (Akademik)',
  'Contemporary Philippine Arts from the Regions',
  'Physical Education and Health (Grade 12)',
  'Food and Beverage Services',
  'Housekeeping',
];
const SUBJECTS_SHS = [...new Set([...SUBJECTS_SHS_G11, ...SUBJECTS_SHS_G12])];
const SUBJECT_WEIGHTS: Record<string, { ww: number; pt: number; ta: number }> = {
  'Filipino':                                       { ww: 0.20, pt: 0.50, ta: 0.30 },
  'English':                                        { ww: 0.20, pt: 0.50, ta: 0.30 },
  'Mathematics':                                    { ww: 0.20, pt: 0.50, ta: 0.30 },
  'Science':                                        { ww: 0.20, pt: 0.50, ta: 0.30 },
  'Araling Panlipunan (AP)':                        { ww: 0.20, pt: 0.50, ta: 0.30 },
  'GMRC/VE':                                        { ww: 0.20, pt: 0.50, ta: 0.30 },
  'EPP/TLE':                                        { ww: 0.20, pt: 0.60, ta: 0.20 },
  'MAPEH - Music & Arts':                           { ww: 0.20, pt: 0.60, ta: 0.20 },
  'MAPEH - PE & Health':                            { ww: 0.20, pt: 0.60, ta: 0.20 },
  // Special Curricular Program subjects — weights mirror the parent subject noted above.
  'SPJ (Journalism)':                               { ww: 0.20, pt: 0.50, ta: 0.30 },  // = English
  'STE Mathematics':                                { ww: 0.20, pt: 0.50, ta: 0.30 },  // = Mathematics
  'STE Science':                                     { ww: 0.20, pt: 0.50, ta: 0.30 },  // = Science
  'STE Foreign Language':                           { ww: 0.20, pt: 0.50, ta: 0.30 },  // = English
  'SPA (Arts)':                                     { ww: 0.20, pt: 0.60, ta: 0.20 },  // = MAPEH
  'STE Research':                                    { ww: 0.20, pt: 0.50, ta: 0.30 },  // = Science
  // SHS: Written Works 20%, Performance Tasks 50%, Summative Tests/Term Exam 30%.
  ...Object.fromEntries([
    ...SUBJECTS_SHS.map(s => [s, { ww: 0.20, pt: 0.50, ta: 0.30 }]),
  ]),
  // Restored legacy SHS subjects. These entries intentionally come after the
  // generic SHS defaults so their original component weights take precedence.
  'SHS Core Subjects':                               { ww: 0.20, pt: 0.50, ta: 0.30 },
  'SHS Applied Track':                                { ww: 0.20, pt: 0.60, ta: 0.20 },
  'SHS Specialized Subjects':                         { ww: 0.20, pt: 0.60, ta: 0.20 },
  'SHS Work Immersion':                               { ww: 0.20, pt: 0.80, ta: 0.00 },
  'SHS Research / Capstone':                          { ww: 0.40, pt: 0.60, ta: 0.00 },
  '21st Century Literature form the Philippines and the World': { ww: 0.25, pt: 0.50, ta: 0.25 },
  // G12 core subjects — DepEd component weights.
  'Philippine Politics and Governance':                     { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Personal Development':                                   { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Introduction to Philosophy of the Human Person':         { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Filipino sa Piling Larang (Akademik)':                   { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Contemporary Philippine Arts from the Regions':          { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Physical Education and Health (Grade 12)':               { ww: 0.25, pt: 0.50, ta: 0.25 },
  // G12 TVL electives.
  'Food and Beverage Services':                             { ww: 0.20, pt: 0.60, ta: 0.20 },
  'Housekeeping':                                           { ww: 0.20, pt: 0.60, ta: 0.20 },
};
// Adjusted Transmutation Table (starting SY 2027–2028).
// The ranges are ordered from highest to lowest and match the supplied table.
const TRANSMUTATION = [
  {min:99.50,max:100.00,trans:100},
  {min:98.32,max:99.49,trans:99},
  {min:97.14,max:98.31,trans:98},
  {min:95.96,max:97.13,trans:97},
  {min:94.78,max:95.95,trans:96},
  {min:93.60,max:94.77,trans:95},
  {min:92.42,max:93.59,trans:94},
  {min:91.24,max:92.41,trans:93},
  {min:90.06,max:91.23,trans:92},
  {min:88.88,max:90.05,trans:91},
  {min:87.70,max:88.87,trans:90},
  {min:86.52,max:87.69,trans:89},
  {min:85.34,max:86.51,trans:88},
  {min:84.16,max:85.33,trans:87},
  {min:82.98,max:84.15,trans:86},
  {min:81.80,max:82.97,trans:85},
  {min:80.62,max:81.79,trans:84},
  {min:79.44,max:80.61,trans:83},
  {min:78.26,max:79.43,trans:82},
  {min:77.08,max:78.25,trans:81},
  {min:75.90,max:77.07,trans:80},
  {min:74.72,max:75.89,trans:79},
  {min:73.54,max:74.71,trans:78},
  {min:72.36,max:73.53,trans:77},
  {min:71.18,max:72.35,trans:76},
  {min:70.00,max:71.17,trans:75},
  {min:65.34,max:69.99,trans:74},
  {min:60.67,max:65.33,trans:73},
  {min:56.01,max:60.66,trans:72},
  {min:51.34,max:56.00,trans:71},
  {min:46.67,max:51.33,trans:70},
  {min:42.01,max:46.66,trans:69},
  {min:37.34,max:42.00,trans:68},
  {min:32.68,max:37.33,trans:67},
  {min:28.01,max:32.67,trans:66},
  {min:23.35,max:28.00,trans:65},
  {min:18.68,max:23.34,trans:64},
  {min:14.01,max:18.67,trans:63},
  {min:9.35,max:14.00,trans:62},
  {min:4.68,max:9.34,trans:61},
  {min:0.00,max:4.67,trans:60},
];
const transmute = (v:number) => {
  const rounded = Math.round((v + Number.EPSILON) * 100) / 100;
  return TRANSMUTATION.find(t => rounded >= t.min && rounded <= t.max)?.trans ?? 60;
};
const descriptor = (g:number) => {
  if(g>=90) return {label:'Advancing (Namumukod-tangi)',  short:'Advancing',    color:'text-emerald-400'};
  if(g>=80) return {label:'Benchmarking (Napamamalas)',   short:'Benchmarking', color:'text-green-400'  };
  if(g>=75) return {label:'Connecting (Natutungo)',       short:'Connecting',   color:'text-blue-400'   };
  return         {label:'Developing (Napauunlad)',        short:'Developing',   color:'text-yellow-400' };
};
const calcAvg = (scores:number[], highs:number[]) => {
  let sumScore=0, sumHigh=0;
  scores.forEach((s,i)=>{ if(highs[i]>0){sumScore+=s; sumHigh+=highs[i];} });
  return sumHigh>0 ? (sumScore/sumHigh)*100 : 0;
};

// DO 15 s. 2026 — Within the EXs component:
// ST1 = 30%, ST2 = 30%, TE = 40% of the EXs assigned weight.
// Parts with no highest (>0) are excluded; remaining weights redistributed proportionally.
const calcEX = (
  st1:number, st2:number, te:number,
  highSt1:number, highSt2:number, highTe:number
): number => {
  const parts = [
    { w:0.30, score:st1, high:highSt1 },
    { w:0.30, score:st2, high:highSt2 },
    { w:0.40, score:te,  high:highTe  },
  ].filter(p => p.high > 0);
  if (parts.length === 0) return 0;
  const totalW = parts.reduce((s,p) => s+p.w, 0);
  return parts.reduce((sum,p) => sum + (p.score/p.high)*100*(p.w/totalW), 0);
};

// ── STATUS CONFIG ─────────────────────────────────────────────────────────────
type StudentStatus = 'active'|'dropped'|'transferred_out'|'transferred_in';
const STATUS_CONFIG: Record<StudentStatus,{label:string;color:string;bg:string;icon:any}> = {
  active:          {label:'Active',           color:'text-emerald-400', bg:'bg-emerald-900/40 border-emerald-700', icon:UserCheck},
  dropped:         {label:'Dropped',          color:'text-red-400',     bg:'bg-red-900/40 border-red-700',         icon:UserX},
  transferred_out: {label:'Transferred Out',  color:'text-amber-400',   bg:'bg-amber-900/40 border-amber-700',     icon:ArrowRightLeft},
  transferred_in:  {label:'Transferred In',   color:'text-blue-400',    bg:'bg-blue-900/40 border-blue-700',       icon:UserPlus},
};

// ── INTERFACES ────────────────────────────────────────────────────────────────
interface Student {
  id: string; lrn: string; full_name: string; sex?: string;
  status?: StudentStatus; status_date?: string; status_note?: string;
}
interface Highest { ww:number[]; pt:number[]; st:number[]; te:number; }
interface Scores  { ww:Record<number,number>; pt:Record<number,number>; st:Record<number,number>; te:number; }
interface TermData { scores:Record<string,Scores>; highest:Highest; }

// ── STUDENT STATUS MODAL ──────────────────────────────────────────────────────
function StudentStatusModal({ student, onClose, onUpdate }:
  { student: Student; onClose:()=>void; onUpdate:(s:Student)=>void }) {
  const [status,    setStatus]    = useState<StudentStatus>(student.status ?? 'active');
  const [date,      setDate]      = useState(student.status_date ?? '');
  const [note,      setNote]      = useState(student.status_note ?? '');
  const [saving,    setSaving]    = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('students').update({
      status, status_date: date || null, status_note: note || null,
    }).eq('id', student.id);
    if (!error) {
      onUpdate({ ...student, status, status_date: date||undefined, status_note: note||undefined });
      onClose();
    } else {
      alert('Error saving: ' + error.message);
    }
    setSaving(false);
  };

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
        {/* Student info */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-white">{student.full_name}</h3>
            <p className="text-gray-500 text-sm">LRN: {student.lrn} &middot; {student.sex === 'M' ? 'Male' : 'Female'}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition">
            <X size={20}/>
          </button>
        </div>

        {/* Current status badge */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold mb-5 ${cfg.bg} ${cfg.color}`}>
          <cfg.icon size={16}/>
          Currently: {cfg.label}
        </div>

        {/* Status selector */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Change Status</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(STATUS_CONFIG) as [StudentStatus, typeof STATUS_CONFIG[StudentStatus]][]).map(([key, conf]) => (
              <button key={key} onClick={() => setStatus(key)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition
                  ${status === key ? `${conf.bg} ${conf.color} border-opacity-100` : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                <conf.icon size={14}/>
                {conf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date and note (only if not active) */}
        {status !== 'active' && (
          <>
            <div className="mb-3">
              <label className="block text-sm text-gray-400 mb-1">
                {status === 'dropped' ? 'Date Dropped' : status === 'transferred_in' ? 'Date Transferred In' : 'Date Transferred Out'}
              </label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"/>
            </div>
            <div className="mb-5">
              <label className="block text-sm text-gray-400 mb-1">
                {status === 'dropped' ? 'Reason for Dropping' : status === 'transferred_in' ? 'From School' : 'Transferred to School'}
              </label>
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder={status === 'dropped' ? 'e.g. Family relocated, Health reasons...' : 'e.g. San Pedro NHS'}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"/>
            </div>
          </>
        )}

        {status === 'active' && <div className="mb-5"/>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition disabled:opacity-60 text-sm">
            {saving ? 'Saving...' : 'Save Status'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ADD STUDENT MODAL ─────────────────────────────────────────────────────────
function AddStudentModal({ onClose, onAdd, sectionId }:
  { onClose:()=>void; onAdd:(s:Student)=>void; sectionId:string }) {
  const [lrn,        setLrn]        = useState('');
  const [lastName,   setLastName]   = useState('');
  const [firstName,  setFirstName]  = useState('');
  const [middleName, setMiddleName] = useState('');
  const [sex,        setSex]        = useState('M');
  const [saving,     setSaving]     = useState(false);

  const save = async () => {
    if (!lastName.trim() || !firstName.trim()) return;
    setSaving(true);
    const last   = lastName.trim().toUpperCase();
    const first  = firstName.trim().toUpperCase();
    const middle = middleName.trim().toUpperCase();
    const full_name = middle ? `${last}, ${first} ${middle}` : `${last}, ${first}`;
    const s = {
      id: crypto.randomUUID(), lrn: lrn.trim(), full_name,
      middle_name: middle || null, sex,
      section_id: sectionId, status: 'active' as StudentStatus,
    };
    const {error} = await supabase.from('students').insert(s);
    if (!error) { onAdd(s); onClose(); } else alert('Error: ' + error.message);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md border border-gray-700">
        <h3 className="text-xl font-bold mb-6">Add New Learner</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">LRN (12 digits)</label>
            <input value={lrn} onChange={e=>setLrn(e.target.value)} maxLength={12}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="129694170087"/>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Last Name</label>
            <input value={lastName} onChange={e=>setLastName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="DELA CRUZ"/>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">First Name</label>
            <input value={firstName} onChange={e=>setFirstName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="JUAN"/>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Middle Name <span className="text-gray-500 text-xs">(full name, not initial — leave blank if none)</span>
            </label>
            <input value={middleName} onChange={e=>setMiddleName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="PEDRO"/>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Sex</label>
            <select value={sex} onChange={e=>setSex(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500">
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition">Cancel</button>
          <button onClick={save} disabled={saving || !lastName.trim() || !firstName.trim()}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition disabled:opacity-60">
            {saving ? 'Saving...' : 'Add Learner'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── STATUS BADGE (inline) ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: StudentStatus }) {
  if (!status || status === 'active') return null;
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <cfg.icon size={10}/>{cfg.label}
    </span>
  );
}

// ── SUMMARY OF GRADES VIEW ────────────────────────────────────────────────────
function SummaryOfGradesView({
  students, subject, sectionName, gradeLevel, schoolName, schoolId,
  schoolYear, division, region, adviser, schoolHead, allTermData, onClose,
}: {
  students: Student[]; subject: string;
  sectionName: string; gradeLevel: string; schoolName: string;
  schoolId: string; schoolYear: string; division: string;
  region: string; adviser: string; schoolHead: string;
  allTermData: Record<number, TermData>;
  onClose: () => void;
}) {
  const weights = SUBJECT_WEIGHTS[subject] ?? { ww:0.25, pt:0.50, ta:0.25 };
  const activeStudents = students.filter(s => !s.status || s.status === 'active');
  const males   = activeStudents.filter(s => s.sex === 'M').sort((a,b)=>a.full_name.localeCompare(b.full_name));
  const females = activeStudents.filter(s => s.sex === 'F').sort((a,b)=>a.full_name.localeCompare(b.full_name));

  const computeTerm = (sid: string, termNum: number) => {
    const td = allTermData[termNum];
    if (!td) return 0;
    const s = td.scores[sid];
    if (!s) return 0; // no grades row at all for this student/term — not yet graded, not a 60
    const ww = Array.from({length:5},(_,i)=>s.ww?.[i]??0);
    const pt = Array.from({length:3},(_,i)=>s.pt?.[i]??0);
    const st = Array.from({length:2},(_,i)=>s.st?.[i]??0);
    const te = s.te ?? 0;
    const avgWW = calcAvg(ww, td.highest.ww);
    const avgPT = calcAvg(pt, td.highest.pt);
    const avgTA = calcEX(st[0],st[1],te, td.highest.st[0],td.highest.st[1],td.highest.te);
    const initial = avgWW*weights.ww + avgPT*weights.pt + avgTA*(weights.ta??0.25);
    return transmute(initial);
  };

  const td = { border:'1px solid #999', padding:'2px 6px', fontSize:'9px', textAlign:'center' as const };
  const th = { ...td, background:'#e8e8e8', fontWeight:'bold' as const };


  // ── Enter-key navigation: moves focus to next student in the same column ──
  const handleEnter = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentId: string,
    type: string,
    idx: number | null,
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const key = `${type}:${idx ?? 'te'}`;
    const all = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[data-cell]')
    ).filter(el => el.dataset.cell?.endsWith(`:${key}`));
    const cur = all.findIndex(el => el.dataset.cell === `${studentId}:${key}`);
    const next = all[cur + 1];
    if (next) { next.focus(); next.select(); }
  };

  const renderGroup = (group: Student[], label: string) => (
    <>
      <tr>
        <td colSpan={7} style={{...td, background: label==='MALE'?'#dbeafe':'#fce7f3', fontWeight:'bold', textAlign:'left'}}>
          {label}
        </td>
      </tr>
      {group.map((student, idx) => {
        const t1 = computeTerm(student.id, 1);
        const t2 = computeTerm(student.id, 2);
        const t3 = computeTerm(student.id, 3);
        const valid = [t1,t2,t3].filter(v=>v>0);
        const final = valid.length>0 ? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length) : 0;
        const desc  = descriptor(final);
        const remarks = final>=75 ? 'PASSED' : final>0 ? 'FAILED' : '';
        return (
          <tr key={student.id} style={{background: idx%2===0?'white':'#f9fafb'}}>
            <td style={td}>{idx+1}</td>
            <td style={{...td, textAlign:'left', minWidth:'160px'}}>{student.full_name}</td>
            <td style={td}>{t1||''}</td>
            <td style={td}>{t2||''}</td>
            <td style={td}>{t3||''}</td>
            <td style={{...td, fontWeight:'bold', fontSize:'11px', color:final>=75?'#166534':'#991b1b'}}>{final||''}</td>
            <td style={{...td, fontSize:'8px'}}>{final ? desc.short : ''}</td>
            <td style={{...td, fontWeight:'bold', color:final>=75?'#166534':'#991b1b'}}>{remarks}</td>
          </tr>
        );
      })}
    </>
  );

  // ── Excel export — mirrors the print preview above exactly ────────────────
  const downloadExcel = async () => {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Summary of Grades');
    const totalCols = 8;
    let r = 1;

    setCell(ws, r, 1, 'SUMMARY OF GRADES', { bold:true, size:13 }); ws.mergeCells(r,1,r,totalCols); r++;
    setCell(ws, r, 1, `${subject} — ${schoolYear}`, { size:9, color:'FF555555' }); ws.mergeCells(r,1,r,totalCols); r++;
    r++;

    // 4-column info grid — same proportions as the print preview's header table
    // (a "unit" of totalCols/4 columns; School/Teacher rows take 2 units each).
    const [u1, u2, u3, u4] = splitCols(totalCols, 4);
    const c1 = 1, c1End = u1;
    const c2 = c1End + 1, c2End = c1End + u2;
    const c3 = c2End + 1, c3End = c2End + u3;
    const c4 = c3End + 1, c4End = totalCols;

    setLabelValue(ws, r, c1, c1End, 'Region', region);
    setLabelValue(ws, r, c2, c2End, 'Division', division);
    setLabelValue(ws, r, c3, c3End, 'School ID', schoolId);
    setLabelValue(ws, r, c4, c4End, 'School Year', schoolYear);
    r++;
    setLabelValue(ws, r, c1, c2End, 'School', schoolName);
    setLabelValue(ws, r, c3, c3End, 'Grade & Section', `${gradeLevel} — ${sectionName}`);
    setLabelValue(ws, r, c4, c4End, 'Subject', subject);
    r++;
    setLabelValue(ws, r, c1, c2End, 'Teacher', adviser?.toUpperCase() || '');
    setLabelValue(ws, r, c3, c4End, 'Total Active Learners', `${activeStudents.length} (${males.length}M / ${females.length}F)`);
    r++; r++;

    const hdrRow = r, hdrRow2 = r+1;
    setCell(ws,hdrRow,1,'#',{bold:true,fill:'FFE8E8E8',size:9}); ws.mergeCells(hdrRow,1,hdrRow2,1);
    setCell(ws,hdrRow,2,"LEARNERS' NAMES",{bold:true,fill:'FFE8E8E8',size:9,align:'left'}); ws.mergeCells(hdrRow,2,hdrRow2,2);
    setCell(ws,hdrRow,3,'TERM GRADES',{bold:true,fill:'FFE8E8E8',size:9}); ws.mergeCells(hdrRow,3,hdrRow,5);
    setCell(ws,hdrRow2,3,'TERM 1',{bold:true,fill:'FFE8E8E8',size:9});
    setCell(ws,hdrRow2,4,'TERM 2',{bold:true,fill:'FFE8E8E8',size:9});
    setCell(ws,hdrRow2,5,'TERM 3',{bold:true,fill:'FFE8E8E8',size:9});
    setCell(ws,hdrRow,6,'FINAL GRADE',{bold:true,fill:'FFD1FAE5',size:9}); ws.mergeCells(hdrRow,6,hdrRow2,6);
    setCell(ws,hdrRow,7,'DESCRIPTOR',{bold:true,fill:'FFE8E8E8',size:9}); ws.mergeCells(hdrRow,7,hdrRow2,7);
    setCell(ws,hdrRow,8,'REMARK',{bold:true,fill:'FFE8E8E8',size:9}); ws.mergeCells(hdrRow,8,hdrRow2,8);
    r = hdrRow2 + 1;

    const writeGroup = (group: Student[], label: string) => {
      if (group.length === 0) return;
      setCell(ws,r,1,label,{bold:true,fill:label==='MALE'?'FFDBEAFE':'FFFCE7F3',align:'left',size:9});
      ws.mergeCells(r,1,r,totalCols); r++;
      group.forEach((student, idx) => {
        const t1 = computeTerm(student.id, 1);
        const t2 = computeTerm(student.id, 2);
        const t3 = computeTerm(student.id, 3);
        const valid = [t1,t2,t3].filter(v=>v>0);
        const final = valid.length>0 ? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length) : 0;
        const desc = descriptor(final);
        const remarks = final>=75 ? 'PASSED' : final>0 ? 'FAILED' : '';
        setCell(ws,r,1,idx+1,{size:9});
        setCell(ws,r,2,student.full_name,{size:9,align:'left'});
        setCell(ws,r,3,t1||'',{size:9});
        setCell(ws,r,4,t2||'',{size:9});
        setCell(ws,r,5,t3||'',{size:9});
        setCell(ws,r,6,final||'',{bold:true,size:10,color:final>=75?'FF166534':'FF991B1B'});
        setCell(ws,r,7,final?desc.short:'',{size:8});
        setCell(ws,r,8,remarks,{bold:true,color:final>=75?'FF166534':'FF991B1B',size:9});
        r++;
      });
    };
    writeGroup(males, 'MALE');
    writeGroup(females, 'FEMALE');

    r++;
    const [sg1, sg2, sg3] = splitCols(totalCols, 3);
    const sc1 = 1, sc1End = sg1;
    const sc2 = sc1End + 1, sc2End = sc1End + sg2;
    const sc3 = sc2End + 1, sc3End = totalCols;
    setMergedText(ws, r, sc1, sc1End, adviser?.toUpperCase() || '', { bold:true, size:9 });
    setMergedText(ws, r, sc2, sc2End, schoolHead?.toUpperCase() || '________________________________', { bold:true, size:9 });
    setMergedText(ws, r, sc3, sc3End, '________________________________', { size:9 });
    r++;
    setMergedText(ws, r, sc1, sc1End, 'Subject Teacher', { size:9 });
    setMergedText(ws, r, sc2, sc2End, 'School Head', { size:9 });
    setMergedText(ws, r, sc3, sc3End, 'Date', { size:9 });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 28;
    for (let c=3;c<=8;c++) ws.getColumn(c).width = 13;

    await saveWorkbook(wb, `SummaryOfGrades_${subject.replace(/[^a-zA-Z0-9]+/g,'_')}.xlsx`);
  };

  return (
    <div className="eclass-modal-overlay fixed inset-0 bg-black/80 z-50 overflow-auto">
      <div className="no-print sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-emerald-400"/>
          <span className="font-semibold">Summary of Grades &mdash; {subject}</span>
          <span className="text-gray-400 text-sm">{sectionName} &middot; {schoolYear}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={downloadExcel} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Download size={16}/> Download Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Printer size={16}/> Print
          </button>
          <button onClick={onClose} className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <X size={16}/> Close
          </button>
        </div>
      </div>

      <div className="summary-print bg-white text-black p-6" style={{fontFamily:'Arial, sans-serif', maxWidth:'900px', margin:'0 auto'}}>
        {/* Header */}
        <div style={{textAlign:'center', marginBottom:'8px'}}>
          <div style={{fontWeight:'bold', fontSize:'13px'}}>SUMMARY OF GRADES</div>
          <div style={{fontSize:'9px', color:'#555'}}>{subject} &mdash; {schoolYear}</div>
        </div>

        <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'6px', fontSize:'9px'}}>
          <tbody>
            <tr>
              <td style={{...td, textAlign:'left'}}><strong>Region:</strong> {region}</td>
              <td style={{...td, textAlign:'left'}}><strong>Division:</strong> {division}</td>
              <td style={{...td, textAlign:'left'}}><strong>School ID:</strong> {schoolId}</td>
              <td style={{...td, textAlign:'left'}}><strong>School Year:</strong> {schoolYear}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{...td, textAlign:'left'}}><strong>School:</strong> {schoolName}</td>
              <td style={{...td, textAlign:'left'}}><strong>Grade &amp; Section:</strong> {gradeLevel} &mdash; {sectionName}</td>
              <td style={{...td, textAlign:'left'}}><strong>Subject:</strong> {subject}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{...td, textAlign:'left'}}><strong>Teacher:</strong> {adviser?.toUpperCase()}</td>
              <td colSpan={2} style={{...td, textAlign:'left'}}><strong>Total Active Learners:</strong> {activeStudents.length} ({males.length}M / {females.length}F)</td>
            </tr>
          </tbody>
        </table>

        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'9px'}}>
          <thead>
            <tr>
              <th style={th} rowSpan={2}>#</th>
              <th style={{...th, textAlign:'left'}} rowSpan={2}>LEARNERS' NAMES</th>
              <th style={th} colSpan={3}>TERM GRADES</th>
              <th style={{...th, background:'#d1fae5'}} rowSpan={2}>FINAL<br/>GRADE</th>
              <th style={th} rowSpan={2}>DESCRIPTOR</th>
              <th style={th} rowSpan={2}>REMARK</th>
            </tr>
            <tr>
              <th style={th}>TERM 1</th>
              <th style={th}>TERM 2</th>
              <th style={th}>TERM 3</th>
            </tr>
          </thead>
          <tbody>
            {renderGroup(males,   'MALE')}
            {renderGroup(females, 'FEMALE')}
          </tbody>
        </table>

        {/* Signatures */}
        <div style={{display:'flex', justifyContent:'space-between', marginTop:'20px', fontSize:'9px'}}>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'2px', marginTop:'24px'}}>{adviser?.toUpperCase()}</div>
            <div>Subject Teacher</div>
          </div>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'2px', marginTop:'24px'}}>{schoolHead?.toUpperCase() || '________________________________'}</div>
            <div>School Head</div>
          </div>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{borderTop:'1px solid black', paddingTop:'2px', marginTop:'24px'}}>________________________________</div>
            <div>Date</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .eclass-modal-overlay { display: block !important; position: static !important; overflow: visible !important; background: white !important; }
          .min-h-screen { display: none !important; }
          body { background: white !important; }
          .summary-print { padding: 8mm !important; max-width: 100% !important; }
          @page { size: portrait; margin: 8mm; }
        }
      `}</style>
    </div>
  );
}

// ── MAPEH SUMMARY VIEW ────────────────────────────────────────────────────────
// MAPEH is entered as two separate subjects (Music & Arts, PE & Health), each with
// its own weighted quarterly grade. Report cards need ONE combined MAPEH grade,
// which DepEd computes as the average of the component grades — this view pulls
// both components' term data and averages them per quarter (then averages the
// quarters for a final grade), all rounded to whole numbers at each step, the
// same way SummaryOfGradesView rounds a single subject's quarters.
function MAPEHSummaryView({
  students, sectionName, gradeLevel, schoolName, schoolId,
  schoolYear, division, region, adviser, schoolHead,
  maTermData, peTermData, currentTerm, onClose,
}: {
  students: Student[];
  sectionName: string; gradeLevel: string; schoolName: string;
  schoolId: string; schoolYear: string; division: string;
  region: string; adviser: string; schoolHead: string;
  maTermData: Record<number, TermData>;
  peTermData: Record<number, TermData>;
  currentTerm: number;
  onClose: () => void;
}) {
  const maWeights = SUBJECT_WEIGHTS['MAPEH - Music & Arts'];
  const peWeights = SUBJECT_WEIGHTS['MAPEH - PE & Health'];
  const activeStudents = students.filter(s => !s.status || s.status === 'active');
  const males   = activeStudents.filter(s => s.sex === 'M').sort((a,b)=>a.full_name.localeCompare(b.full_name));
  const females = activeStudents.filter(s => s.sex === 'F').sort((a,b)=>a.full_name.localeCompare(b.full_name));

  const computeComponentTerm = (
    sid: string, termNum: number,
    termData: Record<number, TermData>, weights: { ww: number; pt: number; ta: number },
  ) => {
    const td = termData[termNum];
    if (!td) return 0;
    const s = td.scores[sid];
    if (!s) return 0; // no grades row at all for this student/term — not yet graded, not a 60
    const ww = Array.from({length:5},(_,i)=>s.ww?.[i]??0);
    const pt = Array.from({length:3},(_,i)=>s.pt?.[i]??0);
    const st = Array.from({length:2},(_,i)=>s.st?.[i]??0);
    const te = s.te ?? 0;
    const avgWW = calcAvg(ww, td.highest.ww);
    const avgPT = calcAvg(pt, td.highest.pt);
    const avgTA = calcEX(st[0],st[1],te, td.highest.st[0],td.highest.st[1],td.highest.te);
    const initial = avgWW*weights.ww + avgPT*weights.pt + avgTA*weights.ta;
    return transmute(initial);
  };

  // Per-quarter MAPEH = whole-number average of that quarter's Music & Arts and PE & Health grades.
  // Terms beyond the one currently being worked on are deliberately kept blank — even if a
  // component subject happens to already have scores entered — so a MAPEH teacher can hand
  // the adviser a Term 1 printout showing only Term 1, without prematurely revealing later
  // quarters that haven't been finalized yet.
  const computeMAPEHTerm = (sid: string, termNum: number) => {
    if (termNum > currentTerm) return { ma: 0, pe: 0, mapeh: 0 };
    const ma = computeComponentTerm(sid, termNum, maTermData, maWeights);
    const pe = computeComponentTerm(sid, termNum, peTermData, peWeights);
    const parts = [ma, pe].filter(v => v > 0);
    const mapeh = parts.length > 0 ? Math.round(parts.reduce((a,b)=>a+b,0) / parts.length) : 0;
    return { ma, pe, mapeh };
  };

  const td = { border:'1px solid #999', padding:'2px 5px', fontSize:'8px', textAlign:'center' as const };
  const th = { ...td, background:'#e8e8e8', fontWeight:'bold' as const };
  const thQ = { ...th, background:'#f3e8ff' }; // light purple to set MAPEH's own averaged column apart from its two components

  const renderGroup = (group: Student[], label: string) => (
    <>
      <tr>
        <td colSpan={14} style={{...td, background: label==='MALE'?'#dbeafe':'#fce7f3', fontWeight:'bold', textAlign:'left'}}>
          {label}
        </td>
      </tr>
      {group.map((student, idx) => {
        const q1 = computeMAPEHTerm(student.id, 1);
        const q2 = computeMAPEHTerm(student.id, 2);
        const q3 = computeMAPEHTerm(student.id, 3);
        const valid = [q1.mapeh, q2.mapeh, q3.mapeh].filter(v => v > 0);
        const final = valid.length > 0 ? Math.round(valid.reduce((a,b)=>a+b,0) / valid.length) : 0;
        const desc = descriptor(final);
        const remarks = final >= 75 ? 'PASSED' : final > 0 ? 'FAILED' : '';
        return (
          <tr key={student.id} style={{background: idx%2===0 ? 'white' : '#f9fafb'}}>
            <td style={td}>{idx+1}</td>
            <td style={{...td, textAlign:'left', minWidth:'150px'}}>{student.full_name}</td>
            <td style={td}>{q1.ma||''}</td>
            <td style={td}>{q1.pe||''}</td>
            <td style={{...td, background:'#faf5ff', fontWeight:'bold'}}>{q1.mapeh||''}</td>
            <td style={td}>{q2.ma||''}</td>
            <td style={td}>{q2.pe||''}</td>
            <td style={{...td, background:'#faf5ff', fontWeight:'bold'}}>{q2.mapeh||''}</td>
            <td style={td}>{q3.ma||''}</td>
            <td style={td}>{q3.pe||''}</td>
            <td style={{...td, background:'#faf5ff', fontWeight:'bold'}}>{q3.mapeh||''}</td>
            <td style={{...td, fontWeight:'bold', fontSize:'11px', color:final>=75?'#166534':'#991b1b'}}>{final||''}</td>
            <td style={{...td, fontSize:'8px'}}>{final ? desc.short : ''}</td>
            <td style={{...td, fontWeight:'bold', color:final>=75?'#166534':'#991b1b'}}>{remarks}</td>
          </tr>
        );
      })}
    </>
  );

  // ── Excel export — mirrors the print preview above exactly ────────────────
  const downloadExcel = async () => {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('MAPEH Summary');
    const totalCols = 14;
    let r = 1;

    setCell(ws, r, 1, 'MAPEH SUMMARY OF GRADES', { bold:true, size:13 }); ws.mergeCells(r,1,r,totalCols); r++;
    setCell(ws, r, 1, `Music & Arts + PE & Health — ${schoolYear}`, { size:9, color:'FF555555' }); ws.mergeCells(r,1,r,totalCols); r++;
    r++;

    const [u1, u2, u3, u4] = splitCols(totalCols, 4);
    const c1 = 1, c1End = u1;
    const c2 = c1End + 1, c2End = c1End + u2;
    const c3 = c2End + 1, c3End = c2End + u3;
    const c4 = c3End + 1, c4End = totalCols;

    setLabelValue(ws, r, c1, c1End, 'Region', region);
    setLabelValue(ws, r, c2, c2End, 'Division', division);
    setLabelValue(ws, r, c3, c3End, 'School ID', schoolId);
    setLabelValue(ws, r, c4, c4End, 'School Year', schoolYear);
    r++;
    setLabelValue(ws, r, c1, c2End, 'School', schoolName);
    setLabelValue(ws, r, c3, c3End, 'Grade & Section', `${gradeLevel} — ${sectionName}`);
    setLabelValue(ws, r, c4, c4End, 'Subject', 'MAPEH (Music & Arts + PE & Health)');
    r++;
    setLabelValue(ws, r, c1, c2End, 'Teacher', adviser?.toUpperCase() || '');
    setLabelValue(ws, r, c3, c4End, 'Total Active Learners', `${activeStudents.length} (${males.length}M / ${females.length}F)`);
    r++; r++;

    const hdrRow = r;
    const headers = [
      '#', "LEARNERS' NAMES",
      'Q1\nMusic & Arts', 'Q1\nPE & Health', 'Q1\nMAPEH',
      'Q2\nMusic & Arts', 'Q2\nPE & Health', 'Q2\nMAPEH',
      'Q3\nMusic & Arts', 'Q3\nPE & Health', 'Q3\nMAPEH',
      'FINAL\nMAPEH', 'DESCRIPTOR', 'REMARK',
    ];
    const mapehCols = [5, 8, 11]; // Q1/Q2/Q3 MAPEH average columns
    headers.forEach((label, i) => {
      setCell(ws, hdrRow, i+1, label, {
        bold:true,
        fill: (i+1)===12 ? 'FFD1FAE5' : mapehCols.includes(i+1) ? 'FFF3E8FF' : 'FFE8E8E8',
        size:9, align: i===1 ? 'left' : 'center',
      });
    });
    r++;

    const writeGroup = (group: Student[], label: string) => {
      if (group.length === 0) return;
      setCell(ws,r,1,label,{bold:true,fill:label==='MALE'?'FFDBEAFE':'FFFCE7F3',align:'left',size:9});
      ws.mergeCells(r,1,r,totalCols); r++;
      group.forEach((student, idx) => {
        const q1 = computeMAPEHTerm(student.id, 1);
        const q2 = computeMAPEHTerm(student.id, 2);
        const q3 = computeMAPEHTerm(student.id, 3);
        const valid = [q1.mapeh, q2.mapeh, q3.mapeh].filter(v => v > 0);
        const final = valid.length > 0 ? Math.round(valid.reduce((a,b)=>a+b,0) / valid.length) : 0;
        const desc = descriptor(final);
        const remarks = final >= 75 ? 'PASSED' : final > 0 ? 'FAILED' : '';
        setCell(ws,r,1,idx+1,{size:9});
        setCell(ws,r,2,student.full_name,{size:9,align:'left'});
        setCell(ws,r,3,q1.ma||'',{size:9});
        setCell(ws,r,4,q1.pe||'',{size:9});
        setCell(ws,r,5,q1.mapeh||'',{bold:true,size:9,fill:'FFFAF5FF'});
        setCell(ws,r,6,q2.ma||'',{size:9});
        setCell(ws,r,7,q2.pe||'',{size:9});
        setCell(ws,r,8,q2.mapeh||'',{bold:true,size:9,fill:'FFFAF5FF'});
        setCell(ws,r,9,q3.ma||'',{size:9});
        setCell(ws,r,10,q3.pe||'',{size:9});
        setCell(ws,r,11,q3.mapeh||'',{bold:true,size:9,fill:'FFFAF5FF'});
        setCell(ws,r,12,final||'',{bold:true,size:10,color:final>=75?'FF166534':'FF991B1B'});
        setCell(ws,r,13,final?desc.short:'',{size:8});
        setCell(ws,r,14,remarks,{bold:true,color:final>=75?'FF166534':'FF991B1B',size:9});
        r++;
      });
    };
    writeGroup(males, 'MALE');
    writeGroup(females, 'FEMALE');

    r++;
    const [sg1, sg2, sg3] = splitCols(totalCols, 3);
    const sc1 = 1, sc1End = sg1;
    const sc2 = sc1End + 1, sc2End = sc1End + sg2;
    const sc3 = sc2End + 1, sc3End = totalCols;
    setMergedText(ws, r, sc1, sc1End, adviser?.toUpperCase() || '', { bold:true, size:9 });
    setMergedText(ws, r, sc2, sc2End, schoolHead?.toUpperCase() || '________________________________', { bold:true, size:9 });
    setMergedText(ws, r, sc3, sc3End, '________________________________', { size:9 });
    r++;
    setMergedText(ws, r, sc1, sc1End, 'MAPEH Teacher', { size:9 });
    setMergedText(ws, r, sc2, sc2End, 'School Head', { size:9 });
    setMergedText(ws, r, sc3, sc3End, 'Date', { size:9 });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 26;
    for (let c=3;c<=14;c++) ws.getColumn(c).width = 10;

    await saveWorkbook(wb, `MAPEH_Summary_${sectionName.replace(/[^a-zA-Z0-9]+/g,'_')}.xlsx`);
  };

  return (
    <div className="eclass-modal-overlay fixed inset-0 bg-black/80 z-50 overflow-auto">
      <div className="no-print sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-fuchsia-400"/>
          <span className="font-semibold">MAPEH Summary — Music &amp; Arts + PE &amp; Health</span>
          <span className="text-gray-400 text-sm">{sectionName} &middot; {schoolYear}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={downloadExcel} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Download size={16}/> Download Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Printer size={16}/> Print
          </button>
          <button onClick={onClose} className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <X size={16}/> Close
          </button>
        </div>
      </div>

      <div className="summary-print bg-white text-black p-6" style={{fontFamily:'Arial, sans-serif', maxWidth:'1100px', margin:'0 auto'}}>
        {/* Header */}
        <div style={{textAlign:'center', marginBottom:'8px'}}>
          <div style={{fontWeight:'bold', fontSize:'13px'}}>MAPEH SUMMARY OF GRADES</div>
          <div style={{fontSize:'9px', color:'#555'}}>Music &amp; Arts + PE &amp; Health — {schoolYear}</div>
        </div>

        <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'6px', fontSize:'9px'}}>
          <tbody>
            <tr>
              <td style={{...td, textAlign:'left', fontSize:'9px'}}><strong>Region:</strong> {region}</td>
              <td style={{...td, textAlign:'left', fontSize:'9px'}}><strong>Division:</strong> {division}</td>
              <td style={{...td, textAlign:'left', fontSize:'9px'}}><strong>School ID:</strong> {schoolId}</td>
              <td style={{...td, textAlign:'left', fontSize:'9px'}}><strong>School Year:</strong> {schoolYear}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{...td, textAlign:'left', fontSize:'9px'}}><strong>School:</strong> {schoolName}</td>
              <td style={{...td, textAlign:'left', fontSize:'9px'}}><strong>Grade &amp; Section:</strong> {gradeLevel} &mdash; {sectionName}</td>
              <td style={{...td, textAlign:'left', fontSize:'9px'}}><strong>Subject:</strong> MAPEH</td>
            </tr>
            <tr>
              <td colSpan={2} style={{...td, textAlign:'left', fontSize:'9px'}}><strong>Teacher:</strong> {adviser?.toUpperCase()}</td>
              <td colSpan={2} style={{...td, textAlign:'left', fontSize:'9px'}}><strong>Total Active Learners:</strong> {activeStudents.length} ({males.length}M / {females.length}F)</td>
            </tr>
          </tbody>
        </table>

        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px'}}>
          <thead>
            <tr>
              <th style={th} rowSpan={2}>#</th>
              <th style={{...th, textAlign:'left'}} rowSpan={2}>LEARNERS' NAMES</th>
              <th style={th} colSpan={3}>TERM 1</th>
              <th style={th} colSpan={3}>TERM 2</th>
              <th style={th} colSpan={3}>TERM 3</th>
              <th style={{...th, background:'#d1fae5'}} rowSpan={2}>FINAL<br/>MAPEH</th>
              <th style={th} rowSpan={2}>DESCRIPTOR</th>
              <th style={th} rowSpan={2}>REMARK</th>
            </tr>
            <tr>
              <th style={th}>Music<br/>&amp; Arts</th><th style={th}>PE &amp;<br/>Health</th><th style={thQ}>MAPEH</th>
              <th style={th}>Music<br/>&amp; Arts</th><th style={th}>PE &amp;<br/>Health</th><th style={thQ}>MAPEH</th>
              <th style={th}>Music<br/>&amp; Arts</th><th style={th}>PE &amp;<br/>Health</th><th style={thQ}>MAPEH</th>
            </tr>
          </thead>
          <tbody>
            {renderGroup(males,   'MALE')}
            {renderGroup(females, 'FEMALE')}
          </tbody>
        </table>

        <p style={{fontSize:'7px', color:'#666', marginTop:'4px'}}>
          Each quarter's MAPEH grade is the whole-number average of that quarter's Music &amp; Arts and PE &amp; Health grades.
          The Final MAPEH grade is the whole-number average of the three quarterly MAPEH grades.
        </p>

        {/* Signatures */}
        <div style={{display:'flex', justifyContent:'space-between', marginTop:'20px', fontSize:'9px'}}>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'2px', marginTop:'24px'}}>{adviser?.toUpperCase()}</div>
            <div>MAPEH Teacher</div>
          </div>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'2px', marginTop:'24px'}}>{schoolHead?.toUpperCase() || '________________________________'}</div>
            <div>School Head</div>
          </div>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{borderTop:'1px solid black', paddingTop:'2px', marginTop:'24px'}}>________________________________</div>
            <div>Date</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .eclass-modal-overlay { display: block !important; position: static !important; overflow: visible !important; background: white !important; }
          .min-h-screen { display: none !important; }
          body { background: white !important; }
          .summary-print { padding: 6mm !important; max-width: 100% !important; }
          @page { size: landscape; margin: 6mm; }
        }
      `}</style>
    </div>
  );
}

// ── E-CLASS RECORD VIEW (current term + test analysis) ────────────────────────
function EClassRecordView({
  students, subject, sectionName, gradeLevel, schoolName, schoolId,
  schoolYear, division, region, teacherName, schoolHead, allTermData, currentTerm, onClose,
}: {
  students: Student[]; subject: string;
  sectionName: string; gradeLevel: string; schoolName: string;
  schoolId: string; schoolYear: string; division: string;
  region: string; teacherName: string; schoolHead: string;
  allTermData: Record<number, TermData>;
  currentTerm: number;
  onClose: () => void;
}) {
  const weights = SUBJECT_WEIGHTS[subject] ?? { ww:0.25, pt:0.50, ta:0.25 };
  const hasTA = (weights.ta ?? 0) > 0;
  const activeStudents = students.filter(s => !s.status || s.status === 'active');
  const males   = activeStudents.filter(s => s.sex === 'M').sort((a,b)=>a.full_name.localeCompare(b.full_name));
  const females = activeStudents.filter(s => s.sex === 'F').sort((a,b)=>a.full_name.localeCompare(b.full_name));
  const termData = allTermData[currentTerm];
  const highest = termData?.highest ?? { ww:[100,100,100,100,100], pt:[100,100,100], st:[50,50], te:100 };

  const computeTerm = (sid: string) => {
    if (!termData) return { transmuted:0, initial:0, ww:[0,0,0,0,0], pt:[0,0,0], st:[0,0], te:0, avgWW:0, avgPT:0, avgTA:0, totalWW:0, totalPT:0, wsWW:0, wsPT:0, wsTA:0, wsSt1:0, wsSt2:0, wsTe:0 };
    const s = termData.scores[sid] || { ww:{}, pt:{}, st:{}, te:0 };
    const ww = Array.from({length:5},(_,i)=>s.ww?.[i]??0);
    const pt = Array.from({length:3},(_,i)=>s.pt?.[i]??0);
    const st = Array.from({length:2},(_,i)=>s.st?.[i]??0);
    const te = s.te ?? 0;
    const avgWW = calcAvg(ww, highest.ww);
    const avgPT = calcAvg(pt, highest.pt);
    const avgTA = calcEX(st[0],st[1],te, highest.st[0],highest.st[1],highest.te);
    const initial = avgWW*weights.ww + avgPT*weights.pt + avgTA*(weights.ta??0.25);
    // Display-only figures to mirror the official DepEd layout's Total/WS columns.
    // None of these feed back into initial/transmuted — those are still computed
    // exactly as before, straight from avgWW/avgPT/avgTA.
    const totalWW = ww.reduce((a,b)=>a+b,0);
    const totalPT = pt.reduce((a,b)=>a+b,0);
    const wsWW = avgWW*weights.ww;
    const wsPT = avgPT*weights.pt;
    const wsTA = avgTA*(weights.ta??0.25);
    const wsSt1 = highest.st[0]>0 ? (st[0]/highest.st[0])*100*0.30 : 0;
    const wsSt2 = highest.st[1]>0 ? (st[1]/highest.st[1])*100*0.30 : 0;
    const wsTe  = highest.te>0    ? (te/highest.te)*100*0.40        : 0;
    return { transmuted:transmute(initial), initial, ww, pt, st, te, avgWW, avgPT, avgTA, totalWW, totalPT, wsWW, wsPT, wsTA, wsSt1, wsSt2, wsTe };
  };

  const td  = { border:'1px solid #999', padding:'2px 4px', fontSize:'8px', textAlign:'center' as const };
  const th  = { ...td, background:'#e8e8e8', fontWeight:'bold' as const };
  const tdL = { ...td, textAlign:'left' as const };

  // ── Test/Exam Result Analysis stats ────────────────────────────────────────
  const allStudents = [...males, ...females];
  const n = allStudents.length;

  // ST1, ST2, TE scores across all active students
  const st1Scores = allStudents.map(s => termData?.scores[s.id]?.st?.[0] ?? 0).filter(v=>v>0);
  const st2Scores = allStudents.map(s => termData?.scores[s.id]?.st?.[1] ?? 0).filter(v=>v>0);
  const teScores  = allStudents.map(s => termData?.scores[s.id]?.te ?? 0).filter(v=>v>0);

  const mean  = (arr:number[]) => arr.length>0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const median= (arr:number[]) => {
    if(!arr.length) return 0;
    const s=[...arr].sort((a,b)=>a-b);
    const m=Math.floor(s.length/2);
    return s.length%2===0?(s[m-1]+s[m])/2:s[m];
  };
  const sd    = (arr:number[]) => {
    if(arr.length<2) return 0;
    const m=mean(arr);
    return Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/arr.length);
  };
  const mps   = (arr:number[], highs:number[]) => {
    const h = highs.find(v=>v>0) ?? 100;
    return arr.length>0 ? (mean(arr)/h)*100 : 0;
  };

  const st1High = highest.st[0] ?? 50;
  const st2High = highest.st[1] ?? 50;
  const teHigh  = highest.te ?? 100;

  const above75 = (arr:number[], high:number) => arr.filter(v=>(v/high)*100>=75).length;
  const below75 = (arr:number[], high:number) => arr.filter(v=>(v/high)*100<75).length;

  const stats = [
    { label:'ST1', scores:st1Scores, high:st1High },
    { label:'ST2', scores:st2Scores, high:st2High },
    { label:'TE',  scores:teScores,  high:teHigh  },
  ];

  // ── Render student group ───────────────────────────────────────────────────
  // Column count per learner row, matching the official layout: # + Name + WW(5+Total+PS+WS)
  // + PT(3+Total+PS+WS) + [EXs(3+3WS+PS+WS)] + Initial Grade + Term Grade + Descriptor
  const rowColCount = 2 + 8 + 6 + (hasTA ? 8 : 0) + 3;
  const infoGradeCols = hasTA ? 6 : 4;
  const infoTeacherCols = hasTA ? 10 : 6;
  const infoSubjectCols = rowColCount - 2 - infoGradeCols - infoTeacherCols;

  const renderGroup = (group: Student[], label: string) => (
    <>
      <tr style={{pageBreakAfter:'avoid', breakAfter:'avoid'}}>
        <td colSpan={rowColCount} style={{...td, background:label==='MALE'?'#dbeafe':'#fce7f3', fontWeight:'bold', textAlign:'left'}}>
          {label}
        </td>
      </tr>
      {group.map((student, idx) => {
        const c = computeTerm(student.id);
        const desc = descriptor(c.transmuted);
        return (
          <tr key={student.id} style={{background:idx%2===0?'white':'#f9fafb', pageBreakInside:'avoid', breakInside:'avoid'}}>
            <td style={td}>{idx+1}</td>
            <td style={{...td, textAlign:'left', minWidth:'140px'}}>{student.full_name}</td>
            {c.ww.map((v,i) => <td key={i} style={td}>{v||''}</td>)}
            <td style={td}>{c.totalWW||''}</td>
            <td style={{...td, background:'#dbeafe'}}>{c.avgWW.toFixed(1)}</td>
            <td style={{...td, background:'#dbeafe'}}>{c.wsWW.toFixed(2)}</td>
            {c.pt.map((v,i) => <td key={i} style={td}>{v||''}</td>)}
            <td style={td}>{c.totalPT||''}</td>
            <td style={{...td, background:'#ede9fe'}}>{c.avgPT.toFixed(1)}</td>
            <td style={{...td, background:'#ede9fe'}}>{c.wsPT.toFixed(2)}</td>
            {hasTA && <>
              {c.st.map((v,i) => <td key={i} style={td}>{v||''}</td>)}
              <td style={td}>{c.te||''}</td>
              <td style={td}>{c.wsSt1?c.wsSt1.toFixed(2):''}</td>
              <td style={td}>{c.wsSt2?c.wsSt2.toFixed(2):''}</td>
              <td style={td}>{c.wsTe?c.wsTe.toFixed(2):''}</td>
              <td style={{...td, background:'#fef3c7'}}>{c.avgTA.toFixed(1)}</td>
              <td style={{...td, background:'#fef3c7'}}>{c.wsTA.toFixed(2)}</td>
            </>}
            <td style={{...td, background:'#f0fdf4', fontWeight:'bold'}}>{c.initial.toFixed(2)}</td>
            <td style={{...td, fontWeight:'bold', fontSize:'9px', color:c.transmuted>=75?'#166534':'#991b1b'}}>{c.transmuted||''}</td>
            <td style={{...td, fontSize:'7px'}}>{desc.short}</td>
          </tr>
        );
      })}
    </>
  );

  const TERM_LABELS: Record<number,string> = { 1:'FIRST TERM', 2:'SECOND TERM', 3:'THIRD TERM' };

  const pageHeader = (
    <>
      <div className="official-title">
        <img src="/depedseal.webp" alt="DepEd seal" className="official-seal" />
        <div className="official-title-text">CLASS RECORD - TERM {currentTerm}</div>
        <img src="/depedlogo.webp" alt="Department of Education" className="official-wordmark" />
      </div>
      <table className="official-meta"><tbody>
        <tr><td><strong>REGION</strong><span>{region || ''}</span></td><td><strong>DIVISION</strong><span>{division || ''}</span></td><td><strong>SCHOOL ID</strong><span>{schoolId || ''}</span></td></tr>
        <tr><td className="meta-wide" colSpan={2}><strong>SCHOOL NAME</strong><span>{schoolName || ''}</span></td><td><strong>SCHOOL YEAR</strong><span>{schoolYear || ''}</span></td></tr>
      </tbody></table>
      <div className="official-blue-rule" />
    </>
  );

  // ── Excel export — mirrors the print preview above exactly ────────────────
  const downloadExcel = async () => {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Term ${currentTerm}`);

    // Column layout mirrors the official DepEd Class Record exactly:
    // WW: 1-5, Total, PS, WS  |  PT: 1-3, Total, PS, WS  |  EXs: ST1,ST2,TE, WS ST1/ST2/TE, PS, WS
    const wwStart = 3, wwEnd = 7, totalWW = 8, psWW = 9, wsWW = 10;
    const ptStart = 11, ptEnd = 13, totalPT = 14, psPT = 15, wsPT = 16;
    const stStart = 17, stEnd = 18, teCol = 19, wsSt1Col = 20, wsSt2Col = 21, wsTeCol = 22, psTA = 23, wsTA = 24;
    const initialCol = hasTA ? 25 : 17;
    const tgCol = initialCol + 1;
    const descCol = tgCol + 1;
    const totalCols = descCol;
    const TERM_LABEL_XL: Record<number,string> = { 1:'FIRST TERM', 2:'SECOND TERM', 3:'THIRD TERM' };

    let r = 1;

    setCell(ws, r, 1, `CLASS RECORD — ${TERM_LABEL_XL[currentTerm] ?? `TERM ${currentTerm}`}`, { bold:true, size:13 }); ws.mergeCells(r,1,r,totalCols); r++;
    setCell(ws, r, 1, `${subject} — ${schoolYear}`, { size:9, color:'FF555555' }); ws.mergeCells(r,1,r,totalCols); r++;
    r++;

    // Info grid mirrors the official header fields (Region/Division/School ID,
    // School Name/School Year, Term/Grade Level/Teacher, Section/Subject).
    const [u1, u2, u3] = splitCols(totalCols, 3);
    const ic1 = 1, ic1End = u1;
    const ic2 = ic1End + 1, ic2End = ic1End + u2;
    const ic3 = ic2End + 1, ic3End = totalCols;

    setLabelValue(ws, r, ic1, ic1End, 'Region', region);
    setLabelValue(ws, r, ic2, ic2End, 'Division', division);
    setLabelValue(ws, r, ic3, ic3End, 'School ID', schoolId);
    r++;
    setLabelValue(ws, r, ic1, ic2End, 'School Name', schoolName);
    setLabelValue(ws, r, ic3, ic3End, 'School Year', schoolYear);
    r++;

    // FIRST/SECOND/THIRD TERM block — mirrors the official layout: the term name
    // spans two rows on the left, Grade Level/Section stack in the next column,
    // and Teacher/Subject each span both rows to the right.
    const setLabelValueRows = (rowStart: number, rowEnd: number, colStart: number, colEnd: number, label: string, value: string) => {
      for (let rr = rowStart; rr <= rowEnd; rr++) for (let c = colStart; c <= colEnd; c++) ws.getCell(rr, c).border = XLSX_ALL_BORDERS;
      ws.mergeCells(rowStart, colStart, rowEnd, colEnd);
      const master = ws.getCell(rowStart, colStart);
      master.value = { richText: [{ font: { bold:true, size:9 }, text: `${label}: ` }, { font: { size:9 }, text: value ?? '' }] };
      master.alignment = { horizontal:'left', vertical:'middle', wrapText:true };
    };
    const [ju1, ju2, ju3] = splitCols(totalCols, 4);
    const jc1 = 1, jc1End = ju1;
    const jc2 = jc1End + 1, jc2End = jc1End + ju2;
    const jc3 = jc2End + 1, jc3End = jc2End + ju3;
    const jc4 = jc3End + 1, jc4End = totalCols;
    const termRow1 = r, termRow2 = r + 1;
    for (let c = jc1; c <= jc1End; c++) { ws.getCell(termRow1,c).border = XLSX_ALL_BORDERS; ws.getCell(termRow2,c).border = XLSX_ALL_BORDERS; }
    ws.mergeCells(termRow1, jc1, termRow2, jc1End);
    const termCell = ws.getCell(termRow1, jc1);
    termCell.value = TERM_LABEL_XL[currentTerm] ?? `TERM ${currentTerm}`;
    termCell.font = { bold:true, size:11 };
    termCell.alignment = { horizontal:'left', vertical:'middle', wrapText:true };
    setLabelValue(ws, termRow1, jc2, jc2End, 'Grade Level', gradeLevel);
    setLabelValue(ws, termRow2, jc2, jc2End, 'Section', sectionName);
    setLabelValueRows(termRow1, termRow2, jc3, jc3End, 'Teacher', teacherName?.toUpperCase() || '');
    setLabelValueRows(termRow1, termRow2, jc4, jc4End, 'Subject', subject);
    r = termRow2 + 1;
    setLabelValue(ws, r, ic1, ic3End, 'Weights',
      `WW ${(weights.ww*100).toFixed(0)}% | PT ${(weights.pt*100).toFixed(0)}%${hasTA?` | EXs ${((weights.ta??0)*100).toFixed(0)}%`:''}`);
    r++; r++;

    const hdr1 = r, hdr2 = r+1, hdr3 = r+2;
    setCell(ws,hdr1,1,'#',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr1,1,hdr3,1);
    setCell(ws,hdr1,2,"LEARNERS' NAMES",{bold:true,fill:'FFE8E8E8',size:8,align:'left'}); ws.mergeCells(hdr1,2,hdr3,2);
    setCell(ws,hdr1,wwStart,`WRITTEN / ORAL WORKS (WWs) — ${(weights.ww*100).toFixed(0)}%`,{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr1,wwStart,hdr1,wsWW);
    setCell(ws,hdr1,ptStart,`PRODUCT / PERFORMANCE TASKS (PTs) — ${(weights.pt*100).toFixed(0)}%`,{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr1,ptStart,hdr1,wsPT);
    if (hasTA) {
      setCell(ws,hdr1,stStart,`EXAMINATIONS (EXs) — ${((weights.ta??0)*100).toFixed(0)}%`,{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr1,stStart,hdr1,wsTA);
    }
    setCell(ws,hdr1,initialCol,'Initial\nGrade',{bold:true,fill:'FFF0FDF4',size:8}); ws.mergeCells(hdr1,initialCol,hdr3,initialCol);
    setCell(ws,hdr1,tgCol,'Term\nGrade',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr1,tgCol,hdr3,tgCol);
    setCell(ws,hdr1,descCol,'Descriptor',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr1,descCol,hdr3,descCol);

    for (let c=wwStart;c<=wwEnd;c++) ws.mergeCells(hdr2,c,hdr3,c);
    setCell(ws,hdr2,totalWW,'Total',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr2,totalWW,hdr3,totalWW);
    setCell(ws,hdr2,psWW,'PS',{bold:true,fill:'FFDBEAFE',size:8}); ws.mergeCells(hdr2,psWW,hdr3,psWW);
    setCell(ws,hdr2,wsWW,'WS',{bold:true,fill:'FFDBEAFE',size:8}); ws.mergeCells(hdr2,wsWW,hdr3,wsWW);
    for (let c=ptStart;c<=ptEnd;c++) ws.mergeCells(hdr2,c,hdr3,c);
    setCell(ws,hdr2,totalPT,'Total',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr2,totalPT,hdr3,totalPT);
    setCell(ws,hdr2,psPT,'PS',{bold:true,fill:'FFEDE9FE',size:8}); ws.mergeCells(hdr2,psPT,hdr3,psPT);
    setCell(ws,hdr2,wsPT,'WS',{bold:true,fill:'FFEDE9FE',size:8}); ws.mergeCells(hdr2,wsPT,hdr3,wsPT);
    if (hasTA) {
      setCell(ws,hdr2,stStart,'ST1',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr2,stStart,hdr3,stStart);
      setCell(ws,hdr2,stStart+1,'ST2',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr2,stStart+1,hdr3,stStart+1);
      setCell(ws,hdr2,teCol,'TE',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr2,teCol,hdr3,teCol);
      setCell(ws,hdr2,wsSt1Col,'WS ST1',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr2,wsSt1Col,hdr3,wsSt1Col);
      setCell(ws,hdr2,wsSt2Col,'WS ST2',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr2,wsSt2Col,hdr3,wsSt2Col);
      setCell(ws,hdr2,wsTeCol,'WS TE',{bold:true,fill:'FFE8E8E8',size:8}); ws.mergeCells(hdr2,wsTeCol,hdr3,wsTeCol);
      setCell(ws,hdr2,psTA,'PS',{bold:true,fill:'FFFEF3C7',size:8}); ws.mergeCells(hdr2,psTA,hdr3,psTA);
      setCell(ws,hdr2,wsTA,'WS',{bold:true,fill:'FFFEF3C7',size:8}); ws.mergeCells(hdr2,wsTA,hdr3,wsTA);
    }
    r = hdr3 + 1;

    // HIGHEST POSSIBLE SCORE row
    setCell(ws,r,1,'',{fill:'FFF3F4F6'});
    setCell(ws,r,2,'HIGHEST POSSIBLE SCORE',{bold:true,align:'left',fill:'FFF3F4F6',size:8});
    highest.ww.forEach((v,i)=>setCell(ws,r,wwStart+i,v,{size:8,fill:'FFF3F4F6'}));
    setCell(ws,r,totalWW,highest.ww.reduce((a,b)=>a+b,0),{size:8,fill:'FFF3F4F6'});
    setCell(ws,r,psWW,100,{size:8,fill:'FFDBEAFE'});
    setCell(ws,r,wsWW,`${(weights.ww*100).toFixed(0)}%`,{size:8,fill:'FFDBEAFE'});
    highest.pt.forEach((v,i)=>setCell(ws,r,ptStart+i,v,{size:8,fill:'FFF3F4F6'}));
    setCell(ws,r,totalPT,highest.pt.reduce((a,b)=>a+b,0),{size:8,fill:'FFF3F4F6'});
    setCell(ws,r,psPT,100,{size:8,fill:'FFEDE9FE'});
    setCell(ws,r,wsPT,`${(weights.pt*100).toFixed(0)}%`,{size:8,fill:'FFEDE9FE'});
    if (hasTA) {
      setCell(ws,r,stStart,highest.st[0],{size:8,fill:'FFF3F4F6'});
      setCell(ws,r,stStart+1,highest.st[1],{size:8,fill:'FFF3F4F6'});
      setCell(ws,r,teCol,highest.te,{size:8,fill:'FFF3F4F6'});
      setCell(ws,r,wsSt1Col,30,{size:8,fill:'FFF3F4F6'});
      setCell(ws,r,wsSt2Col,30,{size:8,fill:'FFF3F4F6'});
      setCell(ws,r,wsTeCol,40,{size:8,fill:'FFF3F4F6'});
      setCell(ws,r,psTA,100,{size:8,fill:'FFFEF3C7'});
      setCell(ws,r,wsTA,`${((weights.ta??0)*100).toFixed(0)}%`,{size:8,fill:'FFFEF3C7'});
    }
    setCell(ws,r,initialCol,'',{fill:'FFF0FDF4'});
    setCell(ws,r,tgCol,'',{fill:'FFF3F4F6'});
    setCell(ws,r,descCol,'',{fill:'FFF3F4F6'});
    r++;

    setCell(ws,r,1,"LEARNERS' NAMES",{bold:true,color:'FFFFFFFF',fill:'FF1E3A5F',align:'left',size:9});
    ws.mergeCells(r,1,r,totalCols); r++;

    const writeGroup = (group: Student[], label: string, fill: string) => {
      if (group.length === 0) return;
      setCell(ws,r,1,label,{bold:true,fill,align:'left',size:8});
      ws.mergeCells(r,1,r,totalCols); r++;
      group.forEach((student, idx) => {
        const c = computeTerm(student.id);
        const desc = descriptor(c.transmuted);
        const zebra = idx%2===1 ? 'FFF9FAFB' : undefined;
        setCell(ws,r,1,idx+1,{size:8,fill:zebra});
        setCell(ws,r,2,student.full_name,{size:8,align:'left',fill:zebra});
        c.ww.forEach((v,i)=>setCell(ws,r,wwStart+i,v||'',{size:8,fill:zebra}));
        setCell(ws,r,totalWW,c.totalWW||'',{size:8,fill:zebra});
        setCell(ws,r,psWW,Number(c.avgWW.toFixed(1)),{size:8,fill:'FFDBEAFE'});
        setCell(ws,r,wsWW,Number(c.wsWW.toFixed(2)),{size:8,fill:'FFDBEAFE'});
        c.pt.forEach((v,i)=>setCell(ws,r,ptStart+i,v||'',{size:8,fill:zebra}));
        setCell(ws,r,totalPT,c.totalPT||'',{size:8,fill:zebra});
        setCell(ws,r,psPT,Number(c.avgPT.toFixed(1)),{size:8,fill:'FFEDE9FE'});
        setCell(ws,r,wsPT,Number(c.wsPT.toFixed(2)),{size:8,fill:'FFEDE9FE'});
        if (hasTA) {
          c.st.forEach((v,i)=>setCell(ws,r,stStart+i,v||'',{size:8,fill:zebra}));
          setCell(ws,r,teCol,c.te||'',{size:8,fill:zebra});
          setCell(ws,r,wsSt1Col,c.wsSt1?Number(c.wsSt1.toFixed(2)):'',{size:8,fill:zebra});
          setCell(ws,r,wsSt2Col,c.wsSt2?Number(c.wsSt2.toFixed(2)):'',{size:8,fill:zebra});
          setCell(ws,r,wsTeCol,c.wsTe?Number(c.wsTe.toFixed(2)):'',{size:8,fill:zebra});
          setCell(ws,r,psTA,Number(c.avgTA.toFixed(1)),{size:8,fill:'FFFEF3C7'});
          setCell(ws,r,wsTA,Number(c.wsTA.toFixed(2)),{size:8,fill:'FFFEF3C7'});
        }
        setCell(ws,r,initialCol,Number(c.initial.toFixed(2)),{size:8,fill:'FFF0FDF4'});
        setCell(ws,r,tgCol,c.transmuted||'',{bold:true,size:9,color:c.transmuted>=75?'FF166534':'FF991B1B',fill:zebra});
        setCell(ws,r,descCol,desc.short,{size:7,fill:zebra});
        r++;
      });
    };
    writeGroup(males, 'MALE', 'FFDBEAFE');
    writeGroup(females, 'FEMALE', 'FFFCE7F3');

    if (hasTA) {
      r++;
      const analysisWidth = Math.max(totalCols, 23);
      setCell(ws,r,1,`TEST / EXAM RESULT ANALYSIS — TERM ${currentTerm}`,{bold:true,size:9,color:'FFFFFFFF',fill:'FF1E3A5F',align:'left'});
      ws.mergeCells(r,1,r,analysisWidth); r++;

      // Four mini-tables side by side, each 5 cols wide (2 for the label + ST1/ST2/TE)
      // with a 1-col gap — mirrors the flex-row layout in the print preview instead
      // of stacking every table underneath the last one.
      const analysisTop = r;
      const blockStarts = [1, 7, 13, 19];
      let analysisBottom = analysisTop;

      const writeStatBlock = (startCol: number, title: string, rows: [string, ...(string|number)[]][]) => {
        let rr = analysisTop;
        // Always write a title row (blank when there's no title) so every block's
        // header/data rows land on the same row numbers as its neighbors — this is
        // what was causing the "Number of Examinees" block to sit one row higher
        // than the other three and look misaligned/overlapping.
        setCell(ws, rr, startCol, title, { bold:true, align:'left', size:8 });
        ws.mergeCells(rr, startCol, rr, startCol+4);
        rr++;
        setCell(ws, rr, startCol, '', { bold:true, fill:'FFE8E8E8', size:8 });
        ws.mergeCells(rr, startCol, rr, startCol+1);
        stats.forEach((s,i)=>setCell(ws, rr, startCol+2+i, s.label, { bold:true, fill:'FFE8E8E8', size:8 }));
        rr++;
        rows.forEach(([label, ...vals]) => {
          setCell(ws, rr, startCol, label, { align:'left', size:8 });
          ws.mergeCells(rr, startCol, rr, startCol+1);
          vals.forEach((v,i)=>setCell(ws, rr, startCol+2+i, v, { size:8 }));
          rr++;
        });
        analysisBottom = Math.max(analysisBottom, rr);
      };

      writeStatBlock(blockStarts[0], '', [
        ['Number of Examinees:', ...stats.map(s=>s.scores.length||n)],
        ['Highest Possible Score:', ...stats.map(s=>s.high)],
      ]);
      writeStatBlock(blockStarts[1], 'CRITERION-REFERENCED', [
        ['Got 75% & above', ...stats.map(s=>above75(s.scores,s.high))],
        ['Percentage', ...stats.map(s=>s.scores.length>0?((above75(s.scores,s.high)/s.scores.length)*100).toFixed(2)+'%':'0.00%')],
        ['Got below 75%', ...stats.map(s=>below75(s.scores,s.high))],
        ['Percentage', ...stats.map(s=>s.scores.length>0?((below75(s.scores,s.high)/s.scores.length)*100).toFixed(2)+'%':'0.00%')],
      ]);
      writeStatBlock(blockStarts[2], 'NORM-REFERENCED', [
        ['Mean', ...stats.map(s=>s.scores.length>0?mean(s.scores).toFixed(2):'')],
        ['Median', ...stats.map(s=>s.scores.length>0?median(s.scores).toFixed(2):'')],
        ['SD', ...stats.map(s=>s.scores.length>0?sd(s.scores).toFixed(2):'')],
        ['MPS/PL', ...stats.map(s=>s.scores.length>0?mps(s.scores,[s.high]).toFixed(2)+'%':'')],
      ]);
      writeStatBlock(blockStarts[3], 'OTHER INFO', [
        ['Highest Score', ...stats.map(s=>s.scores.length>0?Math.max(...s.scores):'')],
        ['Lowest Score', ...stats.map(s=>s.scores.length>0?Math.min(...s.scores):'')],
        ['Total Score', ...stats.map(s=>s.scores.length>0?s.scores.reduce((a,b)=>a+b,0):'')],
      ]);

      r = analysisBottom + 1;
    }

    r++;
    const [sg1, sg2, sg3] = splitCols(totalCols, 3);
    const sc1 = 1, sc1End = sg1;
    const sc2 = sc1End + 1, sc2End = sc1End + sg2;
    const sc3 = sc2End + 1, sc3End = totalCols;
    setMergedText(ws, r, sc1, sc1End, teacherName?.toUpperCase() || '', { bold:true, size:8 });
    setMergedText(ws, r, sc2, sc2End, schoolHead?.toUpperCase() || '________________________________', { bold:true, size:8 });
    setMergedText(ws, r, sc3, sc3End, '________________________________', { size:8 });
    r++;
    setMergedText(ws, r, sc1, sc1End, 'Subject Teacher', { size:8 });
    setMergedText(ws, r, sc2, sc2End, 'School Head', { size:8 });
    setMergedText(ws, r, sc3, sc3End, 'Date', { size:8 });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 26;
    const widthCols = hasTA ? Math.max(totalCols, 23) : totalCols;
    for (let c=3;c<=widthCols;c++) ws.getColumn(c).width = 9;

    await saveWorkbook(wb, `EClassRecord_Term${currentTerm}_${subject.replace(/[^a-zA-Z0-9]+/g,'_')}.xlsx`);
  };

  return (
    <div className="eclass-modal-overlay fixed inset-0 bg-black/80 z-50 overflow-auto">
      <div className="no-print sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-blue-400"/>
          <span className="font-semibold">E-Class Record &mdash; Term {currentTerm} &mdash; {subject}</span>
          <span className="text-gray-400 text-sm">{sectionName} &middot; {schoolYear}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={downloadExcel} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Download size={16}/> Download Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Printer size={16}/> Print
          </button>
          <button onClick={onClose} className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <X size={16}/> Close
          </button>
        </div>
      </div>

      <div className="eclass-print bg-white text-black">
        {pageHeader}

        {/* Class Record Table */}
        <table className="official-record-table">
          <colgroup>
            <col className="col-number" /><col className="col-name" />
            {Array.from({length: 5}, (_, i) => <col key={`ww-${i}`} className="col-score" />)}<col className="col-total" /><col className="col-ps" /><col className="col-ws" />
            {Array.from({length: 3}, (_, i) => <col key={`pt-${i}`} className="col-score" />)}<col className="col-total" /><col className="col-ps" /><col className="col-ws" />
            {hasTA && <>{Array.from({length: 3}, (_, i) => <col key={`ex-${i}`} className="col-score" />)}{Array.from({length: 3}, (_, i) => <col key={`exws-${i}`} className="col-ws" />)}<col className="col-ps" /><col className="col-ws" /></>}
            <col className="col-grade" /><col className="col-grade" /><col className="col-descriptor" />
          </colgroup>
          <thead>
            <tr className="official-info-row">
              <th colSpan={2} rowSpan={4} className="official-term-heading">{TERM_LABELS[currentTerm] ?? `TERM ${currentTerm}`}</th>
              <th colSpan={infoGradeCols} className="official-field-heading"><strong>GRADE LEVEL</strong><span>{gradeLevel || ''}</span></th>
              <th colSpan={infoTeacherCols} rowSpan={2} className="official-field-heading"><strong>TEACHER</strong><span>{teacherName?.toUpperCase() || ''}</span></th>
              <th colSpan={infoSubjectCols} rowSpan={2} className="official-field-heading"><strong>SUBJECT</strong><span>{subject || ''}</span></th>
            </tr>
            <tr className="official-info-row">
              <th colSpan={infoGradeCols} className="official-field-heading"><strong>SECTION</strong><span>{sectionName || ''}</span></th>
            </tr>
            <tr className="official-group-row">
              <th colSpan={8}>WRITTEN / ORAL WORKS (WWs)</th>
              <th colSpan={6}>PRODUCT / PERFORMANCE<br/>TASKS (PTs)</th>
              {hasTA && <th colSpan={8}>EXAMINATIONS (EXs)</th>}
              <th rowSpan={3} className="official-grade-heading">Initial<br/>Grade</th>
              <th rowSpan={3} className="official-grade-heading">Term<br/>Grade</th>
              <th rowSpan={3} className="official-grade-heading">Descriptor</th>
            </tr>
            <tr className="official-subheader-row">
              {highest.ww.map((v,i) => <th key={`ww-${i}`}>{i+1}</th>)}
              <th>Total</th><th>PS</th><th>WS</th>
              {highest.pt.map((v,i) => <th key={`pt-${i}`}>{i+1}</th>)}
              <th>Total</th><th>PS</th><th>WS</th>
              {hasTA && <>
                <th>ST1</th><th>ST2</th><th>TE</th>
                <th>WS ST1</th><th>WS ST2</th><th>WS TE</th><th>PS</th><th>WS</th>
              </>}
            </tr>
            <tr className="official-hps-row">
              <th colSpan={2}>HIGHEST POSSIBLE SCORE</th>
              {highest.ww.map((v,i) => <th key={`hww-${i}`}>{v}</th>)}
              <th>{highest.ww.reduce((a,b)=>a+b,0)}</th><th>100</th><th>{(weights.ww*100).toFixed(0)}%</th>
              {highest.pt.map((v,i) => <th key={`hpt-${i}`}>{v}</th>)}
              <th>{highest.pt.reduce((a,b)=>a+b,0)}</th><th>100</th><th>{(weights.pt*100).toFixed(0)}%</th>
              {hasTA && <>
                <th>{highest.st[0]}</th><th>{highest.st[1]}</th><th>{highest.te}</th>
                <th>30</th><th>30</th><th>40</th><th>100</th><th>{((weights.ta??0)*100).toFixed(0)}%</th>
              </>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={rowColCount} style={{...td, background:'#1e3a5f', color:'white', fontWeight:'bold', textAlign:'left'}}>
                LEARNERS' NAMES
              </td>
            </tr>
            {renderGroup(males,   'MALE')}
            {renderGroup(females, 'FEMALE')}
          </tbody>
        </table>

        {/* Test/Exam Result Analysis */}
        {hasTA && (
          <>
            <div style={{fontWeight:'bold', fontSize:'9px', background:'#1e3a5f', color:'white', padding:'3px 6px', marginBottom:'4px', marginTop:'8px'}}>
              TEST / EXAM RESULT ANALYSIS &mdash; TERM {currentTerm}
            </div>
            <div style={{display:'flex', gap:'8px', flexWrap:'wrap', fontSize:'8px'}}>

              {/* Examinees + Highest */}
              <table style={{borderCollapse:'collapse', minWidth:'240px'}}>
                <thead>
                  <tr>
                    <th style={th}></th>
                    {stats.map(s=><th key={s.label} style={th}>{s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdL}>Number of Examinees:</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length||n}</td>)}
                  </tr>
                  <tr>
                    <td style={tdL}>Highest Possible Score:</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.high}</td>)}
                  </tr>
                </tbody>
              </table>

              {/* Criterion-Referenced */}
              <table style={{borderCollapse:'collapse', minWidth:'280px'}}>
                <thead>
                  <tr>
                    <th style={{...th, textAlign:'left'}} colSpan={4}>CRITERION-REFERENCED</th>
                  </tr>
                  <tr>
                    <th style={th}></th>
                    {stats.map(s=><th key={s.label} style={th}>{s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdL}>Got 75% &amp; above</td>
                    {stats.map(s=><td key={s.label} style={td}>{above75(s.scores,s.high)}</td>)}
                  </tr>
                  <tr>
                    <td style={tdL}>Percentage</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length>0?((above75(s.scores,s.high)/s.scores.length)*100).toFixed(2)+'%':'0.00%'}</td>)}
                  </tr>
                  <tr>
                    <td style={tdL}>Got below 75%</td>
                    {stats.map(s=><td key={s.label} style={td}>{below75(s.scores,s.high)}</td>)}
                  </tr>
                  <tr>
                    <td style={tdL}>Percentage</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length>0?((below75(s.scores,s.high)/s.scores.length)*100).toFixed(2)+'%':'0.00%'}</td>)}
                  </tr>
                </tbody>
              </table>

              {/* Norm-Referenced */}
              <table style={{borderCollapse:'collapse', minWidth:'240px'}}>
                <thead>
                  <tr>
                    <th style={{...th, textAlign:'left'}} colSpan={4}>NORM-REFERENCED</th>
                  </tr>
                  <tr>
                    <th style={th}></th>
                    {stats.map(s=><th key={s.label} style={th}>{s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdL}>Mean</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length>0?mean(s.scores).toFixed(2):''}</td>)}
                  </tr>
                  <tr>
                    <td style={tdL}>Median</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length>0?median(s.scores).toFixed(2):''}</td>)}
                  </tr>
                  <tr>
                    <td style={tdL}>SD</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length>0?sd(s.scores).toFixed(2):''}</td>)}
                  </tr>
                  <tr>
                    <td style={tdL}>MPS/PL</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length>0?mps(s.scores,[s.high]).toFixed(2)+'%':''}</td>)}
                  </tr>
                </tbody>
              </table>

              {/* Other Info */}
              <table style={{borderCollapse:'collapse', minWidth:'240px'}}>
                <thead>
                  <tr>
                    <th style={{...th, textAlign:'left'}} colSpan={4}>OTHER INFO</th>
                  </tr>
                  <tr>
                    <th style={th}></th>
                    {stats.map(s=><th key={s.label} style={th}>{s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdL}>Highest Score</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length>0?Math.max(...s.scores):''}</td>)}
                  </tr>
                  <tr>
                    <td style={tdL}>Lowest Score</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length>0?Math.min(...s.scores):''}</td>)}
                  </tr>
                  <tr>
                    <td style={tdL}>Total Score</td>
                    {stats.map(s=><td key={s.label} style={td}>{s.scores.length>0?s.scores.reduce((a,b)=>a+b,0):''}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Signatures */}
        <div style={{display:'flex', justifyContent:'space-between', marginTop:'16px', fontSize:'8px'}}>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'2px', marginTop:'20px'}}>{teacherName?.toUpperCase()}</div>
            <div>Subject Teacher</div>
          </div>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'2px', marginTop:'20px'}}>{schoolHead?.toUpperCase() || '________________________________'}</div>
            <div>School Head</div>
          </div>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{borderTop:'1px solid black', paddingTop:'2px', marginTop:'20px'}}>________________________________</div>
            <div>Date</div>
          </div>
        </div>
      </div>

      <style>{`
        .official-title { height: 25mm; display: grid; grid-template-columns: 30mm 1fr 38mm; align-items: center; column-gap: 3mm; }
        .official-seal { width: 25mm; height: 25mm; object-fit: contain; justify-self: start; }
        .official-wordmark { width: 34mm; height: 25mm; object-fit: contain; justify-self: end; }
        .official-title-text { text-align: center; font-size: 14px; font-weight: 700; }
        .official-meta, .official-submeta { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8px; }
        .official-meta { width: 72%; margin: 0 auto; }
        .official-meta td, .official-submeta td { border: 1px solid #777; height: 6mm; padding: 0 2mm; white-space: nowrap; }
        .official-meta td { width: 33.333%; }
        .official-meta strong, .official-submeta strong { display: inline-block; min-width: 23mm; font-size: 7px; }
        .official-meta span, .official-submeta span { display: inline-block; border-bottom: 1px solid #333; min-width: 18mm; text-align: center; }
        .official-blue-rule { height: 3px; background: #102c66; margin-top: 3mm; }
        .official-submeta { margin-top: 0; }
        .official-submeta td { height: 7mm; vertical-align: middle; }
        .official-submeta .official-term { width: 22%; text-align: center; font-size: 12px; font-weight: 700; }
        .official-record-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7px; margin-top: 0; }
        .official-record-table th, .official-record-table td { border: 1px solid #111; padding: 0; height: 3.9mm; line-height: 1; text-align: center; overflow: hidden; }
        .official-record-table th { background: #f1f1f1; font-weight: 700; }
        .official-record-table .official-info-row th { height: 6mm; background: #f1f1f1; }
        .official-record-table .official-term-heading { background: #f1f1f1; font-size: 12px; text-align: center; vertical-align: middle; }
        .official-record-table .official-field-heading { padding: 0 1mm; text-align: left; font-weight: 400; }
        .official-record-table .official-field-heading strong { display: inline-block; min-width: 20mm; font-size: 7px; }
        .official-record-table .official-field-heading span { display: inline-block; min-width: 20mm; border-bottom: 1px solid #222; text-align: center; font-size: 8px; }
        .official-record-table .official-group-row th { height: 7mm; background: #f1f1f1; font-size: 7px; vertical-align: middle; }
        .official-record-table .official-subheader-row th { height: 4.5mm; background: #f1f1f1; font-size: 7px; white-space: nowrap; }
        .official-record-table .official-hps-row th { height: 4.5mm; background: #f1f1f1; font-size: 7px; }
        .official-record-table .official-hps-row th:first-child { text-align: right; font-style: italic; }
        .official-record-table .official-grade-heading { background: #f1f1f1; font-size: 7px; }
        .official-record-table .official-group-row th:nth-child(2), .official-record-table .official-subheader-row th:nth-child(9), .official-record-table .official-hps-row th:nth-child(10) { border-left-width: 2px; }
        .official-record-table .official-group-row th { border-top: 2px solid #111; }
        .official-record-table .official-hps-row th { border-bottom: 2px solid #111; }
        .official-record-table .col-number { width: 5mm; }
        .official-record-table .col-name { width: 55mm; }
        .official-record-table .col-score { width: 5.2mm; }
        .official-record-table .col-total { width: 7mm; }
        .official-record-table .col-ps, .official-record-table .col-ws { width: 7mm; }
        .official-record-table .col-grade { width: 9mm; }
        .official-record-table .col-descriptor { width: 14mm; }
        .official-record-table tbody tr:first-child td { height: 5mm; background: #f1f1f1; }
        @media screen {
          .eclass-print { background: white; margin: 20px auto; width: 1200px; max-width: calc(100vw - 40px); padding: 8mm 6mm; border-radius: 8px; box-sizing: border-box; }
          .official-meta { width: 72%; min-width: 720px; }
          .official-record-table { min-width: 100%; }
        }
        @media print {
          .no-print { display: none !important; }
          .eclass-modal-overlay { display: block !important; position: static !important; overflow: visible !important; background: white !important; }
          .min-h-screen { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          .eclass-print { width: 285mm !important; min-width: 285mm !important; max-width: 285mm !important; padding: 7mm 0 !important; margin: 0 auto !important; box-shadow: none !important; border-radius: 0 !important; }
          .official-record-table { page-break-inside: auto; }
          .official-record-table thead { display: table-row-group; }
          .official-record-table tr { page-break-inside: avoid; page-break-after: auto; }
          @page { size: A4 landscape; margin: 6mm; }
        }
      `}</style>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function ClassRecord() {
  const [subject,setSubject]   = useState('Filipino');
  const [term,setTerm]         = useState(1);
  const [students,setStudents] = useState<Student[]>([]);
  const [scores,setScores]     = useState<Record<string,Scores>>({});
  const [highest,setHighest]   = useState<Highest>({ww:[100,100,100,100,100],pt:[100,100,100],st:[50,50],te:100});
  const [loading,setLoading]   = useState(true);
  const [saving,setSaving]     = useState<string|null>(null);
  const [showAdd,setShowAdd]   = useState(false);
  const [showEClass,setShowEClass] = useState(false);
  const [showSummary,setShowSummary] = useState(false);
  const [showMAPEHSummary,setShowMAPEHSummary] = useState(false);
  const [allTermData,setAllTermData] = useState<Record<number,TermData>>({});
  const [maTermData,setMATermData] = useState<Record<number,TermData>>({});
  const [peTermData,setPETermData] = useState<Record<number,TermData>>({});
  const [loadingEClass,setLoadingEClass] = useState(false);
  const [loadingSummary,setLoadingSummary] = useState(false);
  const [loadingMAPEHSummary,setLoadingMAPEHSummary] = useState(false);
  const [statusModal,setStatusModal] = useState<Student|null>(null);

  const { sectionId, sectionName, gradeLevel, gradeNumber, schoolName, schoolId, schoolYear, division, region, adviser, schoolHead } = useActiveSection();
  const { isCollaborator } = useSubscription();
  const { activeSection } = useSection();
  const [currentUserName, setCurrentUserName] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted || !user) return;
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const name = [metadata.full_name, metadata.name, metadata.display_name]
        .find(value => typeof value === 'string' && value.trim()) as string | undefined;
      setCurrentUserName(name?.trim() || user.email?.trim() || '');
    });
    return () => { mounted = false; };
  }, []);

  // If this user is a subject teacher collaborator, only show their assigned subjects
  // _subjects is set by SectionContext when loading shared sections
  const assignedSubjects: string[] = (activeSection?._subjects ?? []).map(normalizeSubjectKey);
  const isSubjectTeacher = isCollaborator && activeSection?._role === 'subject_teacher' && assignedSubjects.length > 0;
  const assignedPeriods: number[] = activeSection?._gradingPeriods?.length ? activeSection._gradingPeriods : [1, 2, 3];
  const assignedComponents: string[] = activeSection?._components?.length ? activeSection._components : ['ww', 'pt', 'st', 'te'];
  const recordTeacherName = isSubjectTeacher ? (currentUserName || adviser) : adviser;
  const canEditPeriod = (period: number) => !isSubjectTeacher || assignedPeriods.includes(period);
  const canEditComponent = (component: string) => !isSubjectTeacher || assignedComponents.includes(component);

  // Filter the subject lists — subject teachers only see their assigned subjects
  const visibleSubjectsJHS = isSubjectTeacher
    ? SUBJECTS_JHS.filter(s => assignedSubjects.includes(s))
    : SUBJECTS_JHS;
  const shsSubjectsForGrade = gradeNumber === 11 ? SUBJECTS_SHS_G11 : gradeNumber === 12 ? SUBJECTS_SHS_G12 : SUBJECTS_SHS;
  const visibleSubjectsSHS = isSubjectTeacher
    ? shsSubjectsForGrade.filter(s => assignedSubjects.includes(s))
    : shsSubjectsForGrade;

  // Auto-select first assigned subject when a subject teacher opens the page
  useEffect(() => {
    if (isSubjectTeacher && assignedSubjects.length > 0) {
      setSubject(assignedSubjects[0]);
      if (!assignedPeriods.includes(term)) setTerm(assignedPeriods[0]);
    }
  }, [isSubjectTeacher, assignedSubjects.join(','), assignedPeriods.join(','), term]);

  const weights = SUBJECT_WEIGHTS[subject] ?? {ww:0.25, pt:0.50, ta:0.25};
  const hasTA = (weights.ta??0)>0;

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const {data,error}=await supabase.from('students').select('*').eq('section_id',sectionId).order('full_name');
      const hiddenStudentIds = activeSection?._hiddenStudentIds ?? [];
      if(!error) setStudents((data ?? []).filter((student: Student) => !hiddenStudentIds.includes(student.id)));
      setLoading(false);
    })();
  },[sectionId, activeSection?._hiddenStudentIds?.join(',')]);

  useEffect(()=>{
    if (students.length === 0) return; // wait until the roster is loaded so we know who to scope to
    let cancelled = false;
    (async()=>{
      const studentIds = students.map(s=>s.id);
      // CRITICAL: scope to only this teacher's own roster. Without .in('student_id', studentIds),
      // this would return every teacher's rows for the same subject/term across the whole school —
      // which is what was causing HPS to look random/overwritten, since whichever teacher anywhere
      // saved most recently would "win" and bleed into everyone else's view.
      const {data}=await supabase.from('grades').select('*').in('subject',subjectStorageKeys(subject)).eq('term',term).in('student_id', studentIds).order('updated_at',{ascending:false});
      if(cancelled) return; // ignore stale responses if subject/term changed again before this resolved
      const m:Record<string,Scores>={};
      let h:Highest = {ww:[100,100,100,100,100],pt:[100,100,100],st:[50,50],te:100};
      if(data){
        data.forEach((r:any)=>{
          // Rows are ordered most-recently-updated first. The first row for a
          // student therefore wins if both old and corrected keys exist.
          if (!m[r.student_id]) m[r.student_id]={ww:r.written_scores||{},pt:r.pt_scores||{},st:r.st_scores||{},te:r.te_score||0};
        });
        // Rows are ordered most-recently-updated first, so data[0] reflects this teacher's own
        // latest save — not an arbitrary row, and not another teacher's section anymore.
        if(data[0]?.highest_ww) h={ww:data[0].highest_ww,pt:data[0].highest_pt,st:data[0].highest_st||[50,50],te:data[0].highest_te||100};
      }
      setScores(m);
      setHighest(h); // always reset — prevents the previous subject's "Highest Possible Score" row from bleeding into this one
    })();
    return () => { cancelled = true; };
  },[subject,term,students]);

  // Persist "Highest Possible Score" edits on their own, per subject/term — independent of
  // whether any individual score has been entered yet.
  const skipHighestSave = useRef(true);
  const [savingHighest, setSavingHighest] = useState(false);
  // Tracks an edit that hasn't been written to the DB yet, tagged with the subject/term it
  // belongs to — so we can force-save it (flush) if the user switches away before the
  // debounce timer fires, instead of losing it.
  const pendingHighestSave = useRef<{ subject: string; term: number; highest: Highest } | null>(null);
  const highestSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSaveHighest = useCallback(async (subj: string, trm: number, h: Highest) => {
    if (students.length === 0) { pendingHighestSave.current = null; return; }
    setSavingHighest(true);
    const rows = students.map(st => {
      const s = scores[st.id] || { ww:{}, pt:{}, st:{}, te:0 };
      return {
        student_id: st.id, term: trm, subject: subj,
        written_scores: s.ww, pt_scores: s.pt, st_scores: s.st, te_score: s.te,
        highest_ww: h.ww, highest_pt: h.pt, highest_st: h.st, highest_te: h.te,
      };
    });
    const { error } = await supabase.from('grades').upsert(rows, { onConflict: 'student_id,term,subject' });
    if (error) console.error('Failed saving highest scores', error);
    setSavingHighest(false);
    pendingHighestSave.current = null;
  }, [students, scores]);

  // If there's an unsaved highest edit pending, save it RIGHT NOW instead of waiting for the
  // debounce — call this before switching subject/term so edits never silently get dropped.
  const flushPendingHighestSave = useCallback(() => {
    if (highestSaveTimer.current) { clearTimeout(highestSaveTimer.current); highestSaveTimer.current = null; }
    const pending = pendingHighestSave.current;
    if (pending) doSaveHighest(pending.subject, pending.term, pending.highest);
  }, [doSaveHighest]);

  // Whenever subject/term changes, the *next* highest update will be the one coming from
  // the load effect above (not a user edit) — skip persisting that one.
  useEffect(() => {
    skipHighestSave.current = true;
  }, [subject, term]);

  useEffect(() => {
    if (skipHighestSave.current) { skipHighestSave.current = false; return; }
    if (students.length === 0) return;
    pendingHighestSave.current = { subject, term, highest };
    if (highestSaveTimer.current) clearTimeout(highestSaveTimer.current);
    highestSaveTimer.current = setTimeout(() => {
      flushPendingHighestSave();
    }, 600); // debounce so rapid typing doesn't fire a write per keystroke
    // No cleanup-based clearTimeout here on purpose — flushPendingHighestSave (called explicitly
    // before subject/term switches, and on unmount below) is what guarantees the save still happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highest]);

  // Safety net: if the user navigates away/closes the tab entirely while an edit is still
  // debouncing, save it immediately rather than losing it.
  useEffect(() => {
    return () => { flushPendingHighestSave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateScore = useCallback(async(sid:string, cat:'ww'|'pt'|'st'|'te', idx:number|null, val:number)=>{
    if (!canEditPeriod(term) || !canEditComponent(cat)) return;
    setScores(prev=>{
      const cur=prev[sid]||{ww:{},pt:{},st:{},te:0};
      const next={...prev,[sid]:{...cur,...(cat==='te'?{te:val}:{[cat]:{...(cur[cat as 'ww'|'pt'|'st']),[idx!]:val}})}};
      const s=next[sid]; setSaving(sid);
      supabase.from('grades').upsert({
        student_id:sid,term,subject,
        written_scores:s.ww,pt_scores:s.pt,st_scores:s.st,te_score:s.te,
        highest_ww:highest.ww,highest_pt:highest.pt,highest_st:highest.st,highest_te:highest.te,
      },{onConflict:'student_id,term,subject'}).then(({error})=>{ if(error) console.error('Failed saving score for',sid,error); setSaving(null); });
      return next;
    });
  },[term,subject,highest,isSubjectTeacher,assignedPeriods.join(','),assignedComponents.join(',')]);

  const compute = (sid:string)=>{
    const s=scores[sid]||{ww:{},pt:{},st:{},te:0};
    const ww=Array.from({length:5},(_,i)=>s.ww?.[i]??0);
    const pt=Array.from({length:3},(_,i)=>s.pt?.[i]??0);
    const st=Array.from({length:2},(_,i)=>s.st?.[i]??0);
    const te=s.te??0;
    const avgWW=calcAvg(ww,highest.ww);
    const avgPT=calcAvg(pt,highest.pt);
    const avgTA=calcEX(st[0],st[1],te,highest.st[0],highest.st[1],highest.te);
    const initial=avgWW*weights.ww+avgPT*weights.pt+avgTA*(weights.ta??0.25);
    return {ww,pt,st,te,avgWW,avgPT,avgTA,initial,transmuted:transmute(initial)};
  };

  const activeStudents = students.filter(s => !s.status || s.status === 'active');
  const classAvg = activeStudents.length>0
    ? activeStudents.reduce((s,st)=>s+compute(st.id).transmuted,0)/activeStudents.length : 0;

  const loadTermData = async (terms: number[], subjectOverride?: string) => {
    const subj = subjectOverride ?? subject;
    const studentIds = students.map(s => s.id);
    const termMap: Record<number,TermData> = {};
    for (const t of terms) {
      // Same scoping as the live per-subject effect above: without .in('student_id', studentIds)
      // and .order('updated_at'), this pulls every teacher's rows for the same subject/term
      // across the whole school, and the "Highest Possible Score" baseline ends up coming from
      // an arbitrary row that isn't even this class — which is exactly what was silently
      // recomputing wrong grades in Summary of Grades / MAPEH Summary / E-Class Record.
      const {data} = await supabase.from('grades').select('*')
        .in('subject',subjectStorageKeys(subj)).eq('term',t).in('student_id', studentIds)
        .order('updated_at', {ascending:false});
      const m: Record<string,Scores> = {};
      let h: Highest = {ww:[100,100,100,100,100],pt:[100,100,100],st:[50,50],te:100};
      if (data && data.length>0) {
        data.forEach((r:any)=>{
          if (!m[r.student_id]) m[r.student_id]={ww:r.written_scores||{},pt:r.pt_scores||{},st:r.st_scores||{},te:r.te_score||0};
        });
        if (data[0]?.highest_ww) h={ww:data[0].highest_ww,pt:data[0].highest_pt,st:data[0].highest_st||[50,50],te:data[0].highest_te||100};
      }
      termMap[t] = {scores:m, highest:h};
    }
    return termMap;
  };

  const openEClassRecord = async () => {
    setLoadingEClass(true);
    const termMap = await loadTermData([term]);
    setAllTermData(prev => ({...prev, ...termMap}));
    setLoadingEClass(false);
    setShowEClass(true);
  };

  const openSummary = async () => {
    setLoadingSummary(true);
    const termMap = await loadTermData([1,2,3]);
    setAllTermData(termMap);
    setLoadingSummary(false);
    setShowSummary(true);
  };

  const openMAPEHSummary = async () => {
    setLoadingMAPEHSummary(true);
    const [ma, pe] = await Promise.all([
      loadTermData([1,2,3], 'MAPEH - Music & Arts'),
      loadTermData([1,2,3], 'MAPEH - PE & Health'),
    ]);
    setMATermData(ma);
    setPETermData(pe);
    setLoadingMAPEHSummary(false);
    setShowMAPEHSummary(true);
  };
  
  const handleEnter = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentId: string,
    type: string,
    idx: number | null,
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const key = `${type}:${idx ?? 'te'}`;
    const all = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[data-cell]')
    ).filter(el => el.dataset.cell?.endsWith(`:${key}`));
    const cur = all.findIndex(el => el.dataset.cell === `${studentId}:${key}`);
    const next = all[cur + 1];
    if (next) { next.focus(); next.select(); }
  };

  const inp=(color:string)=>`w-14 text-center bg-transparent border border-gray-700 hover:border-${color}-600 focus:border-${color}-500 rounded py-2 text-white text-sm outline-none focus:bg-gray-900`;
  const totalCols = 2+5+1+3+1+(hasTA?4:0)+3;

  const renderGroup = (group:Student[], label:string, bgClass:string) => (
    <>
      <tr>
        <td colSpan={totalCols} className={`px-4 py-1.5 text-xs font-bold tracking-widest uppercase border-t border-gray-700 ${bgClass}`}>
          {label} ({group.filter(s=>!s.status||s.status==='active').length} active
          {group.filter(s=>s.status&&s.status!=='active').length>0 && `, ${group.filter(s=>s.status&&s.status!=='active').length} inactive`})
        </td>
      </tr>
      {group.map((student,idx)=>{
        const isInactive = student.status && student.status !== 'active';
        const {ww,pt,st,te,avgWW,avgPT,avgTA,initial,transmuted}=compute(student.id);
        const desc=descriptor(transmuted);
        const isSaving=saving===student.id;
        return (
          <tr key={student.id} className={`border-t border-gray-800 transition-colors
            ${isInactive ? 'opacity-50 bg-gray-900/80' : transmuted<75?'bg-red-950/10':'hover:bg-gray-900/50'}`}>
            <td className="px-3 py-2 text-center text-gray-500 text-xs">{idx+1}</td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                {isSaving && <RefreshCw size={12} className="animate-spin text-blue-400"/>}
                <button
                  onClick={() => setStatusModal(student)}
                  className={`text-sm font-medium hover:text-blue-300 transition text-left ${isInactive ? 'line-through text-gray-500' : 'text-white'}`}>
                  {student.full_name}
                </button>
                {student.sex && <span className="text-xs text-gray-600">{student.sex}</span>}
                <StatusBadge status={student.status}/>
              </div>
              <div className="text-xs text-gray-600">{student.lrn}</div>
              {student.status_note && isInactive && (
                <div className="text-xs text-gray-600 italic">{student.status_date} &mdash; {student.status_note}</div>
              )}
            </td>
            {ww.map((v,i)=>(
              <td key={i} className="px-1 py-1 border-l border-gray-800">
                <input type="number" min={0} max={highest.ww[i]} value={v||''} disabled={!!isInactive || !canEditPeriod(term) || !canEditComponent('ww')}
                  data-cell={`${student.id}:ww:${i}`}
                  onChange={e=>updateScore(student.id,'ww',i,+e.target.value)}
                  onKeyDown={e=>handleEnter(e,student.id,'ww',i)}
                  className={inp('blue')}/>
              </td>
            ))}
            <td className="px-2 py-2 text-center text-blue-300 text-xs border-l border-gray-800 font-mono">{isInactive?'—':avgWW.toFixed(1)}</td>
            {pt.map((v,i)=>(
              <td key={i} className="px-1 py-1 border-l border-gray-800">
                <input type="number" min={0} max={highest.pt[i]} value={v||''} disabled={!!isInactive || !canEditPeriod(term) || !canEditComponent('pt')}
                  data-cell={`${student.id}:pt:${i}`}
                  onChange={e=>updateScore(student.id,'pt',i,+e.target.value)}
                  onKeyDown={e=>handleEnter(e,student.id,'pt',i)}
                  className={inp('purple')}/>
              </td>
            ))}
            <td className="px-2 py-2 text-center text-purple-300 text-xs border-l border-gray-800 font-mono">{isInactive?'—':avgPT.toFixed(1)}</td>
            {hasTA&&<>
              {st.map((v,i)=>(
                <td key={i} className="px-1 py-1 border-l border-gray-800">
                  <input type="number" min={0} max={highest.st[i]} value={v||''} disabled={!!isInactive || !canEditPeriod(term) || !canEditComponent('st')}
                    data-cell={`${student.id}:st:${i}`}
                    onChange={e=>updateScore(student.id,'st',i,+e.target.value)}
                    onKeyDown={e=>handleEnter(e,student.id,'st',i)}
                    className={inp('amber')}/>
                </td>
              ))}
              <td className="px-1 py-1 border-l border-gray-800">
                <input type="number" min={0} max={highest.te} value={te||''} disabled={!!isInactive || !canEditPeriod(term) || !canEditComponent('te')}
                  data-cell={`${student.id}:te:te`}
                  onChange={e=>updateScore(student.id,'te',null,+e.target.value)}
                  onKeyDown={e=>handleEnter(e,student.id,'te',null)}
                  className={inp('orange')}/>
              </td>
              <td className="px-2 py-2 text-center text-amber-300 text-xs border-l border-gray-800 font-mono">{isInactive?'—':avgTA.toFixed(1)}</td>
            </>}
            <td className="px-3 py-2 text-center text-gray-400 text-xs border-l border-gray-800 font-mono">{isInactive?'—':initial.toFixed(2)}</td>
            <td className={`px-3 py-2 text-center font-bold text-2xl border-l border-gray-800 ${isInactive?'text-gray-600':transmuted>=75?'text-white':'text-red-400'}`}>
              {isInactive ? STATUS_CONFIG[student.status!].label : transmuted}
            </td>
            <td className={`px-3 py-2 text-center text-xs font-medium border-l border-gray-800 ${isInactive?'text-gray-600':desc.color}`}>
              {isInactive ? '' : desc.label}
            </td>
          </tr>
        );
      })}
    </>
  );

  const males   = students.filter(s=>s.sex==='M');
  const females = students.filter(s=>s.sex==='F');
  const others  = students.filter(s=>s.sex!=='M'&&s.sex!=='F');

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          input { border: none !important; background: transparent !important; color: black !important; }
          /* Hide the entire live page when E-Class modal or Summary modal is printing */
          .min-h-screen { display: none !important; }
        }
      `}</style>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={()=>window.history.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400"><ArrowLeft size={22}/></button>
            <div>
              <h1 className="text-2xl font-bold">Class Record</h1>
              <p className="text-gray-400 text-sm">Term {term} &middot; {subject}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gray-800 rounded-xl px-4 py-2 text-sm flex items-center gap-2">
              <Users size={16} className="text-blue-400"/>
              <span className="text-gray-400">{activeStudents.length} active</span>
              {students.length !== activeStudents.length && (
                <span className="text-gray-600 text-xs">/ {students.length} total</span>
              )}
              <span className="text-gray-600">·</span>
              <span className="font-semibold text-blue-300">Avg: {classAvg.toFixed(0)}</span>
            </div>
            <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Plus size={16}/>Add Learner
            </button>
            <button onClick={openEClassRecord} disabled={loadingEClass}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60">
              {loadingEClass ? <RefreshCw size={16} className="animate-spin"/> : <FileText size={16}/>}
              E-Class Record (Term {term})
            </button>
            <button onClick={openSummary} disabled={loadingSummary}
              className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60">
              {loadingSummary ? <RefreshCw size={16} className="animate-spin"/> : <FileText size={16}/>}
              Summary of Grades
            </button>
            {(subject === 'MAPEH - Music & Arts' || subject === 'MAPEH - PE & Health') && (
              <button onClick={openMAPEHSummary} disabled={loadingMAPEHSummary}
                className="flex items-center gap-2 bg-fuchsia-700 hover:bg-fuchsia-600 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60">
                {loadingMAPEHSummary ? <RefreshCw size={16} className="animate-spin"/> : <FileText size={16}/>}
                MAPEH Summary
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="no-print px-6 py-4 flex flex-wrap gap-3 items-center">
          <select value={subject} onChange={e=>{flushPendingHighestSave();setSubject(e.target.value);}}
            className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500">
            {isSubjectTeacher ? (
              // Subject teacher — only show their assigned subjects
              assignedSubjects.map(s => <option key={s}>{s}</option>)
            ) : (
              <>
                <optgroup label="Junior High School/Elementary">{visibleSubjectsJHS.map(s=><option key={s}>{s}</option>)}</optgroup>
                <optgroup label="Senior High School">{visibleSubjectsSHS.map(s=><option key={s}>{s}</option>)}</optgroup>
              </>
            )}
          </select>
          <div className="flex rounded-xl overflow-hidden border border-gray-700">
            {[1,2,3].map(t=>(
              <button key={t} onClick={()=>{if (!canEditPeriod(t)) return; flushPendingHighestSave();setTerm(t);}}
                disabled={!canEditPeriod(t)}
                title={!canEditPeriod(t) ? 'This grading period is not assigned to you' : undefined}
                className={`px-7 py-2.5 text-sm font-medium transition ${term===t?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'} ${!canEditPeriod(t)?'opacity-40 cursor-not-allowed':''}`}>
                Term {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm ml-auto">
            <span className="bg-blue-900/40 text-blue-300 px-3 py-1.5 rounded-lg">WW {(weights.ww*100).toFixed(0)}%</span>
            <span className="bg-purple-900/40 text-purple-300 px-3 py-1.5 rounded-lg">PT {(weights.pt*100).toFixed(0)}%</span>
            {hasTA&&<span className="bg-amber-900/40 text-amber-300 px-3 py-1.5 rounded-lg">TA {((weights.ta??0)*100).toFixed(0)}%</span>}
          </div>
        </div>

        {/* Hint */}
        <div className="no-print px-6 pb-2 text-xs text-gray-600 italic">
          Click a learner's name to view info or change their status (Dropped, Transferred, etc.)
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400"><RefreshCw size={20} className="animate-spin"/>Loading learners...</div>
        ) : (
          <div className="px-6 pb-10 overflow-x-auto no-print">
            <table className="w-full min-w-[1600px] text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl w-8">#</th>
                  <th className="bg-gray-800 text-left px-3 py-3 min-w-[220px]">Learner's Name</th>
                  <th colSpan={5} className="bg-blue-900 text-center px-3 py-3 border-l border-gray-700">Written Works ({(weights.ww*100).toFixed(0)}%)</th>
                  <th className="bg-blue-900 text-center px-2 py-3 border-l border-gray-700 text-xs text-blue-300">PS</th>
                  <th colSpan={3} className="bg-purple-900 text-center px-3 py-3 border-l border-gray-700">Performance Tasks ({(weights.pt*100).toFixed(0)}%)</th>
                  <th className="bg-purple-900 text-center px-2 py-3 border-l border-gray-700 text-xs text-purple-300">PS</th>
                  {hasTA&&<>
                    <th colSpan={2} className="bg-amber-800 text-center px-3 py-3 border-l border-gray-700 text-xs">Summative Tests</th>
                    <th className="bg-orange-800 text-center px-3 py-3 border-l border-gray-700 text-xs">Term Exam</th>
                    <th className="bg-amber-900 text-center px-2 py-3 border-l border-gray-700 text-xs text-amber-300">TA ({((weights.ta??0)*100).toFixed(0)}%) PS</th>
                  </>}
                  <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700">Initial</th>
                  <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700">TG</th>
                  <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700 rounded-tr-xl min-w-[180px]">Descriptor</th>
                </tr>
                <tr className="text-xs">
                  <td className="bg-gray-900 px-3 py-1 text-gray-600"></td>
                  <td className="bg-gray-900 px-3 py-1 italic text-gray-600 text-xs">
                    Highest Possible Score{savingHighest && <span className="text-blue-400 ml-1 not-italic">(saving…)</span>}
                  </td>
                  {highest.ww.map((v,i)=>(
                    <td key={i} className="bg-gray-900 px-1 py-1 border-l border-gray-800">
                      <input type="number" value={v||''} disabled={!canEditComponent('ww') || !canEditPeriod(term)} onChange={e=>setHighest(p=>({...p,ww:p.ww.map((x,j)=>j===i?+e.target.value:x)}))}
                        onBlur={flushPendingHighestSave}
                        className="w-14 text-center bg-gray-800 border border-gray-700 rounded py-1 text-white text-xs"/>
                    </td>
                  ))}
                  <td className="bg-gray-900 border-l border-gray-800 text-center text-gray-600 text-xs py-1">WW PS</td>
                  {highest.pt.map((v,i)=>(
                    <td key={i} className="bg-gray-900 px-1 py-1 border-l border-gray-800">
                      <input type="number" value={v||''} disabled={!canEditComponent('pt') || !canEditPeriod(term)} onChange={e=>setHighest(p=>({...p,pt:p.pt.map((x,j)=>j===i?+e.target.value:x)}))}
                        onBlur={flushPendingHighestSave}
                        className="w-14 text-center bg-gray-800 border border-gray-700 rounded py-1 text-white text-xs"/>
                    </td>
                  ))}
                  <td className="bg-gray-900 border-l border-gray-800 text-center text-gray-600 text-xs py-1">PT PS</td>
                  {hasTA&&<>
                    {highest.st.map((v,i)=>(
                      <td key={i} className="bg-gray-900 px-1 py-1 border-l border-gray-800">
                        <input type="number" value={v||''} disabled={!canEditComponent('st') || !canEditPeriod(term)} onChange={e=>setHighest(p=>({...p,st:p.st.map((x,j)=>j===i?+e.target.value:x)}))}
                          onBlur={flushPendingHighestSave}
                          className="w-14 text-center bg-gray-800 border border-gray-700 rounded py-1 text-white text-xs"/>
                      </td>
                    ))}
                    <td className="bg-gray-900 px-1 py-1 border-l border-gray-800">
                      <input type="number" value={highest.te||''} disabled={!canEditComponent('te') || !canEditPeriod(term)} onChange={e=>setHighest(p=>({...p,te:+e.target.value}))}
                        onBlur={flushPendingHighestSave}
                        className="w-14 text-center bg-gray-800 border border-gray-700 rounded py-1 text-white text-xs"/>
                    </td>
                    <td className="bg-gray-900 border-l border-gray-800 text-center text-gray-600 text-xs py-1">TA PS</td>
                  </>}
                  <td colSpan={3} className="bg-gray-900 border-l border-gray-800"></td>
                </tr>
              </thead>
              <tbody>
                {males.length>0   && renderGroup(males,   'Male',   'bg-blue-950/40 text-blue-300')}
                {females.length>0 && renderGroup(females, 'Female', 'bg-pink-950/40 text-pink-300')}
                {others.length>0  && renderGroup(others,  'Other',  'bg-gray-800/60 text-gray-400')}
                {activeStudents.length>0 && (
                  <tr className="border-t-2 border-gray-700 bg-gray-900">
                    <td></td>
                    <td className="px-3 py-3 font-semibold text-gray-400 text-sm italic">Class Average (Active only)</td>
                    {Array(5+1+3+1+(hasTA?4:0)+2).fill(null).map((_,i)=><td key={i} className="border-l border-gray-800"></td>)}
                    <td className="px-3 py-3 text-center font-bold text-xl text-yellow-300 border-l border-gray-800">{classAvg.toFixed(0)}</td>
                    <td className="border-l border-gray-800"></td>
                  </tr>
                )}
              </tbody>
            </table>
            {students.length===0 && (
              <div className="text-center py-20 text-gray-500">
                <Users size={48} className="mx-auto mb-4 opacity-30"/>
                <p className="text-lg">No learners yet</p>
                <p className="text-sm mt-1">Click "Add Learner" to get started</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showAdd && <AddStudentModal sectionId={sectionId} onClose={()=>setShowAdd(false)}
        onAdd={s=>setStudents(prev=>[...prev,s].sort((a,b)=>{
          const sa=a.sex==='M'?0:1, sb=b.sex==='M'?0:1;
          if(sa!==sb) return sa-sb;
          return a.full_name.localeCompare(b.full_name);
        }))}/>}

      {statusModal && (
        <StudentStatusModal
          student={statusModal}
          onClose={() => setStatusModal(null)}
          onUpdate={updated => setStudents(prev => prev.map(s => s.id===updated.id ? updated : s))}
        />
      )}

      {showEClass && (
        <EClassRecordView
          students={students}
          subject={subject}
          sectionName={sectionName}
          gradeLevel={gradeLevel}
          schoolName={schoolName}
          schoolId={schoolId}
          schoolYear={schoolYear}
          division={division}
          region={region}
          teacherName={recordTeacherName}
          schoolHead={schoolHead}
          allTermData={allTermData}
          currentTerm={term}
          onClose={() => setShowEClass(false)}
        />
      )}

      {showSummary && (
        <SummaryOfGradesView
          students={students}
          subject={subject}
          sectionName={sectionName}
          gradeLevel={gradeLevel}
          schoolName={schoolName}
          schoolId={schoolId}
          schoolYear={schoolYear}
          division={division}
          region={region}
          adviser={adviser}
          schoolHead={schoolHead}
          allTermData={allTermData}
          onClose={() => setShowSummary(false)}
        />
      )}

      {showMAPEHSummary && (
        <MAPEHSummaryView
          students={students}
          sectionName={sectionName}
          gradeLevel={gradeLevel}
          schoolName={schoolName}
          schoolId={schoolId}
          schoolYear={schoolYear}
          division={division}
          region={region}
          adviser={adviser}
          schoolHead={schoolHead}
          maTermData={maTermData}
          peTermData={peTermData}
          currentTerm={term}
          onClose={() => setShowMAPEHSummary(false)}
        />
      )}
    </>
  );
}
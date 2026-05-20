'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Printer, Users, RefreshCw, ChevronLeft,
  ChevronRight, AlertTriangle, CheckCircle, Calendar, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Section constants now come from useActiveSection() hook inside the component

// DepEd School Year 2026-2027 (June 2026 – March 2027)
const MONTHS = [
  'June','July','August','September','October','November',
  'December','January','February','March',
];
// Actual JS Date month (0-indexed)
const MONTH_JS: Record<string, number> = {
  June:5, July:6, August:7, September:8, October:9, November:10,
  December:11, January:0, February:1, March:2,
};
// School year for cross-year months (SY 2026-2027)
const MONTH_YEAR: Record<string, number> = {
  June:2026, July:2026, August:2026, September:2026, October:2026, November:2026,
  December:2026, January:2027, February:2027, March:2027,
};

type Status = 'P' | 'A' | 'L';  // Present, Absent, Late/Tardy
type StudentStatus = 'active' | 'dropped' | 'transferred';
interface Student { id: string; lrn: string; full_name: string; sex: string; status?: StudentStatus; status_date?: string; status_reason?: string; }
interface AttRecord { [date: string]: Status }  // date = 'YYYY-MM-DD'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getSchoolDays(month: string, holidays: string[] = []): Date[] {
  const year = MONTH_YEAR[month];
  const m    = MONTH_JS[month];
  const days: Date[] = [];
  const d = new Date(year, m, 1);
  while (d.getMonth() === m) {
    const dow     = d.getDay();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    // Weekday AND not a declared holiday
    if (dow !== 0 && dow !== 6 && !holidays.includes(dateStr)) {
      days.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dayLabel(d: Date): string {
  return ['SU','M','T','W','TH','F','S'][d.getDay()];
}

function cycleStatus(cur?: Status): Status {
  if (!cur || cur === 'P') return 'A';
  if (cur === 'A') return 'L';
  return 'P';
}

function statusColor(s?: Status) {
  if (s === 'A') return 'bg-red-600 text-white';
  if (s === 'L') return 'bg-yellow-500 text-black';
  if (s === 'P') return 'bg-emerald-600 text-white';
  return 'bg-gray-800 text-gray-400';
}

function statusPrintChar(s?: Status) {
  if (s === 'A') return 'X';
  if (s === 'L') return '/';
  return '';   // Present = blank per DepEd
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT STATUS MODAL
// ─────────────────────────────────────────────────────────────────────────────

function StudentStatusModal({ student, onClose, onUpdate }: {
  student: Student;
  onClose: () => void;
  onUpdate: (updated: Student) => void;
}) {
  const [status, setStatus] = useState<StudentStatus>(student.status || 'active');
  const [date, setDate]     = useState(student.status_date || new Date().toISOString().slice(0,10));
  const [reason, setReason] = useState(student.status_reason || '');
  const [saving, setSaving] = useState(false);

  const cfg = {
    active:      { label: 'Active',      bg: 'bg-emerald-600', icon: '✓', desc: 'Student is currently enrolled and attending.' },
    dropped:     { label: 'Dropped',     bg: 'bg-red-600',     icon: '✕', desc: 'Student stopped schooling / out-of-school youth.' },
    transferred: { label: 'Transferred', bg: 'bg-amber-500',   icon: '→', desc: 'Student transferred to another school.' },
  };

  const save = async () => {
    setSaving(true);
    const updates = {
      status,
      status_date:   status === 'active' ? undefined : date,
      status_reason: status === 'active' ? undefined : reason.trim() || undefined,
    };
    const { error } = await supabase.from('students').update(updates).eq('id', student.id);
    if (error) { alert('Error: ' + error.message); setSaving(false); return; }
    onUpdate({ ...student, ...updates });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-white">{student.full_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">LRN: {student.lrn} · {student.sex === 'M' ? 'Male' : 'Female'}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition"><X size={20}/></button>
        </div>

        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">Learner Status</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(['active','dropped','transferred'] as StudentStatus[]).map(s => {
            const c = cfg[s];
            const isActive = status === s;
            return (
              <button key={s} onClick={() => setStatus(s)}
                className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl border-2 transition-all
                  ${isActive ? `${c.bg} border-transparent text-white` : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}>
                <span className="text-xl font-bold">{c.icon}</span>
                <span className="text-xs font-semibold">{c.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mb-4">{cfg[status].desc}</p>

        {status !== 'active' && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Effectivity Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Reason <span className="text-gray-600">(optional)</span></label>
              <input value={reason} onChange={e => setReason(e.target.value)}
                placeholder={status === 'dropped' ? 'e.g. Health reasons, work, etc.' : 'e.g. Transferred to ABC School'}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm"/>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">Cancel</button>
          <button onClick={save} disabled={saving}
            className={`flex-1 py-2.5 rounded-xl font-semibold transition text-sm disabled:opacity-60 ${cfg[status].bg} text-white hover:opacity-90`}>
            {saving ? 'Saving...' : 'Save Status'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, schoolYear, adviser, schoolHead, district } = useActiveSection();
  const [month, setMonth]         = useState('June');
  const [view, setView]           = useState<'tracker' | 'sf2'>('tracker');
  const [students, setStudents]   = useState<Student[]>([]);
  const [records, setRecords]     = useState<Record<string, AttRecord>>({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<string | null>(null);
  const [holidays, setHolidays]   = useState<string[]>([]);
  const [showHolModal, setShowHolModal] = useState(false);
  const [holInput,  setHolInput]  = useState('');
  const [holReason, setHolReason] = useState('');
  const [statusStudent, setStatusStudent] = useState<Student | null>(null);
  const schoolDays = useMemo(() => getSchoolDays(month, holidays), [month, holidays]);

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('students').select('*').eq('section_id', sectionId).order('full_name');
      const sortByGenderThenName = (arr: Student[]) =>
        [...arr].sort((a, b) => {
          const sexA = a.sex === 'M' ? 0 : 1, sexB = b.sex === 'M' ? 0 : 1;
          if (sexA !== sexB) return sexA - sexB;
          return a.full_name.localeCompare(b.full_name);
        });
      if (!error && data?.length) setStudents(sortByGenderThenName(data));
      else setStudents([
        { id:'1', lrn:'129694170087', full_name:'ALVAREZ, ZEV C.',           sex:'M' },
        { id:'2', lrn:'129702120162', full_name:'ARNADO, ERWIN N.',           sex:'M' },
        { id:'3', lrn:'129643170074', full_name:'BASTATAS, JERECK A.',        sex:'M' },
        { id:'4', lrn:'129697180062', full_name:'BERUAN, KHIAN JAY A.',       sex:'M' },
        { id:'5', lrn:'129515160019', full_name:'CAMAONGAY, ROBERT JR. D.',   sex:'M' },
        { id:'6', lrn:'129643150229', full_name:'ABAYAN, KESIAH FAITH B.',    sex:'F' },
        { id:'7', lrn:'129697170011', full_name:'CARSON, SEAN JANSSEN C.',    sex:'M' },
      ]);
      setLoading(false);
    })();
  }, [sectionId]);

  // ── Load holidays for this section ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('holidays')
        .select('date')
        .eq('section_id', sectionId);
      setHolidays((data ?? []).map((r: any) => r.date));
    })();
  }, [sectionId]);

  // ── Load attendance for this month ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (!students.length) return;
      const dates = schoolDays.map(fmt);
      if (!dates.length) return;
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('section_id', sectionId)
        .in('date', dates);

      const map: Record<string, AttRecord> = {};
      students.forEach(s => { map[s.id] = {}; });
      data?.forEach((r: any) => {
        if (map[r.student_id]) map[r.student_id][r.date] = r.status;
      });
      setRecords(map);
    })();
  }, [students, schoolDays]);

  // ── Add holiday ────────────────────────────────────────────────────────────
  const addHoliday = async () => {
    if (!holInput) return;
    const exists = holidays.includes(holInput);
    if (exists) return;
    const next = [...holidays, holInput].sort();
    setHolidays(next);
    setHolInput(''); setHolReason('');
    await supabase.from('holidays').upsert(
      { section_id: sectionId, date: holInput, reason: holReason || 'Holiday' },
      { onConflict: 'section_id,date' }
    );
  };

  const removeHoliday = async (date: string) => {
    setHolidays(prev => prev.filter(h => h !== date));
    await supabase.from('holidays').delete()
      .eq('section_id', sectionId).eq('date', date);
  };

  // ── Toggle attendance ──────────────────────────────────────────────────────
  const toggle = async (sid: string, date: string) => {
    const cur = records[sid]?.[date];
    const next = cycleStatus(cur);
    setRecords(prev => ({ ...prev, [sid]: { ...prev[sid], [date]: next } }));
    setSaving(sid + date);
    await supabase.from('attendance').upsert(
      { student_id: sid, section_id: sectionId, date, status: next },
      { onConflict: 'student_id,date' }
    );
    setSaving(null);
  };

  // ── Mark all present for a day ─────────────────────────────────────────────
  const markAllPresent = async (date: string) => {
    const updates = students.map(s => ({
      student_id: s.id, section_id: sectionId, date, status: 'P' as Status,
    }));
    setRecords(prev => {
      const next = { ...prev };
      students.forEach(s => { next[s.id] = { ...next[s.id], [date]: 'P' }; });
      return next;
    });
    await supabase.from('attendance').upsert(updates, { onConflict: 'student_id,date' });
  };

  // ── Stats helpers ──────────────────────────────────────────────────────────
  const getAbsents  = (sid: string) => schoolDays.filter(d => records[sid]?.[fmt(d)] === 'A').length;
  const getTardies  = (sid: string) => schoolDays.filter(d => records[sid]?.[fmt(d)] === 'L').length;
  const getPresents = (sid: string) => schoolDays.filter(d => {
    const s = records[sid]?.[fmt(d)];
    return s === 'P' || s === 'L' || s === undefined;
  }).length;

  const hasConsecAbsences = (sid: string) => {
    let count = 0;
    for (const d of schoolDays) {
      if (records[sid]?.[fmt(d)] === 'A') { count++; if (count >= 5) return true; }
      else count = 0;
    }
    return false;
  };

  const activeStudents     = students.filter(s => !s.status || s.status === 'active');
  const droppedStudents    = students.filter(s => s.status === 'dropped');
  const transferredStudents = students.filter(s => s.status === 'transferred');

  const males   = activeStudents.filter(s => s.sex === 'M');
  const females = activeStudents.filter(s => s.sex === 'F');
  // For SF2 inactive rows (shown grayed, with remarks)
  const inactiveMales   = students.filter(s => s.sex === 'M' && (s.status === 'dropped' || s.status === 'transferred'));
  const inactiveFemales = students.filter(s => s.sex === 'F' && (s.status === 'dropped' || s.status === 'transferred'));

  const dayAbsents  = (date: string) => activeStudents.filter(s => records[s.id]?.[date] === 'A').length;
  const dayPresents = (date: string) => activeStudents.filter(s => {
    const st = records[s.id]?.[date];
    return st === 'P' || st === 'L' || st === undefined;
  }).length;

  const totalSchoolDays = schoolDays.length;
  const mAbsents  = males.reduce((s,st)=>s+getAbsents(st.id),0);
  const fAbsents  = females.reduce((s,st)=>s+getAbsents(st.id),0);
  const mTardies  = males.reduce((s,st)=>s+getTardies(st.id),0);
  const fTardies  = females.reduce((s,st)=>s+getTardies(st.id),0);
  const totalEnrollment = activeStudents.length;
  const mEnroll   = males.length;
  const fEnroll   = females.length;
  const mDropped  = droppedStudents.filter(s => s.sex === 'M').length;
  const fDropped  = droppedStudents.filter(s => s.sex === 'F').length;
  const mTransferred = transferredStudents.filter(s => s.sex === 'M').length;
  const fTransferred = transferredStudents.filter(s => s.sex === 'F').length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — DIGITAL TRACKER VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const TrackerView = () => (
    <div className="px-4 pb-10 overflow-x-auto">
      {/* Legend */}
      <div className="no-print flex items-center gap-4 mb-4 text-xs">
        <span className="text-gray-400 font-medium">Click cell to cycle:</span>
        <span className="flex items-center gap-1"><span className="w-6 h-6 rounded bg-gray-800 border border-gray-700 inline-block"></span> blank = Present</span>
        <span className="flex items-center gap-1"><span className="w-6 h-6 rounded bg-red-600 inline-block"></span> X = Absent</span>
        <span className="flex items-center gap-1"><span className="w-6 h-6 rounded bg-yellow-500 inline-block"></span> / = Tardy/Late</span>
      </div>

      <table className="w-full text-xs border-separate border-spacing-0 min-w-[900px]">
        <thead>
          <tr>
            <th className="bg-gray-800 text-left px-3 py-2 rounded-tl-xl sticky left-0 z-10 min-w-[220px]">Learner's Name</th>
            {schoolDays.map(d => (
              <th key={fmt(d)} className="bg-gray-800 text-center px-0.5 py-1 min-w-[32px] group">
                <div className="text-gray-300">{d.getDate()}</div>
                <div style={{fontSize:'9px'}} className="text-gray-500">{dayLabel(d)}</div>
                <button onClick={() => markAllPresent(fmt(d))} title="Mark all Present"
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 w-5 h-4 rounded bg-emerald-700 hover:bg-emerald-500 text-white mx-auto flex items-center justify-center leading-none"
                  style={{fontSize:'9px'}}>✓</button>
              </th>
            ))}
            <th className="bg-blue-900 text-center px-2 py-2 text-blue-300">Days Present</th>
            <th className="bg-red-900 text-center px-2 py-2 text-red-300">Absences</th>
            <th className="bg-yellow-900 text-center px-2 py-2 text-yellow-300">Tardies</th>
            <th className="bg-gray-800 text-center px-2 py-2 rounded-tr-xl">⚠️</th>
          </tr>
        </thead>
        <tbody>
          {/* MALE section */}
          <tr><td colSpan={schoolDays.length + 5} className="bg-blue-950/50 px-3 py-1.5 text-blue-400 font-semibold text-xs">MALE ({males.length}{inactiveMales.length > 0 ? ` active · ${inactiveMales.length} inactive` : ''})</td></tr>
          {males.map((student, idx) => {
            const absents = getAbsents(student.id);
            const alert   = hasConsecAbsences(student.id);
            return (
              <tr key={student.id} className={`border-t border-gray-800 hover:bg-gray-900/40 ${alert ? 'bg-red-950/20' : ''}`}>
                <td className="px-3 py-1.5 sticky left-0 bg-gray-950 z-10 border-r border-gray-800">
                  <button onClick={() => setStatusStudent(student)}
                    className="font-medium text-white text-xs hover:text-blue-300 hover:underline transition text-left">
                    {student.full_name}
                  </button>
                  <div className="text-gray-600 text-xs">{student.lrn}</div>
                </td>
                {schoolDays.map(d => {
                  const dateStr = fmt(d);
                  const status  = records[student.id]?.[dateStr];
                  const isSav   = saving === student.id + dateStr;
                  return (
                    <td key={dateStr} className="p-0.5 text-center border-l border-gray-800">
                      <button
                        onClick={() => toggle(student.id, dateStr)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-all hover:scale-110 active:scale-95
                          ${isSav ? 'animate-pulse bg-gray-600' : statusColor(status)}`}
                        title={status || 'Present'}
                      >
                        {status === 'A' ? 'X' : status === 'L' ? '/' : ''}
                      </button>
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center text-emerald-400 font-bold border-l border-gray-800">{getPresents(student.id)}</td>
                <td className={`px-2 py-1 text-center font-bold border-l border-gray-800 ${absents > 0 ? 'text-red-400' : 'text-gray-600'}`}>{absents}</td>
                <td className="px-2 py-1 text-center text-yellow-400 border-l border-gray-800">{getTardies(student.id)}</td>
                <td className="px-2 py-1 text-center border-l border-gray-800">
                  {alert && <span title="5+ consecutive absences!"><AlertTriangle size={14} className="text-red-400 mx-auto"/></span>}
                </td>
              </tr>
            );
          })}
          {inactiveMales.map(student => (
            <tr key={student.id} className="border-t border-gray-800 opacity-40 bg-gray-900/60">
              <td className="px-3 py-1.5 sticky left-0 bg-gray-900 z-10 border-r border-gray-800">
                <button onClick={() => setStatusStudent(student)}
                  className="font-medium text-gray-500 text-xs hover:text-blue-300 hover:underline transition text-left">
                  {student.full_name}
                </button>
                <div className="flex items-center gap-1 mt-0.5">
                  {student.status === 'dropped'
                    ? <span className="text-[9px] bg-red-900/60 text-red-300 border border-red-700 px-1 rounded">DROPPED</span>
                    : <span className="text-[9px] bg-amber-900/60 text-amber-300 border border-amber-700 px-1 rounded">TRANSFERRED</span>}
                  {student.status_date && <span className="text-[9px] text-gray-600">{student.status_date}</span>}
                </div>
              </td>
              {schoolDays.map(d => <td key={fmt(d)} className="p-0.5 border-l border-gray-800 bg-gray-900/40"></td>)}
              <td colSpan={4} className="px-2 text-[10px] text-gray-600 border-l border-gray-800 italic">
                {student.status === 'dropped' ? 'Dropped' : 'Transferred'}{student.status_reason ? ` — ${student.status_reason}` : ''}
              </td>
            </tr>
          ))}

          {/* FEMALE section */}
          <tr><td colSpan={schoolDays.length + 5} className="bg-pink-950/50 px-3 py-1.5 text-pink-400 font-semibold text-xs">FEMALE ({females.length}{inactiveFemales.length > 0 ? ` active · ${inactiveFemales.length} inactive` : ''})</td></tr>
          {females.map((student) => {
            const absents = getAbsents(student.id);
            const alert   = hasConsecAbsences(student.id);
            return (
              <tr key={student.id} className={`border-t border-gray-800 hover:bg-gray-900/40 ${alert ? 'bg-red-950/20' : ''}`}>
                <td className="px-3 py-1.5 sticky left-0 bg-gray-950 z-10 border-r border-gray-800">
                  <button onClick={() => setStatusStudent(student)}
                    className="font-medium text-white text-xs hover:text-blue-300 hover:underline transition text-left">
                    {student.full_name}
                  </button>
                  <div className="text-gray-600 text-xs">{student.lrn}</div>
                </td>
                {schoolDays.map(d => {
                  const dateStr = fmt(d);
                  const status  = records[student.id]?.[dateStr];
                  const isSav   = saving === student.id + dateStr;
                  return (
                    <td key={dateStr} className="p-0.5 text-center border-l border-gray-800">
                      <button
                        onClick={() => toggle(student.id, dateStr)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-all hover:scale-110 active:scale-95
                          ${isSav ? 'animate-pulse bg-gray-600' : statusColor(status)}`}
                      >
                        {status === 'A' ? 'X' : status === 'L' ? '/' : ''}
                      </button>
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center text-emerald-400 font-bold border-l border-gray-800">{getPresents(student.id)}</td>
                <td className={`px-2 py-1 text-center font-bold border-l border-gray-800 ${absents > 0 ? 'text-red-400' : 'text-gray-600'}`}>{absents}</td>
                <td className="px-2 py-1 text-center text-yellow-400 border-l border-gray-800">{getTardies(student.id)}</td>
                <td className="px-2 py-1 text-center border-l border-gray-800">
                  {alert && <span title="5+ consecutive absences!"><AlertTriangle size={14} className="text-red-400 mx-auto"/></span>}
                </td>
              </tr>
            );
          })}
          {inactiveFemales.map(student => (
            <tr key={student.id} className="border-t border-gray-800 opacity-40 bg-gray-900/60">
              <td className="px-3 py-1.5 sticky left-0 bg-gray-900 z-10 border-r border-gray-800">
                <button onClick={() => setStatusStudent(student)}
                  className="font-medium text-gray-500 text-xs hover:text-blue-300 hover:underline transition text-left">
                  {student.full_name}
                </button>
                <div className="flex items-center gap-1 mt-0.5">
                  {student.status === 'dropped'
                    ? <span className="text-[9px] bg-red-900/60 text-red-300 border border-red-700 px-1 rounded">DROPPED</span>
                    : <span className="text-[9px] bg-amber-900/60 text-amber-300 border border-amber-700 px-1 rounded">TRANSFERRED</span>}
                  {student.status_date && <span className="text-[9px] text-gray-600">{student.status_date}</span>}
                </div>
              </td>
              {schoolDays.map(d => <td key={fmt(d)} className="p-0.5 border-l border-gray-800 bg-gray-900/40"></td>)}
              <td colSpan={4} className="px-2 text-[10px] text-gray-600 border-l border-gray-800 italic">
                {student.status === 'dropped' ? 'Dropped' : 'Transferred'}{student.status_reason ? ` — ${student.status_reason}` : ''}
              </td>
            </tr>
          ))}

          {/* Daily totals */}
          <tr className="border-t-2 border-gray-600 bg-gray-900">
            <td className="px-3 py-2 font-bold text-gray-300 text-xs sticky left-0 bg-gray-900">TOTAL Present / Day</td>
            {schoolDays.map(d => {
              const dateStr = fmt(d);
              const p = dayPresents(dateStr);
              return (
                <td key={dateStr} className="text-center py-2 border-l border-gray-700 text-xs font-bold text-emerald-400">
                  {p}
                </td>
              );
            })}
            <td colSpan={4} className="border-l border-gray-700 px-2 text-xs text-gray-500">
              Total school days: {totalSchoolDays}
            </td>
          </tr>
          <tr className="bg-gray-900">
            <td className="px-3 py-2 font-bold text-gray-300 text-xs sticky left-0 bg-gray-900">TOTAL Absent / Day</td>
            {schoolDays.map(d => {
              const dateStr = fmt(d);
              const a = dayAbsents(dateStr);
              return (
                <td key={dateStr} className="text-center py-2 border-l border-gray-700 text-xs font-bold text-red-400">
                  {a > 0 ? a : '-'}
                </td>
              );
            })}
            <td colSpan={4} className="border-l border-gray-700"></td>
          </tr>
        </tbody>
      </table>

      {/* Summary cards */}
      <div className="no-print mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Total Enrollment</p>
          <p className="text-3xl font-bold text-white">{totalEnrollment}</p>
          <p className="text-xs text-gray-500">{mEnroll}M · {fEnroll}F</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">School Days</p>
          <p className="text-3xl font-bold text-blue-400">{totalSchoolDays}</p>
          <p className="text-xs text-gray-500">in {month}</p>
        </div>
        <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Total Absences</p>
          <p className="text-3xl font-bold text-red-400">{mAbsents + fAbsents}</p>
          <p className="text-xs text-gray-500">{mAbsents}M · {fAbsents}F</p>
        </div>
        <div className="bg-gray-900 border border-yellow-900/50 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Total Tardies</p>
          <p className="text-3xl font-bold text-yellow-400">{mTardies + fTardies}</p>
          <p className="text-xs text-gray-500">{mTardies}M · {fTardies}F</p>
        </div>
      </div>

      {/* Alerts */}
      {students.some(s => hasConsecAbsences(s.id)) && (
        <div className="no-print mt-4 bg-red-950/40 border border-red-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
            <AlertTriangle size={16}/> Learners with 5+ Consecutive Absences (Requires Home Visit)
          </div>
          {students.filter(s => hasConsecAbsences(s.id)).map(s => (
            <div key={s.id} className="text-sm text-red-300 ml-6">• {s.full_name}</div>
          ))}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — SF2 PRINT VIEW (matches official DepEd format)
  // ─────────────────────────────────────────────────────────────────────────
  const SF2View = () => {
    const totalDailyAttendance = schoolDays.reduce((sum, d) => sum + dayPresents(fmt(d)), 0);
    const ada  = totalSchoolDays > 0 ? (totalDailyAttendance / totalSchoolDays) : 0;
    const poa  = totalEnrollment > 0 ? (ada / totalEnrollment) * 100 : 0;
    const consecutiveCount = students.filter(s => hasConsecAbsences(s.id)).length;
    const tdStyle = {border:'1px solid black', padding:'1px 3px', fontSize:'8px'} as React.CSSProperties;
    const thStyle = {border:'1px solid black', padding:'1px 3px', fontSize:'8px', background:'#f3f4f6'} as React.CSSProperties;

    return (
      <div className="sf2-print bg-white text-black font-sans" style={{fontSize:'9px', minWidth:'1100px', padding:'4mm'}}>

        {/* ── TITLE ── */}
        <div style={{textAlign:'center', marginBottom:'3px'}}>
          <div style={{fontWeight:'bold', fontSize:'11px'}}>School Form 2 (SF2) Daily Attendance Report of Learners</div>
          <div style={{fontSize:'8px'}}>(This replaces Form 1, Form 2 &amp; STS Form 4 - Absenteeism and Dropout Profile)</div>
        </div>

        {/* ── HEADER ── */}
        <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'2px', fontSize:'8px'}}>
          <tbody>
            <tr>
              <td style={tdStyle}><strong>School ID:</strong> {schoolId}</td>
              <td style={tdStyle}><strong>School Year:</strong> {schoolYear}</td>
              <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                Report for the Month of: {month} {MONTH_YEAR[month]}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={tdStyle}><strong>Name of School:</strong> {schoolName}</td>
              <td style={tdStyle}>
                <strong>Grade Level:</strong> {gradeLevel} &nbsp;&nbsp;
                <strong>Section:</strong> {sectionName}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── MAIN ATTENDANCE TABLE ── */}
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px'}}>
          <thead>
            <tr>
              <th style={{...thStyle, textAlign:'left', minWidth:'150px'}} rowSpan={2}>
                LEARNER'S NAME<br/>(Last Name, First Name, Middle Name)
              </th>
              {schoolDays.map(d => (
                <th key={fmt(d)} style={{...thStyle, width:'20px', minWidth:'20px', textAlign:'center', padding:'0'}}>
                  <div>{d.getDate()}</div>
                  <div style={{fontSize:'6px'}}>{dayLabel(d)}</div>
                </th>
              ))}
              <th style={{...thStyle, textAlign:'center', minWidth:'55px'}} colSpan={2}>
                Total for the Month
              </th>
              <th style={{...thStyle, textAlign:'center', minWidth:'80px'}}>
                REMARKS (If DROPPED OUT, state reason, please refer to legend number 2.
                If TRANSFERRED IN/OUT, write the name of School.)
              </th>
            </tr>
            <tr>
              {schoolDays.map(d => (
                <th key={fmt(d)} style={{...thStyle, width:'20px', padding:'0'}}></th>
              ))}
              <th style={{...thStyle, textAlign:'center'}}>ABSENT</th>
              <th style={{...thStyle, textAlign:'center'}}>PRESENT</th>
              <th style={{...thStyle}}></th>
            </tr>
          </thead>
          <tbody>
            {/* MALE section */}
            <tr>
              <td colSpan={schoolDays.length + 4}
                style={{...tdStyle, fontWeight:'bold', background:'#dbeafe'}}>
                MALE
              </td>
            </tr>
            {males.map((student, idx) => (
              <tr key={student.id}>
                <td style={{...tdStyle, minWidth:'150px'}}>
                  {idx + 1}. {student.full_name}
                </td>
                {schoolDays.map(d => {
                  const dateStr = fmt(d);
                  const status  = records[student.id]?.[dateStr];
                  return (
                    <td key={dateStr} style={{
                      ...tdStyle, width:'20px', textAlign:'center', fontWeight:'bold', padding:'0',
                      background: status === 'A' ? '#fee2e2' : status === 'L' ? '#fef9c3' : 'white',
                    }}>
                      {statusPrintChar(status)}
                    </td>
                  );
                })}
                <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                  {getAbsents(student.id) || ''}
                </td>
                <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                  {getPresents(student.id) || ''}
                </td>
                <td style={{...tdStyle, fontSize:'7px'}}>
                  {hasConsecAbsences(student.id) ? '5+ consecutive absences' : ''}
                </td>
              </tr>
            ))}
            {inactiveMales.map((student, idx) => (
              <tr key={student.id} style={{background:'#f3f4f6', color:'#9ca3af'}}>
                <td style={{...tdStyle, minWidth:'150px', textDecoration:'line-through', color:'#9ca3af'}}>
                  {males.length + idx + 1}. {student.full_name}
                </td>
                {schoolDays.map(d => <td key={fmt(d)} style={{...tdStyle, background:'#f3f4f6'}}></td>)}
                <td style={{...tdStyle, textAlign:'center'}}>—</td>
                <td style={{...tdStyle, textAlign:'center'}}>—</td>
                <td style={{...tdStyle, fontSize:'7px', fontStyle:'italic', color:'#6b7280'}}>
                  {student.status === 'dropped' ? 'DROPPED OUT' : 'TRANSFERRED OUT'}
                  {student.status_date ? ` (${student.status_date})` : ''}
                  {student.status_reason ? ` — ${student.status_reason}` : ''}
                </td>
              </tr>
            ))}

            {/* MALE total */}
            <tr>
              <td style={{...tdStyle, fontWeight:'bold', textAlign:'right', fontStyle:'italic'}}>
                &lt;=== MALE | TOTAL Per Day ===&gt;
              </td>
              {schoolDays.map(d => {
                const dateStr = fmt(d);
                const p = males.filter(s => {
                  const st = records[s.id]?.[dateStr];
                  return st === 'P' || st === 'L' || st === undefined;
                }).length;
                return (
                  <td key={dateStr} style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                    {p}
                  </td>
                );
              })}
              <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>{mAbsents}</td>
              <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                {males.reduce((sum,s)=>sum+getPresents(s.id),0)}
              </td>
              <td style={{...tdStyle}}></td>
            </tr>

            {/* FEMALE section */}
            <tr>
              <td colSpan={schoolDays.length + 4}
                style={{...tdStyle, fontWeight:'bold', background:'#fce7f3'}}>
                FEMALE
              </td>
            </tr>
            {females.map((student, idx) => (
              <tr key={student.id}>
                <td style={{...tdStyle, minWidth:'150px'}}>
                  {idx + 1}. {student.full_name}
                </td>
                {schoolDays.map(d => {
                  const dateStr = fmt(d);
                  const status  = records[student.id]?.[dateStr];
                  return (
                    <td key={dateStr} style={{
                      ...tdStyle, width:'20px', textAlign:'center', fontWeight:'bold', padding:'0',
                      background: status === 'A' ? '#fee2e2' : status === 'L' ? '#fef9c3' : 'white',
                    }}>
                      {statusPrintChar(status)}
                    </td>
                  );
                })}
                <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                  {getAbsents(student.id) || ''}
                </td>
                <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                  {getPresents(student.id) || ''}
                </td>
                <td style={{...tdStyle, fontSize:'7px'}}>
                  {hasConsecAbsences(student.id) ? '5+ consecutive absences' : ''}
                </td>
              </tr>
            ))}
            {inactiveFemales.map((student, idx) => (
              <tr key={student.id} style={{background:'#f3f4f6', color:'#9ca3af'}}>
                <td style={{...tdStyle, minWidth:'150px', textDecoration:'line-through', color:'#9ca3af'}}>
                  {females.length + idx + 1}. {student.full_name}
                </td>
                {schoolDays.map(d => <td key={fmt(d)} style={{...tdStyle, background:'#f3f4f6'}}></td>)}
                <td style={{...tdStyle, textAlign:'center'}}>—</td>
                <td style={{...tdStyle, textAlign:'center'}}>—</td>
                <td style={{...tdStyle, fontSize:'7px', fontStyle:'italic', color:'#6b7280'}}>
                  {student.status === 'dropped' ? 'DROPPED OUT' : 'TRANSFERRED OUT'}
                  {student.status_date ? ` (${student.status_date})` : ''}
                  {student.status_reason ? ` — ${student.status_reason}` : ''}
                </td>
              </tr>
            ))}

            {/* FEMALE total */}
            <tr>
              <td style={{...tdStyle, fontWeight:'bold', textAlign:'right', fontStyle:'italic'}}>
                &lt;=== FEMALE | TOTAL Per Day ===&gt;
              </td>
              {schoolDays.map(d => {
                const dateStr = fmt(d);
                const p = females.filter(s => {
                  const st = records[s.id]?.[dateStr];
                  return st === 'P' || st === 'L' || st === undefined;
                }).length;
                return (
                  <td key={dateStr} style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                    {p}
                  </td>
                );
              })}
              <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>{fAbsents}</td>
              <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                {females.reduce((sum,s)=>sum+getPresents(s.id),0)}
              </td>
              <td style={{...tdStyle}}></td>
            </tr>

            {/* Combined total */}
            <tr style={{background:'#f3f4f6'}}>
              <td style={{...tdStyle, fontWeight:'bold', textAlign:'right', fontStyle:'italic'}}>
                Combined TOTAL Per Day
              </td>
              {schoolDays.map(d => {
                const dateStr = fmt(d);
                return (
                  <td key={dateStr} style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                    {dayPresents(dateStr)}
                  </td>
                );
              })}
              <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>{mAbsents + fAbsents}</td>
              <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>
                {students.reduce((sum,s)=>sum+getPresents(s.id),0)}
              </td>
              <td style={{...tdStyle}}></td>
            </tr>
          </tbody>
        </table>

        {/* ── BOTTOM SECTION: GUIDELINES + CODES + SUMMARY ── */}
        <div style={{display:'flex', gap:'4px', marginTop:'4px', fontSize:'8px'}}>

          {/* GUIDELINES */}
          <div style={{flex:2, border:'1px solid black', padding:'3px', fontSize:'7.5px'}}>
            <div style={{fontWeight:'bold', marginBottom:'2px'}}>GUIDELINES:</div>
            <div style={{lineHeight:'1.4'}}>
              1. The attendance shall be accomplished daily. Refer to the codes for checking learners' attendance.<br/>
              2. Dates shall be written in the columns after Learner's Name.<br/>
              3. To compute the following:
            </div>
            <div style={{marginLeft:'8px', lineHeight:'1.6', marginTop:'2px'}}>
              <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
                <span>a. Percentage of Enrolment =</span>
                <div style={{textAlign:'center', flex:1}}>
                  <div style={{borderBottom:'1px solid black', paddingBottom:'1px'}}>Registered Learners as of end of the month</div>
                  <div>Enrolment as of 1st Friday of the school year</div>
                </div>
                <span>× 100</span>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'4px', marginTop:'4px'}}>
                <span>b. Average Daily Attendance =</span>
                <div style={{textAlign:'center', flex:1}}>
                  <div style={{borderBottom:'1px solid black', paddingBottom:'1px'}}>Total Daily Attendance</div>
                  <div>Number of School Days in reporting month</div>
                </div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'4px', marginTop:'4px'}}>
                <span>c. Percentage of Attendance for the month =</span>
                <div style={{textAlign:'center', flex:1}}>
                  <div style={{borderBottom:'1px solid black', paddingBottom:'1px'}}>Average daily attendance</div>
                  <div>Registered Learners as of end of the month</div>
                </div>
                <span>× 100</span>
              </div>
            </div>
            <div style={{lineHeight:'1.4', marginTop:'4px'}}>
              4. Every end of the month, the class adviser will submit this form to the office of the principal for recording
              of summary table into School Form 4. Once signed by the principal, this form should be returned to the adviser.<br/>
              5. The adviser will provide neccessary interventions including but not limited to home visitation to learner/s
              who were absent for 5 consecutive days and/or those at risk of dropping out.<br/>
              6. Attendance performance of learners will be reflected in Form 137 and Form 138 every grading period.
            </div>
            <div style={{marginTop:'4px', fontStyle:'italic', fontSize:'7px'}}>
              *Beginning of School Year cut-off report is every 1st Friday of the School Year
            </div>
          </div>

          {/* CODES + REASONS */}
          <div style={{flex:2, border:'1px solid black', padding:'3px', fontSize:'7.5px'}}>
            <div style={{fontWeight:'bold', marginBottom:'2px'}}>1. CODES FOR CHECKING ATTENDANCE</div>
            <div style={{marginBottom:'4px', lineHeight:'1.4'}}>
              (blank) - Present; (x) - Absent; Tardy (half shaded = Upper for Late Commer, Lower for Cutting Classes)
            </div>

            <div style={{fontWeight:'bold', marginBottom:'1px'}}>2. REASONS/CAUSES FOR NLS</div>
            <div style={{columns:2, columnGap:'8px', lineHeight:'1.5'}}>
              <div style={{fontWeight:'bold'}}>a. Domestic-Related Factors</div>
              <div>a.1. Had to take care of siblings</div>
              <div>a.2. Early marriage/pregnancy</div>
              <div>a.3. Parents' attitude toward schooling</div>
              <div>a.4. Family problems</div>
              <div style={{fontWeight:'bold', marginTop:'2px'}}>b. Individual-Related Factors</div>
              <div>b.1. Illness</div>
              <div>b.2. Overage</div>
              <div>b.3. Death</div>
              <div>b.4. Drug Abuse</div>
              <div>b.5. Poor academic performance</div>
              <div>b.6. Lack of interest/Distractions</div>
              <div>b.7. Hunger/Malnutrition</div>
              <div style={{fontWeight:'bold', marginTop:'2px'}}>c. School-Related Factors</div>
              <div>c.1. Teacher Factor</div>
              <div>c.2. Physical condition of classroom</div>
              <div>c.3. Peer influence</div>
              <div style={{fontWeight:'bold', marginTop:'2px'}}>d. Geographic/Environmental</div>
              <div>d.1. Distance between home and school</div>
              <div>d.2. Armed conflict (incl. Tribal wars &amp; clanfeuds)</div>
              <div>d.3. Calamities/Disasters</div>
              <div style={{fontWeight:'bold', marginTop:'2px'}}>e. Financial-Related</div>
              <div>e.1. Child labor, work</div>
              <div style={{fontWeight:'bold', marginTop:'2px'}}>f. Others (Specify)</div>
            </div>
          </div>

          {/* SUMMARY TABLE + SIGNATURES */}
          <div style={{flex:2, border:'1px solid black', padding:'3px', fontSize:'7.5px'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'2px'}}>
              <span><strong>Month:</strong> {month} {MONTH_YEAR[month]}</span>
              <span><strong>No. of Days of Classes:</strong> {totalSchoolDays}</span>
            </div>

            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'7px', marginBottom:'4px'}}>
              <thead>
                <tr>
                  <th style={thStyle}>Summary for the Month</th>
                  <th style={{...thStyle, textAlign:'center'}}>M</th>
                  <th style={{...thStyle, textAlign:'center'}}>F</th>
                  <th style={{...thStyle, textAlign:'center'}}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>* Enrolment as of (1st Friday of June)</td>
                  <td style={{...tdStyle, textAlign:'center'}}>{mEnroll}</td>
                  <td style={{...tdStyle, textAlign:'center'}}>{fEnroll}</td>
                  <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>{totalEnrollment}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Late enrolment during the month (beyond cut-off)</td>
                  <td style={{...tdStyle, textAlign:'center'}}>0</td>
                  <td style={{...tdStyle, textAlign:'center'}}>0</td>
                  <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>0</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Registered Learners as of end of month</td>
                  <td style={{...tdStyle, textAlign:'center'}}>{mEnroll}</td>
                  <td style={{...tdStyle, textAlign:'center'}}>{fEnroll}</td>
                  <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>{totalEnrollment}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Percentage of Enrolment as of end of month</td>
                  <td style={{...tdStyle}} colSpan={2}></td>
                  <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>100%</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Average Daily Attendance</td>
                  <td style={{...tdStyle}} colSpan={2}></td>
                  <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>{ada.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Percentage of Attendance for the month</td>
                  <td style={{...tdStyle}} colSpan={2}></td>
                  <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>{poa.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Number of students absent for 5 consecutive days</td>
                  <td style={{...tdStyle}} colSpan={2}></td>
                  <td style={{...tdStyle, textAlign:'center', fontWeight:'bold', color:'red'}}>{consecutiveCount || ''}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Dropped out</td>
                  <td style={{...tdStyle, textAlign:'center'}}>{mDropped || ''}</td>
                  <td style={{...tdStyle, textAlign:'center'}}>{fDropped || ''}</td>
                  <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>{(mDropped + fDropped) || ''}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Transferred out</td>
                  <td style={{...tdStyle, textAlign:'center'}}>{mTransferred || ''}</td>
                  <td style={{...tdStyle, textAlign:'center'}}>{fTransferred || ''}</td>
                  <td style={{...tdStyle, textAlign:'center', fontWeight:'bold'}}>{(mTransferred + fTransferred) || ''}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Transferred in</td>
                  <td style={{...tdStyle, textAlign:'center'}}></td>
                  <td style={{...tdStyle, textAlign:'center'}}></td>
                  <td style={{...tdStyle, textAlign:'center'}}></td>
                </tr>
              </tbody>
            </table>

            {/* Certification + Signatures */}
            <div style={{fontStyle:'italic', marginBottom:'6mm', fontSize:'7.5px'}}>
              I certify that this is a true and correct report.
            </div>
            <div style={{textAlign:'center', marginBottom:'6mm'}}>
              <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'1px', display:'inline-block', minWidth:'140px'}}>
                {adviser.toUpperCase()}
              </div>
              <div style={{fontSize:'7px'}}>(Signature of Adviser over Printed Name)</div>
            </div>
            <div style={{marginBottom:'2px', fontSize:'7px'}}>Attested by:</div>
            <div style={{textAlign:'center'}}>
              <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'1px', display:'inline-block', minWidth:'140px'}}>
                &nbsp;
              </div>
              <div style={{fontWeight:'bold'}}>{schoolHead || '________________________________'}</div>
              <div style={{fontSize:'7px'}}>(Signature of School Head over Printed Name)</div>
            </div>
            <div style={{textAlign:'center', marginTop:'4px', fontSize:'7px', color:'#666'}}>
              Generated thru TeacherHub PH
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RETURN
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .sf2-print { padding: 4mm; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-950 text-white">

        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold">SF2 Daily Attendance</h1>
              <p className="text-gray-400 text-sm">{sectionName} · {gradeLevel} · {schoolYear}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Month navigation */}
            <div className="flex items-center gap-1 bg-gray-800 rounded-xl px-2 py-1">
              <button onClick={() => {
                const i = MONTHS.indexOf(month);
                if (i > 0) setMonth(MONTHS[i-1]);
              }} className="p-1 hover:bg-gray-700 rounded-lg transition"><ChevronLeft size={16}/></button>
              <select value={month} onChange={e => setMonth(e.target.value)}
                className="bg-transparent text-white text-sm font-semibold px-2 focus:outline-none">
                {MONTHS.map(m => <option key={m} value={m} className="bg-gray-800">{m} {MONTH_YEAR[m]}</option>)}
              </select>
              <button onClick={() => {
                const i = MONTHS.indexOf(month);
                if (i < MONTHS.length-1) setMonth(MONTHS[i+1]);
              }} className="p-1 hover:bg-gray-700 rounded-lg transition"><ChevronRight size={16}/></button>
            </div>

            {/* View toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              <button onClick={() => setView('tracker')}
                className={`px-4 py-2 text-sm font-medium transition ${view==='tracker'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                📋 Tracker
              </button>
              <button onClick={() => setView('sf2')}
                className={`px-4 py-2 text-sm font-medium transition ${view==='sf2'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                📄 SF2 Form
              </button>
            </div>

            <button onClick={() => setShowHolModal(true)}
              className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              🏖️ Holidays {holidays.length > 0 && <span className="bg-amber-900 px-1.5 py-0.5 rounded-full text-xs">{holidays.length}</span>}
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Printer size={16}/> Print SF2
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/> Loading attendance data…
          </div>
        ) : (
          <div className={view === 'sf2' ? 'bg-white p-4' : 'p-4'}>
            {view === 'tracker' ? <TrackerView /> : <SF2View />}
          </div>
        )}
      </div>

      {/* ── Student Status Modal ── */}
      {statusStudent && (
        <StudentStatusModal
          student={statusStudent}
          onClose={() => setStatusStudent(null)}
          onUpdate={updated => {
            setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
            setStatusStudent(null);
          }}
        />
      )}

      {/* ── Holiday Modal ── */}
      {showHolModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
              🏖️ Holidays / Non-School Days
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Declare weekdays that are NOT school days — holidays, typhoon suspensions,
              special non-working days. These will be <strong className="text-white">removed
              from the attendance grid</strong> and won't count in the SF2 school day total.
            </p>

            {/* Add holiday form */}
            <div className="space-y-2 mb-4">
              <label className="block text-sm text-gray-400">Date (weekday only)</label>
              <input type="date" value={holInput} onChange={e => setHolInput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"/>
              <label className="block text-sm text-gray-400">Reason / Description</label>
              <input value={holReason} onChange={e => setHolReason(e.target.value)}
                placeholder="e.g. Rizal Day, Typhoon Suspension, Foundation Day"
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"/>
              <button onClick={addHoliday} disabled={!holInput}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold text-sm transition disabled:opacity-50">
                + Declare as Non-School Day
              </button>
            </div>

            {/* Holiday list */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">
                Declared — {holidays.length} non-school day{holidays.length !== 1 ? 's' : ''}
              </p>
              {holidays.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-3">None declared yet.</div>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {holidays.sort().map(h => (
                    <div key={h} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
                      <div>
                        <span className="text-white text-sm font-mono">{h}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          {new Date(h + 'T00:00:00').toLocaleDateString('en-PH', { weekday:'short', month:'short', day:'numeric' })}
                        </span>
                      </div>
                      <button onClick={() => removeHoliday(h)}
                        className="text-red-400 hover:text-red-300 text-xs font-semibold transition ml-2">
                        ✕ Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowHolModal(false)}
              className="w-full py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm font-medium">
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
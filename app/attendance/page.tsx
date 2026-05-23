'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Calendar,
  ArrowLeft, Printer, RefreshCw, Users, UserX, ArrowRightLeft, UserPlus, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const MONTHS = ['June','July','August','September','October','November','December','January','February','March'];
const MONTH_JS: Record<string,number> = {
  June:5, July:6, August:7, September:8, October:9,
  November:10, December:11, January:0, February:1, March:2,
};
const MONTH_YEAR: Record<string,number> = {
  June:2026, July:2026, August:2026, September:2026, October:2026,
  November:2026, December:2026, January:2027, February:2027, March:2027,
};

type Status = 'P'|'A'|'L';
type StudentStatus = 'active'|'dropped'|'transferred_out'|'transferred_in';

// ── STATUS CONFIG ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<StudentStatus,{label:string;color:string;bg:string;icon:any}> = {
  active:          {label:'Active',          color:'text-emerald-400', bg:'bg-emerald-900/40 border-emerald-700', icon:CheckCircle},
  dropped:         {label:'Dropped',         color:'text-red-400',     bg:'bg-red-900/40 border-red-700',         icon:UserX},
  transferred_out: {label:'Transferred Out', color:'text-amber-400',   bg:'bg-amber-900/40 border-amber-700',     icon:ArrowRightLeft},
  transferred_in:  {label:'Transferred In',  color:'text-blue-400',    bg:'bg-blue-900/40 border-blue-700',       icon:UserPlus},
};

interface Student {
  id: string; lrn: string; full_name: string; sex: string; middle_name?: string;
  status?: StudentStatus; status_date?: string; status_note?: string;
}
interface AttRecord { [date: string]: Status }

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getSchoolDays(month: string, holidays: string[] = []): Date[] {
  const m = MONTH_JS[month]; const y = MONTH_YEAR[month];
  const days: Date[] = [];
  const d = new Date(y, m, 1);
  while (d.getMonth() === m) {
    const dow = d.getDay();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (dow !== 0 && dow !== 6 && !holidays.includes(dateStr)) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dayLabel(d: Date): string {
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()];
}
function cycleStatus(cur?: Status): Status {
  if (!cur || cur === 'P') return 'A';
  if (cur === 'A') return 'L';
  return 'P';
}
function statusColor(s?: Status) {
  if (s === 'A') return 'bg-red-600 text-white';
  if (s === 'L') return 'bg-yellow-500 text-black';
  return 'bg-gray-800 border border-gray-700';
}
function statusPrintChar(s?: Status) {
  if (s === 'A') return 'X';
  if (s === 'L') return '/';
  return '';
}

// ── STUDENT STATUS MODAL ──────────────────────────────────────────────────────
function StudentStatusModal({ student, onClose, onUpdate }:
  { student: Student; onClose:()=>void; onUpdate:(s:Student)=>void }) {
  const [status, setStatus] = useState<StudentStatus>(student.status ?? 'active');
  const [date,   setDate]   = useState(student.status_date ?? '');
  const [note,   setNote]   = useState(student.status_note ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('students').update({
      status, status_date: date||null, status_note: note||null,
    }).eq('id', student.id);
    if (!error) { onUpdate({...student, status, status_date:date||undefined, status_note:note||undefined}); onClose(); }
    else alert('Error: ' + error.message);
    setSaving(false);
  };

  const cfg = STATUS_CONFIG[status];
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-white">{student.full_name}</h3>
            <p className="text-gray-500 text-sm">LRN: {student.lrn} &middot; {student.sex === 'M' ? 'Male' : 'Female'}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition"><X size={20}/></button>
        </div>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold mb-5 ${cfg.bg} ${cfg.color}`}>
          <cfg.icon size={16}/>
          Currently: {cfg.label}
          {student.status_date && student.status !== 'active' && (
            <span className="text-xs font-normal opacity-70">since {student.status_date}</span>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Change Status</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(STATUS_CONFIG) as [StudentStatus, typeof STATUS_CONFIG[StudentStatus]][]).map(([key, conf]) => (
              <button key={key} onClick={() => setStatus(key)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition
                  ${status === key ? `${conf.bg} ${conf.color}` : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                <conf.icon size={14}/>{conf.label}
              </button>
            ))}
          </div>
        </div>

        {status !== 'active' && (
          <>
            <div className="mb-3">
              <label className="block text-sm text-gray-400 mb-1">
                {status==='dropped'?'Date Dropped':status==='transferred_in'?'Date Transferred In':'Date Transferred Out'}
              </label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"/>
            </div>
            <div className="mb-5">
              <label className="block text-sm text-gray-400 mb-1">
                {status==='dropped'?'Reason':status==='transferred_in'?'From School':'To School'}
              </label>
              <input value={note} onChange={e=>setNote(e.target.value)}
                placeholder={status==='dropped'?'e.g. Family relocated, Health issues...':'e.g. San Pedro NHS'}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"/>
            </div>
          </>
        )}
        {status === 'active' && <div className="mb-5"/>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition disabled:opacity-60 text-sm">
            {saving ? 'Saving...' : 'Save Status'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── STATUS BADGE ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: StudentStatus }) {
  if (!status || status === 'active') return null;
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <cfg.icon size={10}/>{cfg.label}
    </span>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, schoolYear, adviser, schoolHead, district, division, region } = useActiveSection();

  const [view,setView]             = useState<'tracker'|'sf2'>('tracker');
  const [month,setMonth]           = useState('June');
  const [students,setStudents]     = useState<Student[]>([]);
  const [records,setRecords]       = useState<Record<string,AttRecord>>({});
  const [loading,setLoading]       = useState(true);
  const [saving,setSaving]         = useState<string|null>(null);
  const [holidays,setHolidays]     = useState<string[]>([]);
  const [holInput,setHolInput]     = useState('');
  const [holReason,setHolReason]   = useState('');
  const [showHolModal,setShowHolModal] = useState(false);
  const [statusModal,setStatusModal]   = useState<Student|null>(null);
  const [showSF2Modal,setShowSF2Modal]   = useState(false);

  const schoolDays = useMemo(() => getSchoolDays(month, holidays), [month, holidays]);

  // Active students only for tracking
  const activeStudents = students.filter(s => !s.status || s.status === 'active');
  const inactiveStudents = students.filter(s => s.status && s.status !== 'active');
  const males   = activeStudents.filter(s => s.sex === 'M');
  const females = activeStudents.filter(s => s.sex === 'F');

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('students').select('*').eq('section_id', sectionId).order('full_name');
      if (!error && data?.length) setStudents(data);
      setLoading(false);
    })();
  }, [sectionId]);

  // ── Load holidays ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('holidays').select('date').eq('section_id', sectionId);
      setHolidays((data ?? []).map((r: any) => r.date));
    })();
  }, [sectionId]);

  // ── Load attendance ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (!students.length) return;
      const dates = schoolDays.map(fmt);
      if (!dates.length) return;
      const { data } = await supabase.from('attendance').select('*')
        .eq('section_id', sectionId).in('date', dates);
      const map: Record<string, AttRecord> = {};
      students.forEach(s => { map[s.id] = {}; });
      (data ?? []).forEach((r: any) => { if (map[r.student_id]) map[r.student_id][r.date] = r.status; });
      setRecords(map);
    })();
  }, [students, schoolDays, sectionId]);

  // ── Holiday management ─────────────────────────────────────────────────────
  const addHoliday = async () => {
    if (!holInput) return;
    if (holidays.includes(holInput)) return;
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
    await supabase.from('holidays').delete().eq('section_id', sectionId).eq('date', date);
  };

  // ── Toggle attendance ──────────────────────────────────────────────────────
  const toggle = async (sid: string, date: string) => {
    const cur = records[sid]?.[date];
    const next = cycleStatus(cur);
    setRecords(prev => ({...prev, [sid]: {...prev[sid], [date]: next}}));
    setSaving(sid + date);
    await supabase.from('attendance').upsert(
      { student_id: sid, section_id: sectionId, date, status: next },
      { onConflict: 'student_id,date' }
    );
    setSaving(null);
  };

  const markAllPresent = async (date: string) => {
    const updates = activeStudents.map(s => ({ student_id: s.id, section_id: sectionId, date, status: 'P' as Status }));
    const next = {...records};
    activeStudents.forEach(s => { next[s.id] = {...next[s.id], [date]: 'P'}; });
    setRecords(next);
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

  const totalSchoolDays = schoolDays.length;
  const totalEnrollment = activeStudents.length;
  const mEnroll = males.length; const fEnroll = females.length;
  const dayAbsents  = (date: string) => activeStudents.filter(s => records[s.id]?.[date] === 'A').length;
  const dayPresents = (date: string) => activeStudents.filter(s => {
    const st = records[s.id]?.[date];
    return st === 'P' || st === 'L' || st === undefined;
  }).length;
  const mAbsents  = males.reduce((s,st)=>s+getAbsents(st.id),0);
  const fAbsents  = females.reduce((s,st)=>s+getAbsents(st.id),0);
  const mTardies  = males.reduce((s,st)=>s+getTardies(st.id),0);
  const fTardies  = females.reduce((s,st)=>s+getTardies(st.id),0);

  // ── TRACKER VIEW ───────────────────────────────────────────────────────────
  const TrackerView = () => (
    <div className="px-4 pb-10 overflow-x-auto">
      <div className="no-print flex items-center gap-4 mb-4 text-xs">
        <span className="text-gray-400 font-medium">Click cell to cycle:</span>
        <span className="flex items-center gap-1"><span className="w-6 h-6 rounded bg-gray-800 border border-gray-700 inline-block"/><span>= Present</span></span>
        <span className="flex items-center gap-1"><span className="w-6 h-6 rounded bg-red-600 inline-block"/><span>X = Absent</span></span>
        <span className="flex items-center gap-1"><span className="w-6 h-6 rounded bg-yellow-500 inline-block"/><span>/ = Tardy/Late</span></span>
        {inactiveStudents.length > 0 && (
          <span className="flex items-center gap-1 ml-4 text-gray-500 italic">
            {inactiveStudents.length} inactive learner{inactiveStudents.length>1?'s':''} hidden from tracking
          </span>
        )}
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
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 w-5 h-4 rounded bg-emerald-700 hover:bg-emerald-600 text-white"
                  style={{fontSize:'9px'}}>P</button>
              </th>
            ))}
            <th className="bg-emerald-900 text-center px-2 py-2 text-emerald-300">Days Present</th>
            <th className="bg-red-900 text-center px-2 py-2 text-red-300">Absences</th>
            <th className="bg-yellow-900 text-center px-2 py-2 text-yellow-300">Tardies</th>
            <th className="bg-gray-800 text-center px-2 py-2 rounded-tr-xl">
              <AlertTriangle size={12} className="mx-auto text-orange-400"/>
            </th>
          </tr>
        </thead>
        <tbody>
          {/* MALE */}
          <tr><td colSpan={schoolDays.length+5} className="bg-blue-950/50 px-3 py-1.5 text-blue-400 font-bold text-xs">
            MALE ({males.length})
          </td></tr>
          {males.map((student) => {
            const absents = getAbsents(student.id);
            const alert   = hasConsecAbsences(student.id);
            return (
              <tr key={student.id} className={`border-t border-gray-800 hover:bg-gray-900/40 ${alert?'bg-red-950/20':''}`}>
                <td className="px-3 py-1.5 sticky left-0 bg-gray-950 z-10 border-r border-gray-800">
                  <button onClick={() => setStatusModal(student)}
                    className="font-medium text-white text-xs hover:text-blue-300 transition text-left w-full">
                    {student.full_name}
                  </button>
                  <div className="text-gray-600 text-xs">{student.lrn}</div>
                </td>
                {schoolDays.map(d => {
                  const dateStr = fmt(d);
                  const status  = records[student.id]?.[dateStr];
                  const isSav   = saving === student.id + dateStr;
                  return (
                    <td key={dateStr} className="px-0.5 py-0.5 text-center border-l border-gray-900">
                      <button
                        onClick={() => toggle(student.id, dateStr)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-all hover:scale-110 active:scale-95
                          ${isSav ? 'animate-pulse bg-gray-600' : statusColor(status)}`}
                        title={status || 'Present'}>
                        {statusPrintChar(status)}
                      </button>
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center text-emerald-400 font-bold border-l border-gray-800">{getPresents(student.id)}</td>
                <td className="px-2 py-1 text-center text-red-400 font-bold border-l border-gray-800">{absents || ''}</td>
                <td className="px-2 py-1 text-center text-yellow-400 border-l border-gray-800">{getTardies(student.id)||''}</td>
                <td className="px-2 py-1 text-center border-l border-gray-800">
                  {alert && <span title="5+ consecutive absences!"><AlertTriangle size={14} className="text-red-400 mx-auto"/></span>}
                </td>
              </tr>
            );
          })}

          {/* FEMALE */}
          <tr><td colSpan={schoolDays.length+5} className="bg-pink-950/50 px-3 py-1.5 text-pink-400 font-bold text-xs">
            FEMALE ({females.length})
          </td></tr>
          {females.map((student) => {
            const absents = getAbsents(student.id);
            const alert   = hasConsecAbsences(student.id);
            return (
              <tr key={student.id} className={`border-t border-gray-800 hover:bg-gray-900/40 ${alert?'bg-red-950/20':''}`}>
                <td className="px-3 py-1.5 sticky left-0 bg-gray-950 z-10 border-r border-gray-800">
                  <button onClick={() => setStatusModal(student)}
                    className="font-medium text-white text-xs hover:text-blue-300 transition text-left w-full">
                    {student.full_name}
                  </button>
                  <div className="text-gray-600 text-xs">{student.lrn}</div>
                </td>
                {schoolDays.map(d => {
                  const dateStr = fmt(d);
                  const status  = records[student.id]?.[dateStr];
                  const isSav   = saving === student.id + dateStr;
                  return (
                    <td key={dateStr} className="px-0.5 py-0.5 text-center border-l border-gray-900">
                      <button
                        onClick={() => toggle(student.id, dateStr)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-all hover:scale-110 active:scale-95
                          ${isSav ? 'animate-pulse bg-gray-600' : statusColor(status)}`}
                        title={status || 'Present'}>
                        {statusPrintChar(status)}
                      </button>
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center text-emerald-400 font-bold border-l border-gray-800">{getPresents(student.id)}</td>
                <td className="px-2 py-1 text-center text-red-400 font-bold border-l border-gray-800">{absents||''}</td>
                <td className="px-2 py-1 text-center text-yellow-400 border-l border-gray-800">{getTardies(student.id)||''}</td>
                <td className="px-2 py-1 text-center border-l border-gray-800">
                  {alert && <span title="5+ consecutive absences!"><AlertTriangle size={14} className="text-red-400 mx-auto"/></span>}
                </td>
              </tr>
            );
          })}

          {/* Totals */}
          <tr className="border-t-2 border-gray-700">
            <td className="px-3 py-2 font-bold text-gray-300 text-xs sticky left-0 bg-gray-900">TOTAL Present / Day</td>
            {schoolDays.map(d => (
              <td key={fmt(d)} className="text-center py-1 border-l border-gray-800 text-xs text-emerald-400 font-bold">
                {dayPresents(fmt(d))}
              </td>
            ))}
            <td colSpan={4} className="text-right px-3 text-xs text-gray-500">Total school days: {totalSchoolDays}</td>
          </tr>
          <tr className="border-t border-gray-800">
            <td className="px-3 py-2 font-bold text-gray-300 text-xs sticky left-0 bg-gray-900">TOTAL Absent / Day</td>
            {schoolDays.map(d => (
              <td key={fmt(d)} className="text-center py-1 border-l border-gray-800 text-xs text-red-400">
                {dayAbsents(fmt(d)) || '-'}
              </td>
            ))}
            <td colSpan={4}></td>
          </tr>
        </tbody>
      </table>

      {/* Summary cards */}
      <div className="no-print mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Total Enrollment</p>
          <p className="text-3xl font-bold text-white">{totalEnrollment}</p>
          <p className="text-xs text-gray-500">{mEnroll}M &middot; {fEnroll}F</p>
          {inactiveStudents.length > 0 && (
            <p className="text-xs text-amber-500 mt-1">{inactiveStudents.length} inactive</p>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">School Days</p>
          <p className="text-3xl font-bold text-blue-400">{totalSchoolDays}</p>
          <p className="text-xs text-gray-500">in {month}</p>
        </div>
        <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Total Absences</p>
          <p className="text-3xl font-bold text-red-400">{mAbsents+fAbsents}</p>
          <p className="text-xs text-gray-500">{mAbsents}M &middot; {fAbsents}F</p>
        </div>
        <div className="bg-gray-900 border border-yellow-900/50 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Total Tardies</p>
          <p className="text-3xl font-bold text-yellow-400">{mTardies+fTardies}</p>
          <p className="text-xs text-gray-500">{mTardies}M &middot; {fTardies}F</p>
        </div>
      </div>

      {/* Consecutive absences alert */}
      {activeStudents.some(s => hasConsecAbsences(s.id)) && (
        <div className="no-print mt-4 bg-red-950/40 border border-red-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
            <AlertTriangle size={16}/> Learners with 5+ Consecutive Absences (Requires Home Visit)
          </div>
          {activeStudents.filter(s => hasConsecAbsences(s.id)).map(s => (
            <div key={s.id} className="text-sm text-red-300 ml-6">&bull; {s.full_name}</div>
          ))}
        </div>
      )}

      {/* Inactive learners section */}
      {inactiveStudents.length > 0 && (
        <div className="no-print mt-4 bg-gray-900/60 border border-gray-700 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 font-semibold mb-3 text-sm">
            <UserX size={16}/> Inactive Learners ({inactiveStudents.length}) &mdash; excluded from attendance tracking
          </div>
          <div className="space-y-2">
            {inactiveStudents.map(s => {
              const cfg = STATUS_CONFIG[s.status!];
              return (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
                    <cfg.icon size={10}/>{cfg.label}
                  </span>
                  <button onClick={() => setStatusModal(s)} className="text-gray-400 hover:text-white transition line-through">
                    {s.full_name}
                  </button>
                  <span className="text-gray-600 text-xs">{s.lrn}</span>
                  {s.status_date && <span className="text-gray-600 text-xs">{s.status_date}</span>}
                  {s.status_note && <span className="text-gray-500 text-xs italic">&mdash; {s.status_note}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ── SF2 PRINT VIEW ─────────────────────────────────────────────────────────
  const SF2View = () => {
    const totalDailyAttendance = schoolDays.reduce((sum,d) => sum + dayPresents(fmt(d)), 0);
    const ada  = totalSchoolDays > 0 ? (totalDailyAttendance / totalSchoolDays) : 0;
    const poa  = totalEnrollment > 0 ? (ada / totalEnrollment) * 100 : 0;
    const consecutiveCount = activeStudents.filter(s => hasConsecAbsences(s.id)).length;

    const droppedStudents      = inactiveStudents.filter(s => s.status === 'dropped');
    const transferredOutStudents = inactiveStudents.filter(s => s.status === 'transferred_out');
    const transferredInStudents  = inactiveStudents.filter(s => s.status === 'transferred_in');

    const mDropped  = droppedStudents.filter(s => s.sex === 'M').length;
    const fDropped  = droppedStudents.filter(s => s.sex === 'F').length;
    const mTransOut = transferredOutStudents.filter(s => s.sex === 'M').length;
    const fTransOut = transferredOutStudents.filter(s => s.sex === 'F').length;
    const mTransIn  = transferredInStudents.filter(s => s.sex === 'M').length;
    const fTransIn  = transferredInStudents.filter(s => s.sex === 'F').length;

    // Registered learners at end of month = active + transferred in
    const regEndM = mEnroll + mTransIn;
    const regEndF = fEnroll + fTransIn;
    const regEnd  = regEndM + regEndF;

    // Initial enrollment (1st Friday of June baseline) = active + dropped + transferred_out
    const initEnrollM = mEnroll + mDropped + mTransOut;
    const initEnrollF = fEnroll + fDropped + fTransOut;
    const initEnroll  = initEnrollM + initEnrollF;

    const b = {border:'1px solid #000'} as React.CSSProperties;
    const td = {...b, padding:'2px 4px', fontSize:'8px', verticalAlign:'top'} as React.CSSProperties;
    const th = {...td, background:'#f3f4f6', fontWeight:'bold', textAlign:'center' as const};
    const tdC = {...td, textAlign:'center' as const};
    const thC = {...th, textAlign:'center' as const};

    return (
      <div className="sf2-print bg-white text-black" style={{fontFamily:'Arial, sans-serif', fontSize:'9px', padding:'6mm', overflow:'visible'}}>

        {/* ══ PAGE 1: ATTENDANCE TABLE ══════════════════════════════════════ */}

        {/* Title */}
        <div style={{textAlign:'center', marginBottom:'4px'}}>
          <div style={{fontWeight:'bold', fontSize:'12px'}}>School Form 2 (SF2)</div>
          <div style={{fontWeight:'bold', fontSize:'10px'}}>Daily Attendance Report of Learners</div>
          <div style={{fontSize:'7.5px', color:'#555'}}>(This replaces Form 1, Form 2 &amp; STS Form 4 — Absenteeism and Dropping Out)</div>
        </div>

        {/* School info header */}
        <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'3px', fontSize:'8px'}}>
          <tbody>
            <tr>
              <td style={td}><strong>School ID:</strong> {schoolId}</td>
              <td style={{...td, textAlign:'center', fontWeight:'bold'}} rowSpan={2}>
                Report for the Month of:<br/><span style={{fontSize:'10px'}}>{month.toUpperCase()} {MONTH_YEAR[month]}</span>
              </td>
              <td style={td}><strong>Region:</strong> {region}</td>
            </tr>
            <tr>
              <td style={td}><strong>Name of School:</strong> {schoolName}</td>
              <td style={td}><strong>Division:</strong> {division}</td>
            </tr>
            <tr>
              <td style={td}><strong>Grade Level:</strong> {gradeLevel}</td>
              <td style={td}><strong>Section:</strong> {sectionName}</td>
              <td style={td}><strong>Class Adviser:</strong> {adviser}</td>
            </tr>
          </tbody>
        </table>

        {/* Main attendance table */}
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px'}}>
          <thead>
            <tr>
              <th style={{...th, textAlign:'left', minWidth:'160px', width:'160px'}} rowSpan={2}>
                LEARNER'S NAME<br/>
                <span style={{fontWeight:'normal', fontSize:'7px'}}>(Last Name, First Name, Middle Name)</span>
              </th>
              {schoolDays.map(d => (
                <th key={fmt(d)} style={{...thC, width:'18px', minWidth:'18px', padding:'1px 0', fontSize:'7px'}}>
                  <div>{d.getDate()}</div>
                  <div style={{fontSize:'6px'}}>{['SU','M','T','W','TH','F','S'][d.getDay()]}</div>
                </th>
              ))}
              <th style={{...thC, minWidth:'30px', fontSize:'7px'}} colSpan={2}>Total for the Month</th>
              <th style={{...thC, minWidth:'90px', fontSize:'7px'}}>
                REMARKS (If DROPPED OUT, state reason from legend 2. If TRANSFERRED IN/OUT, write name of School.)
              </th>
            </tr>
            <tr>
              {schoolDays.map(d => <th key={fmt(d)} style={{...thC, padding:'0', fontSize:'7px'}}></th>)}
              <th style={{...thC, fontSize:'7px'}}>ABSENT</th>
              <th style={{...thC, fontSize:'7px'}}>PRESENT</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {/* ── MALE ── */}
            <tr>
              <td colSpan={schoolDays.length + 4} style={{...td, fontWeight:'bold', background:'#dbeafe', textAlign:'left'}}>
                MALE
              </td>
            </tr>
            {males.map((student, idx) => (
              <tr key={student.id}>
                <td style={{...td, textAlign:'left'}}>{idx+1}. {student.full_name}</td>
                {schoolDays.map(d => {
                  const ds = fmt(d); const st = records[student.id]?.[ds];
                  return (
                    <td key={ds} style={{...tdC, width:'18px', padding:'0', fontWeight:'bold', fontSize:'8px',
                      background: st==='A'?'#fee2e2' : st==='L'?'#fef9c3' : 'white'}}>
                      {statusPrintChar(st)}
                    </td>
                  );
                })}
                <td style={{...tdC, fontWeight:'bold'}}>{getAbsents(student.id)||''}</td>
                <td style={{...tdC, fontWeight:'bold'}}>{getPresents(student.id)||''}</td>
                <td style={{...td, fontSize:'7px', fontStyle:'italic'}}>
                  {hasConsecAbsences(student.id) ? '5+ consecutive absences' : ''}
                </td>
              </tr>
            ))}
            {/* Male subtotal */}
            <tr style={{background:'#eff6ff'}}>
              <td style={{...td, fontStyle:'italic', textAlign:'right', fontWeight:'bold', fontSize:'7px'}}>Male Subtotal</td>
              {schoolDays.map(d => {
                const ds = fmt(d);
                const p = males.filter(s => { const st=records[s.id]?.[ds]; return st==='P'||st==='L'||st===undefined; }).length;
                return <td key={ds} style={{...tdC, fontWeight:'bold', fontSize:'7px'}}>{p}</td>;
              })}
              <td style={{...tdC, fontWeight:'bold'}}>{mAbsents}</td>
              <td style={{...tdC, fontWeight:'bold'}}>{males.reduce((s,st)=>s+getPresents(st.id),0)}</td>
              <td style={td}></td>
            </tr>

            {/* ── FEMALE ── */}
            <tr>
              <td colSpan={schoolDays.length + 4} style={{...td, fontWeight:'bold', background:'#fce7f3', textAlign:'left'}}>
                FEMALE
              </td>
            </tr>
            {females.map((student, idx) => (
              <tr key={student.id}>
                <td style={{...td, textAlign:'left'}}>{idx+1}. {student.full_name}</td>
                {schoolDays.map(d => {
                  const ds = fmt(d); const st = records[student.id]?.[ds];
                  return (
                    <td key={ds} style={{...tdC, width:'18px', padding:'0', fontWeight:'bold', fontSize:'8px',
                      background: st==='A'?'#fee2e2' : st==='L'?'#fef9c3' : 'white'}}>
                      {statusPrintChar(st)}
                    </td>
                  );
                })}
                <td style={{...tdC, fontWeight:'bold'}}>{getAbsents(student.id)||''}</td>
                <td style={{...tdC, fontWeight:'bold'}}>{getPresents(student.id)||''}</td>
                <td style={{...td, fontSize:'7px', fontStyle:'italic'}}>
                  {hasConsecAbsences(student.id) ? '5+ consecutive absences' : ''}
                </td>
              </tr>
            ))}
            {/* Female subtotal */}
            <tr style={{background:'#fdf2f8'}}>
              <td style={{...td, fontStyle:'italic', textAlign:'right', fontWeight:'bold', fontSize:'7px'}}>Female Subtotal</td>
              {schoolDays.map(d => {
                const ds = fmt(d);
                const p = females.filter(s => { const st=records[s.id]?.[ds]; return st==='P'||st==='L'||st===undefined; }).length;
                return <td key={ds} style={{...tdC, fontWeight:'bold', fontSize:'7px'}}>{p}</td>;
              })}
              <td style={{...tdC, fontWeight:'bold'}}>{fAbsents}</td>
              <td style={{...tdC, fontWeight:'bold'}}>{females.reduce((s,st)=>s+getPresents(st.id),0)}</td>
              <td style={td}></td>
            </tr>

            {/* Combined total */}
            <tr style={{background:'#f3f4f6'}}>
              <td style={{...td, fontWeight:'bold', textAlign:'right', fontSize:'7px'}}>COMBINED TOTAL Per Day</td>
              {schoolDays.map(d => {
                const ds = fmt(d);
                const p = activeStudents.filter(s => { const st=records[s.id]?.[ds]; return st==='P'||st==='L'||st===undefined; }).length;
                return <td key={ds} style={{...tdC, fontWeight:'bold', fontSize:'7px'}}>{p}</td>;
              })}
              <td style={{...tdC, fontWeight:'bold'}}>{mAbsents+fAbsents}</td>
              <td style={{...tdC, fontWeight:'bold'}}>{activeStudents.reduce((s,st)=>s+getPresents(st.id),0)}</td>
              <td style={td}></td>
            </tr>
          </tbody>
        </table>

        {/* NLS section for dropped/transferred students */}
        {inactiveStudents.length > 0 && (
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px', marginTop:'4px'}}>
            <thead>
              <tr>
                <th style={{...th, textAlign:'left'}} colSpan={schoolDays.length + 4}>
                  NLS (No Longer in School) — shown for record purposes only, excluded from attendance counts
                </th>
              </tr>
            </thead>
            <tbody>
              {inactiveStudents.map((student, idx) => (
                <tr key={student.id} style={{background:'#f9fafb', color:'#6b7280'}}>
                  <td style={{...td, minWidth:'160px', textDecoration:'line-through', color:'#9ca3af'}}>
                    {idx+1}. {student.full_name}
                  </td>
                  {schoolDays.map(d => <td key={fmt(d)} style={{...tdC, background:'#f3f4f6', fontSize:'7px'}}></td>)}
                  <td style={{...tdC}}>—</td>
                  <td style={{...tdC}}>—</td>
                  <td style={{...td, fontSize:'7px', fontStyle:'italic', color:'#6b7280'}}>
                    {student.status === 'dropped' ? 'DROPPED OUT' : student.status === 'transferred_out' ? 'TRANSFERRED OUT' : 'TRANSFERRED IN'}
                    {student.status_date ? ` (${student.status_date})` : ''}
                    {student.status_note ? ` — ${student.status_note}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ══ GUIDELINES + CODES + SUMMARY ══ */}
        <div className="sf2-summary" style={{marginTop:'4px'}}>

          {/* Three-column bottom section */}
          <div style={{display:'flex', gap:'4px', alignItems:'stretch', fontSize:'8px'}}>

            {/* ── COLUMN 1: GUIDELINES ── */}
            <div style={{flex:'2', border:'1px solid black', padding:'4px'}}>
              <div style={{fontWeight:'bold', marginBottom:'3px', fontSize:'8.5px'}}>GUIDELINES:</div>
              <div style={{lineHeight:'1.5'}}>
                1. The attendance shall be accomplished daily. Refer to the codes for checking learners' attendance.<br/>
                2. Dates shall be written in the columns after Learner's Name.<br/>
                3. To compute the following:
              </div>

              {/* Formula (a) */}
              <div style={{display:'flex', alignItems:'center', gap:'6px', margin:'6px 0 4px 8px'}}>
                <span style={{minWidth:'150px'}}>a. <em>Percentage of Enrolment =</em></span>
                <div style={{flex:1, textAlign:'center'}}>
                  <div style={{borderBottom:'1px solid black', paddingBottom:'1px', lineHeight:'1.4'}}>
                    Registered Learner as of End of the Month
                  </div>
                  <div style={{lineHeight:'1.4'}}>Enrolment as of 1st Friday of June</div>
                </div>
                <span>× 100</span>
              </div>

              {/* Formula (b) */}
              <div style={{display:'flex', alignItems:'center', gap:'6px', margin:'4px 0 4px 8px'}}>
                <span style={{minWidth:'150px'}}>b. <em>Average Daily Attendance =</em></span>
                <div style={{flex:1, textAlign:'center'}}>
                  <div style={{borderBottom:'1px solid black', paddingBottom:'1px', lineHeight:'1.4'}}>
                    Total Daily Attendance
                  </div>
                  <div style={{lineHeight:'1.4'}}>Number of School Days in reporting month</div>
                </div>
              </div>

              {/* Formula (c) */}
              <div style={{display:'flex', alignItems:'center', gap:'6px', margin:'4px 0 6px 8px'}}>
                <span style={{minWidth:'150px'}}>c. <em>Percentage of Attendance for the month =</em></span>
                <div style={{flex:1, textAlign:'center'}}>
                  <div style={{borderBottom:'1px solid black', paddingBottom:'1px', lineHeight:'1.4'}}>
                    Average daily attendance
                  </div>
                  <div style={{lineHeight:'1.4'}}>Registered Learners as of End of the month</div>
                </div>
                <span>× 100</span>
              </div>

              <div style={{lineHeight:'1.5', marginTop:'4px'}}>
                4. Every end of the month, the class adviser will submit this form to the office of the principal for recording
                of summary table into School Form 4. Once signed by the principal, this form should be returned to the adviser.<br/>
                5. The adviser will extend necessary intervention including but not limited to home visitation to learner/s
                who were absent for 5 consecutive days and/or those at risk of dropping out.<br/>
                6. Attendance performance of learners is expected to reflect in Form 137 and Form 138 every grading period.<br/>
                <span style={{fontSize:'7px'}}>* Beginning of School Year cut-off report is every 1st Friday of School Calendar Days</span>
              </div>
            </div>

            {/* ── COLUMN 2: CODES + REASONS ── */}
            <div style={{flex:'2', border:'1px solid black', padding:'4px'}}>
              <div style={{fontWeight:'bold', marginBottom:'3px', fontSize:'8.5px'}}>1. CODES FOR CHECKING ATTENDANCE</div>
              <div style={{marginBottom:'5px', lineHeight:'1.5'}}>
                <strong>blank</strong> - Present;&nbsp;&nbsp;
                <strong>(x)</strong> - Absent;&nbsp;&nbsp;
                Tardy (half shaded = Upper for Late Comer, Lower for Cutting Classes)
              </div>

              <div style={{fontWeight:'bold', marginBottom:'2px', fontSize:'8.5px'}}>2. REASONS/CAUSES FOR DROP-OUTS</div>
              <div style={{columns:2, columnGap:'6px', lineHeight:'1.6'}}>
                <div style={{fontWeight:'bold'}}>a. Domestic-Related Factors</div>
                <div>a.1. Had to take care of siblings</div>
                <div>a.2. Early marriage/pregnancy</div>
                <div>a.3. Parents' attitude toward schooling</div>
                <div>a.4. Family problems</div>

                <div style={{fontWeight:'bold', marginTop:'3px'}}>b. Individual-Related Factors</div>
                <div>b.1. Illness</div>
                <div>b.2. Overage</div>
                <div>b.3. Death</div>
                <div>b.4. Drug Abuse</div>
                <div>b.5. Poor academic performance</div>
                <div>b.6. Lack of interest/Distractions</div>
                <div>b.7. Hunger/Malnutrition</div>

                <div style={{fontWeight:'bold', marginTop:'3px'}}>c. School-Related Factors</div>
                <div>c.1. Teacher Factor</div>
                <div>c.2. Physical condition of classroom</div>
                <div>c.3. Peer influence</div>

                <div style={{fontWeight:'bold', marginTop:'3px'}}>d. Geographic/Environmental</div>
                <div>d.1. Distance between home and school</div>
                <div>d.2. Armed conflict (incl. Tribal wars &amp; clanfeuds)</div>
                <div>d.3. Calamities/Disasters</div>

                <div style={{fontWeight:'bold', marginTop:'3px'}}>e. Financial-Related</div>
                <div>e.1. Child labor, work</div>

                <div style={{fontWeight:'bold', marginTop:'3px'}}>f. Others (Specify)</div>
              </div>
            </div>

            {/* ── COLUMN 3: SUMMARY TABLE + SIGNATURES ── */}
            <div style={{flex:'2', border:'1px solid black', padding:'4px'}}>

              {/* Summary table */}
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px', marginBottom:'6px'}}>
                <thead>
                  <tr>
                    <th style={{...th, textAlign:'left', fontSize:'8px'}}>Month: {month} {MONTH_YEAR[month]}</th>
                    <th style={{...thC, fontSize:'7px'}}>No. of Days of Classes:</th>
                    <th style={{...thC, fontSize:'8px', background:'#e5e7eb'}} colSpan={3}>Summary for the Month</th>
                  </tr>
                  <tr>
                    <th style={{...th, textAlign:'left', fontSize:'7px'}}></th>
                    <th style={{...thC, fontWeight:'bold', fontSize:'9px'}}>{totalSchoolDays}</th>
                    <th style={{...thC, fontSize:'7px'}}>M</th>
                    <th style={{...thC, fontSize:'7px'}}>F</th>
                    <th style={{...thC, fontSize:'7px'}}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{...td, fontStyle:'italic', fontSize:'7px'}}>* Enrolment as of (1st Friday of June)</td>
                    <td style={tdC}></td>
                    <td style={tdC}>{initEnrollM || ''}</td>
                    <td style={tdC}>{initEnrollF || ''}</td>
                    <td style={{...tdC, fontWeight:'bold'}}>{initEnroll || ''}</td>
                  </tr>
                  <tr>
                    <td style={{...td, fontStyle:'italic', fontSize:'7px'}}>Late Enrollment <strong>during the month</strong> (beyond cut-off)</td>
                    <td style={tdC}></td>
                    <td style={tdC}>{mTransIn || ''}</td>
                    <td style={tdC}>{fTransIn || ''}</td>
                    <td style={{...tdC, fontWeight:'bold'}}>{(mTransIn + fTransIn) || ''}</td>
                  </tr>
                  <tr>
                    <td style={{...td, fontStyle:'italic', fontSize:'7px'}}>Registered Learner as of <strong>end of the month</strong></td>
                    <td style={tdC}></td>
                    <td style={tdC}>{regEndM || ''}</td>
                    <td style={tdC}>{regEndF || ''}</td>
                    <td style={{...tdC, fontWeight:'bold'}}>{regEnd || ''}</td>
                  </tr>
                  <tr>
                    <td style={{...td, fontStyle:'italic', fontSize:'7px'}}>Percentage of Enrolment as of <strong>end of the month</strong></td>
                    <td style={tdC}></td>
                    <td style={tdC}></td>
                    <td style={tdC}></td>
                    <td style={{...tdC, fontWeight:'bold'}}>
                      {initEnroll > 0 ? ((regEnd / initEnroll) * 100).toFixed(2) + '%' : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style={{...td, fontStyle:'italic', fontSize:'7px'}}>Average Daily Attendance</td>
                    <td style={tdC}></td>
                    <td style={tdC}></td>
                    <td style={tdC}></td>
                    <td style={{...tdC, fontWeight:'bold'}}>{ada.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={{...td, fontStyle:'italic', fontSize:'7px'}}>Percentage of Attendance for the month</td>
                    <td style={tdC}></td>
                    <td style={tdC}></td>
                    <td style={tdC}></td>
                    <td style={{...tdC, fontWeight:'bold'}}>{poa.toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td style={{...td, fontStyle:'italic', fontSize:'7px'}}>Number of students with 5 consecutive days of absences:</td>
                    <td style={tdC}></td>
                    <td style={tdC}></td>
                    <td style={tdC}></td>
                    <td style={{...tdC, fontWeight:'bold', color: consecutiveCount > 0 ? 'red' : 'inherit'}}>
                      {consecutiveCount || ''}
                    </td>
                  </tr>
                  <tr>
                    <td style={{...td, fontWeight:'bold', textAlign:'center', fontSize:'7.5px'}}>Drop out</td>
                    <td style={tdC}></td>
                    <td style={tdC}>{mDropped || ''}</td>
                    <td style={tdC}>{fDropped || ''}</td>
                    <td style={{...tdC, fontWeight:'bold'}}>{(mDropped + fDropped) || ''}</td>
                  </tr>
                  <tr>
                    <td style={{...td, fontWeight:'bold', textAlign:'center', fontSize:'7.5px'}}>Transferred out</td>
                    <td style={tdC}></td>
                    <td style={tdC}>{mTransOut || ''}</td>
                    <td style={tdC}>{fTransOut || ''}</td>
                    <td style={{...tdC, fontWeight:'bold'}}>{(mTransOut + fTransOut) || ''}</td>
                  </tr>
                  <tr>
                    <td style={{...td, fontWeight:'bold', textAlign:'center', fontSize:'7.5px'}}>Transferred in</td>
                    <td style={tdC}></td>
                    <td style={tdC}>{mTransIn || ''}</td>
                    <td style={tdC}>{fTransIn || ''}</td>
                    <td style={{...tdC, fontWeight:'bold'}}>{(mTransIn + fTransIn) || ''}</td>
                  </tr>
                </tbody>
              </table>

              {/* Certification */}
              <div style={{fontStyle:'italic', marginBottom:'8px', fontSize:'7.5px', lineHeight:'1.4'}}>
                I certify that this is a true and correct report.
              </div>

              {/* Teacher signature */}
              <div style={{textAlign:'center', marginBottom:'12px'}}>
                <div style={{marginTop:'20px', borderTop:'1px solid black', paddingTop:'2px', fontWeight:'bold', fontSize:'8px'}}>
                  {adviser?.toUpperCase()}
                </div>
                <div style={{fontSize:'7px'}}>(Signature of Teacher over Printed Name)</div>
              </div>

              {/* School Head signature */}
              <div style={{marginBottom:'2px', fontSize:'7.5px'}}>Attested by:</div>
              <div style={{textAlign:'center'}}>
                <div style={{marginTop:'20px', borderTop:'1px solid black', paddingTop:'2px', fontWeight:'bold', fontSize:'8px'}}>
                  {schoolHead ? schoolHead.toUpperCase() : '________________________________'}
                </div>
                <div style={{fontSize:'7px'}}>(Signature of School Head over Printed Name)</div>
              </div>


            </div>

          </div>{/* end 3-column */}
        </div>{/* end page 2 */}

      </div>
    );
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; margin: 0 !important; }
          .no-print { display: none !important; }
          /* Hide main page, show SF2 modal only */
          .min-h-screen { display: none !important; }
          .sf2-modal-overlay { display: block !important; position: static !important; overflow: visible !important; background: white !important; }
          .sf2-modal-content { display: block !important; }
          /* SF2 content */
          .sf2-print { padding: 4mm !important; display: block !important; overflow: visible !important; }
          .sf2-print table { page-break-inside: auto; width: 100%; }
          .sf2-print tr { page-break-inside: avoid; page-break-after: auto; }
          .sf2-print thead { display: table-header-group; }
          .sf2-summary { page-break-before: auto !important; margin-top: 4px !important; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold">SF2 Daily Attendance</h1>
              <p className="text-gray-400 text-sm">{sectionName} &middot; {gradeLevel} &middot; {schoolYear}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Month navigation */}
            <div className="flex items-center gap-1 bg-gray-800 rounded-xl px-2 py-1">
              <button onClick={() => { const i=MONTHS.indexOf(month); if(i>0) setMonth(MONTHS[i-1]); }}
                className="p-1 hover:bg-gray-700 rounded-lg transition"><ChevronLeft size={16}/></button>
              <select value={month} onChange={e=>setMonth(e.target.value)}
                className="bg-transparent text-white text-sm font-semibold px-2 focus:outline-none">
                {MONTHS.map(m => <option key={m} value={m} className="bg-gray-800">{m} {MONTH_YEAR[m]}</option>)}
              </select>
              <button onClick={() => { const i=MONTHS.indexOf(month); if(i<MONTHS.length-1) setMonth(MONTHS[i+1]); }}
                className="p-1 hover:bg-gray-700 rounded-lg transition"><ChevronRight size={16}/></button>
            </div>

            {/* View toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              <button onClick={() => setView('tracker')}
                className={`px-4 py-2 text-sm font-medium transition ${view==='tracker'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                Tracker
              </button>
              <button onClick={() => setShowSF2Modal(true)}
                className="px-4 py-2 text-sm font-medium transition bg-gray-900 text-gray-400 hover:bg-gray-800">
                SF2 Form
              </button>
            </div>

            <button onClick={() => setShowHolModal(true)}
              className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Calendar size={16}/> Holidays {holidays.length > 0 && <span className="bg-amber-900 px-1.5 py-0.5 rounded text-xs">{holidays.length}</span>}
            </button>


          </div>
        </div>

        {/* Hint */}
        <div className="no-print px-6 pt-3 pb-1 text-xs text-gray-600 italic">
          Click a learner's name to view info or update their status (Dropped, Transferred, etc.)
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/> Loading attendance data...
          </div>
        ) : (
          <div className="p-4">
            <TrackerView />
          </div>
        )}
      </div>

      {/* SF2 Print Modal — isolated so only SF2 content prints */}
      {showSF2Modal && (
        <div className="sf2-modal-overlay fixed inset-0 bg-black/80 z-50 overflow-auto">
          <div className="no-print sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <Printer size={18} className="text-blue-400"/>
              <span className="font-semibold">SF2 Daily Attendance &mdash; {month} {MONTH_YEAR[month]}</span>
              <span className="text-gray-400 text-sm">{sectionName} &middot; {schoolYear}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => window.print()}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
                <Printer size={16}/> Print SF2
              </button>
              <button onClick={() => setShowSF2Modal(false)}
                className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 px-4 py-2 rounded-xl text-sm font-semibold transition">
                <X size={16}/> Close
              </button>
            </div>
          </div>
          <div className="sf2-modal-content bg-white" style={{fontFamily:'Arial, sans-serif'}}>
            <SF2View />
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      {showHolModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
              <Calendar size={18} className="text-amber-400"/> Holidays / Non-School Days
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Declare weekdays that are NOT school days. These are removed from the attendance grid and SF2 school day total.
            </p>
            <div className="space-y-2 mb-4">
              <label className="block text-sm text-gray-400">Date</label>
              <input type="date" value={holInput} onChange={e=>setHolInput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"/>
              <label className="block text-sm text-gray-400">Reason / Description</label>
              <input value={holReason} onChange={e=>setHolReason(e.target.value)}
                placeholder="e.g. Rizal Day, Typhoon Suspension"
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"/>
              <button onClick={addHoliday} disabled={!holInput}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold text-sm transition disabled:opacity-50">
                Add Holiday
              </button>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">
                Declared &mdash; {holidays.length} non-school day{holidays.length!==1?'s':''}
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
                          {new Date(h+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'long',day:'numeric'})}
                        </span>
                      </div>
                      <button onClick={() => removeHoliday(h)}
                        className="text-red-400 hover:text-red-300 text-xs font-semibold transition ml-2">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowHolModal(false)}
              className="w-full py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Student Status Modal */}
      {statusModal && (
        <StudentStatusModal
          student={statusModal}
          onClose={() => setStatusModal(null)}
          onUpdate={updated => setStudents(prev => prev.map(s => s.id===updated.id ? updated : s))}
        />
      )}
    </>
  );
}
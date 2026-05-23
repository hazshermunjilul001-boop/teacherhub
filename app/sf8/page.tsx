'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Printer, RefreshCw, Save, Heart, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ─────────────────────────────────────────────────────────────────────────────
// WHO BMI-FOR-AGE REFERENCE (5–19 years, simplified cutoffs)
// Source: WHO Growth Reference 2007
// ─────────────────────────────────────────────────────────────────────────────

// BMI cutoffs by age in months (simplified to yearly bands)
// Format: [age_years, sex, sw_max, w_max, n_max, ow_max]
// sw = Severely Wasted (<-3SD), w = Wasted (-3 to -2SD),
// n = Normal (-2 to +1SD), ow = Overweight (+1 to +2SD), obese = >+2SD

const BMI_CUTOFFS: Record<string, { sw: number; w: number; n: number; ow: number }> = {
  // Boys (M) — approximate WHO -3SD, -2SD, +1SD, +2SD midpoints
  'M_5':  { sw: 12.1, w: 13.0, n: 18.3, ow: 20.2 },
  'M_6':  { sw: 12.1, w: 13.1, n: 18.5, ow: 20.5 },
  'M_7':  { sw: 12.2, w: 13.1, n: 19.0, ow: 21.0 },
  'M_8':  { sw: 12.2, w: 13.1, n: 19.0, ow: 21.5 },
  'M_9':  { sw: 12.3, w: 13.2, n: 19.5, ow: 22.0 },
  'M_10': { sw: 12.3, w: 13.2, n: 19.6, ow: 22.5 },
  'M_11': { sw: 12.3, w: 13.2, n: 19.6, ow: 22.7 },
  'M_12': { sw: 12.3, w: 13.2, n: 19.7, ow: 22.9 },
  'M_13': { sw: 12.4, w: 13.3, n: 19.9, ow: 23.3 },
  'M_14': { sw: 12.5, w: 13.5, n: 21.0, ow: 24.0 },
  'M_15': { sw: 12.7, w: 13.7, n: 21.5, ow: 24.5 },
  'M_16': { sw: 13.0, w: 14.0, n: 22.0, ow: 25.0 },
  'M_17': { sw: 13.2, w: 14.2, n: 22.5, ow: 25.5 },
  'M_18': { sw: 13.5, w: 14.5, n: 23.0, ow: 26.0 },
  'M_19': { sw: 13.7, w: 14.7, n: 23.5, ow: 26.5 },
  // Girls (F)
  'F_5':  { sw: 11.7, w: 12.6, n: 18.9, ow: 21.2 },
  'F_6':  { sw: 11.7, w: 12.6, n: 19.0, ow: 21.7 },
  'F_7':  { sw: 11.7, w: 12.7, n: 19.5, ow: 22.5 },
  'F_8':  { sw: 11.7, w: 12.7, n: 19.8, ow: 23.0 },
  'F_9':  { sw: 11.7, w: 12.8, n: 20.2, ow: 23.5 },
  'F_10': { sw: 11.8, w: 12.8, n: 20.5, ow: 24.0 },
  'F_11': { sw: 11.8, w: 12.8, n: 20.7, ow: 24.5 },
  'F_12': { sw: 11.8, w: 12.8, n: 20.9, ow: 25.0 },
  'F_13': { sw: 11.9, w: 12.9, n: 21.5, ow: 25.5 },
  'F_14': { sw: 12.0, w: 13.0, n: 22.0, ow: 26.0 },
  'F_15': { sw: 12.1, w: 13.1, n: 22.5, ow: 26.5 },
  'F_16': { sw: 12.3, w: 13.3, n: 23.0, ow: 27.0 },
  'F_17': { sw: 12.5, w: 13.5, n: 23.2, ow: 27.2 },
  'F_18': { sw: 12.7, w: 13.7, n: 23.5, ow: 27.5 },
  'F_19': { sw: 12.9, w: 13.9, n: 23.8, ow: 27.8 },
};

function getNutritionalStatus(bmi: number, ageYears: number, sex: string): string {
  const key = `${sex}_${Math.min(Math.max(ageYears, 5), 19)}`;
  const ref = BMI_CUTOFFS[key];
  if (!ref) return '—';
  if (bmi < ref.sw)  return 'Severely Wasted';
  if (bmi < ref.w)   return 'Wasted';
  if (bmi <= ref.n)  return 'Normal';
  if (bmi <= ref.ow) return 'Overweight';
  return 'Obese';
}

function getNSColor(status: string): string {
  switch (status) {
    case 'Severely Wasted': return 'text-red-500 bg-red-950/40';
    case 'Wasted':          return 'text-orange-400 bg-orange-950/40';
    case 'Normal':          return 'text-emerald-400 bg-emerald-950/40';
    case 'Overweight':      return 'text-yellow-400 bg-yellow-950/40';
    case 'Obese':           return 'text-purple-400 bg-purple-950/40';
    default:                return 'text-gray-400';
  }
}

function getNSPrintBg(status: string): string {
  switch (status) {
    case 'Severely Wasted': return '#fee2e2';
    case 'Wasted':          return '#ffedd5';
    case 'Normal':          return '#dcfce7';
    case 'Overweight':      return '#fef9c3';
    case 'Obese':           return '#f3e8ff';
    default:                return 'white';
  }
}

function calcAge(birthdate: string, referenceDate?: string): number {
  if (!birthdate) return 0;
  const birth = new Date(birthdate);
  const ref   = referenceDate ? new Date(referenceDate) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Student { id: string; lrn: string; full_name: string; sex: string; birthdate?: string; }
interface HealthRecord {
  id:            string;
  student_id:    string;
  period:        'BEY' | 'EEY';   // Beginning / End of Year
  date_measured: string;
  weight_kg:     number;
  height_m:      number;
  bmi:           number;
  ns_status:     string;
  age_at_measure: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SF8Page() {
  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, division, region, schoolYear, adviser, schoolHead } = useActiveSection();
  const [period,   setPeriod]   = useState<'BEY'|'EEY'>('BEY');
  const [students, setStudents] = useState<Student[]>([]);
  const [records,  setRecords]  = useState<Record<string, HealthRecord>>({});
  const [editing,  setEditing]  = useState<Record<string, Partial<HealthRecord>>>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string|null>(null);
  const [dateRef,  setDateRef]  = useState(new Date().toISOString().split('T')[0]);
  const [view,     setView]     = useState<'encode'|'sf8'>('encode');

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('students').select('*').eq('section_id', sectionId).order('full_name');
      setStudents(data ?? []);
      setLoading(false);
    })();
  }, [sectionId]);

  // ── Load health records ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('health_records')
        .select('*')
        .eq('section_id', sectionId)
        .eq('period', period);
      const map: Record<string, HealthRecord> = {};
      data?.forEach((r: any) => { map[r.student_id] = r; });
      setRecords(map);
      setEditing({});
    })();
  }, [sectionId, period]);

  // ── Handle input change ────────────────────────────────────────────────────
  const handleChange = (sid: string, field: string, val: string) => {
    setEditing(prev => {
      const cur = { ...(prev[sid] ?? records[sid] ?? {}) };
      (cur as any)[field] = val;
      // Auto-compute BMI when weight + height both present
      const w = parseFloat(field === 'weight_kg' ? val : String(cur.weight_kg ?? ''));
      const h = parseFloat(field === 'height_m'  ? val : String(cur.height_m  ?? ''));
      if (w > 0 && h > 0) {
        cur.bmi = parseFloat((w / (h * h)).toFixed(2));
        const student = students.find(s => s.id === sid);
        const age = calcAge(student?.birthdate ?? '', cur.date_measured as string || dateRef);
        cur.age_at_measure = age;
        cur.ns_status = getNutritionalStatus(cur.bmi, age, student?.sex ?? 'M');
      }
      return { ...prev, [sid]: cur };
    });
  };

  // ── Save record ────────────────────────────────────────────────────────────
  const saveRecord = async (sid: string) => {
    const data = editing[sid];
    if (!data) return;
    setSaving(sid);
    const student  = students.find(s => s.id === sid);
    const payload  = {
      student_id:     sid,
      section_id:     sectionId,
      period,
      school_year:    schoolYear,
      date_measured:  data.date_measured || dateRef,
      weight_kg:      parseFloat(String(data.weight_kg ?? 0)),
      height_m:       parseFloat(String(data.height_m  ?? 0)),
      bmi:            data.bmi ?? 0,
      ns_status:      data.ns_status ?? '—',
      age_at_measure: data.age_at_measure ?? calcAge(student?.birthdate ?? ''),
    };
    const { data: saved, error } = await supabase
      .from('health_records')
      .upsert(payload, { onConflict: 'student_id,period,school_year' })
      .select().single();
    if (!error && saved) {
      setRecords(prev => ({ ...prev, [sid]: saved }));
      setEditing(prev => { const n = { ...prev }; delete n[sid]; return n; });
    }
    setSaving(null);
  };

  const getVal = (sid: string, field: string) => {
    const e = editing[sid];
    const r = records[sid];
    return (e ? (e as any)[field] : (r as any)?.[field]) ?? '';
  };

  const getBMI    = (sid: string) => getVal(sid, 'bmi');
  const getNS     = (sid: string) => {
    if (editing[sid]) return editing[sid].ns_status ?? '—';
    return records[sid]?.ns_status ?? '—';
  };

  // Summary stats
  const allNS = students.map(s => getNS(s.id)).filter(s => s !== '—');
  const countNS = (label: string) => allNS.filter(s => s === label).length;

  const males   = students.filter(s => s.sex === 'M');
  const females = students.filter(s => s.sex === 'F');

  // ─────────────────────────────────────────────────────────────────────────
  // SF8 PRINT VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const SF8PrintView = () => (
    <div className="bg-white text-black p-4 font-sans" style={{fontSize:'9px', minWidth:'900px'}}>
      {/* Title */}
      <div className="text-center mb-2">
        <div className="text-xs font-bold">SF 8</div>
        <div className="font-bold text-sm">Department of Education</div>
        <div className="font-bold">School Form 8 Learner's Basic Health and Nutrition Report (SF8)</div>
        <div>(For All Grade Levels)</div>
      </div>

      {/* Header info */}
      <table className="w-full border-collapse mb-1" style={{fontSize:'8px'}}>
        <tbody>
          <tr>
            <td className="border border-black px-1 py-0.5"><strong>School Name:</strong> {schoolName}</td>
            <td className="border border-black px-1 py-0.5"><strong>District:</strong></td>
            <td className="border border-black px-1 py-0.5"><strong>Division:</strong> {division}</td>
            <td className="border border-black px-1 py-0.5"><strong>Region:</strong> {region}</td>
          </tr>
          <tr>
            <td className="border border-black px-1 py-0.5"><strong>School ID:</strong> {schoolId}</td>
            <td className="border border-black px-1 py-0.5"><strong>Grade:</strong> {gradeLevel}</td>
            <td className="border border-black px-1 py-0.5"><strong>Section:</strong> {sectionName}</td>
            <td className="border border-black px-1 py-0.5"><strong>School Year:</strong> {schoolYear}</td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black px-1 py-0.5">
              <strong>Period:</strong> {period === 'BEY' ? 'Beginning of Year (BEY)' : 'End of Year (EEY)'}
            </td>
            <td colSpan={2} className="border border-black px-1 py-0.5">
              <strong>Date of Weighing:</strong> {dateRef}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Main table */}
      <table className="w-full border-collapse" style={{fontSize:'8px'}}>
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-0.5 py-1" rowSpan={2}>No.</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>LRN</th>
            <th className="border border-black px-1 py-1 text-left" rowSpan={2} style={{minWidth:'140px'}}>
              Learner's Name<br/>(Last Name, First Name, M.I.)
            </th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Birthdate</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Age</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Weight (kg)</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Height (m)</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Height² (m²)</th>
            <th className="border border-black text-center px-1 py-1" colSpan={2}>Nutritional Status</th>
            <th className="border border-black px-1 py-1" rowSpan={2}>Remarks</th>
          </tr>
          <tr className="bg-gray-50">
            <th className="border border-black px-1 py-0.5" style={{fontSize:'7px'}}>BMI (kg/m²)</th>
            <th className="border border-black px-1 py-0.5" style={{fontSize:'7px'}}>BMI Category</th>
          </tr>
        </thead>
        <tbody>
          {/* MALE */}
          <tr>
            <td colSpan={11} className="border border-black px-1 py-0.5 font-bold bg-blue-50">MALE</td>
          </tr>
          {males.map((student, idx) => {
            const r   = records[student.id];
            const bmi = r?.bmi ?? 0;
            const ns  = r?.ns_status ?? '—';
            const h   = r?.height_m ?? 0;
            return (
              <tr key={student.id}>
                <td className="border border-black text-center">{idx+1}</td>
                <td className="border border-black px-1" style={{fontSize:'7px'}}>{student.lrn}</td>
                <td className="border border-black px-1">{student.full_name}</td>
                <td className="border border-black text-center px-1">{student.birthdate ?? ''}</td>
                <td className="border border-black text-center">{r?.age_at_measure ?? ''}</td>
                <td className="border border-black text-center">{r?.weight_kg ?? ''}</td>
                <td className="border border-black text-center">{r?.height_m ?? ''}</td>
                <td className="border border-black text-center">{h > 0 ? (h*h).toFixed(4) : ''}</td>
                <td className="border border-black text-center font-bold">{bmi > 0 ? bmi.toFixed(2) : ''}</td>
                <td className="border border-black text-center font-bold px-1"
                  style={{background: ns !== '—' ? getNSPrintBg(ns) : 'white', fontSize:'7px'}}>
                  {ns !== '—' ? ns : ''}
                </td>
                <td className="border border-black px-1"></td>
              </tr>
            );
          })}

          {/* FEMALE */}
          <tr>
            <td colSpan={11} className="border border-black px-1 py-0.5 font-bold bg-pink-50">FEMALE</td>
          </tr>
          {females.map((student, idx) => {
            const r   = records[student.id];
            const bmi = r?.bmi ?? 0;
            const ns  = r?.ns_status ?? '—';
            const h   = r?.height_m ?? 0;
            return (
              <tr key={student.id}>
                <td className="border border-black text-center">{idx+1}</td>
                <td className="border border-black px-1" style={{fontSize:'7px'}}>{student.lrn}</td>
                <td className="border border-black px-1">{student.full_name}</td>
                <td className="border border-black text-center px-1">{student.birthdate ?? ''}</td>
                <td className="border border-black text-center">{r?.age_at_measure ?? ''}</td>
                <td className="border border-black text-center">{r?.weight_kg ?? ''}</td>
                <td className="border border-black text-center">{r?.height_m ?? ''}</td>
                <td className="border border-black text-center">{h > 0 ? (h*h).toFixed(4) : ''}</td>
                <td className="border border-black text-center font-bold">{bmi > 0 ? bmi.toFixed(2) : ''}</td>
                <td className="border border-black text-center font-bold px-1"
                  style={{background: ns !== '—' ? getNSPrintBg(ns) : 'white', fontSize:'7px'}}>
                  {ns !== '—' ? ns : ''}
                </td>
                <td className="border border-black px-1"></td>
              </tr>
            );
          })}

          {/* Summary */}
          <tr className="bg-gray-100 font-bold">
            <td colSpan={4} className="border border-black px-1 py-1">NUTRITIONAL STATUS SUMMARY</td>
            <td colSpan={2} className="border border-black text-center px-1">Severely Wasted: {countNS('Severely Wasted')}</td>
            <td colSpan={2} className="border border-black text-center px-1">Wasted: {countNS('Wasted')}</td>
            <td className="border border-black text-center">Normal: {countNS('Normal')}</td>
            <td className="border border-black text-center">Overweight: {countNS('Overweight')}</td>
            <td className="border border-black text-center">Obese: {countNS('Obese')}</td>
          </tr>
        </tbody>
      </table>

      {/* Signatures */}
      <div className="flex justify-between mt-4" style={{fontSize:'8px'}}>
        <div className="text-center">
          <div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>
            {adviser}<br/>Adviser / Class Teacher
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>
            School Nurse / Health Coordinator
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>
            {schoolHead || 'School Head'}
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: landscape; margin: 8mm; }
          .sf8-screen-wrapper { display: none !important; }
          .sf8-print-only { display: block !important; }
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
              <h1 className="text-2xl font-bold">Health & Nutrition (SF8)</h1>
              <p className="text-gray-400 text-sm">{sectionName} · {gradeLevel} · {schoolYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Period toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              {(['BEY','EEY'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-5 py-2 text-sm font-medium transition ${period===p?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                  {p === 'BEY' ? '📅 Beginning of Year' : '📅 End of Year'}
                </button>
              ))}
            </div>
            {/* View toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              <button onClick={() => setView('encode')} className={`px-4 py-2 text-sm font-medium transition ${view==='encode'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>📝 Encode</button>
              <button onClick={() => setView('sf8')}   className={`px-4 py-2 text-sm font-medium transition ${view==='sf8'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>📄 SF8 Form</button>
            </div>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Printer size={16}/>Print SF8
            </button>
          </div>
        </div>

        {/* Reference date */}
        <div className="no-print px-6 py-3 bg-gray-900/50 border-b border-gray-800 flex items-center gap-4">
          <label className="text-sm text-gray-400">Date of Weighing:</label>
          <input type="date" value={dateRef} onChange={e => setDateRef(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"/>
          <p className="text-gray-500 text-xs">Ages and BMI categories are computed relative to this date.</p>

          {/* NS summary chips */}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {['Severely Wasted','Wasted','Normal','Overweight','Obese'].map(ns => {
              const count = countNS(ns);
              if (!count) return null;
              return (
                <span key={ns} className={`px-3 py-1 rounded-xl text-xs font-semibold ${getNSColor(ns)}`}>
                  {ns}: {count}
                </span>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/>Loading…
          </div>
        ) : (
          <div className={view === 'sf8' ? 'bg-white p-4' : 'p-6'}>
            {view === 'encode' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0" style={{minWidth:'900px'}}>
                  <thead>
                    <tr>
                      <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl min-w-[210px] sticky left-0 z-10">#  Learner's Name</th>
                      <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700">Age</th>
                      <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700">Date Measured</th>
                      <th className="bg-blue-900 text-center px-3 py-3 border-l border-gray-700">Weight (kg)</th>
                      <th className="bg-blue-900 text-center px-3 py-3 border-l border-gray-700">Height (m)</th>
                      <th className="bg-purple-900 text-center px-3 py-3 border-l border-gray-700">BMI</th>
                      <th className="bg-emerald-900 text-center px-3 py-3 border-l border-gray-700 min-w-[160px]">Nutritional Status</th>
                      <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700 rounded-tr-xl">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* MALE */}
                    <tr><td colSpan={8} className="bg-blue-950/50 px-3 py-1.5 text-blue-400 font-semibold text-xs">MALE ({males.length})</td></tr>
                    {males.map((student, idx) => {
                      const isDirty = !!editing[student.id];
                      const ns      = getNS(student.id);
                      const age     = editing[student.id]?.age_at_measure ?? records[student.id]?.age_at_measure ?? calcAge(student.birthdate ?? '', dateRef);
                      return (
                        <tr key={student.id} className="border-t border-gray-800 hover:bg-gray-900/40">
                          <td className="px-3 py-2 sticky left-0 bg-gray-950 border-r border-gray-800 z-10">
                            <div className="text-sm font-medium text-white">{idx+1}. {student.full_name}</div>
                            <div className="text-xs text-gray-600">{student.lrn}</div>
                          </td>
                          <td className="text-center border-l border-gray-800 text-gray-400 text-xs">{age || '—'}</td>
                          <td className="px-1 border-l border-gray-800">
                            <input type="date" value={getVal(student.id,'date_measured') || dateRef}
                              onChange={e => handleChange(student.id,'date_measured',e.target.value)}
                              className="w-full bg-transparent border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"/>
                          </td>
                          <td className="px-1 border-l border-gray-800">
                            <input type="number" step="0.1" min="0" placeholder="e.g. 45.5"
                              value={getVal(student.id,'weight_kg')}
                              onChange={e => handleChange(student.id,'weight_kg',e.target.value)}
                              className="w-24 text-center bg-transparent border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"/>
                          </td>
                          <td className="px-1 border-l border-gray-800">
                            <input type="number" step="0.01" min="0" placeholder="e.g. 1.52"
                              value={getVal(student.id,'height_m')}
                              onChange={e => handleChange(student.id,'height_m',e.target.value)}
                              className="w-24 text-center bg-transparent border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"/>
                          </td>
                          <td className="text-center border-l border-gray-800 font-bold font-mono text-purple-300">
                            {getBMI(student.id) ? Number(getBMI(student.id)).toFixed(2) : '—'}
                          </td>
                          <td className="text-center border-l border-gray-800 px-2">
                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${getNSColor(ns)}`}>{ns}</span>
                          </td>
                          <td className="text-center border-l border-gray-800 px-2">
                            {isDirty && (
                              <button onClick={() => saveRecord(student.id)}
                                disabled={saving === student.id}
                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition mx-auto">
                                {saving === student.id ? <RefreshCw size={12} className="animate-spin"/> : <Save size={12}/>}
                                Save
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* FEMALE */}
                    <tr><td colSpan={8} className="bg-pink-950/50 px-3 py-1.5 text-pink-400 font-semibold text-xs">FEMALE ({females.length})</td></tr>
                    {females.map((student, idx) => {
                      const isDirty = !!editing[student.id];
                      const ns      = getNS(student.id);
                      const age     = editing[student.id]?.age_at_measure ?? records[student.id]?.age_at_measure ?? calcAge(student.birthdate ?? '', dateRef);
                      return (
                        <tr key={student.id} className="border-t border-gray-800 hover:bg-gray-900/40">
                          <td className="px-3 py-2 sticky left-0 bg-gray-950 border-r border-gray-800 z-10">
                            <div className="text-sm font-medium text-white">{idx+1}. {student.full_name}</div>
                            <div className="text-xs text-gray-600">{student.lrn}</div>
                          </td>
                          <td className="text-center border-l border-gray-800 text-gray-400 text-xs">{age || '—'}</td>
                          <td className="px-1 border-l border-gray-800">
                            <input type="date" value={getVal(student.id,'date_measured') || dateRef}
                              onChange={e => handleChange(student.id,'date_measured',e.target.value)}
                              className="w-full bg-transparent border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"/>
                          </td>
                          <td className="px-1 border-l border-gray-800">
                            <input type="number" step="0.1" min="0" placeholder="e.g. 45.5"
                              value={getVal(student.id,'weight_kg')}
                              onChange={e => handleChange(student.id,'weight_kg',e.target.value)}
                              className="w-24 text-center bg-transparent border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"/>
                          </td>
                          <td className="px-1 border-l border-gray-800">
                            <input type="number" step="0.01" min="0" placeholder="e.g. 1.52"
                              value={getVal(student.id,'height_m')}
                              onChange={e => handleChange(student.id,'height_m',e.target.value)}
                              className="w-24 text-center bg-transparent border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"/>
                          </td>
                          <td className="text-center border-l border-gray-800 font-bold font-mono text-purple-300">
                            {getBMI(student.id) ? Number(getBMI(student.id)).toFixed(2) : '—'}
                          </td>
                          <td className="text-center border-l border-gray-800 px-2">
                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${getNSColor(ns)}`}>{ns}</span>
                          </td>
                          <td className="text-center border-l border-gray-800 px-2">
                            {isDirty && (
                              <button onClick={() => saveRecord(student.id)}
                                disabled={saving === student.id}
                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition mx-auto">
                                {saving === student.id ? <RefreshCw size={12} className="animate-spin"/> : <Save size={12}/>}
                                Save
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {view === 'sf8' && (
              <div className="sf8-screen-wrapper bg-white rounded-2xl overflow-hidden shadow-2xl">
                <SF8PrintView/>
              </div>
            )}
          </div>
        )}

        {/* Print only — always rendered, hidden on screen, visible on print */}
        <div className="sf8-print-only" style={{display:'none'}}>
          <SF8PrintView/>
        </div>
      </div>
    </>
  );
}
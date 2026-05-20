'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Printer, Users, RefreshCw, FileText, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

const SUBJECTS_JHS = [
  'Filipino', 'English', 'Mathematics', 'Science',
  'Araling Panlipunan (AP)', 'Edukasyon sa Pagpapakatao (EsP)',
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
  'MAPEH - Music', 'MAPEH - Arts', 'MAPEH - Physical Education', 'MAPEH - Health',
];
const SUBJECTS_SHS = [
  'SHS Core Subject', 'SHS Applied Track', 'SHS Specialized Subject',
  'SHS Work Immersion', 'SHS Research / Capstone',
];

const SUBJECT_WEIGHTS: Record<string, { ww: number; pt: number; ta: number }> = {
  'Filipino':                                       { ww: 0.25, pt: 0.50, ta: 0.25 },
  'English':                                        { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Mathematics':                                    { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Science':                                        { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Araling Panlipunan (AP)':                        { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Edukasyon sa Pagpapakatao (EsP)':                { ww: 0.25, pt: 0.50, ta: 0.25 },
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)':   { ww: 0.20, pt: 0.60, ta: 0.20 },
  'MAPEH - Music':                                  { ww: 0.20, pt: 0.60, ta: 0.20 },
  'MAPEH - Arts':                                   { ww: 0.20, pt: 0.60, ta: 0.20 },
  'MAPEH - Physical Education':                     { ww: 0.20, pt: 0.60, ta: 0.20 },
  'MAPEH - Health':                                 { ww: 0.20, pt: 0.60, ta: 0.20 },
  'SHS Core Subject':                               { ww: 0.25, pt: 0.50, ta: 0.25 },
  'SHS Applied Track':                              { ww: 0.20, pt: 0.60, ta: 0.20 },
  'SHS Specialized Subject':                        { ww: 0.20, pt: 0.60, ta: 0.20 },
  'SHS Work Immersion':                             { ww: 0.20, pt: 0.80, ta: 0.00 },
  'SHS Research / Capstone':                        { ww: 0.40, pt: 0.60, ta: 0.00 },
};

const TRANSMUTATION = [
  { min: 99.50, max: 100,   trans: 100 }, { min: 97.50, max: 99.49, trans: 99 },
  { min: 96.00, max: 97.49, trans: 98  }, { min: 95.00, max: 95.99, trans: 97 },
  { min: 94.00, max: 94.99, trans: 96  }, { min: 93.00, max: 93.99, trans: 95 },
  { min: 92.00, max: 92.99, trans: 94  }, { min: 91.00, max: 91.99, trans: 93 },
  { min: 90.00, max: 90.99, trans: 92  }, { min: 89.00, max: 89.99, trans: 91 },
  { min: 88.00, max: 88.99, trans: 90  }, { min: 87.00, max: 87.99, trans: 89 },
  { min: 86.00, max: 86.99, trans: 88  }, { min: 85.00, max: 85.99, trans: 87 },
  { min: 84.00, max: 84.99, trans: 86  }, { min: 83.00, max: 83.99, trans: 85 },
  { min: 82.00, max: 82.99, trans: 84  }, { min: 81.00, max: 81.99, trans: 83 },
  { min: 80.00, max: 80.99, trans: 82  }, { min: 79.00, max: 79.99, trans: 81 },
  { min: 78.00, max: 78.99, trans: 80  }, { min: 77.00, max: 77.99, trans: 79 },
  { min: 76.00, max: 76.99, trans: 78  }, { min: 75.00, max: 75.75, trans: 77 },
  { min: 73.00, max: 74.99, trans: 76  }, { min: 70.00, max: 72.99, trans: 75 },
  { min: 68.00, max: 69.99, trans: 74  }, { min: 66.00, max: 67.99, trans: 73 },
  { min: 64.00, max: 65.99, trans: 72  }, { min: 62.00, max: 63.99, trans: 71 },
  { min: 60.00, max: 61.99, trans: 70  }, { min: 58.00, max: 59.99, trans: 69 },
  { min: 56.00, max: 57.99, trans: 68  }, { min: 54.00, max: 55.99, trans: 67 },
  { min: 52.00, max: 53.99, trans: 66  }, { min: 50.00, max: 51.99, trans: 65 },
  { min: 48.00, max: 49.99, trans: 64  }, { min: 46.00, max: 47.99, trans: 63 },
  { min: 43.00, max: 45.99, trans: 62  }, { min: 40.00, max: 42.99, trans: 61 },
  { min: 0,     max: 39.99, trans: 60  },
];

const transmute = (v: number) => TRANSMUTATION.find(t => v >= t.min && v <= t.max)?.trans ?? 60;
const descriptor = (g: number) => {
  if (g >= 90) return { label: 'Advancing (Namumukod-tangi)', short: 'Advancing',   color: 'text-emerald-400' };
  if (g >= 80) return { label: 'Benchmarking (Napamamalas)',  short: 'Benchmarking', color: 'text-green-400'   };
  if (g >= 75) return { label: 'Connecting (Natutungo)',      short: 'Connecting',   color: 'text-blue-400'    };
  if (g <= 74) return { label: 'Developing (Napauunlad)',     short: 'Developing',   color: 'text-yellow-400'  };
  return              { label: 'Emerging (Nasisimula)',       short: 'Emerging',     color: 'text-red-400'     };
};
const calcAvg = (scores: number[], highs: number[]) => {
  let tot = 0, cnt = 0;
  scores.forEach((s, i) => { if (highs[i] > 0) { tot += (s / highs[i]) * 100; cnt++; } });
  return cnt > 0 ? tot / cnt : 0;
};

type StudentStatus = 'active' | 'dropped' | 'transferred';
interface Student { id: string; lrn: string; full_name: string; sex?: string; status?: StudentStatus; status_date?: string; status_reason?: string; }
interface Highest { ww: number[]; pt: number[]; st: number[]; te: number; }
interface Scores  { ww: Record<number,number>; pt: Record<number,number>; st: Record<number,number>; te: number; }
interface TermData { scores: Record<string, Scores>; highest: Highest; }

// ── STUDENT STATUS MODAL ──────────────────────────────────────────────────────
function StudentStatusModal({ student, onClose, onUpdate }: {
  student: Student;
  onClose: () => void;
  onUpdate: (updated: Student) => void;
}) {
  const current = student.status || 'active';
  const [status, setStatus] = useState<StudentStatus>(current);
  const [date, setDate] = useState(student.status_date || new Date().toISOString().slice(0,10));
  const [reason, setReason] = useState(student.status_reason || '');
  const [saving, setSaving] = useState(false);

  const statusConfig = {
    active:      { label: 'Active',      bg: 'bg-emerald-600', ring: 'ring-emerald-500', icon: '✓', desc: 'Student is currently enrolled and attending.' },
    dropped:     { label: 'Dropped',     bg: 'bg-red-600',     ring: 'ring-red-500',     icon: '✕', desc: 'Student stopped schooling / out-of-school youth.' },
    transferred: { label: 'Transferred', bg: 'bg-amber-500',   ring: 'ring-amber-400',   icon: '→', desc: 'Student transferred to another school.' },
  };

  const save = async () => {
    setSaving(true);
    const updates = { status, status_date: status === 'active' ? undefined : date, status_reason: status === 'active' ? undefined : reason.trim() || undefined };
    const { error } = await supabase.from('students').update(updates).eq('id', student.id);
    if (error) { alert('Error: ' + error.message); setSaving(false); return; }
    onUpdate({ ...student, ...updates });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-white">{student.full_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">LRN: {student.lrn} · {student.sex === 'M' ? 'Male' : 'Female'}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition"><X size={20}/></button>
        </div>

        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">Learner Status</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {(['active','dropped','transferred'] as StudentStatus[]).map(s => {
            const c = statusConfig[s];
            const active = status === s;
            return (
              <button key={s} onClick={() => setStatus(s)}
                className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl border-2 transition-all ${active ? `${c.bg} border-transparent text-white` : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}>
                <span className="text-xl font-bold">{c.icon}</span>
                <span className="text-xs font-semibold">{c.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mb-4">{statusConfig[status].desc}</p>

        {status !== 'active' && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Effectivity Date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Reason <span className="text-gray-600">(optional)</span></label>
              <input value={reason} onChange={e=>setReason(e.target.value)} placeholder={status==='dropped'?'e.g. Health reasons, work, etc.':'e.g. Transferred to ABC School'}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm"/>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">Cancel</button>
          <button onClick={save} disabled={saving}
            className={`flex-1 py-2.5 rounded-xl font-semibold transition text-sm disabled:opacity-60 ${statusConfig[status].bg} text-white hover:opacity-90`}>
            {saving ? 'Saving...' : 'Save Status'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddStudentModal({ onClose, onAdd, sectionId }:
  { onClose:()=>void; onAdd:(s:Student)=>void; sectionId:string }) {
  const [lrn,setLrn]=useState(''); const [name,setName]=useState('');
  const [sex,setSex]=useState('M'); const [saving,setSaving]=useState(false);
  const save = async () => {
    if (!name.trim()) return; setSaving(true);
    const s={id:crypto.randomUUID(),lrn:lrn.trim(),full_name:name.trim().toUpperCase(),sex,section_id:sectionId};
    const {error}=await supabase.from('students').insert(s);
    if (!error){onAdd(s);onClose();}else alert('Error: '+error.message);
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md border border-gray-700">
        <h3 className="text-xl font-bold mb-6">Add New Learner</h3>
        <div className="space-y-4">
          <div><label className="block text-sm text-gray-400 mb-1">LRN (12 digits)</label>
            <input value={lrn} onChange={e=>setLrn(e.target.value)} maxLength={12}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white" placeholder="129694170087"/></div>
          <div><label className="block text-sm text-gray-400 mb-1">Full Name (Last, First MI.)</label>
            <input value={name} onChange={e=>setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white" placeholder="ALVAREZ, ZEV C."/></div>
          <div><label className="block text-sm text-gray-400 mb-1">Sex</label>
            <select value={sex} onChange={e=>setSex(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white">
              <option value="M">Male</option><option value="F">Female</option></select></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition disabled:opacity-60">
            {saving ? 'Saving...' : 'Add Learner'}</button>
        </div>
      </div>
    </div>
  );
}

// ── E-CLASS RECORD PRINT VIEW ─────────────────────────────────────────────────
function EClassRecordView({
  students, subject, sectionName, gradeLevel, schoolName, schoolId,
  schoolYear, division, region, adviser, allTermData, onClose,
}: {
  students: Student[];
  subject: string;
  sectionName: string; gradeLevel: string; schoolName: string;
  schoolId: string; schoolYear: string; division: string;
  region: string; adviser: string;
  allTermData: Record<number, TermData>;
  onClose: () => void;
}) {
  const weights = SUBJECT_WEIGHTS[subject] ?? { ww: 0.25, pt: 0.50, ta: 0.25 };
  const hasTA = (weights.ta ?? 0) > 0;

  const computeTerm = (sid: string, termNum: number) => {
    const td = allTermData[termNum];
    if (!td) return { transmuted: 0, initial: 0 };
    const s = td.scores[sid] || { ww: {}, pt: {}, st: {}, te: 0 };
    const ww = Array.from({ length: 5 }, (_, i) => s.ww?.[i] ?? 0);
    const pt = Array.from({ length: 3 }, (_, i) => s.pt?.[i] ?? 0);
    const st = Array.from({ length: 2 }, (_, i) => s.st?.[i] ?? 0);
    const te = s.te ?? 0;
    const avgWW = calcAvg(ww, td.highest.ww);
    const avgPT = calcAvg(pt, td.highest.pt);
    const avgTA = calcAvg([...st, te], [...td.highest.st, td.highest.te]);
    const initial = avgWW * weights.ww + avgPT * weights.pt + avgTA * (weights.ta ?? 0.25);
    return { transmuted: transmute(initial), initial, ww, pt, st, te, avgWW, avgPT, avgTA };
  };

  const td = { border: '1px solid #666', padding: '2px 4px', fontSize: '8px', textAlign: 'center' as const };
  const th = { ...td, background: '#e8e8e8', fontWeight: 'bold' as const };
  const males   = students.filter(s => s.sex === 'M');
  const females = students.filter(s => s.sex === 'F');

  const renderTermTable = (termNum: number) => {
    const termData = allTermData[termNum];
    if (!termData) return <div style={{ fontSize: '9px', color: '#999', padding: '4px' }}>No data for Term {termNum}</div>;
    const { highest } = termData;

    const renderGroup = (group: Student[], label: string) => (
      <>
        <tr>
          <td colSpan={hasTA ? 20 : 16} style={{ ...td, background: label === 'MALE' ? '#dbeafe' : '#fce7f3', fontWeight: 'bold', textAlign: 'left' }}>
            {label}
          </td>
        </tr>
        {group.map((student, idx) => {
          const c = computeTerm(student.id, termNum) as any;
          const desc = descriptor(c.transmuted);
          return (
            <tr key={student.id} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
              <td style={td}>{idx + 1}</td>
              <td style={{ ...td, textAlign: 'left', minWidth: '140px' }}>{student.full_name}</td>
              {(c.ww || [0,0,0,0,0]).map((v: number, i: number) => <td key={i} style={td}>{v || ''}</td>)}
              <td style={{ ...td, background: '#dbeafe' }}>{c.avgWW?.toFixed(1) || ''}</td>
              {(c.pt || [0,0,0]).map((v: number, i: number) => <td key={i} style={td}>{v || ''}</td>)}
              <td style={{ ...td, background: '#ede9fe' }}>{c.avgPT?.toFixed(1) || ''}</td>
              {hasTA && <>
                {(c.st || [0,0]).map((v: number, i: number) => <td key={i} style={td}>{v || ''}</td>)}
                <td style={td}>{c.te || ''}</td>
                <td style={{ ...td, background: '#fef3c7' }}>{c.avgTA?.toFixed(1) || ''}</td>
              </>}
              <td style={{ ...td, background: '#f0fdf4' }}>{c.initial?.toFixed(2) || ''}</td>
              <td style={{ ...td, fontWeight: 'bold', fontSize: '9px', color: c.transmuted >= 75 ? '#166534' : '#991b1b' }}>{c.transmuted || ''}</td>
              <td style={{ ...td, fontSize: '7px' }}>{desc.short}</td>
            </tr>
          );
        })}
      </>
    );

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginBottom: '4px' }}>
        <thead>
          <tr>
            <th style={th} rowSpan={2}>#</th>
            <th style={{ ...th, textAlign: 'left' }} rowSpan={2}>LEARNERS' NAMES</th>
            <th style={th} colSpan={5}>WRITTEN / ORAL WORKS ({(weights.ww * 100).toFixed(0)}%)</th>
            <th style={{ ...th, background: '#dbeafe' }} rowSpan={2}>PS</th>
            <th style={th} colSpan={3}>PRODUCT / PERFORMANCE TASKS ({(weights.pt * 100).toFixed(0)}%)</th>
            <th style={{ ...th, background: '#ede9fe' }} rowSpan={2}>PS</th>
            {hasTA && <>
              <th style={th} colSpan={2}>SUMMATIVE TESTS</th>
              <th style={th}>TERM EXAM</th>
              <th style={{ ...th, background: '#fef3c7' }} rowSpan={2}>TA PS</th>
            </>}
            <th style={{ ...th, background: '#f0fdf4' }} rowSpan={2}>Initial</th>
            <th style={{ ...th, fontWeight: 'bold' }} rowSpan={2}>TG</th>
            <th style={th} rowSpan={2}>Descriptor</th>
          </tr>
          <tr>
            {highest.ww.map((v, i) => <th key={i} style={th}>{v || i + 1}</th>)}
            {highest.pt.map((v, i) => <th key={i} style={th}>{v || i + 1}</th>)}
            {hasTA && <>
              {highest.st.map((v, i) => <th key={i} style={th}>{v || i + 1}</th>)}
              <th style={th}>{highest.te || 100}</th>
            </>}
          </tr>
        </thead>
        <tbody>
          {renderGroup(males, 'MALE')}
          {renderGroup(females, 'FEMALE')}
        </tbody>
      </table>
    );
  };

  const renderSummaryTable = () => {
    const renderGroup = (group: Student[], label: string) => (
      <>
        <tr>
          <td colSpan={8} style={{ ...td, background: label === 'MALE' ? '#dbeafe' : '#fce7f3', fontWeight: 'bold', textAlign: 'left' }}>
            {label}
          </td>
        </tr>
        {group.map((student, idx) => {
          const t1 = computeTerm(student.id, 1);
          const t2 = computeTerm(student.id, 2);
          const t3 = computeTerm(student.id, 3);
          const validTerms = [t1, t2, t3].filter(t => t.transmuted > 0);
          const finalGrade = validTerms.length > 0
            ? Math.round(validTerms.reduce((s, t) => s + t.transmuted, 0) / validTerms.length)
            : 0;
          const desc = descriptor(finalGrade);
          const remarks = finalGrade >= 75 ? 'PASSED' : 'FAILED';
          return (
            <tr key={student.id} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
              <td style={td}>{idx + 1}</td>
              <td style={{ ...td, textAlign: 'left', minWidth: '140px' }}>{student.full_name}</td>
              <td style={td}>{t1.transmuted || ''}</td>
              <td style={td}>{t2.transmuted || ''}</td>
              <td style={td}>{t3.transmuted || ''}</td>
              <td style={{ ...td, fontWeight: 'bold', fontSize: '10px', color: finalGrade >= 75 ? '#166534' : '#991b1b' }}>
                {finalGrade || ''}
              </td>
              <td style={{ ...td, fontSize: '7px' }}>{finalGrade ? desc.short : ''}</td>
              <td style={{ ...td, fontWeight: 'bold', color: remarks === 'PASSED' ? '#166534' : '#991b1b' }}>
                {finalGrade ? remarks : ''}
              </td>
            </tr>
          );
        })}
      </>
    );

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
        <thead>
          <tr>
            <th style={th}>#</th>
            <th style={{ ...th, textAlign: 'left' }}>LEARNERS' NAMES</th>
            <th style={th}>TERM 1</th>
            <th style={th}>TERM 2</th>
            <th style={th}>TERM 3</th>
            <th style={{ ...th, background: '#d1fae5' }}>FINAL GRADE</th>
            <th style={th}>DESCRIPTOR</th>
            <th style={th}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {renderGroup(males, 'MALE')}
          {renderGroup(females, 'FEMALE')}
        </tbody>
      </table>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-auto">
      {/* Toolbar — hidden on print */}
      <div className="no-print sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-blue-400"/>
          <span className="font-semibold">E-Class Record — {subject}</span>
          <span className="text-gray-400 text-sm">{sectionName} · {schoolYear}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Printer size={16}/> Print
          </button>
          <button onClick={onClose}
            className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <X size={16}/> Close
          </button>
        </div>
      </div>

      {/* Print content */}
      <div className="eclass-print bg-white text-black p-4" style={{ minWidth: '1100px', fontFamily: 'Arial, sans-serif' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>CLASS RECORD</div>
          <div style={{ fontSize: '8px', color: '#555' }}>(Waiting for the Official DepEd Order)</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px', fontSize: '8px' }}>
          <tbody>
            <tr>
              <td style={{ ...td, textAlign: 'left' }}><strong>REGION:</strong> {region}</td>
              <td style={{ ...td, textAlign: 'left' }}><strong>DIVISION:</strong> {division}</td>
              <td style={{ ...td, textAlign: 'left' }}><strong>SCHOOL ID:</strong> {schoolId}</td>
              <td style={{ ...td, textAlign: 'left' }}><strong>SCHOOL YEAR:</strong> {schoolYear}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ ...td, textAlign: 'left' }}><strong>SCHOOL NAME:</strong> {schoolName}</td>
              <td style={{ ...td, textAlign: 'left' }}><strong>GRADE & SECTION:</strong> {gradeLevel} — {sectionName}</td>
              <td style={{ ...td, textAlign: 'left' }}><strong>SUBJECT:</strong> {subject}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ ...td, textAlign: 'left' }}><strong>TEACHER:</strong> {adviser?.toUpperCase()}</td>
              <td colSpan={2} style={{ ...td, textAlign: 'left' }}>
                <strong>WEIGHTS:</strong> WW {(weights.ww * 100).toFixed(0)}% | PT {(weights.pt * 100).toFixed(0)}%
                {hasTA ? ` | TA ${((weights.ta ?? 0) * 100).toFixed(0)}%` : ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* TERM 1 */}
        <div style={{ fontWeight: 'bold', fontSize: '9px', background: '#1e3a5f', color: 'white', padding: '3px 6px', marginBottom: '2px', marginTop: '6px' }}>
          TERM 1
        </div>
        {renderTermTable(1)}

        {/* TERM 2 */}
        <div style={{ fontWeight: 'bold', fontSize: '9px', background: '#1e3a5f', color: 'white', padding: '3px 6px', marginBottom: '2px', marginTop: '8px' }}>
          TERM 2
        </div>
        {renderTermTable(2)}

        {/* TERM 3 */}
        <div style={{ fontWeight: 'bold', fontSize: '9px', background: '#1e3a5f', color: 'white', padding: '3px 6px', marginBottom: '2px', marginTop: '8px' }}>
          TERM 3
        </div>
        {renderTermTable(3)}

        {/* SUMMARY OF GRADES */}
        <div style={{ fontWeight: 'bold', fontSize: '9px', background: '#14532d', color: 'white', padding: '3px 6px', marginBottom: '2px', marginTop: '8px' }}>
          SUMMARY OF GRADES
        </div>
        {renderSummaryTable()}

        {/* Signature area */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '8px' }}>
          <div style={{ textAlign: 'center', minWidth: '200px' }}>
            <div style={{ fontWeight: 'bold', borderTop: '1px solid black', paddingTop: '2px', marginTop: '20px' }}>
              {adviser?.toUpperCase()}
            </div>
            <div>Subject Teacher</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '200px' }}>
            <div style={{ borderTop: '1px solid black', paddingTop: '2px', marginTop: '20px' }}>
              ________________________________
            </div>
            <div>School Head</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: '200px' }}>
            <div style={{ borderTop: '1px solid black', paddingTop: '2px', marginTop: '20px' }}>
              ________________________________
            </div>
            <div>Date</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .eclass-print { padding: 4mm; min-width: 100% !important; }
          @page { size: landscape; margin: 6mm; }
        }
      `}</style>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ClassRecord() {
  const [subject,setSubject] = useState('Filipino');
  const [term,setTerm]       = useState(1);
  const [students,setStudents] = useState<Student[]>([]);
  const [scores,setScores]   = useState<Record<string,Scores>>({});
  const [highest,setHighest] = useState<Highest>({ ww:[100,100,100,100,100], pt:[100,100,100], st:[50,50], te:100 });
  const [loading,setLoading] = useState(true);
  const [saving,setSaving]   = useState<string|null>(null);
  const [showAdd,setShowAdd] = useState(false);
  const [showEClass,setShowEClass] = useState(false);
  const [allTermData,setAllTermData] = useState<Record<number, TermData>>({});
  const [loadingEClass,setLoadingEClass] = useState(false);
  const [statusStudent,setStatusStudent] = useState<Student|null>(null);

  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, schoolYear, division, region, adviser } = useActiveSection();
  const weights = SUBJECT_WEIGHTS[subject] ?? { ww:0.25, pt:0.50, ta:0.25 };

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const {data,error}=await supabase.from('students').select('*').eq('section_id',sectionId).order('full_name');
      const sortByGenderThenName = (arr: Student[]) =>
        [...arr].sort((a,b)=>{
          const sexA=a.sex==='M'?0:1, sexB=b.sex==='M'?0:1;
          if(sexA!==sexB) return sexA-sexB;
          return a.full_name.localeCompare(b.full_name);
        });
      if(!error&&data?.length) setStudents(sortByGenderThenName(data));
      else setStudents([
        {id:'1',lrn:'129694170087',full_name:'ALVAREZ, ZEV C.',sex:'M'},
        {id:'2',lrn:'129702120162',full_name:'ARNADO, ERWIN N.',sex:'M'},
        {id:'3',lrn:'129643170074',full_name:'BASTATAS, JERECK A.',sex:'M'},
      ]);
      setLoading(false);
    })();
  },[sectionId]);

  useEffect(()=>{
    (async()=>{
      const {data}=await supabase.from('grades').select('*').eq('subject',subject).eq('term',term);
      if(data){
        const m:Record<string,Scores>={};
        data.forEach((r:any)=>{ m[r.student_id]={ww:r.written_scores||{},pt:r.pt_scores||{},st:r.st_scores||{},te:r.te_score||0}; });
        setScores(m);
        if(data[0]?.highest_ww) setHighest({ww:data[0].highest_ww,pt:data[0].highest_pt,st:data[0].highest_st||[50,50],te:data[0].highest_te||100});
      }
    })();
  },[subject,term]);

  const updateScore = useCallback(async(sid:string, cat:'ww'|'pt'|'st'|'te', idx:number|null, val:number)=>{
    setScores(prev=>{
      const cur=prev[sid]||{ww:{},pt:{},st:{},te:0};
      const next={...prev,[sid]:{...cur,...(cat==='te'?{te:val}:{[cat]:{...(cur[cat as 'ww'|'pt'|'st']),[idx!]:val}})}};
      const s=next[sid]; setSaving(sid);
      supabase.from('grades').upsert({
        student_id:sid,term,subject,
        written_scores:s.ww,pt_scores:s.pt,st_scores:s.st,te_score:s.te,
        highest_ww:highest.ww,highest_pt:highest.pt,highest_st:highest.st,highest_te:highest.te,
      },{onConflict:'student_id,term,subject'}).then(()=>setSaving(null));
      return next;
    });
  },[term,subject,highest]);

  const compute = (sid:string)=>{
    const s=scores[sid]||{ww:{},pt:{},st:{},te:0};
    const ww=Array.from({length:5},(_,i)=>s.ww?.[i]??0);
    const pt=Array.from({length:3},(_,i)=>s.pt?.[i]??0);
    const st=Array.from({length:2},(_,i)=>s.st?.[i]??0);
    const te=s.te??0;
    const avgWW=calcAvg(ww,highest.ww);
    const avgPT=calcAvg(pt,highest.pt);
    const avgTA=calcAvg([...st,te],[...highest.st,highest.te]);
    const initial=avgWW*weights.ww+avgPT*weights.pt+avgTA*(weights.ta??0.25);
    return {ww,pt,st,te,avgWW,avgPT,avgTA,initial,transmuted:transmute(initial)};
  };

  const activeStudents = students.filter(s => !s.status || s.status === 'active');
  const classAvg = activeStudents.length > 0
    ? activeStudents.reduce((s,st)=>s+compute(st.id).transmuted,0)/activeStudents.length : 0;

  const hasTA=(weights.ta??0)>0;

  // Load all 3 terms data for E-Class Record view
  const openEClassRecord = async () => {
    setLoadingEClass(true);
    const termMap: Record<number, TermData> = {};
    for (const t of [1, 2, 3]) {
      const { data } = await supabase.from('grades').select('*').eq('subject', subject).eq('term', t);
      const m: Record<string, Scores> = {};
      let h: Highest = { ww: [100,100,100,100,100], pt: [100,100,100], st: [50,50], te: 100 };
      if (data && data.length > 0) {
        data.forEach((r: any) => {
          m[r.student_id] = { ww: r.written_scores||{}, pt: r.pt_scores||{}, st: r.st_scores||{}, te: r.te_score||0 };
        });
        if (data[0]?.highest_ww) {
          h = { ww: data[0].highest_ww, pt: data[0].highest_pt, st: data[0].highest_st||[50,50], te: data[0].highest_te||100 };
        }
      }
      termMap[t] = { scores: m, highest: h };
    }
    setAllTermData(termMap);
    setLoadingEClass(false);
    setShowEClass(true);
  };

  return (
    <>
      <style>{`@media print{body{background:white!important;color:black!important}.no-print{display:none!important}input{border:none!important;background:transparent!important;color:black!important}table{font-size:8px}}`}</style>
      <div className="min-h-screen bg-gray-950 text-white">

        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={()=>window.history.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400"><ArrowLeft size={22}/></button>
            <div><h1 className="text-2xl font-bold">Class Record</h1><p className="text-gray-400 text-sm">Term {term} · {subject}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gray-800 rounded-xl px-4 py-2 text-sm flex items-center gap-2">
              <Users size={16} className="text-blue-400"/>
              <span className="text-gray-400">{students.length} learners</span>
              <span className="text-gray-600">·</span>
              <span className="font-semibold text-blue-300">Avg: {classAvg.toFixed(0)}</span>
            </div>
            <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-semibold transition"><Plus size={16}/>Add Learner</button>
            <button
              onClick={openEClassRecord}
              disabled={loadingEClass}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60">
              {loadingEClass ? <RefreshCw size={16} className="animate-spin"/> : <FileText size={16}/>}
              E-Class Record
            </button>
            <button onClick={()=>window.print()} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition"><Printer size={16}/>Print</button>
          </div>
        </div>

        {/* Controls */}
        <div className="no-print px-6 py-4 flex flex-wrap gap-3 items-center">
          <select value={subject} onChange={e=>setSubject(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500">
            <optgroup label="Junior High School">{SUBJECTS_JHS.map(s=><option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Senior High School">{SUBJECTS_SHS.map(s=><option key={s}>{s}</option>)}</optgroup>
          </select>

          <div className="flex rounded-xl overflow-hidden border border-gray-700">
            {[1,2,3].map(t=>(
              <button key={t} onClick={()=>setTerm(t)}
                className={`px-7 py-2.5 text-sm font-medium transition ${term===t?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
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

        {/* Table */}
        {loading?(
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400"><RefreshCw size={20} className="animate-spin"/>Loading learners...</div>
        ):(
          <div className="px-6 pb-10 overflow-x-auto">
            <table className="w-full min-w-[1600px] text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl w-8">#</th>
                  <th className="bg-gray-800 text-left px-3 py-3 min-w-[210px]">Learner's Name</th>
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
                  <td className="bg-gray-900 px-3 py-1 italic text-gray-600 text-xs">Highest Possible Score</td>
                  {highest.ww.map((v,i)=>(
                    <td key={i} className="bg-gray-900 px-1 py-1 border-l border-gray-800">
                      <input type="number" value={v||''} onChange={e=>setHighest(p=>({...p,ww:p.ww.map((x,j)=>j===i?+e.target.value:x)}))}
                        className="w-14 text-center bg-gray-800 border border-gray-700 rounded py-1 text-white text-xs"/>
                    </td>
                  ))}
                  <td className="bg-gray-900 border-l border-gray-800 text-center text-gray-600 text-xs py-1">WW PS</td>
                  {highest.pt.map((v,i)=>(
                    <td key={i} className="bg-gray-900 px-1 py-1 border-l border-gray-800">
                      <input type="number" value={v||''} onChange={e=>setHighest(p=>({...p,pt:p.pt.map((x,j)=>j===i?+e.target.value:x)}))}
                        className="w-14 text-center bg-gray-800 border border-gray-700 rounded py-1 text-white text-xs"/>
                    </td>
                  ))}
                  <td className="bg-gray-900 border-l border-gray-800 text-center text-gray-600 text-xs py-1">PT PS</td>
                  {hasTA&&<>
                    {highest.st.map((v,i)=>(
                      <td key={i} className="bg-gray-900 px-1 py-1 border-l border-gray-800">
                        <input type="number" value={v||''} onChange={e=>setHighest(p=>({...p,st:p.st.map((x,j)=>j===i?+e.target.value:x)}))}
                          className="w-14 text-center bg-gray-800 border border-gray-700 rounded py-1 text-white text-xs"/>
                      </td>
                    ))}
                    <td className="bg-gray-900 px-1 py-1 border-l border-gray-800">
                      <input type="number" value={highest.te||''} onChange={e=>setHighest(p=>({...p,te:+e.target.value}))}
                        className="w-14 text-center bg-gray-800 border border-gray-700 rounded py-1 text-white text-xs"/>
                    </td>
                    <td className="bg-gray-900 border-l border-gray-800 text-center text-gray-600 text-xs py-1">TA PS</td>
                  </>}
                  <td colSpan={3} className="bg-gray-900 border-l border-gray-800"></td>
                </tr>
              </thead>
              <tbody>
                {(()=>{
                  const inp=(color:string)=>`w-14 text-center bg-transparent border border-gray-700 hover:border-${color}-600 focus:border-${color}-500 rounded py-2 text-white text-sm outline-none focus:bg-gray-900`;
                  const totalCols = 2 + 5 + 1 + 3 + 1 + (hasTA ? 4 : 0) + 3;
                  const renderGroup = (group: Student[], label: string, bgClass: string) => (
                    <>
                      <tr>
                        <td colSpan={totalCols} className={`px-4 py-1.5 text-xs font-bold tracking-widest uppercase border-t border-gray-700 ${bgClass}`}>
                          {label} ({group.length})
                        </td>
                      </tr>
                      {group.map((student,idx)=>{
                        const {ww,pt,st,te,avgWW,avgPT,avgTA,initial,transmuted}=compute(student.id);
                        const desc=descriptor(transmuted);
                        const isSaving=saving===student.id;
                        const isInactive = student.status === 'dropped' || student.status === 'transferred';
                        const statusTag = student.status === 'dropped'
                          ? <span className="text-[10px] bg-red-900/60 text-red-300 border border-red-700 px-1.5 py-0.5 rounded font-semibold">DROPPED</span>
                          : student.status === 'transferred'
                          ? <span className="text-[10px] bg-amber-900/60 text-amber-300 border border-amber-700 px-1.5 py-0.5 rounded font-semibold">TRANSFERRED</span>
                          : null;
                        return (
                          <tr key={student.id} className={`border-t border-gray-800 transition-colors ${isInactive ? 'opacity-50 bg-gray-900/60' : transmuted<75 ? 'bg-red-950/10 hover:bg-gray-900/50' : 'hover:bg-gray-900/50'}`}>
                            <td className="px-3 py-2 text-center text-gray-500 text-xs">{idx+1}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isSaving&&<RefreshCw size={12} className="animate-spin text-blue-400"/>}
                                <button
                                  onClick={()=>setStatusStudent(student)}
                                  className="text-sm font-medium hover:text-blue-300 hover:underline transition text-left">
                                  {student.full_name}
                                </button>
                                {student.sex&&<span className="text-xs text-gray-600">{student.sex}</span>}
                                {statusTag}
                              </div>
                              <div className="text-xs text-gray-600">{student.lrn}</div>
                              {isInactive && student.status_date && (
                                <div className="text-[10px] text-gray-600 mt-0.5">Since {student.status_date}{student.status_reason ? ` · ${student.status_reason}` : ''}</div>
                              )}
                            </td>
                            {ww.map((v,i)=>(
                              <td key={i} className="px-1 py-1 border-l border-gray-800">
                                <input type="number" min={0} max={highest.ww[i]} value={v||''} disabled={isInactive}
                                  onChange={e=>updateScore(student.id,'ww',i,+e.target.value)} className={inp('blue')}/>
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center text-blue-300 text-xs border-l border-gray-800 font-mono">{avgWW.toFixed(1)}</td>
                            {pt.map((v,i)=>(
                              <td key={i} className="px-1 py-1 border-l border-gray-800">
                                <input type="number" min={0} max={highest.pt[i]} value={v||''} disabled={isInactive}
                                  onChange={e=>updateScore(student.id,'pt',i,+e.target.value)} className={inp('purple')}/>
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center text-purple-300 text-xs border-l border-gray-800 font-mono">{avgPT.toFixed(1)}</td>
                            {hasTA&&<>
                              {st.map((v,i)=>(
                                <td key={i} className="px-1 py-1 border-l border-gray-800">
                                  <input type="number" min={0} max={highest.st[i]} value={v||''} disabled={isInactive}
                                    onChange={e=>updateScore(student.id,'st',i,+e.target.value)} className={inp('amber')}/>
                                </td>
                              ))}
                              <td className="px-1 py-1 border-l border-gray-800">
                                <input type="number" min={0} max={highest.te} value={te||''} disabled={isInactive}
                                  onChange={e=>updateScore(student.id,'te',null,+e.target.value)} className={inp('orange')}/>
                              </td>
                              <td className="px-2 py-2 text-center text-amber-300 text-xs border-l border-gray-800 font-mono">{avgTA.toFixed(1)}</td>
                            </>}
                            <td className="px-3 py-2 text-center text-gray-400 text-xs border-l border-gray-800 font-mono">{isInactive ? '—' : initial.toFixed(2)}</td>
                            <td className={`px-3 py-2 text-center font-bold text-2xl border-l border-gray-800 ${isInactive ? 'text-gray-600' : transmuted>=75?'text-white':'text-red-400'}`}>{isInactive ? '—' : transmuted}</td>
                            <td className={`px-3 py-2 text-center text-xs font-medium border-l border-gray-800 ${isInactive ? 'text-gray-600' : desc.color}`}>{isInactive ? student.status : desc.label}</td>
                          </tr>
                        );
                      })}
                    </>
                  );
                  const males   = students.filter(s=>s.sex==='M');
                  const females = students.filter(s=>s.sex==='F');
                  const others  = students.filter(s=>s.sex!=='M'&&s.sex!=='F');
                  return <>
                    {males.length>0   && renderGroup(males,   'Male',   'bg-blue-950/40 text-blue-300')}
                    {females.length>0 && renderGroup(females, 'Female', 'bg-pink-950/40 text-pink-300')}
                    {others.length>0  && renderGroup(others,  'Other',  'bg-gray-800/60 text-gray-400')}
                  </>;
                })()}
                {students.length>0&&(
                  <tr className="border-t-2 border-gray-700 bg-gray-900">
                    <td></td>
                    <td className="px-3 py-3 font-semibold text-gray-400 text-sm italic">Class Average</td>
                    {Array(5+1+3+1+(hasTA?4:0)+2).fill(null).map((_,i)=><td key={i} className="border-l border-gray-800"></td>)}
                    <td className="px-3 py-3 text-center font-bold text-xl text-yellow-300 border-l border-gray-800">{classAvg.toFixed(0)}</td>
                    <td className="border-l border-gray-800"></td>
                  </tr>
                )}
              </tbody>
            </table>
            {students.length===0&&(
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
          const sexA=a.sex==='M'?0:1, sexB=b.sex==='M'?0:1;
          if(sexA!==sexB) return sexA-sexB;
          return a.full_name.localeCompare(b.full_name);
        }))}/>}

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
          adviser={adviser}
          allTermData={allTermData}
          onClose={() => setShowEClass(false)}
        />
      )}
    </>
  );
}
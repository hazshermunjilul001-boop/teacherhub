'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Printer, Users, RefreshCw, FileText, X, UserX, ArrowRightLeft, UserCheck, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
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
  { min:99.50,max:100,trans:100},{min:97.50,max:99.49,trans:99},{min:96.00,max:97.49,trans:98},
  {min:95.00,max:95.99,trans:97},{min:94.00,max:94.99,trans:96},{min:93.00,max:93.99,trans:95},
  {min:92.00,max:92.99,trans:94},{min:91.00,max:91.99,trans:93},{min:90.00,max:90.99,trans:92},
  {min:89.00,max:89.99,trans:91},{min:88.00,max:88.99,trans:90},{min:87.00,max:87.99,trans:89},
  {min:86.00,max:86.99,trans:88},{min:85.00,max:85.99,trans:87},{min:84.00,max:84.99,trans:86},
  {min:83.00,max:83.99,trans:85},{min:82.00,max:82.99,trans:84},{min:81.00,max:81.99,trans:83},
  {min:80.00,max:80.99,trans:82},{min:79.00,max:79.99,trans:81},{min:78.00,max:78.99,trans:80},
  {min:77.00,max:77.99,trans:79},{min:76.00,max:76.99,trans:78},{min:75.00,max:75.75,trans:77},
  {min:73.00,max:74.99,trans:76},{min:70.00,max:72.99,trans:75},{min:68.00,max:69.99,trans:74},
  {min:66.00,max:67.99,trans:73},{min:64.00,max:65.99,trans:72},{min:62.00,max:63.99,trans:71},
  {min:60.00,max:61.99,trans:70},{min:58.00,max:59.99,trans:69},{min:56.00,max:57.99,trans:68},
  {min:54.00,max:55.99,trans:67},{min:52.00,max:53.99,trans:66},{min:50.00,max:51.99,trans:65},
  {min:48.00,max:49.99,trans:64},{min:46.00,max:47.99,trans:63},{min:43.00,max:45.99,trans:62},
  {min:40.00,max:42.99,trans:61},{min:0,max:39.99,trans:60},
];
const transmute = (v:number) => TRANSMUTATION.find(t=>v>=t.min&&v<=t.max)?.trans ?? 60;
const descriptor = (g:number) => {
  if(g>=90) return {label:'Advancing (Namumukod-tangi)',  short:'Advancing',    color:'text-emerald-400'};
  if(g>=80) return {label:'Benchmarking (Napamamalas)',   short:'Benchmarking', color:'text-green-400'  };
  if(g>=75) return {label:'Connecting (Natutungo)',       short:'Connecting',   color:'text-blue-400'   };
  return         {label:'Developing (Napauunlad)',        short:'Developing',   color:'text-yellow-400' };
};
const calcAvg = (scores:number[], highs:number[]) => {
  let tot=0, cnt=0;
  scores.forEach((s,i)=>{ if(highs[i]>0){tot+=(s/highs[i])*100;cnt++;} });
  return cnt>0?tot/cnt:0;
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
  const [lrn,setLrn]=useState(''); const [name,setName]=useState('');
  const [sex,setSex]=useState('M'); const [saving,setSaving]=useState(false);
  const save = async () => {
    if (!name.trim()) return; setSaving(true);
    const s={id:crypto.randomUUID(),lrn:lrn.trim(),full_name:name.trim().toUpperCase(),sex,section_id:sectionId,status:'active' as StudentStatus};
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
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white" placeholder="DELA CRUZ, JUAN P."/></div>
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
  schoolYear, division, region, adviser, allTermData, onClose,
}: {
  students: Student[]; subject: string;
  sectionName: string; gradeLevel: string; schoolName: string;
  schoolId: string; schoolYear: string; division: string;
  region: string; adviser: string;
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
    const s = td.scores[sid] || { ww:{}, pt:{}, st:{}, te:0 };
    const ww = Array.from({length:5},(_,i)=>s.ww?.[i]??0);
    const pt = Array.from({length:3},(_,i)=>s.pt?.[i]??0);
    const st = Array.from({length:2},(_,i)=>s.st?.[i]??0);
    const te = s.te ?? 0;
    const avgWW = calcAvg(ww, td.highest.ww);
    const avgPT = calcAvg(pt, td.highest.pt);
    const avgTA = calcAvg([...st,te], [...td.highest.st, td.highest.te]);
    const initial = avgWW*weights.ww + avgPT*weights.pt + avgTA*(weights.ta??0.25);
    return transmute(initial);
  };

  const td = { border:'1px solid #999', padding:'2px 6px', fontSize:'9px', textAlign:'center' as const };
  const th = { ...td, background:'#e8e8e8', fontWeight:'bold' as const };

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
            <td style={{...td, fontSize:'8px'}}>{final ? desc : ''}</td>
            <td style={{...td, fontWeight:'bold', color:final>=75?'#166534':'#991b1b'}}>{remarks}</td>
          </tr>
        );
      })}
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-auto">
      <div className="no-print sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-emerald-400"/>
          <span className="font-semibold">Summary of Grades &mdash; {subject}</span>
          <span className="text-gray-400 text-sm">{sectionName} &middot; {schoolYear}</span>
        </div>
        <div className="flex gap-3">
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
              <th style={th}>#</th>
              <th style={{...th, textAlign:'left'}}>LEARNER'S NAME</th>
              <th style={th}>TERM 1</th>
              <th style={th}>TERM 2</th>
              <th style={th}>TERM 3</th>
              <th style={{...th, background:'#d1fae5'}}>FINAL GRADE</th>
              <th style={th}>DESCRIPTOR</th>
              <th style={th}>REMARKS</th>
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
            <div style={{borderTop:'1px solid black', paddingTop:'2px', marginTop:'24px'}}>________________________________</div>
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
          body { background: white !important; }
          .summary-print { padding: 8mm !important; max-width: 100% !important; }
          @page { size: portrait; margin: 8mm; }
        }
      `}</style>
    </div>
  );
}

// ── E-CLASS RECORD VIEW (current term + test analysis) ────────────────────────
function EClassRecordView({
  students, subject, sectionName, gradeLevel, schoolName, schoolId,
  schoolYear, division, region, adviser, allTermData, currentTerm, onClose,
}: {
  students: Student[]; subject: string;
  sectionName: string; gradeLevel: string; schoolName: string;
  schoolId: string; schoolYear: string; division: string;
  region: string; adviser: string;
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
    if (!termData) return { transmuted:0, initial:0, ww:[0,0,0,0,0], pt:[0,0,0], st:[0,0], te:0, avgWW:0, avgPT:0, avgTA:0 };
    const s = termData.scores[sid] || { ww:{}, pt:{}, st:{}, te:0 };
    const ww = Array.from({length:5},(_,i)=>s.ww?.[i]??0);
    const pt = Array.from({length:3},(_,i)=>s.pt?.[i]??0);
    const st = Array.from({length:2},(_,i)=>s.st?.[i]??0);
    const te = s.te ?? 0;
    const avgWW = calcAvg(ww, highest.ww);
    const avgPT = calcAvg(pt, highest.pt);
    const avgTA = calcAvg([...st,te], [...highest.st, highest.te]);
    const initial = avgWW*weights.ww + avgPT*weights.pt + avgTA*(weights.ta??0.25);
    return { transmuted:transmute(initial), initial, ww, pt, st, te, avgWW, avgPT, avgTA };
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
  const renderGroup = (group: Student[], label: string) => (
    <>
      <tr>
        <td colSpan={hasTA?20:16} style={{...td, background:label==='MALE'?'#dbeafe':'#fce7f3', fontWeight:'bold', textAlign:'left'}}>
          {label}
        </td>
      </tr>
      {group.map((student, idx) => {
        const c = computeTerm(student.id);
        const desc = descriptor(c.transmuted);
        return (
          <tr key={student.id} style={{background:idx%2===0?'white':'#f9fafb'}}>
            <td style={td}>{idx+1}</td>
            <td style={{...td, textAlign:'left', minWidth:'140px'}}>{student.full_name}</td>
            {c.ww.map((v,i) => <td key={i} style={td}>{v||''}</td>)}
            <td style={{...td, background:'#dbeafe'}}>{c.avgWW.toFixed(1)}</td>
            {c.pt.map((v,i) => <td key={i} style={td}>{v||''}</td>)}
            <td style={{...td, background:'#ede9fe'}}>{c.avgPT.toFixed(1)}</td>
            {hasTA && <>
              {c.st.map((v,i) => <td key={i} style={td}>{v||''}</td>)}
              <td style={td}>{c.te||''}</td>
              <td style={{...td, background:'#fef3c7'}}>{c.avgTA.toFixed(1)}</td>
            </>}
            <td style={{...td, background:'#f0fdf4'}}>{c.initial.toFixed(2)}</td>
            <td style={{...td, fontWeight:'bold', fontSize:'9px', color:c.transmuted>=75?'#166534':'#991b1b'}}>{c.transmuted||''}</td>
            <td style={{...td, fontSize:'7px'}}>{desc.short}</td>
          </tr>
        );
      })}
    </>
  );

  const pageHeader = (
    <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'4px', fontSize:'8px'}}>
      <tbody>
        <tr>
          <td style={tdL}><strong>REGION:</strong> {region}</td>
          <td style={tdL}><strong>DIVISION:</strong> {division}</td>
          <td style={tdL}><strong>SCHOOL ID:</strong> {schoolId}</td>
          <td style={tdL}><strong>SCHOOL YEAR:</strong> {schoolYear}</td>
        </tr>
        <tr>
          <td colSpan={2} style={tdL}><strong>SCHOOL:</strong> {schoolName}</td>
          <td style={tdL}><strong>GRADE &amp; SECTION:</strong> {gradeLevel} &mdash; {sectionName}</td>
          <td style={tdL}><strong>SUBJECT:</strong> {subject}</td>
        </tr>
        <tr>
          <td colSpan={2} style={tdL}><strong>TEACHER:</strong> {adviser?.toUpperCase()}</td>
          <td colSpan={2} style={tdL}>
            <strong>WEIGHTS:</strong> WW {(weights.ww*100).toFixed(0)}% | PT {(weights.pt*100).toFixed(0)}%
            {hasTA ? ` | TA ${((weights.ta??0)*100).toFixed(0)}%` : ''}
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-auto">
      <div className="no-print sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-blue-400"/>
          <span className="font-semibold">E-Class Record &mdash; Term {currentTerm} &mdash; {subject}</span>
          <span className="text-gray-400 text-sm">{sectionName} &middot; {schoolYear}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Printer size={16}/> Print
          </button>
          <button onClick={onClose} className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <X size={16}/> Close
          </button>
        </div>
      </div>

      <div className="eclass-print bg-white text-black p-4" style={{fontFamily:'Arial, sans-serif', minWidth:'1100px'}}>

        {/* Title */}
        <div style={{textAlign:'center', marginBottom:'4px'}}>
          <div style={{fontWeight:'bold', fontSize:'12px'}}>CLASS RECORD &mdash; TERM {currentTerm}</div>
          <div style={{fontSize:'8px', color:'#555'}}>{subject} &mdash; {schoolYear}</div>
        </div>
        {pageHeader}

        {/* Class Record Table */}
        <div style={{fontWeight:'bold', fontSize:'9px', background:'#1e3a5f', color:'white', padding:'3px 6px', marginBottom:'2px', marginTop:'4px'}}>
          TERM {currentTerm} CLASS RECORD
        </div>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px', marginBottom:'8px'}}>
          <thead>
            <tr>
              <th style={th} rowSpan={2}>#</th>
              <th style={{...th, textAlign:'left'}} rowSpan={2}>LEARNERS' NAMES</th>
              <th style={th} colSpan={5}>WRITTEN WORKS ({(weights.ww*100).toFixed(0)}%)</th>
              <th style={{...th, background:'#dbeafe'}} rowSpan={2}>PS</th>
              <th style={th} colSpan={3}>PERFORMANCE TASKS ({(weights.pt*100).toFixed(0)}%)</th>
              <th style={{...th, background:'#ede9fe'}} rowSpan={2}>PS</th>
              {hasTA && <>
                <th style={th} colSpan={2}>SUMMATIVE TESTS ({((weights.ta??0)*100).toFixed(0)}%)</th>
                <th style={th}>TERM EXAM</th>
                <th style={{...th, background:'#fef3c7'}} rowSpan={2}>TA PS</th>
              </>}
              <th style={{...th, background:'#f0fdf4'}} rowSpan={2}>Initial</th>
              <th style={{...th}} rowSpan={2}>TG</th>
              <th style={th} rowSpan={2}>Descriptor</th>
            </tr>
            <tr>
              {highest.ww.map((v,i) => <th key={i} style={th}>{v||i+1}</th>)}
              {highest.pt.map((v,i) => <th key={i} style={th}>{v||i+1}</th>)}
              {hasTA && <>
                {highest.st.map((v,i) => <th key={i} style={th}>{v||i+1}</th>)}
                <th style={th}>{highest.te||100}</th>
              </>}
            </tr>
          </thead>
          <tbody>
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
            <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'2px', marginTop:'20px'}}>{adviser?.toUpperCase()}</div>
            <div>Subject Teacher</div>
          </div>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{borderTop:'1px solid black', paddingTop:'2px', marginTop:'20px'}}>________________________________</div>
            <div>School Head</div>
          </div>
          <div style={{textAlign:'center', minWidth:'200px'}}>
            <div style={{borderTop:'1px solid black', paddingTop:'2px', marginTop:'20px'}}>________________________________</div>
            <div>Date</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .eclass-print { padding: 4mm !important; min-width: 100% !important; }
          @page { size: landscape; margin: 6mm; }
        }
      `}</style>
    </div>
  );
}

  const computeTerm = (sid:string, termNum:number) => {
    const td = allTermData[termNum];
    if (!td) return { transmuted:0, initial:0, ww:[0,0,0,0,0], pt:[0,0,0], st:[0,0], te:0, avgWW:0, avgPT:0, avgTA:0 };
    const s = td.scores[sid] || { ww:{}, pt:{}, st:{}, te:0 };
    const ww = Array.from({length:5},(_,i)=>s.ww?.[i]??0);
    const pt = Array.from({length:3},(_,i)=>s.pt?.[i]??0);
    const st = Array.from({length:2},(_,i)=>s.st?.[i]??0);
    const te = s.te ?? 0;
    const avgWW = calcAvg(ww, td.highest.ww);
    const avgPT = calcAvg(pt, td.highest.pt);
    const avgTA = calcAvg([...st,te], [...td.highest.st, td.highest.te]);
    const initial = avgWW*weights.ww + avgPT*weights.pt + avgTA*(weights.ta??0.25);
    return { transmuted:transmute(initial), initial, ww, pt, st, te, avgWW, avgPT, avgTA };
  };

  const td = { border:'1px solid #666', padding:'2px 4px', fontSize:'8px', textAlign:'center' as const };
  const th = { ...td, background:'#e8e8e8', fontWeight:'bold' as const };

  const renderHeader = (termNum: number) => {
    const highest = allTermData[termNum]?.highest ?? { ww:[100,100,100,100,100], pt:[100,100,100], st:[50,50], te:100 };
    return (
      <thead>
        <tr>
          <th style={th} rowSpan={2}>#</th>
          <th style={{...th, textAlign:'left'}} rowSpan={2}>LEARNERS' NAMES</th>
          <th style={th} colSpan={5}>WRITTEN WORKS ({(weights.ww*100).toFixed(0)}%)</th>
          <th style={{...th, background:'#dbeafe'}} rowSpan={2}>PS</th>
          <th style={th} colSpan={3}>PERFORMANCE TASKS ({(weights.pt*100).toFixed(0)}%)</th>
          <th style={{...th, background:'#ede9fe'}} rowSpan={2}>PS</th>
          {hasTA && <>
            <th style={th} colSpan={2}>SUMMATIVE TESTS</th>
            <th style={th}>TERM EXAM</th>
            <th style={{...th, background:'#fef3c7'}} rowSpan={2}>TA PS</th>
          </>}
          <th style={{...th, background:'#f0fdf4'}} rowSpan={2}>Initial</th>
          <th style={{...th, fontWeight:'bold'}} rowSpan={2}>TG</th>
          <th style={th} rowSpan={2}>Descriptor</th>
        </tr>
        <tr>
          {highest.ww.map((v,i) => <th key={i} style={th}>{v||i+1}</th>)}
          {highest.pt.map((v,i) => <th key={i} style={th}>{v||i+1}</th>)}
          {hasTA && <>
            {highest.st.map((v,i) => <th key={i} style={th}>{v||i+1}</th>)}
            <th style={th}>{highest.te||100}</th>
          </>}
        </tr>
      </thead>
    );
  };

  const renderGroup = (group:Student[], label:string, termNum:number) => (
    <>
      <tr>
        <td colSpan={hasTA?20:16} style={{...td, background:label==='MALE'?'#dbeafe':'#fce7f3', fontWeight:'bold', textAlign:'left'}}>
          {label}
        </td>
      </tr>
      {group.map((student,idx) => {
        const c = computeTerm(student.id, termNum);
        const desc = descriptor(c.transmuted);
        return (
          <tr key={student.id} style={{background:idx%2===0?'white':'#f9fafb'}}>
            <td style={td}>{idx+1}</td>
            <td style={{...td, textAlign:'left', minWidth:'140px'}}>{student.full_name}</td>
            {c.ww.map((v,i) => <td key={i} style={td}>{v||''}</td>)}
            <td style={{...td, background:'#dbeafe'}}>{c.avgWW.toFixed(1)}</td>
            {c.pt.map((v,i) => <td key={i} style={td}>{v||''}</td>)}
            <td style={{...td, background:'#ede9fe'}}>{c.avgPT.toFixed(1)}</td>
            {hasTA && <>
              {c.st.map((v,i) => <td key={i} style={td}>{v||''}</td>)}
              <td style={td}>{c.te||''}</td>
              <td style={{...td, background:'#fef3c7'}}>{c.avgTA.toFixed(1)}</td>
            </>}
            <td style={{...td, background:'#f0fdf4'}}>{c.initial.toFixed(2)}</td>
            <td style={{...td, fontWeight:'bold', fontSize:'9px', color:c.transmuted>=75?'#166534':'#991b1b'}}>{c.transmuted||''}</td>
            <td style={{...td, fontSize:'7px'}}>{desc.short}</td>
          </tr>
        );
      })}
    </>
  );

  const pageHeader = (
    <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'4px', fontSize:'8px'}}>
      <tbody>
        <tr>
          <td style={{...td, textAlign:'left'}}><strong>REGION:</strong> {region}</td>
          <td style={{...td, textAlign:'left'}}><strong>DIVISION:</strong> {division}</td>
          <td style={{...td, textAlign:'left'}}><strong>SCHOOL ID:</strong> {schoolId}</td>
          <td style={{...td, textAlign:'left'}}><strong>SCHOOL YEAR:</strong> {schoolYear}</td>
        </tr>
        <tr>
          <td colSpan={2} style={{...td, textAlign:'left'}}><strong>SCHOOL:</strong> {schoolName}</td>
          <td style={{...td, textAlign:'left'}}><strong>GRADE &amp; SECTION:</strong> {gradeLevel} &mdash; {sectionName}</td>
          <td style={{...td, textAlign:'left'}}><strong>SUBJECT:</strong> {subject}</td>
        </tr>
        <tr>
          <td colSpan={2} style={{...td, textAlign:'left'}}><strong>TEACHER:</strong> {adviser?.toUpperCase()}</td>
          <td colSpan={2} style={{...td, textAlign:'left'}}>
            <strong>WEIGHTS:</strong> WW {(weights.ww*100).toFixed(0)}% | PT {(weights.pt*100).toFixed(0)}%
            {hasTA ? ` | TA ${((weights.ta??0)*100).toFixed(0)}%` : ''}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const signatures = (
    <div style={{display:'flex', justifyContent:'space-between', marginTop:'12px', fontSize:'8px'}}>
      <div style={{textAlign:'center', minWidth:'200px'}}>
        <div style={{fontWeight:'bold', borderTop:'1px solid black', paddingTop:'2px', marginTop:'20px'}}>{adviser?.toUpperCase()}</div>
        <div>Subject Teacher</div>
      </div>
      <div style={{textAlign:'center', minWidth:'200px'}}>
        <div style={{borderTop:'1px solid black', paddingTop:'2px', marginTop:'20px'}}>________________________________</div>
        <div>School Head</div>
      </div>
      <div style={{textAlign:'center', minWidth:'200px'}}>
        <div style={{borderTop:'1px solid black', paddingTop:'2px', marginTop:'20px'}}>________________________________</div>
        <div>Date</div>
      </div>
    </div>
  );

  const sectionBanner = (label: string, color: string) => (
    <div style={{fontWeight:'bold', fontSize:'9px', background:color, color:'white', padding:'3px 6px', marginBottom:'2px', marginTop:'6px'}}>
      {label}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-auto">
      <div className="no-print sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-blue-400"/>
          <span className="font-semibold">E-Class Record &mdash; {subject}</span>
          <span className="text-gray-400 text-sm">{sectionName} &middot; {schoolYear}</span>
          <span className="text-gray-600 text-xs">Active learners only: {activeStudents.length}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Printer size={16}/> Print
          </button>
          <button onClick={onClose} className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <X size={16}/> Close
          </button>
        </div>
      </div>

      <div className="eclass-print bg-white text-black" style={{fontFamily:'Arial, sans-serif', padding:'8px'}}>

        {/* TERM 1 PAGE */}
        <div className="print-page">
          <div style={{textAlign:'center', marginBottom:'4px'}}>
            <div style={{fontWeight:'bold', fontSize:'12px'}}>CLASS RECORD &mdash; TERM 1</div>
          </div>
          {pageHeader}
          {sectionBanner('TERM 1', '#1e3a5f')}
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px'}}>
            {renderHeader(1)}
            <tbody>
              {renderGroup(males,   'MALE',   1)}
              {renderGroup(females, 'FEMALE', 1)}
            </tbody>
          </table>
          {signatures}
        </div>

        {/* TERM 2 PAGE */}
        <div className="print-page" style={{marginTop:'20px'}}>
          <div style={{textAlign:'center', marginBottom:'4px'}}>
            <div style={{fontWeight:'bold', fontSize:'12px'}}>CLASS RECORD &mdash; TERM 2</div>
          </div>
          {pageHeader}
          {sectionBanner('TERM 2', '#1e3a5f')}
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px'}}>
            {renderHeader(2)}
            <tbody>
              {renderGroup(males,   'MALE',   2)}
              {renderGroup(females, 'FEMALE', 2)}
            </tbody>
          </table>
          {signatures}
        </div>

        {/* TERM 3 PAGE */}
        <div className="print-page" style={{marginTop:'20px'}}>
          <div style={{textAlign:'center', marginBottom:'4px'}}>
            <div style={{fontWeight:'bold', fontSize:'12px'}}>CLASS RECORD &mdash; TERM 3</div>
          </div>
          {pageHeader}
          {sectionBanner('TERM 3', '#1e3a5f')}
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px'}}>
            {renderHeader(3)}
            <tbody>
              {renderGroup(males,   'MALE',   3)}
              {renderGroup(females, 'FEMALE', 3)}
            </tbody>
          </table>
          {signatures}
        </div>

        {/* SUMMARY PAGE */}
        <div className="print-page" style={{marginTop:'20px'}}>
          <div style={{textAlign:'center', marginBottom:'4px'}}>
            <div style={{fontWeight:'bold', fontSize:'12px'}}>CLASS RECORD &mdash; SUMMARY OF GRADES</div>
          </div>
          {pageHeader}
          {sectionBanner('SUMMARY OF GRADES', '#14532d')}
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px'}}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={{...th, textAlign:'left'}}>LEARNERS' NAMES</th>
                <th style={th}>TERM 1</th>
                <th style={th}>TERM 2</th>
                <th style={th}>TERM 3</th>
                <th style={{...th, background:'#d1fae5'}}>FINAL GRADE</th>
                <th style={th}>DESCRIPTOR</th>
                <th style={th}>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {[{group:males,label:'MALE'},{group:females,label:'FEMALE'}].map(({group,label})=>(
                <React.Fragment key={label}>
                  <tr>
                    <td colSpan={8} style={{...td, background:label==='MALE'?'#dbeafe':'#fce7f3', fontWeight:'bold', textAlign:'left'}}>{label}</td>
                  </tr>
                  {group.map((student,idx)=>{
                    const t1=computeTerm(student.id,1);
                    const t2=computeTerm(student.id,2);
                    const t3=computeTerm(student.id,3);
                    const valid=[t1,t2,t3].filter(t=>t.transmuted>0);
                    const final=valid.length>0?Math.round(valid.reduce((s,t)=>s+t.transmuted,0)/valid.length):0;
                    const desc=descriptor(final);
                    return (
                      <tr key={student.id} style={{background:idx%2===0?'white':'#f9fafb'}}>
                        <td style={td}>{idx+1}</td>
                        <td style={{...td, textAlign:'left', minWidth:'140px'}}>{student.full_name}</td>
                        <td style={td}>{t1.transmuted||''}</td>
                        <td style={td}>{t2.transmuted||''}</td>
                        <td style={td}>{t3.transmuted||''}</td>
                        <td style={{...td, fontWeight:'bold', fontSize:'10px', color:final>=75?'#166534':'#991b1b'}}>{final||''}</td>
                        <td style={{...td, fontSize:'7px'}}>{final?desc.short:''}</td>
                        <td style={{...td, fontWeight:'bold', color:final>=75?'#166534':'#991b1b'}}>{final?(final>=75?'PASSED':'FAILED'):''}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {signatures}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .eclass-print { padding: 4mm !important; }
          .print-page { page-break-after: always; }
          .print-page:last-child { page-break-after: avoid; }
          @page { size: landscape; margin: 6mm; }
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
  const [allTermData,setAllTermData] = useState<Record<number,TermData>>({});
  const [loadingEClass,setLoadingEClass] = useState(false);
  const [loadingSummary,setLoadingSummary] = useState(false);
  const [statusModal,setStatusModal] = useState<Student|null>(null);

  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, schoolYear, division, region, adviser } = useActiveSection();
  const weights = SUBJECT_WEIGHTS[subject] ?? {ww:0.25, pt:0.50, ta:0.25};
  const hasTA = (weights.ta??0)>0;

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const {data,error}=await supabase.from('students').select('*').eq('section_id',sectionId).order('full_name');
      if(!error&&data?.length) setStudents(data);
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
  const classAvg = activeStudents.length>0
    ? activeStudents.reduce((s,st)=>s+compute(st.id).transmuted,0)/activeStudents.length : 0;

  const loadTermData = async (terms: number[]) => {
    const termMap: Record<number,TermData> = {};
    for (const t of terms) {
      const {data} = await supabase.from('grades').select('*').eq('subject',subject).eq('term',t);
      const m: Record<string,Scores> = {};
      let h: Highest = {ww:[100,100,100,100,100],pt:[100,100,100],st:[50,50],te:100};
      if (data && data.length>0) {
        data.forEach((r:any)=>{ m[r.student_id]={ww:r.written_scores||{},pt:r.pt_scores||{},st:r.st_scores||{},te:r.te_score||0}; });
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
                <input type="number" min={0} max={highest.ww[i]} value={v||''} disabled={!!isInactive}
                  onChange={e=>updateScore(student.id,'ww',i,+e.target.value)} className={inp('blue')}/>
              </td>
            ))}
            <td className="px-2 py-2 text-center text-blue-300 text-xs border-l border-gray-800 font-mono">{isInactive?'—':avgWW.toFixed(1)}</td>
            {pt.map((v,i)=>(
              <td key={i} className="px-1 py-1 border-l border-gray-800">
                <input type="number" min={0} max={highest.pt[i]} value={v||''} disabled={!!isInactive}
                  onChange={e=>updateScore(student.id,'pt',i,+e.target.value)} className={inp('purple')}/>
              </td>
            ))}
            <td className="px-2 py-2 text-center text-purple-300 text-xs border-l border-gray-800 font-mono">{isInactive?'—':avgPT.toFixed(1)}</td>
            {hasTA&&<>
              {st.map((v,i)=>(
                <td key={i} className="px-1 py-1 border-l border-gray-800">
                  <input type="number" min={0} max={highest.st[i]} value={v||''} disabled={!!isInactive}
                    onChange={e=>updateScore(student.id,'st',i,+e.target.value)} className={inp('amber')}/>
                </td>
              ))}
              <td className="px-1 py-1 border-l border-gray-800">
                <input type="number" min={0} max={highest.te} value={te||''} disabled={!!isInactive}
                  onChange={e=>updateScore(student.id,'te',null,+e.target.value)} className={inp('orange')}/>
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
      <style>{`@media print{body{background:white!important}.no-print{display:none!important}input{border:none!important;background:transparent!important;color:black!important}}`}</style>
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
            <button onClick={()=>window.print()} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Printer size={16}/>Print
            </button>
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

        {/* Hint */}
        <div className="no-print px-6 pb-2 text-xs text-gray-600 italic">
          Click a learner's name to view info or change their status (Dropped, Transferred, etc.)
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400"><RefreshCw size={20} className="animate-spin"/>Loading learners...</div>
        ) : (
          <div className="px-6 pb-10 overflow-x-auto">
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
          adviser={adviser}
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
          allTermData={allTermData}
          onClose={() => setShowSummary(false)}
        />
      )}
    </>
  );
}
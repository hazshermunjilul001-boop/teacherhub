'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Printer, Users, RefreshCw } from 'lucide-react';
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
  { min: 76.00, max: 76.99, trans: 78  }, { min: 75.00, max: 75.99, trans: 77 },
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
  if (g >= 90) return { label: 'Advancing (Namumukod- tangi)',           color: 'text-emerald-400' };
  if (g >= 80) return { label: 'Benchmarking (Napamamalas)',     color: 'text-green-400'   };
  if (g >= 75) return { label: 'Connecting (Natutungo)',          color: 'text-blue-400'    };
  if (g <= 74) return { label: 'Developing (Napauunlad)',   color: 'text-yellow-400'  };
  return              { label: 'Emerging (Nasisimula)', color: 'text-red-400' };
};
const calcAvg = (scores: number[], highs: number[]) => {
  let tot = 0, cnt = 0;
  scores.forEach((s, i) => { if (highs[i] > 0) { tot += (s / highs[i]) * 100; cnt++; } });
  return cnt > 0 ? tot / cnt : 0;
};

interface Student { id: string; lrn: string; full_name: string; sex?: string; }
interface Highest { ww: number[]; pt: number[]; st: number[]; te: number; }
interface Scores  { ww: Record<number,number>; pt: Record<number,number>; st: Record<number,number>; te: number; }

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
            {saving?'Saving…':'Add Learner'}</button>
        </div>
      </div>
    </div>
  );
}

export default function ClassRecord() {
  const [subject,setSubject] = useState('Filipino');
  const [term,setTerm]       = useState(1);
  const [students,setStudents] = useState<Student[]>([]);
  const [scores,setScores]   = useState<Record<string,Scores>>({});
  const [highest,setHighest] = useState<Highest>({ ww:[100,100,100,100,100], pt:[100,100,100], st:[50,50], te:100 });
  const [loading,setLoading] = useState(true);
  const [saving,setSaving]   = useState<string|null>(null);
  const [showAdd,setShowAdd] = useState(false);
  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, schoolYear, division, region, adviser } = useActiveSection();

  const weights = SUBJECT_WEIGHTS[subject] ?? { ww:0.25, pt:0.50, ta:0.25 };

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const {data,error}=await supabase.from('students').select('*').eq('section_id',sectionId).order('full_name');
      if(!error&&data?.length) setStudents(data);
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

  const classAvg=students.length>0
    ?students.reduce((s,st)=>s+compute(st.id).transmuted,0)/students.length:0;

  const hasTA=(weights.ta??0)>0;

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

          {/* TERM 1–3, not Quarter */}
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
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400"><RefreshCw size={20} className="animate-spin"/>Loading learners…</div>
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
                  <td className="bg-gray-900 px-3 py-1 italic text-gray-600 text-xs">Highest Possible Score →</td>
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
                {students.map((student,idx)=>{
                  const {ww,pt,st,te,avgWW,avgPT,avgTA,initial,transmuted}=compute(student.id);
                  const desc=descriptor(transmuted);
                  const isSaving=saving===student.id;
                  const inp=(color:string)=>`w-14 text-center bg-transparent border border-gray-700 hover:border-${color}-600 focus:border-${color}-500 rounded py-2 text-white text-sm outline-none focus:bg-gray-900`;
                  return (
                    <tr key={student.id} className={`border-t border-gray-800 hover:bg-gray-900/50 transition-colors ${transmuted<75?'bg-red-950/10':''}`}>
                      <td className="px-3 py-2 text-center text-gray-500 text-xs">{idx+1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {isSaving&&<RefreshCw size={12} className="animate-spin text-blue-400"/>}
                          <span className="text-sm font-medium">{student.full_name}</span>
                          {student.sex&&<span className="text-xs text-gray-600">{student.sex}</span>}
                        </div>
                        <div className="text-xs text-gray-600">{student.lrn}</div>
                      </td>
                      {ww.map((v,i)=>(
                        <td key={i} className="px-1 py-1 border-l border-gray-800">
                          <input type="number" min={0} max={highest.ww[i]} value={v||''}
                            onChange={e=>updateScore(student.id,'ww',i,+e.target.value)} className={inp('blue')}/>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center text-blue-300 text-xs border-l border-gray-800 font-mono">{avgWW.toFixed(1)}</td>
                      {pt.map((v,i)=>(
                        <td key={i} className="px-1 py-1 border-l border-gray-800">
                          <input type="number" min={0} max={highest.pt[i]} value={v||''}
                            onChange={e=>updateScore(student.id,'pt',i,+e.target.value)} className={inp('purple')}/>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center text-purple-300 text-xs border-l border-gray-800 font-mono">{avgPT.toFixed(1)}</td>
                      {hasTA&&<>
                        {st.map((v,i)=>(
                          <td key={i} className="px-1 py-1 border-l border-gray-800">
                            <input type="number" min={0} max={highest.st[i]} value={v||''}
                              onChange={e=>updateScore(student.id,'st',i,+e.target.value)} className={inp('amber')}/>
                          </td>
                        ))}
                        <td className="px-1 py-1 border-l border-gray-800">
                          <input type="number" min={0} max={highest.te} value={te||''}
                            onChange={e=>updateScore(student.id,'te',null,+e.target.value)} className={inp('orange')}/>
                        </td>
                        <td className="px-2 py-2 text-center text-amber-300 text-xs border-l border-gray-800 font-mono">{avgTA.toFixed(1)}</td>
                      </>}
                      <td className="px-3 py-2 text-center text-gray-400 text-xs border-l border-gray-800 font-mono">{initial.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-center font-bold text-2xl border-l border-gray-800 ${transmuted>=75?'text-white':'text-red-400'}`}>{transmuted}</td>
                      <td className={`px-3 py-2 text-center text-xs font-medium border-l border-gray-800 ${desc.color}`}>{desc.label}</td>
                    </tr>
                  );
                })}
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
      {showAdd&&<AddStudentModal sectionId={sectionId} onClose={()=>setShowAdd(false)}
        onAdd={s=>setStudents(prev=>[...prev,s].sort((a,b)=>a.full_name.localeCompare(b.full_name)))}/>}
    </>
  );
}
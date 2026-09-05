'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer, RefreshCw, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useActiveSection } from '@/lib/useActiveSection';
import { useSection } from '@/context/SectionContext';

const SUBJECTS = ['GMRC (Elem)', 'Values Education (JHS)'] as const;
type DomainSubject = typeof SUBJECTS[number];
const BLOCKS = [
  { key: 'ww_cognitive', label: 'WRITTEN / ORAL WORKS (WWs) — COGNITIVE DOMAIN', short: 'WW Cognitive', count: 5, weight: .10 },
  { key: 'ww_affective', label: 'WRITTEN / ORAL WORKS (WWs) — AFFECTIVE DOMAIN', short: 'WW Affective', count: 5, weight: .10 },
  { key: 'pt_cognitive', label: 'PRODUCT / PERFORMANCE TASKS (PTs) — COGNITIVE DOMAIN', short: 'PT Cognitive', count: 3, weight: .10 },
  { key: 'pt_affective', label: 'PRODUCT / PERFORMANCE TASKS (PTs) — AFFECTIVE DOMAIN', short: 'PT Affective', count: 3, weight: .10 },
  { key: 'behavioral', label: 'BEHAVIORAL DOMAIN', short: 'Behavioral Domain', count: 3, weight: .30 },
  { key: 'examinations', label: 'EXAMINATIONS (EXs)', short: 'Examinations', count: 3, weight: .30 },
] as const;
type Scores = Record<string, Record<number, number>>;
type Student = { id: string; full_name: string; sex?: string; lrn?: string; status?: string };

function gradeFor(scores: Scores) {
  const values = BLOCKS.map(b => { const a = Object.values(scores[b.key] || {}).filter(v => v > 0); return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0; });
  const initial = values.reduce((sum, value, i) => sum + value * BLOCKS[i].weight, 0);
  const term = initial ? Math.round(initial) : 0;
  const descriptor = term >= 90 ? 'ADVANCING' : term >= 80 ? 'BENCHMARKING' : term >= 75 ? 'CONNECTING' : term >= 65 ? 'DEVELOPING' : 'EMERGING';
  return { initial, term, descriptor };
}

function DomainTable({ students, records, editable, onChange }: { students: Student[]; records: Record<string, Scores>; editable: boolean; onChange: (studentId:string, key:string, index:number, value:number)=>void }) {
  const th: React.CSSProperties = { border:'1px solid #777', padding:'3px 4px', textAlign:'center', fontSize:9 };
  const td: React.CSSProperties = { border:'1px solid #999', padding:'2px 4px', textAlign:'center', fontSize:9 };
  const rows = [...students.filter(s=>s.sex==='M'), ...students.filter(s=>s.sex==='F'), ...students.filter(s=>s.sex!=='M'&&s.sex!=='F')];
  return <div className="gmrc-ecr-scroll" style={{overflowX:'auto',background:'#fff',color:'#000',padding:8}}><div style={{minWidth:1600,fontFamily:'Arial,sans-serif'}}>
    <div style={{textAlign:'center',fontWeight:700,fontSize:24,padding:3}}>CLASS RECORD</div>
    <table style={{borderCollapse:'collapse',width:'100%',tableLayout:'fixed'}}><thead>
      <tr><th colSpan={2} style={th}>REGION</th><th colSpan={8} style={th}></th><th colSpan={2} style={th}>DIVISION</th><th colSpan={8} style={th}></th><th colSpan={2} style={th}>SCHOOL ID</th><th colSpan={8} style={th}></th></tr>
      <tr><th colSpan={2} style={th}>SCHOOL NAME</th><th colSpan={8} style={th}></th><th colSpan={2} style={th}>SCHOOL YEAR</th><th colSpan={8} style={th}></th><th colSpan={2} style={th}>TEACHER</th><th colSpan={8} style={th}></th></tr>
      <tr><th rowSpan={3} colSpan={2} style={{...th,background:'#0b2e6b',color:'#fff',fontSize:16}}>CLASS RECORD</th><th colSpan={8} style={th}>GRADE LEVEL / SECTION</th><th colSpan={8} style={th}>TEACHER</th><th colSpan={10} style={th}>SUBJECT</th></tr>
      <tr>{BLOCKS.map(b=><th key={b.key} colSpan={b.count+1} style={{...th,fontWeight:700}}>{b.label}</th>)}<th rowSpan={2} style={th}>INITIAL<br/>GRADE</th><th rowSpan={2} style={th}>TERM<br/>GRADE</th><th rowSpan={2} style={th}>DESCRIPTOR</th></tr>
      <tr>{BLOCKS.flatMap(b=>[...Array.from({length:b.count},(_,i)=><th key={b.key+i} style={th}>{i+1}</th>),<th key={b.key+'avg'} style={th}>AVG</th>])}</tr>
      <tr><th colSpan={2} style={{...th,textAlign:'left'}}>HIGHEST POSSIBLE SCORE</th>{BLOCKS.flatMap(b=>[...Array.from({length:b.count},(_,i)=><th key={b.key+'h'+i} style={th}>100</th>),<th key={b.key+'ha'} style={th}>100</th>])}<th style={th}>100</th><th style={th}>100</th><th style={th}></th></tr>
      <tr><th colSpan={999} style={{...th,background:'#0b2e6b',color:'#fff',textAlign:'left'}}>LEARNERS' NAMES</th></tr>
    </thead><tbody><tr><td colSpan={999} style={{...th,textAlign:'left',fontWeight:700}}>MALE</td></tr>{rows.filter(s=>s.sex==='M').map((s,i)=><DomainRow key={s.id} student={s} index={i+1} scores={records[s.id]||{}} editable={editable} onChange={onChange} td={td}/>)}<tr><td colSpan={999} style={{...th,textAlign:'left',fontWeight:700}}>FEMALE</td></tr>{rows.filter(s=>s.sex==='F').map((s,i)=><DomainRow key={s.id} student={s} index={i+1} scores={records[s.id]||{}} editable={editable} onChange={onChange} td={td}/>)}{rows.filter(s=>s.sex!=='M'&&s.sex!=='F').map((s,i)=><DomainRow key={s.id} student={s} index={i+1} scores={records[s.id]||{}} editable={editable} onChange={onChange} td={td}/>)}</tbody></table>
  </div></div>;
}
function DomainRow({student,index,scores,editable,onChange,td}:{student:Student;index:number;scores:Scores;editable:boolean;onChange:(studentId:string,key:string,index:number,value:number)=>void;td:React.CSSProperties}) { const g=gradeFor(scores); return <tr><td style={td}>{index}</td><td style={{...td,textAlign:'left',whiteSpace:'nowrap'}}>{student.full_name}</td>{BLOCKS.flatMap(b=>{const vals=Array.from({length:b.count},(_,i)=>scores[b.key]?.[i]||0);const e=vals.filter(v=>v>0);const avg=e.length?e.reduce((a,b)=>a+b,0)/e.length:0;return [...vals.map((v,i)=><td key={b.key+i} style={td}><input type="number" min={0} max={100} value={v||''} disabled={!editable} onChange={x=>onChange(student.id,b.key,i,+x.target.value)} style={{width:42,textAlign:'center',border:'1px solid #aaa'}}/></td>),<td key={b.key+'avg'} style={td}>{avg?avg.toFixed(1):''}</td>]})}<td style={td}>{g.initial?g.initial.toFixed(2):''}</td><td style={{...td,fontWeight:700}}>{g.term||''}</td><td style={td}>{g.term?g.descriptor:''}</td></tr>; }

export default function GMRCValuesRecordPage() {
  const active = useActiveSection(); const { loadSections } = useSection();
  const [subject,setSubject]=useState<DomainSubject>('GMRC (Elem)'); const [term,setTerm]=useState(1); const [students,setStudents]=useState<Student[]>([]); const [records,setRecords]=useState<Record<string,Scores>>({}); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState<string|null>(null); const [preview,setPreview]=useState(false); const [teacherName,setTeacherName]=useState(active.adviser || 'Teacher');
  useEffect(() => { supabase.auth.getUser().then(({data:{user}}) => { const m=(user?.user_metadata||{}) as Record<string,unknown>; const name=[m.full_name,m.display_name,m.name].find(v=>typeof v==='string'&&v.trim()) as string|undefined; if(name) setTeacherName(name.trim()); }); }, []);
  const load = useCallback(async()=>{ if(!active.sectionId){setLoading(false);return;} setLoading(true); const {data:st}=await supabase.from('students').select('id,full_name,sex,lrn,status').eq('section_id',active.sectionId).order('full_name'); setStudents(st||[]); const {data:gr}=await supabase.from('grades').select('*').eq('term',term).eq('subject',subject).in('student_id',(st||[]).map(x=>x.id)); const map:Record<string,Scores>={}; (gr||[]).forEach(r=>map[r.student_id]=r.domain_scores||{}); setRecords(map); setLoading(false); },[active.sectionId,term,subject]);
  useEffect(()=>{load()},[load]);
  const update=async(studentId:string,key:string,index:number,value:number)=>{const next={...(records[studentId]||{}),[key]:{...(records[studentId]?.[key]||{}),[index]:Math.max(0,Math.min(100,value||0))}};setRecords(x=>({...x,[studentId]:next}));setSaving(studentId);const {error}=await supabase.from('grades').upsert({student_id:studentId,term,subject,domain_scores:next},{onConflict:'student_id,term,subject'});if(error)console.error(error);setSaving(null);};
  const summary=useMemo(()=>{const activeStudents=students.filter(s=>!s.status||s.status==='active');const gs=activeStudents.map(s=>gradeFor(records[s.id]||{})).filter(g=>g.term>0);return {gsa:gs.length?gs.reduce((a,g)=>a+g.term,0)/gs.length:0,counts:{ADVANCING:gs.filter(g=>g.term>=90).length,BENCHMARKING:gs.filter(g=>g.term>=80&&g.term<=89).length,CONNECTING:gs.filter(g=>g.term>=75&&g.term<=79).length,DEVELOPING:gs.filter(g=>g.term>=65&&g.term<=74).length,EMERGING:gs.filter(g=>g.term<=64).length}}},[students,records]);
  if(loading)return <div className="min-h-screen bg-gray-950 text-gray-300 flex items-center justify-center"><RefreshCw className="animate-spin mr-2"/>Loading dedicated domain class record…</div>;
  return <main className="min-h-screen bg-gray-950 text-white p-6"><div className="max-w-[1900px] mx-auto"><div className="flex items-center justify-between mb-5"><div><h1 className="text-2xl font-bold">GMRC / Values Education Class Record</h1><p className="text-gray-400 text-sm">Dedicated domain-based record for {active.sectionName} · {active.gradeLevel}</p></div><button onClick={()=>loadSections()} className="text-gray-400 hover:text-white"><ArrowLeft size={18}/> Back</button></div><div className="flex gap-3 mb-4"><select value={subject} onChange={e=>setSubject(e.target.value as DomainSubject)} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"><option>GMRC (Elem)</option><option>Values Education (JHS)</option></select>{[1,2,3].map(t=><button key={t} onClick={()=>setTerm(t)} className={`px-4 py-2 rounded-lg ${term===t?'bg-blue-600':'bg-gray-800'}`}>Term {t}</button>)}<button onClick={()=>setPreview(true)} className="ml-auto flex items-center gap-2 bg-blue-700 px-4 py-2 rounded-lg"><Printer size={16}/> Print Preview</button></div><div className="mb-3 text-xs text-gray-400">Enter domain ratings from 0–100. {saving&&'Saving…'} Weights: WW Cognitive 10%, WW Affective 10%, PT Cognitive 10%, PT Affective 10%, Behavioral 30%, Examinations 30%.</div><DomainTable students={students} records={records} editable={true} onChange={update}/><section className="mt-5 bg-gray-900 border border-gray-700 rounded-xl p-4"><h2 className="font-semibold mb-3">Term {term} Performance Summary</h2><div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm"><div className="bg-gray-800 rounded p-3">GSA<br/><b>{summary.gsa?summary.gsa.toFixed(2):'—'}</b></div>{Object.entries(summary.counts).map(([k,v])=><div key={k} className="bg-gray-800 rounded p-3">{k}<br/><b>{v}</b> learners</div>)}</div></section></div>{preview&&<div className="fixed inset-0 z-50 bg-black/80 overflow-auto p-4"><div className="max-w-[1900px] mx-auto bg-white rounded"><div className="no-print flex justify-between items-center p-3 border-b"><b>{subject} — Term {term} — Print Preview</b><div className="flex gap-2"><button onClick={()=>window.print()} className="bg-blue-700 text-white px-3 py-2 rounded flex items-center gap-2"><Printer size={16}/> Print / Save PDF</button><button onClick={()=>setPreview(false)} className="bg-gray-200 px-3 py-2 rounded"><X size={16}/></button></div></div><DomainTable students={students} records={records} editable={false} onChange={()=>{}}/></div><style>{`@media print{.no-print{display:none!important}.fixed{position:static!important;background:#fff!important;padding:0!important}.gmrc-ecr-scroll{overflow:visible!important;padding:0!important}.gmrc-ecr-scroll>div{min-width:1600px!important}@page{size:landscape;margin:5mm}}`}</style></div>}</main>;
}

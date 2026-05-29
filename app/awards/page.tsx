'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Trophy, Download, Printer, RefreshCw, Info, AlertTriangle, CheckCircle, Star, X, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const GA_SUBJECTS = [
  'Filipino','English','Mathematics','Science',
  'Araling Panlipunan (AP)','Edukasyon sa Pagpapakatao (EsP)',
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
];
const MAPEH_COMPONENTS = ['MAPEH - Music','MAPEH - Arts','MAPEH - Physical Education','MAPEH - Health'];
const ALL_SUBJECTS = [...GA_SUBJECTS, ...MAPEH_COMPONENTS];

const TRANSMUTATION = [
  {min:99.50,max:100,trans:100},{min:97.50,max:99.49,trans:99},{min:96.00,max:97.49,trans:98},
  {min:95.00,max:95.99,trans:97},{min:94.00,max:94.99,trans:96},{min:93.00,max:93.99,trans:95},
  {min:92.00,max:92.99,trans:94},{min:91.00,max:91.99,trans:93},{min:90.00,max:90.99,trans:92},
  {min:89.00,max:89.99,trans:91},{min:88.00,max:88.99,trans:90},{min:87.00,max:87.99,trans:89},
  {min:86.00,max:86.99,trans:88},{min:85.00,max:85.99,trans:87},{min:84.00,max:84.99,trans:86},
  {min:83.00,max:83.99,trans:85},{min:82.00,max:82.99,trans:84},{min:81.00,max:81.99,trans:83},
  {min:80.00,max:80.99,trans:82},{min:79.00,max:79.99,trans:81},{min:78.00,max:78.99,trans:80},
  {min:77.00,max:77.99,trans:79},{min:76.00,max:76.99,trans:78},{min:75.00,max:75.99,trans:77},
  {min:73.00,max:74.99,trans:76},{min:70.00,max:72.99,trans:75},{min:68.00,max:69.99,trans:74},
  {min:66.00,max:67.99,trans:73},{min:64.00,max:65.99,trans:72},{min:62.00,max:63.99,trans:71},
  {min:60.00,max:61.99,trans:70},{min:0,max:59.99,trans:60},
];
const transmute = (v:number) => TRANSMUTATION.find(t=>v>=t.min&&v<=t.max)?.trans ?? 60;

const getAwardLevel = (ga:number, minSubjectGrade:number) => {
  if (ga < 95 || minSubjectGrade < 85) return null;
  if (ga >= 98) return { label:'With Highest Honors', color:'text-yellow-400', bg:'bg-yellow-900/30 border-yellow-700', badge:'bg-yellow-500' };
  return { label:'With High Honors', color:'text-blue-400', bg:'bg-blue-900/30 border-blue-700', badge:'bg-blue-500' };
};

interface Student { id:string; lrn:string; full_name:string; sex:string; status?:string; }
interface AwardData {
  student: Student;
  finalGrades: Record<string,number>;
  mapehFinal: number;
  generalAverage: number;
  minSubjectGrade: number;
  lowestSubject: string;
  award: ReturnType<typeof getAwardLevel>;
  termAverages: { t1:number; t2:number; t3:number; };
  disqualifyReasons: string[];
}

// ── GRADE COMPUTATION ─────────────────────────────────────────────────────────
function calcAvg(scores:number[], highs:number[]) {
  let tot=0,cnt=0;
  scores.forEach((s,i)=>{ if(highs[i]>0&&s>0){tot+=(s/highs[i])*100;cnt++;} });
  return cnt>0?tot/cnt:0;
}
function computeFromRow(row:any): number {
  const WEIGHTS:Record<string,{ww:number;pt:number;ta:number}> = {
    'Filipino':{ww:0.25,pt:0.50,ta:0.25},'English':{ww:0.25,pt:0.50,ta:0.25},
    'Mathematics':{ww:0.25,pt:0.50,ta:0.25},'Science':{ww:0.25,pt:0.50,ta:0.25},
    'Araling Panlipunan (AP)':{ww:0.25,pt:0.50,ta:0.25},
    'Edukasyon sa Pagpapakatao (EsP)':{ww:0.25,pt:0.50,ta:0.25},
    'Edukasyong Pantahanan at Pangkabuhayan (EPP)':{ww:0.20,pt:0.60,ta:0.20},
    'MAPEH - Music':{ww:0.20,pt:0.60,ta:0.20},'MAPEH - Arts':{ww:0.20,pt:0.60,ta:0.20},
    'MAPEH - Physical Education':{ww:0.20,pt:0.60,ta:0.20},'MAPEH - Health':{ww:0.20,pt:0.60,ta:0.20},
  };
  const w=WEIGHTS[row.subject]??{ww:0.25,pt:0.50,ta:0.25};
  const ww=Array.from({length:5},(_,i)=>row.written_scores?.[i]??0);
  const pt=Array.from({length:3},(_,i)=>row.pt_scores?.[i]??0);
  const st=Array.from({length:2},(_,i)=>row.st_scores?.[i]??0);
  const hww=row.highest_ww??[100,100,100,100,100];
  const hpt=row.highest_pt??[100,100,100];
  const hst=row.highest_st??[50,50];
  const hte=row.highest_te??100;
  const hasWW=ww.some(v=>v>0),hasPT=pt.some(v=>v>0),hasST=st.some(v=>v>0)||row.te_score>0;
  if(!hasWW&&!hasPT&&!hasST) return 0;
  const avgWW=calcAvg(ww,hww),avgPT=calcAvg(pt,hpt);
  const avgTA=calcAvg([...st,row.te_score??0],[...hst,hte]);
  const active=[];
  if(hasWW)active.push({avg:avgWW,weight:w.ww});
  if(hasPT)active.push({avg:avgPT,weight:w.pt});
  if(hasST)active.push({avg:avgTA,weight:w.ta});
  const tw=active.reduce((s,c)=>s+c.weight,0);
  const init=tw>0?active.reduce((s,c)=>s+(c.avg*(c.weight/tw)),0):0;
  return init>0?transmute(init):0;
}

// ── CERTIFICATE VIEW ─────────────────────────────────────────────────────────
function CertificateView({ qualifier, section, certDate, onClose, printAll, allQualifiers }:{
  qualifier: AwardData; section:any; certDate:string;
  onClose:()=>void; printAll?:boolean; allQualifiers?:AwardData[];
}) {
  const students = printAll && allQualifiers ? allQualifiers : [qualifier];

  const ordinal = (n:number) => {
    if(n>=11&&n<=13) return `${n}th`;
    return `${n}${['st','nd','rd'][((n%10)-1)]||'th'}`;
  };

  const parsedDate = certDate ? new Date(certDate+'T00:00:00') : null;
  const month = parsedDate ? parsedDate.toLocaleDateString('en-PH',{month:'long'}) : '___________';
  const day   = parsedDate ? parsedDate.getDate() : null;
  const year  = parsedDate ? parsedDate.getFullYear() : '____';

  const renderCert = (d: AwardData, idx:number) => {
    const pronoun = d.student.sex==='F' ? 'her' : 'his';
    return (
      <div key={d.student.id} className={`cert-page ${idx>0?'page-break-before':''}`}
        style={{
          width:'297mm', height:'210mm', position:'relative',
          backgroundImage:'url(/cert-bg.webp)',
          backgroundSize:'cover', backgroundPosition:'center',
          backgroundRepeat:'no-repeat',
          overflow:'hidden',
          border:'1px solid #ccc',
        }}>

        {/* Content block — positioned BELOW the logo area in the background */}
        {/* Logo in bg is approx top 20% of 210mm = ~42mm, so start at 44mm */}
        <div style={{
          position:'absolute',
          top:'44mm', left:'56mm', right:'28mm', bottom:'6mm',
          display:'flex', flexDirection:'column', alignItems:'center',
          textAlign:'center', justifyContent:'center',
        }}>

          {/* Republic of the Philippines — Old English Text */}
          <p style={{margin:'0',fontSize:'14px',color:'#222',lineHeight:'1.5',
            fontFamily:'"UnifrakturMaguntia","MedievalSharp","Old English Text MT",serif'}}>
            Republic of the Philippines
          </p>
          <p style={{margin:'0 0 4px 0',fontSize:'14px',color:'#222',lineHeight:'1.5',
            fontFamily:'"UnifrakturMaguntia","MedievalSharp","Old English Text MT",serif'}}>
            Department of Education
          </p>

          {/* Region / Division / School */}
          <p style={{margin:'0',fontSize:'14.5px',fontWeight:'bold',color:'#1a1a6e',lineHeight:'1.6',
            fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
            REGION XI
          </p>
          <p style={{margin:'0',fontSize:'14.5px',fontWeight:'bold',color:'#1a1a6e',lineHeight:'1.6',
            fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
            DIVISION OF DAVAO CITY
          </p>
          <p style={{margin:'0',fontSize:'14.5px',fontWeight:'bold',color:'#1a1a6e',lineHeight:'1.6',
            fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
            STA. ANA NATIONAL HIGH SCHOOL
          </p>
          <p style={{margin:'0 0 7px 0',fontSize:'12px',color:'#444',lineHeight:'1.4',
            fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
            D. SUAZO ST., DAVAO CITY
          </p>

          {/* awards this */}
          <p style={{margin:'0 0 2px 0',fontSize:'14px',color:'#333',fontFamily:'Georgia,serif',fontStyle:'italic',lineHeight:'1.5'}}>
            awards this
          </p>

          {/* CERTIFICATE OF RECOGNITION */}
          <p style={{margin:'0 0 2px 0',fontSize:'28px',fontWeight:'bold',color:'#1a1a6e',letterSpacing:'2px',lineHeight:'1.3',
            fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
            CERTIFICATE OF RECOGNITION
          </p>

          {/* Award Level */}
          <p style={{margin:'0 0 6px 0',fontSize:'24px',fontWeight:'bold',color:'#8B0000',fontStyle:'italic',lineHeight:'1.3',
            fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
            {d.award?.label}
          </p>

          {/* to */}
          <p style={{margin:'0 0 3px 0',fontSize:'14px',color:'#333',fontFamily:'Georgia,serif',lineHeight:'1.4'}}>to</p>

          {/* Student Name */}
          <p style={{margin:'0 0 8px 0',fontSize:'30px',fontWeight:'bold',color:'#1a1a6e',letterSpacing:'1px',lineHeight:'1.3',
            fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
            {d.student.full_name}
          </p>

          {/* Body text */}
          <p style={{margin:'0 0 6px 0',fontSize:'14px',color:'#222',lineHeight:'1.7',maxWidth:'148mm',
            fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
            for {pronoun} outstanding academic performance, achieving a General Average of{' '}
            <strong>{d.generalAverage}</strong> with no grade below 85 in any subject in{' '}
            {section?.gradeLevel ?? ''}, SY {section?.schoolYear ?? ''}.
          </p>

          {/* Date and venue */}
          <p style={{margin:'0 0 22mm 0',fontSize:'14px',color:'#222',lineHeight:'1.7',
            fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
            Given this {day ? ordinal(day) : '___'} day of {month} {year}<br/>
            at Sta. Ana National High School, D. Suazo Street, Davao City.
          </p>

          {/* Signatories */}
          <div style={{display:'flex',justifyContent:'space-between',width:'100%',
            paddingLeft:'4mm',paddingRight:'4mm'}}>
            <div style={{textAlign:'center',minWidth:'65mm'}}>
              <p style={{margin:'0',fontWeight:'bold',fontSize:'14px',color:'#1a1a6e',
                borderTop:'1.5px solid #333',paddingTop:'4px',
                fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
                {(section?.adviser??'').toUpperCase()}
              </p>
              <p style={{margin:'0',fontSize:'13px',color:'#333',
                fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
                Adviser
              </p>
            </div>
            <div style={{textAlign:'center',minWidth:'65mm'}}>
              <p style={{margin:'0',fontWeight:'bold',fontSize:'14px',color:'#1a1a6e',
                borderTop:'1.5px solid #333',paddingTop:'4px',
                fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
                {(section?.school_head??'WELITO I. ROSAL').toUpperCase()}
              </p>
              <p style={{margin:'0',fontSize:'13px',color:'#333',
                fontFamily:'"Bookman Old Style","Libre Baskerville","Book Antiqua",Palatino,serif'}}>
                School Head
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="cert-modal-overlay fixed inset-0 bg-black/80 z-50 overflow-auto">
      <div className="no-print sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Trophy size={18} className="text-yellow-400"/>
          <span className="font-semibold">{printAll ? `Batch Print — ${students.length} Certificates` : `Certificate — ${qualifier.student.full_name}`}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={()=>window.print()} className="flex items-center gap-2 bg-yellow-700 hover:bg-yellow-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <Printer size={16}/> Print {printAll ? 'All' : 'Certificate'}
          </button>
          <button onClick={onClose} className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 px-4 py-2 rounded-xl text-sm font-semibold transition">
            <X size={16}/> Close
          </button>
        </div>
      </div>
      <div className="cert-container p-4 flex flex-col items-center gap-4">
        {students.map((d,i)=>renderCert(d,i))}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');
        @media screen {
          .cert-page { box-shadow: 0 4px 32px rgba(0,0,0,0.5); border-radius: 4px; }
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          .min-h-screen { display: none !important; }
          .cert-modal-overlay { display: block !important; position: static !important; overflow: visible !important; background: white !important; }
          .cert-container { padding: 0 !important; gap: 0 !important; }
          .cert-page { border: none !important; box-shadow: none !important; border-radius: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .page-break-before { page-break-before: always !important; break-before: always !important; }
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function AwardsPage() {
  const { sectionId, sectionName, gradeLevel, gradeNumber, schoolYear, adviser, schoolHead } = useActiveSection();
  const section = { sectionName, gradeLevel, gradeNumber, schoolYear, adviser, school_head: schoolHead };

  const [loading,       setLoading]       = useState(true);
  const [awardData,     setAwardData]     = useState<AwardData[]>([]);
  const [tab,           setTab]           = useState<'qualifiers'|'watchlist'|'all'>('qualifiers');
  const [certDate,      setCertDate]      = useState(new Date().toISOString().split('T')[0]);
  const [showCert,      setShowCert]      = useState<AwardData|null>(null);
  const [showBatch,     setShowBatch]     = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');

  useEffect(()=>{ loadData(); },[sectionId]);

  const loadData = async () => {
    setLoading(true);
    const { data: studs } = await supabase.from('students').select('*').eq('section_id',sectionId).order('full_name');
    const students: Student[] = (studs??[]).filter(s=>!s.status||s.status==='active');
    if (!students.length) { setLoading(false); return; }

    const { data: gradesRaw } = await supabase.from('grades').select('*')
      .in('subject', ALL_SUBJECTS).in('term',[1,2,3]);

    const results: AwardData[] = students.map(student => {
      const finalGrades: Record<string,number> = {};
      const termGrades: Record<string,number[]> = {};

      ALL_SUBJECTS.forEach(subj => {
        const rows = [1,2,3].map(t => gradesRaw?.find(g=>g.student_id===student.id&&g.subject===subj&&g.term===t));
        const grades = rows.map(r => r ? computeFromRow({...r,subject:subj}) : 0);
        termGrades[subj] = grades;
        const valid = grades.filter(v=>v>0);
        finalGrades[subj] = valid.length>0 ? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length) : 0;
      });

      // MAPEH average
      const mapehScores = MAPEH_COMPONENTS.map(c=>finalGrades[c]).filter(v=>v>0);
      const mapehFinal  = mapehScores.length>0 ? Math.round(mapehScores.reduce((a,b)=>a+b,0)/mapehScores.length) : 0;

      // General Average (GA subjects + MAPEH)
      const gaScores = [...GA_SUBJECTS.map(s=>finalGrades[s]), mapehFinal].filter(v=>v>0);
      const generalAverage = gaScores.length>0 ? Math.round(gaScores.reduce((a,b)=>a+b,0)/gaScores.length) : 0;

      // Min subject grade check
      const allFinals = [...GA_SUBJECTS.map(s=>finalGrades[s]), mapehFinal].filter(v=>v>0);
      const minSubjectGrade = allFinals.length>0 ? Math.min(...allFinals) : 0;
      const lowestEntry = [...GA_SUBJECTS.map(s=>({s,g:finalGrades[s]})),{s:'MAPEH',g:mapehFinal}]
        .filter(x=>x.g>0).sort((a,b)=>a.g-b.g)[0];
      const lowestSubject = lowestEntry?.s ?? '';

      // Term running averages
      const termAvg = (t:number) => {
        const tGrades = [...GA_SUBJECTS.map(s=>termGrades[s]?.[t-1]??0),
          Math.round(MAPEH_COMPONENTS.map(c=>termGrades[c]?.[t-1]??0).filter(v=>v>0).reduce((a,b,_,arr)=>a+b/arr.length,0))
        ].filter(v=>v>0);
        return tGrades.length>0 ? Math.round(tGrades.reduce((a,b)=>a+b,0)/tGrades.length) : 0;
      };

      // Disqualify reasons
      const disqualifyReasons: string[] = [];
      if (generalAverage>0 && generalAverage<95) disqualifyReasons.push(`General Average is ${generalAverage} — needs 95 to qualify`);
      if (minSubjectGrade>0 && minSubjectGrade<85) disqualifyReasons.push(`${lowestSubject} grade is ${minSubjectGrade} — below 85 minimum`);

      const award = generalAverage>=95 && minSubjectGrade>=85 ? getAwardLevel(generalAverage, minSubjectGrade) : null;

      return {
        student, finalGrades, mapehFinal, generalAverage, minSubjectGrade,
        lowestSubject, award,
        termAverages: { t1:termAvg(1), t2:termAvg(2), t3:termAvg(3) },
        disqualifyReasons,
      };
    });

    // Sort: qualifiers by GA desc, then alphabetical
    results.sort((a,b) => {
      if (a.award && !b.award) return -1;
      if (!a.award && b.award) return 1;
      return b.generalAverage - a.generalAverage;
    });

    setAwardData(results);
    setLoading(false);
  };

  const qualifiers  = awardData.filter(d=>d.award);
  const watchlist   = awardData.filter(d=>!d.award && d.generalAverage>=90);
  const allLearners = awardData;
  const highestHonors = qualifiers.filter(d=>d.generalAverage>=98).length;
  const highHonors    = qualifiers.filter(d=>d.generalAverage>=95&&d.generalAverage<98).length;

  const exportCSV = () => {
    const headers = ['Rank','LRN','Full Name','Sex','General Average','Award Level',...GA_SUBJECTS,'MAPEH'];
    const rows = qualifiers.map((d,i) => [
      i+1, d.student.lrn, d.student.full_name, d.student.sex==='M'?'Male':'Female',
      d.generalAverage, d.award?.label??'',
      ...GA_SUBJECTS.map(s=>d.finalGrades[s]||''), d.mapehFinal||''
    ]);
    const csv = [headers,...rows].map(r=>r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    const a = document.createElement('a'); a.href=url;
    a.download=`AcademicExcellence_${sectionName}_${schoolYear.replace(' ','')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const gradeNum = gradeNumber ?? 7;
  const isEligibleGrade = gradeNum >= 4;

  // Grade color helper
  const gradeColor = (g:number) => {
    if (!g) return 'text-gray-600';
    if (g >= 98) return 'text-yellow-400 font-bold';
    if (g >= 95) return 'text-blue-400 font-bold';
    if (g >= 85) return 'text-emerald-400';
    return 'text-red-400 font-semibold';
  };

  const renderQualifiersTable = (list: AwardData[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-0" style={{minWidth:'1300px'}}>
        <thead>
          <tr>
            <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl sticky left-0 z-10 min-w-[50px]">Rank</th>
            <th className="bg-gray-800 text-left px-3 py-3 sticky left-[50px] z-10 min-w-[200px]">Learner</th>
            {GA_SUBJECTS.map(s=>(
              <th key={s} className="bg-gray-800 text-center px-1 py-3 border-l border-gray-700 min-w-[55px]" style={{fontSize:'10px'}}>
                {s.split(' ')[0]}
              </th>
            ))}
            <th className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700 min-w-[55px]">MAPEH</th>
            <th className="bg-yellow-900 text-center px-2 py-3 border-l border-gray-700 min-w-[55px] text-yellow-300">GA</th>
            <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700 rounded-tr-xl min-w-[160px]">Award</th>
          </tr>
        </thead>
        <tbody>
          {list.length===0 ? (
            <tr><td colSpan={GA_SUBJECTS.length+5} className="text-center py-16 text-gray-500">
              {tab==='qualifiers' ? 'No qualifiers yet — encode all 3 term grades in Class Record first.' : 'No students in this category.'}
            </td></tr>
          ) : list.map((d,idx)=>(
            <tr key={d.student.id} className="border-t border-gray-800 hover:bg-gray-900/40">
              <td className="px-3 py-3 sticky left-0 bg-gray-950 z-10 text-center font-bold text-lg text-yellow-400">
                {tab==='qualifiers' ? `${idx+1}${['st','nd','rd'][idx]||'th'}` : ''}
              </td>
              <td className="px-3 py-2 sticky left-[50px] bg-gray-950 z-10 border-r border-gray-800">
                <div className="font-medium text-white">{d.student.full_name}</div>
                <div className="text-gray-600 text-xs">{d.student.lrn}</div>
                {tab==='watchlist' && d.disqualifyReasons.map((r,i)=>(
                  <div key={i} className="text-amber-500 text-xs mt-0.5 flex items-center gap-1">
                    <AlertTriangle size={10}/>{r}
                  </div>
                ))}
              </td>
              {GA_SUBJECTS.map(s=>(
                <td key={s} className={`text-center py-2 border-l border-gray-800 ${gradeColor(d.finalGrades[s])}`}>
                  {d.finalGrades[s]||'—'}
                </td>
              ))}
              <td className={`text-center py-2 border-l border-gray-800 ${gradeColor(d.mapehFinal)}`}>
                {d.mapehFinal||'—'}
              </td>
              <td className={`text-center py-2 border-l border-gray-800 text-xl font-bold ${d.generalAverage>=98?'text-yellow-400':d.generalAverage>=95?'text-blue-400':d.generalAverage>=90?'text-white':'text-gray-400'}`}>
                {d.generalAverage||'—'}
              </td>
              <td className="px-3 py-2 border-l border-gray-800 text-center">
                {d.award ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${d.award.bg} ${d.award.color}`}>
                    <Trophy size={10}/>{d.award.label}
                  </span>
                ) : (
                  <button onClick={()=>{setShowCert(d);setShowBatch(false);}}
                    className="text-gray-600 text-xs">—</button>
                )}
                {d.award && (
                  <button onClick={()=>{setShowCert(d);setShowBatch(false);}}
                    className="block mx-auto mt-1 text-xs text-blue-400 hover:text-blue-300 transition">
                    View Cert
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!isEligibleGrade) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <Trophy size={48} className="mx-auto mb-4 text-gray-600"/>
        <p className="text-lg text-gray-400">Academic Excellence Awards apply to Grades 4–12 only.</p>
        <p className="text-sm text-gray-600 mt-1">This section is {gradeLevel}.</p>
        <button onClick={()=>window.history.back()} className="mt-6 px-6 py-2 bg-gray-800 rounded-xl text-sm hover:bg-gray-700 transition">
          Go Back
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .min-h-screen { display: none !important; }
          .cert-modal-overlay { display: block !important; position: static !important; }
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={()=>window.history.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-yellow-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Trophy size={22} className="text-yellow-400"/>
                Academic Excellence Awards
              </h1>
              <p className="text-gray-400 text-sm">{sectionName} &middot; {gradeLevel} &middot; {schoolYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Certificate Date */}
            <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
              <label className="text-xs text-gray-400">Certificate Date:</label>
              <input type="date" value={certDate} onChange={e=>setCertDate(e.target.value)}
                className="bg-transparent text-white text-sm focus:outline-none"/>
            </div>
            <button onClick={exportCSV}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Download size={16}/> Export List
            </button>
            <button onClick={()=>setShowBatch(true)} disabled={qualifiers.length===0}
              className="flex items-center gap-2 bg-yellow-700 hover:bg-yellow-600 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">
              <Printer size={16}/> Print All Certificates ({qualifiers.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/>Computing awards...
          </div>
        ) : (
          <div className="p-6">
            {/* DepEd Criteria Info */}
            <div className="mb-6 bg-blue-950/40 border border-blue-800 rounded-2xl p-4 flex items-start gap-3">
              <Info size={18} className="text-blue-400 flex-shrink-0 mt-0.5"/>
              <div className="text-sm text-blue-200">
                <span className="font-bold text-blue-300">DepEd Qualification Criteria (Grades 4–12):</span>
                <span className="ml-2">General Average </span><span className="font-bold text-white">≥ 95</span>
                <span className="mx-2">&middot;</span>
                <span>No subject grade below </span><span className="font-bold text-white">85</span>
                <span className="mx-2">&middot;</span>
                <span className="text-yellow-300 font-semibold">98–100 = With Highest Honors</span>
                <span className="mx-2">&middot;</span>
                <span className="text-blue-300 font-semibold">95–97 = With High Honors</span>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl p-4 border border-gray-700">
                <p className="text-gray-400 text-xs">Total Learners</p>
                <p className="text-3xl font-bold text-white">{awardData.length}</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-800 to-yellow-950 rounded-2xl p-4 border border-yellow-700">
                <p className="text-yellow-300 text-xs">With Highest Honors</p>
                <p className="text-3xl font-bold text-yellow-400">{highestHonors}</p>
                <p className="text-yellow-600 text-xs">GA 98–100</p>
              </div>
              <div className="bg-gradient-to-br from-blue-800 to-blue-950 rounded-2xl p-4 border border-blue-700">
                <p className="text-blue-300 text-xs">With High Honors</p>
                <p className="text-3xl font-bold text-blue-400">{highHonors}</p>
                <p className="text-blue-600 text-xs">GA 95–97</p>
              </div>
              <div className="bg-gradient-to-br from-amber-800 to-amber-950 rounded-2xl p-4 border border-amber-700">
                <p className="text-amber-300 text-xs">Watchlist</p>
                <p className="text-3xl font-bold text-amber-400">{watchlist.length}</p>
                <p className="text-amber-600 text-xs">GA 90–94 or subject &lt; 85</p>
              </div>
            </div>

            {/* Certificate preview selector */}
            {qualifiers.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <span className="text-sm text-gray-400">Preview certificate for:</span>
                <select value={selectedStudent} onChange={e=>{
                    const found=qualifiers.find(d=>d.student.id===e.target.value);
                    if(found){setShowCert(found);setShowBatch(false);}
                  }}
                  className="bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-yellow-500">
                  <option value="">— Select a student —</option>
                  {qualifiers.map(d=>(
                    <option key={d.student.id} value={d.student.id}>{d.student.full_name} ({d.award?.label})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-800">
              {([
                {key:'qualifiers', label:`Qualifiers (${qualifiers.length})`, color:'text-yellow-400', active:'border-yellow-500'},
                {key:'watchlist',  label:`Watchlist (${watchlist.length})`,   color:'text-amber-400',  active:'border-amber-500'},
                {key:'all',        label:`All Learners (${allLearners.length})`, color:'text-gray-400', active:'border-blue-500'},
              ] as const).map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                    tab===t.key ? `${t.active} ${t.color}` : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Table */}
            {tab==='qualifiers' && renderQualifiersTable(qualifiers)}
            {tab==='watchlist'  && renderQualifiersTable(watchlist)}
            {tab==='all'        && renderQualifiersTable(allLearners)}
          </div>
        )}
      </div>

      {/* Certificate modal */}
      {(showCert || showBatch) && (
        <CertificateView
          qualifier={showCert??qualifiers[0]}
          section={{...section, adviser: section.adviser, school_head: section.school_head??'WELITO I. ROSAL'}}
          certDate={certDate}
          onClose={()=>{setShowCert(null);setShowBatch(false);setSelectedStudent('');}}
          printAll={showBatch}
          allQualifiers={showBatch?qualifiers:undefined}
        />
      )}
    </>
  );
}
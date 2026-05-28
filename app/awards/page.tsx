'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Printer, RefreshCw, Trophy, Star,
  AlertCircle, CheckCircle, Download, Users, Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — DepEd Academic Excellence Award Guidelines SY 2026-2027
// ─────────────────────────────────────────────────────────────────────────────

const MIN_GA           = 95;    // Minimum General Average to qualify
const MIN_SUBJECT      = 85;    // No subject grade below this
const MIN_GRADE_LEVEL  = 4;     // Awards start from Grade 4

const AWARD_LEVELS = [
  { label: 'With Highest Honors', min: 98, max: 100, color: '#b45309', bg: '#fef3c7', border: '#d97706' },
  { label: 'With High Honors',    min: 95, max: 97,  color: '#1d4ed8', bg: '#eff6ff', border: '#3b82f6' },
];

const JHS_SUBJECTS = [
  'Filipino', 'English', 'Mathematics', 'Science',
  'Araling Panlipunan (AP)', 'Edukasyon sa Pagpapakatao (EsP)',
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
];
const MAPEH_COMPONENTS = [
  'MAPEH - Music', 'MAPEH - Arts', 'MAPEH - Physical Education', 'MAPEH - Health',
];
const ALL_SUBJECTS = [...JHS_SUBJECTS, ...MAPEH_COMPONENTS];

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
  {min:60.00,max:61.99,trans:70},{min:58.00,max:59.99,trans:69},{min:56.00,max:57.99,trans:68},
  {min:54.00,max:55.99,trans:67},{min:52.00,max:53.99,trans:66},{min:50.00,max:51.99,trans:65},
  {min:48.00,max:49.99,trans:64},{min:46.00,max:47.99,trans:63},{min:43.00,max:45.99,trans:62},
  {min:40.00,max:42.99,trans:61},{min:0,max:39.99,trans:60},
];

const WEIGHTS: Record<string,{ww:number;pt:number;ta:number}> = {
  'Filipino':{ww:0.25,pt:0.50,ta:0.25},'English':{ww:0.25,pt:0.50,ta:0.25},
  'Mathematics':{ww:0.25,pt:0.50,ta:0.25},'Science':{ww:0.25,pt:0.50,ta:0.25},
  'Araling Panlipunan (AP)':{ww:0.25,pt:0.50,ta:0.25},
  'Edukasyon sa Pagpapakatao (EsP)':{ww:0.25,pt:0.50,ta:0.25},
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)':{ww:0.20,pt:0.60,ta:0.20},
  'MAPEH - Music':{ww:0.20,pt:0.60,ta:0.20},'MAPEH - Arts':{ww:0.20,pt:0.60,ta:0.20},
  'MAPEH - Physical Education':{ww:0.20,pt:0.60,ta:0.20},'MAPEH - Health':{ww:0.20,pt:0.60,ta:0.20},
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const transmute = (v:number) => TRANSMUTATION.find(t=>v>=t.min&&v<=t.max)?.trans??60;

function calcAvg(scores:number[], highs:number[]): number {
  let t=0,c=0;
  scores.forEach((v,i)=>{ if(highs[i]>0&&v>0){t+=(v/highs[i])*100;c++;} });
  return c>0?t/c:0;
}

function computeFromRow(row:any, subject:string): number {
  if (!row) return 0;
  const w  = WEIGHTS[subject]??{ww:0.25,pt:0.50,ta:0.25};
  const ww = Array.from({length:5},(_,i)=>row.written_scores?.[i]??0);
  const pt = Array.from({length:3},(_,i)=>row.pt_scores?.[i]??0);
  const st = Array.from({length:2},(_,i)=>row.st_scores?.[i]??0);
  const te = row.te_score??0;
  const hasWW=ww.some(v=>v>0), hasPT=pt.some(v=>v>0), hasST=st.some(v=>v>0)||te>0;
  if (!hasWW&&!hasPT&&!hasST) return 0;
  const avgWW=calcAvg(ww,row.highest_ww??[100,100,100,100,100]);
  const avgPT=calcAvg(pt,row.highest_pt??[100,100,100]);
  const avgTA=calcAvg([...st,te],[...(row.highest_st??[50,50]),row.highest_te??100]);
  const active=[];
  if(hasWW) active.push({avg:avgWW,weight:w.ww});
  if(hasPT) active.push({avg:avgPT,weight:w.pt});
  if(hasST) active.push({avg:avgTA,weight:w.ta});
  const tw=active.reduce((s,c)=>s+c.weight,0);
  const initial=tw>0?active.reduce((s,c)=>s+(c.avg*(c.weight/tw)),0):0;
  return initial>0?transmute(initial):0;
}

function getAwardLevel(ga: number): typeof AWARD_LEVELS[0] | null {
  return AWARD_LEVELS.find(a => ga >= a.min && ga <= a.max) ?? null;
}

function toOrdinal(n: number): string {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10]||s[v]||s[0]);
}

function formatDate(date: Date): string {
  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return `${toOrdinal(date.getDate())} day of ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Student { id:string; lrn:string; full_name:string; sex:string; }

interface AwardResult {
  student:         Student;
  rank:            number;
  termGrades:      Record<string, number[]>;   // subject → [t1,t2,t3]
  finalGrades:     Record<string, number>;     // subject → final
  mapehFinal:      number;
  genAverage:      number;
  qualifies:       boolean;
  awardLevel:      typeof AWARD_LEVELS[0] | null;
  failedSubjects:  string[];   // subjects below 85
  watchlist:       boolean;    // GA 90-94 or one subject below 85
  watchReason:     string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATE COMPONENT — matches the DepEd style in the screenshot
// ─────────────────────────────────────────────────────────────────────────────

function Certificate({ result, section, certDate }: {
  result: AwardResult;
  section: any;
  certDate: string;
}) {
  const award   = result.awardLevel!;
  const nameParts = result.student.full_name.split(',').map(s=>s.trim());
  const lastName  = nameParts[0]??'';
  const afterComma = nameParts[1]??'';
  const tokens    = afterComma.split(' ').filter(Boolean);
  const hasMiddle = tokens.length>1&&(tokens[tokens.length-1].endsWith('.')||tokens[tokens.length-1].length<=2);
  const firstName = hasMiddle ? tokens.slice(0,-1).join(' ') : afterComma;
  const studentName = `${firstName} ${lastName}`.trim();

  const pronoun = result.student.sex==='F' ? 'her' : 'his';

  return (
    <div className="certificate-card" style={{
      width: '277mm',
      height: '190mm',
      position: 'relative',
      background: 'white',
      fontFamily: 'Georgia, serif',
      overflow: 'hidden',
      pageBreakAfter: 'always',
      display: 'flex',
      alignItems: 'stretch',
    }}>
      {/* ── LEFT BORDER — Ethnic/Weave Pattern ── */}
      <div style={{
        width: '18mm',
        background: 'linear-gradient(180deg, #8B4513 0%, #D4A017 25%, #8B4513 50%, #D4A017 75%, #8B4513 100%)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Geometric weave pattern */}
        <svg width="100%" height="100%" style={{position:'absolute',top:0,left:0}}>
          {Array.from({length:40}).map((_,i)=>(
            <g key={i}>
              <rect x="2" y={i*20} width="14" height="10" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
              <rect x="5" y={i*20+3} width="8" height="4" fill="white" opacity="0.3"/>
              <line x1="0" y1={i*20+10} x2="18" y2={i*20+10} stroke="white" strokeWidth="0.3" opacity="0.4"/>
            </g>
          ))}
          {/* Diamond pattern */}
          {Array.from({length:20}).map((_,i)=>(
            <polygon key={`d${i}`}
              points={`9,${i*40} 16,${i*40+10} 9,${i*40+20} 2,${i*40+10}`}
              fill="none" stroke="white" strokeWidth="0.8" opacity="0.7"/>
          ))}
        </svg>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8mm 10mm',
        backgroundImage: 'radial-gradient(ellipse at center, #fff9f0 0%, #fdf5e8 100%)',
        position: 'relative',
      }}>
        {/* Marble texture overlay */}
        <div style={{
          position:'absolute', inset:0, opacity:0.04,
          backgroundImage: 'repeating-linear-gradient(45deg, #8B4513 0px, transparent 2px, transparent 10px, #8B4513 12px)',
        }}/>

        {/* DepEd Logo placeholder */}
        <div style={{
          width: '18mm', height: '18mm',
          borderRadius: '50%',
          border: '2px solid #1a3a6b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '3mm',
          background: 'white',
          fontSize: '8pt', color: '#1a3a6b', fontWeight: 'bold', textAlign: 'center',
          lineHeight: '1.2',
        }}>
          <div>DepEd<br/>PH</div>
        </div>

        {/* Header */}
        <div style={{textAlign:'center', marginBottom:'3mm', fontStyle:'italic', fontSize:'9pt'}}>
          Republic of the Philippines<br/>
          Department of Education
        </div>
        <div style={{textAlign:'center', fontWeight:'bold', fontSize:'10pt', marginBottom:'2mm', letterSpacing:'0.5px'}}>
          {(section?.region??'REGION XI').toUpperCase()}<br/>
          DIVISION OF {(section?.division??'DAVAO CITY').toUpperCase()}<br/>
          {(section?.school_name??'').toUpperCase()}
        </div>
        {section?.district && (
          <div style={{textAlign:'center', fontSize:'8pt', marginBottom:'4mm', color:'#444'}}>
            {section.district}
          </div>
        )}

        {/* Awards this */}
        <div style={{fontSize:'9pt', marginBottom:'2mm', color:'#333', fontStyle:'italic'}}>
          awards this
        </div>

        {/* Certificate type */}
        <div style={{
          fontSize:'18pt', fontWeight:'bold', color:'#1a3a6b',
          letterSpacing:'1px', textAlign:'center', marginBottom:'1mm',
        }}>
          CERTIFICATE OF RECOGNITION
        </div>

        {/* Award level */}
        <div style={{
          fontSize:'16pt', fontWeight:'bold', fontStyle:'italic',
          color: award.color, marginBottom:'4mm', textAlign:'center',
        }}>
          {award.label}
        </div>

        {/* "to" */}
        <div style={{fontSize:'9pt', marginBottom:'2mm', fontStyle:'italic', color:'#555'}}>
          to
        </div>

        {/* Student name */}
        <div style={{
          fontSize:'20pt', fontWeight:'bold', color:'#1a3a6b',
          letterSpacing:'1px', marginBottom:'4mm', textAlign:'center',
          textTransform:'uppercase',
        }}>
          {studentName}
        </div>

        {/* Achievement text */}
        <div style={{
          textAlign:'center', fontSize:'9.5pt', color:'#333',
          lineHeight:'1.6', marginBottom:'4mm', maxWidth:'180mm',
        }}>
          for {pronoun} outstanding academic performance, achieving a General Average of{' '}
          <strong>{result.genAverage}</strong> with no grade below 85 in any subject
          in {section?.grade_level??'Grade 7'}, SY {section?.school_year??'2026-2027'}.
        </div>

        {/* Date */}
        <div style={{fontSize:'9pt', color:'#444', marginBottom:'8mm', textAlign:'center'}}>
          Given this {formatDate(new Date(certDate))}
          <br/>at {section?.school_name??''}.
        </div>

        {/* Signatures */}
        <div style={{
          display:'flex', justifyContent:'space-around', width:'100%', maxWidth:'200mm',
        }}>
          {[
            { name: (section?.adviser??'').toUpperCase(),    title: 'Adviser'     },
            { name: (section?.school_head??'').toUpperCase(), title: 'School Head' },
          ].map(sig => (
            <div key={sig.title} style={{textAlign:'center', minWidth:'70mm'}}>
              <div style={{fontWeight:'bold', fontSize:'10pt', marginBottom:'1mm'}}>{sig.name||'___________________'}</div>
              <div style={{
                borderTop: '1.5px solid #333',
                paddingTop: '2px', fontSize:'8.5pt', color:'#555',
              }}>{sig.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT BORDER — Decorative fan/floral ── */}
      <div style={{
        width: '22mm',
        background: 'linear-gradient(180deg, #fef3c7 0%, #fde68a 50%, #fef3c7 100%)',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <svg width="100%" height="100%" style={{position:'absolute',top:0,left:0}}>
          {/* Fan pattern */}
          {Array.from({length:6}).map((_,i)=>(
            <g key={i} transform={`translate(22,${i*60+30})`}>
              {Array.from({length:8}).map((_,j)=>(
                <line key={j}
                  x1="0" y1="0"
                  x2={-20*Math.cos((j-3.5)*0.2)} y2={20*Math.sin((j-3.5)*0.2)}
                  stroke="#D4A017" strokeWidth="0.8" opacity="0.7"/>
              ))}
              <circle cx="0" cy="0" r="3" fill="#D4A017" opacity="0.5"/>
            </g>
          ))}
          {/* Leaf/botanical */}
          {Array.from({length:4}).map((_,i)=>(
            <ellipse key={`l${i}`}
              cx="11" cy={i*50+25}
              rx="8" ry="15"
              fill="none" stroke="#b45309" strokeWidth="0.6" opacity="0.4"
              transform={`rotate(${i%2===0?20:-20},11,${i*50+25})`}/>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AwardsPage() {
  const { sectionId, sectionName, gradeLevel, gradeNumber, schoolYear, activeSection } = useActiveSection();

  const [results,     setResults]     = useState<AwardResult[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [certDate,    setCertDate]    = useState(new Date().toISOString().split('T')[0]);
  const [view,        setView]        = useState<'dashboard'|'certificates'>('dashboard');
  const [selected,    setSelected]    = useState<string|null>(null); // single cert preview
  const [printAll,    setPrintAll]    = useState(false);
  const [search,      setSearch]      = useState('');
  const [tab,         setTab]         = useState<'qualifiers'|'watchlist'|'all'>('qualifiers');

  // ── Check if grade level is eligible (Grades 4-12) ─────────────────────────
  const isEligibleGrade = gradeNumber >= MIN_GRADE_LEVEL;

  // ── Load and compute ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sectionId || sectionId==='default-section') { setLoading(false); return; }
    (async () => {
      setLoading(true);

      const { data: studs } = await supabase
        .from('students').select('*')
        .eq('section_id', sectionId)
        .order('full_name');
      const students: Student[] = (studs??[]).filter((s:any) => !s.status || s.status==='active');

      const { data: gradesRaw } = await supabase
        .from('grades').select('*')
        .in('term',[1,2,3])
        .in('subject', ALL_SUBJECTS);

      const { data: manualRaw } = await supabase
        .from('manual_grades').select('*')
        .eq('section_id', sectionId);

      const computed: Omit<AwardResult,'rank'>[] = students.map(student => {
        const termGrades: Record<string,number[]> = {};
        const finalGrades: Record<string,number>  = {};

        ALL_SUBJECTS.forEach(subj => {
          const tg = [1,2,3].map(t => {
            const cr = gradesRaw?.find(g=>g.student_id===student.id&&g.subject===subj&&g.term===t);
            if (cr) { const v=computeFromRow(cr,subj); if(v>0) return v; }
            const mr = manualRaw?.find(g=>g.student_id===student.id&&g.subject===subj&&g.term===t);
            return mr?.grade??0;
          });
          termGrades[subj] = tg;
          const rec = tg.filter(v=>v>0);
          finalGrades[subj] = rec.length ? Math.round(rec.reduce((a,b)=>a+b)/rec.length) : 0;
        });

        // MAPEH final
        const mapehScores = MAPEH_COMPONENTS.map(k=>finalGrades[k]).filter(v=>v>0);
        const mapehFinal  = mapehScores.length
          ? Math.round(mapehScores.reduce((a,b)=>a+b)/mapehScores.length) : 0;

        // General Average
        const gaScores = [...JHS_SUBJECTS.map(s=>finalGrades[s]), mapehFinal].filter(v=>v>0);
        const genAverage = gaScores.length
          ? Math.round(gaScores.reduce((a,b)=>a+b)/gaScores.length) : 0;

        // Check qualification
        const allFinals = [...JHS_SUBJECTS.map(s=>finalGrades[s]), mapehFinal];
        const failedSubjects: string[] = [];
        [...JHS_SUBJECTS, 'MAPEH'].forEach((subj, i) => {
          const grade = i < JHS_SUBJECTS.length ? finalGrades[subj] : mapehFinal;
          if (grade > 0 && grade < MIN_SUBJECT) failedSubjects.push(subj);
        });

        const qualifies = isEligibleGrade &&
          genAverage >= MIN_GA &&
          failedSubjects.length === 0 &&
          gaScores.length > 0;

        const awardLevel = qualifies ? getAwardLevel(genAverage) : null;

        // Watchlist — almost qualifies
        const watchReason: string[] = [];
        if (!qualifies && genAverage > 0) {
          if (genAverage >= 90 && genAverage < MIN_GA)
            watchReason.push(`GA is ${genAverage} — needs ${MIN_GA} to qualify`);
          failedSubjects.forEach(s =>
            watchReason.push(`${s.replace('Araling Panlipunan (AP)','AP').replace('Edukasyon sa Pagpapakatao (EsP)','EsP').replace('Edukasyong Pantahanan at Pangkabuhayan (EPP)','EPP')} grade below 85`)
          );
        }
        const watchlist = !qualifies && (genAverage >= 90 || (genAverage >= MIN_GA && failedSubjects.length > 0));

        return { student, termGrades, finalGrades, mapehFinal, genAverage,
          qualifies, awardLevel, failedSubjects, watchlist, watchReason };
      });

      // Rank qualifiers by GA descending
      const qualifiers = computed.filter(r=>r.qualifies)
        .sort((a,b)=>b.genAverage-a.genAverage);
      const nonQualifiers = computed.filter(r=>!r.qualifies);

      const ranked: AwardResult[] = [
        ...qualifiers.map((r,i) => ({ ...r, rank: i+1 })),
        ...nonQualifiers.map(r => ({ ...r, rank: 0 })),
      ];

      setResults(ranked);
      setLoading(false);
    })();
  }, [sectionId, isEligibleGrade]);

  const qualifiers  = results.filter(r=>r.qualifies);
  const watchlist   = results.filter(r=>r.watchlist);
  const allStudents = results;

  const filtered = (list: AwardResult[]) =>
    list.filter(r => r.student.full_name.toLowerCase().includes(search.toLowerCase()));

  const displayList = tab==='qualifiers' ? filtered(qualifiers)
    : tab==='watchlist' ? filtered(watchlist)
    : filtered(allStudents);

  const selectedResult = results.find(r=>r.student.id===selected);

  // Export qualifiers list as CSV
  const exportCSV = () => {
    const headers = ['Rank','LRN','Full Name','Sex','Gen Average','Award Level',
      'Filipino','English','Math','Science','AP','EsP','EPP','MAPEH'];
    const rows = qualifiers.map(r => [
      r.rank, r.student.lrn, r.student.full_name, r.student.sex, r.genAverage,
      r.awardLevel?.label??'',
      ...JHS_SUBJECTS.map(s=>r.finalGrades[s]||''),
      r.mapehFinal||'',
    ]);
    const csv = [headers,...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `AcademicExcellence_${sectionName}_${schoolYear.replace(/\s/g,'')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          @page { size: A4 landscape; margin: 0; }
          .certificate-card { page-break-after: always; }
          .certificate-card:last-child { page-break-after: auto; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-950 text-white">

        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={()=>window.history.back()}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Trophy size={24} className="text-amber-400"/> Academic Excellence Awards
              </h1>
              <p className="text-gray-400 text-sm">
                {sectionName} &middot; {gradeLevel} &middot; SY {schoolYear} &middot; DepEd Guidelines SY 2026-2027
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              <button onClick={()=>setView('dashboard')}
                className={`px-4 py-2 text-sm font-medium transition ${view==='dashboard'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                Dashboard
              </button>
              <button onClick={()=>setView('certificates')}
                className={`px-4 py-2 text-sm font-medium transition ${view==='certificates'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                disabled={qualifiers.length===0}>
                Certificates ({qualifiers.length})
              </button>
            </div>

            {view==='certificates' && qualifiers.length>0 && (
              <>
                <button onClick={()=>{setPrintAll(false);setTimeout(()=>window.print(),100);}}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
                  <Printer size={16}/> Print This
                </button>
                <button onClick={()=>{setPrintAll(true);setTimeout(()=>window.print(),100);}}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-xl text-sm font-semibold transition">
                  <Users size={16}/> Print All ({qualifiers.length})
                </button>
              </>
            )}

            {view==='dashboard' && qualifiers.length>0 && (
              <button onClick={exportCSV}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
                <Download size={16}/> Export List
              </button>
            )}
          </div>
        </div>

        {/* Grade level warning */}
        {!isEligibleGrade && (
          <div className="no-print m-6 bg-amber-950/40 border border-amber-800 rounded-2xl p-5 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5"/>
            <div>
              <div className="font-semibold text-amber-400">Grade Level Not Eligible</div>
              <p className="text-amber-300/80 text-sm mt-1">
                Academic Excellence Awards are given to learners in <strong>Grades 4&ndash;12</strong> only.
                This section is <strong>{gradeLevel}</strong> (Grade {gradeNumber}), which is below Grade 4.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/> Computing academic standings...
          </div>
        ) : (
          <>
            {/* ── DASHBOARD VIEW ── */}
            {view === 'dashboard' && (
              <div className="no-print p-6">

                {/* DepEd criteria reminder */}
                <div className="bg-blue-950/30 border border-blue-800 rounded-2xl p-4 mb-6 text-sm">
                  <div className="font-semibold text-blue-400 mb-2">
                    DepEd Academic Excellence Award Criteria (SY 2026-2027)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-blue-200 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">1</span>
                      General Average of <strong className="mx-1">95 or above</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">2</span>
                      No subject grade <strong className="mx-1">below 85</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">3</span>
                      Grades <strong className="mx-1">4 to 12</strong> only
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {[
                    { label:'Total Learners',     value:allStudents.length,  color:'from-blue-600 to-blue-800'    },
                    { label:'With Highest Honors', value:qualifiers.filter(r=>r.genAverage>=98).length, color:'from-amber-600 to-amber-800' },
                    { label:'With High Honors',    value:qualifiers.filter(r=>r.genAverage>=95&&r.genAverage<=97).length, color:'from-blue-500 to-blue-700' },
                    { label:'Watchlist',           value:watchlist.length,    color:'from-orange-600 to-orange-800'},
                  ].map(s=>(
                    <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 shadow-lg`}>
                      <p className="text-white/70 text-xs">{s.label}</p>
                      <p className="text-4xl font-bold text-white mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Certificate date picker */}
                <div className="flex items-center gap-4 mb-6">
                  <label className="text-sm text-gray-400 flex-shrink-0">Certificate Date:</label>
                  <input type="date" value={certDate} onChange={e=>setCertDate(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-amber-500"/>
                  <p className="text-gray-600 text-xs">Used on all printed certificates</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-gray-800">
                  {[
                    { key:'qualifiers', label:`🏆 Qualifiers (${qualifiers.length})` },
                    { key:'watchlist',  label:`👀 Watchlist (${watchlist.length})`   },
                    { key:'all',        label:`👥 All Learners (${allStudents.length})` },
                  ].map(t=>(
                    <button key={t.key} onClick={()=>setTab(t.key as any)}
                      className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                        tab===t.key?'border-amber-500 text-amber-400':'border-transparent text-gray-400 hover:text-white'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative mb-4 max-w-xs">
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-500"/>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search learner..."
                    className="w-full pl-8 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"/>
                </div>

                {/* Students table */}
                {displayList.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Trophy size={48} className="mx-auto mb-4 opacity-20"/>
                    <p>{tab==='qualifiers' ? 'No qualifiers yet — encode all term grades first.' : 'No students in this category.'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl">Rank</th>
                          <th className="bg-gray-800 text-left px-3 py-3 min-w-[200px]">Learner&apos;s Name</th>
                          {JHS_SUBJECTS.map(s=>(
                            <th key={s} className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700 text-xs">
                              {s.replace('Araling Panlipunan (AP)','AP')
                               .replace('Edukasyon sa Pagpapakatao (EsP)','EsP')
                               .replace('Edukasyong Pantahanan at Pangkabuhayan (EPP)','EPP')}
                            </th>
                          ))}
                          <th className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700 text-xs">MAPEH</th>
                          <th className="bg-amber-900 text-center px-3 py-3 border-l border-gray-700 font-bold">Gen. Ave.</th>
                          <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700 rounded-tr-xl">Award</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayList.map(result=>{
                          const award = result.awardLevel;
                          return (
                            <tr key={result.student.id}
                              className={`border-t border-gray-800 hover:bg-gray-900/40 ${
                                result.qualifies?'':'opacity-70'
                              }`}>
                              <td className="px-3 py-2 text-center">
                                {result.rank > 0 ? (
                                  <span className="font-bold text-amber-400">{result.rank}</span>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-white">{result.student.full_name}</div>
                                <div className="text-xs text-gray-600">{result.student.lrn}</div>
                                {result.watchlist && result.watchReason.map((r,i)=>(
                                  <div key={i} className="text-xs text-orange-400 mt-0.5">{r}</div>
                                ))}
                              </td>
                              {JHS_SUBJECTS.map(subj=>{
                                const grade = result.finalGrades[subj]??0;
                                const low   = grade>0&&grade<MIN_SUBJECT;
                                return (
                                  <td key={subj} className="text-center border-l border-gray-800 px-1 py-2">
                                    <span className={`font-mono text-sm ${
                                      low?'text-red-400 font-bold':grade>=95?'text-emerald-400 font-bold':'text-gray-300'
                                    }`}>{grade||'—'}</span>
                                  </td>
                                );
                              })}
                              <td className="text-center border-l border-gray-800 px-1 py-2">
                                <span className={`font-mono text-sm ${
                                  result.mapehFinal>0&&result.mapehFinal<MIN_SUBJECT?'text-red-400 font-bold':
                                  result.mapehFinal>=95?'text-emerald-400 font-bold':'text-gray-300'
                                }`}>{result.mapehFinal||'—'}</span>
                              </td>
                              <td className="text-center border-l border-gray-800 px-3 py-2">
                                <span className={`font-bold text-xl ${
                                  result.genAverage>=98?'text-amber-400':
                                  result.genAverage>=95?'text-blue-400':
                                  result.genAverage>=90?'text-orange-400':
                                  result.genAverage>0?'text-gray-300':'text-gray-600'
                                }`}>{result.genAverage||'—'}</span>
                              </td>
                              <td className="text-center border-l border-gray-800 px-3 py-2">
                                {award ? (
                                  <span className="px-2 py-1 rounded-xl text-xs font-bold"
                                    style={{background:award.bg, color:award.color, border:`1px solid ${award.border}`}}>
                                    {award.label}
                                  </span>
                                ) : result.watchlist ? (
                                  <span className="px-2 py-1 rounded-xl text-xs font-medium bg-orange-900/40 text-orange-400 border border-orange-700">
                                    Watchlist
                                  </span>
                                ) : (
                                  <span className="text-gray-600 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Generate certificates button */}
                {qualifiers.length > 0 && (
                  <div className="mt-8 text-center">
                    <button onClick={()=>setView('certificates')}
                      className="flex items-center gap-2 mx-auto bg-amber-600 hover:bg-amber-700 px-8 py-4 rounded-2xl font-bold text-lg transition shadow-xl shadow-amber-900/30">
                      <Trophy size={20}/> Generate Certificates ({qualifiers.length})
                    </button>
                    <p className="text-gray-500 text-sm mt-2">
                      Printable certificates for all qualifying learners
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── CERTIFICATES VIEW ── */}
            {view === 'certificates' && (
              <div className="no-print p-6">
                {/* Navigator */}
                <div className="flex items-center gap-4 mb-6">
                  <select value={selected??qualifiers[0]?.student.id??''}
                    onChange={e=>setSelected(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                    {qualifiers.map((r,i)=>(
                      <option key={r.student.id} value={r.student.id} className="bg-gray-900">
                        {i+1}. {r.student.full_name} &mdash; {r.awardLevel?.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-500 text-sm">Preview individual certificate</span>
                </div>

                {/* Certificate preview */}
                <div className="bg-white rounded-2xl shadow-2xl overflow-auto">
                  <Certificate
                    result={selectedResult ?? qualifiers[0]}
                    section={activeSection}
                    certDate={certDate}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── PRINT AREA ── */}
      <div className="hidden print:block">
        {view==='certificates' && (
          printAll
            ? qualifiers.map(r=>(
                <Certificate key={r.student.id} result={r} section={activeSection} certDate={certDate}/>
              ))
            : (selectedResult??qualifiers[0]) && (
                <Certificate result={selectedResult??qualifiers[0]} section={activeSection} certDate={certDate}/>
              )
        )}
      </div>
    </>
  );
}
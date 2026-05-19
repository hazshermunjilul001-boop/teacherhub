'use client';
import React from 'react';

import { useState, useEffect } from 'react';
import { ArrowLeft, Printer, RefreshCw, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────











// Subjects in SF5 order
const SF5_SUBJECTS = [
  'Filipino', 'English', 'Mathematics', 'Science',
  'Araling Panlipunan (AP)', 'Edukasyon sa Pagpapakatao (EsP)',
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
  'MAPEH - Music', 'MAPEH - Arts', 'MAPEH - Physical Education', 'MAPEH - Health',
];

// MAPEH components averaged into one MAPEH final grade
const MAPEH_COMPONENTS = ['MAPEH - Music', 'MAPEH - Arts', 'MAPEH - Physical Education', 'MAPEH - Health'];

const TRANSMUTATION = [
  { min:99.50,max:100,trans:100},{min:97.50,max:99.49,trans:99},{min:96.00,max:97.49,trans:98},
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

const transmute = (v:number) => TRANSMUTATION.find(t=>v>=t.min&&v<=t.max)?.trans ?? 60;
const descriptor = (g:number) => {
  if(g>=90) return 'Outstanding';
  if(g>=85) return 'Very Satisfactory';
  if(g>=80) return 'Satisfactory';
  if(g>=75) return 'Fairly Satisfactory';
  return 'Did Not Meet Expectations';
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Student { id:string; lrn:string; full_name:string; sex:string; }

interface TermGrade {
  subject: string;
  term: number;
  transmuted: number;
}

interface LearnerSF5 {
  student: Student;
  termGrades: Record<string, number[]>;    // subject -> [t1, t2, t3]
  finalGrades: Record<string, number>;     // subject -> final grade
  mapehFinal: number;
  generalAverage: number;
  failedSubjects: string[];
  action: 'Promoted' | 'Retained' | 'Conditionally Promoted';
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function calcAvgScores(scores: number[], highs: number[]): number {
  // Only count slots where highest > 0 AND score > 0 (actual data entered)
  let tot=0, cnt=0;
  scores.forEach((s,i)=>{ if(highs[i]>0 && s>0){tot+=(s/highs[i])*100; cnt++;} });
  return cnt>0 ? tot/cnt : 0;
}

function computeTransmutedFromGrade(row: any): number {
  // row has written_scores, pt_scores, st_scores, te_score,
  // highest_ww, highest_pt, highest_st, highest_te, subject
  const WEIGHTS: Record<string,{ww:number;pt:number;ta:number}> = {
    'Filipino':{ww:0.25,pt:0.50,ta:0.25},'English':{ww:0.25,pt:0.50,ta:0.25},
    'Mathematics':{ww:0.25,pt:0.50,ta:0.25},'Science':{ww:0.25,pt:0.50,ta:0.25},
    'Araling Panlipunan (AP)':{ww:0.25,pt:0.50,ta:0.25},
    'Edukasyon sa Pagpapakatao (EsP)':{ww:0.25,pt:0.50,ta:0.25},
    'Edukasyong Pantahanan at Pangkabuhayan (EPP)':{ww:0.20,pt:0.60,ta:0.20},
    'MAPEH - Music':{ww:0.20,pt:0.60,ta:0.20},'MAPEH - Arts':{ww:0.20,pt:0.60,ta:0.20},
    'MAPEH - Physical Education':{ww:0.20,pt:0.60,ta:0.20},'MAPEH - Health':{ww:0.20,pt:0.60,ta:0.20},
  };
  const w = WEIGHTS[row.subject] ?? {ww:0.25,pt:0.50,ta:0.25};
  const ww = Array.from({length:5},(_,i)=>row.written_scores?.[i]??0);
  const pt = Array.from({length:3},(_,i)=>row.pt_scores?.[i]??0);
  const st = Array.from({length:2},(_,i)=>row.st_scores?.[i]??0);
  const te = row.te_score??0;
  const hww = row.highest_ww??[100,100,100,100,100];
  const hpt = row.highest_pt??[100,100,100];
  const hst = row.highest_st??[50,50];
  const hte = row.highest_te??100;
  // Guard: if ALL scores are zero, no data was encoded â†’ return 0
  const hasWW = ww.some(v => v > 0);
  const hasPT = pt.some(v => v > 0);
  const hasST = st.some(v => v > 0) || te > 0;
  if (!hasWW && !hasPT && !hasST) return 0;

  // Compute averages per component
  const avgWW = calcAvgScores(ww,hww);
  const avgPT = calcAvgScores(pt,hpt);
  const avgTA = calcAvgScores([...st,te],[...hst,hte]);

  // Redistribute weights among components that actually have data
  const activeComponents: {avg:number; weight:number}[] = [];
  if (hasWW) activeComponents.push({avg:avgWW, weight:w.ww});
  if (hasPT) activeComponents.push({avg:avgPT, weight:w.pt});
  if (hasST) activeComponents.push({avg:avgTA, weight:w.ta});
  const totalWeight = activeComponents.reduce((s,c)=>s+c.weight, 0);
  const initial = totalWeight > 0
    ? activeComponents.reduce((s,comp)=>s+(comp.avg*(comp.weight/totalWeight)),0)
    : 0;
  return initial > 0 ? transmute(initial) : 0;
}

function determineAction(failedSubjects: string[]): LearnerSF5['action'] {
  if (failedSubjects.length === 0) return 'Promoted';
  if (failedSubjects.length <= 2)  return 'Conditionally Promoted';
  return 'Retained';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SF5Page() {
  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, schoolYear, division, region, adviser, schoolHead, district } = useActiveSection();

  const [students,  setStudents]  = useState<Student[]>([]);
  const [sf5Data,   setSF5Data]   = useState<LearnerSF5[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState<'table'|'sf5'>('table');

  // ── Load all data ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);

      // Load students
      const { data: studs } = await supabase
        .from('students').select('*').eq('section_id', sectionId).order('full_name');
      const studentList: Student[] = studs ?? [];
      setStudents(studentList);

      // Load all grades for all terms and all SF5 subjects (+ MAPEH components)
      const allSubjects = [
        'Filipino','English','Mathematics','Science',
        'Araling Panlipunan (AP)','Edukasyon sa Pagpapakatao (EsP)',
        'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
        'MAPEH - Music','MAPEH - Arts','MAPEH - Physical Education','MAPEH - Health',
      ];

      const { data: gradesRaw } = await supabase
        .from('grades')
        .select('*')
        .in('subject', allSubjects)
        .in('term', [1,2,3]);

      // Build SF5 data per student
      const result: LearnerSF5[] = studentList.map(student => {
        const termGrades: Record<string, number[]> = {};
        const finalGrades: Record<string, number>  = {};

        allSubjects.forEach(subj => {
          const t1row = gradesRaw?.find(g => g.student_id===student.id && g.subject===subj && g.term===1);
          const t2row = gradesRaw?.find(g => g.student_id===student.id && g.subject===subj && g.term===2);
          const t3row = gradesRaw?.find(g => g.student_id===student.id && g.subject===subj && g.term===3);

          const t1 = t1row ? computeTransmutedFromGrade({...t1row,subject:subj}) : 0;
          const t2 = t2row ? computeTransmutedFromGrade({...t2row,subject:subj}) : 0;
          const t3 = t3row ? computeTransmutedFromGrade({...t3row,subject:subj}) : 0;

          termGrades[subj] = [t1, t2, t3];
          const recorded = [t1,t2,t3].filter(v=>v>0);
          finalGrades[subj] = recorded.length > 0
            ? Math.round(recorded.reduce((a,b)=>a+b,0)/recorded.length)
            : 0;
        });

        // MAPEH final = average of 4 components
        const mapehScores = MAPEH_COMPONENTS.map(c => finalGrades[c]).filter(v=>v>0);
        const mapehFinal  = mapehScores.length > 0
          ? Math.round(mapehScores.reduce((a,b)=>a+b,0)/mapehScores.length)
          : 0;

        // General Average: use non-MAPEH subjects + MAPEH as one
        const gaSubjects = [
          'Filipino','English','Mathematics','Science',
          'Araling Panlipunan (AP)','Edukasyon sa Pagpapakatao (EsP)',
          'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
        ];
        const gaScores = [...gaSubjects.map(s=>finalGrades[s]), mapehFinal].filter(v=>v>0);
        const generalAverage = gaScores.length > 0
          ? Math.round(gaScores.reduce((a,b)=>a+b,0)/gaScores.length)
          : 0;

        // Failed = below 75
        const failedSubjects = gaSubjects.filter(s => finalGrades[s] > 0 && finalGrades[s] < 75);
        if (mapehFinal > 0 && mapehFinal < 75) failedSubjects.push('MAPEH');

        return {
          student, termGrades, finalGrades,
          mapehFinal, generalAverage, failedSubjects,
          action: determineAction(failedSubjects),
        };
      });

      setSF5Data(result);
      setLoading(false);
    })();
  }, []);

  // ── CSV Export for LIS ─────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = [
      'LRN','Last Name','First Name','Middle Name','Sex',
      'Filipino T1','Filipino T2','Filipino T3','Filipino Final',
      'English T1','English T2','English T3','English Final',
      'Mathematics T1','Mathematics T2','Mathematics T3','Mathematics Final',
      'Science T1','Science T2','Science T3','Science Final',
      'AP T1','AP T2','AP T3','AP Final',
      'EsP T1','EsP T2','EsP T3','EsP Final',
      'EPP T1','EPP T2','EPP T3','EPP Final',
      'MAPEH Final','General Average','Action',
    ];

    const rows = sf5Data.map(d => {
      const nameParts = d.student.full_name.split(',').map(s=>s.trim());
      const lastName  = nameParts[0] ?? '';
      const firstMid  = (nameParts[1] ?? '').split(' ');
      const firstName = firstMid.slice(0,-1).join(' ') || firstMid[0] || '';
      const midName   = firstMid.length > 1 ? firstMid[firstMid.length-1] : '';

      const row = [
        d.student.lrn, lastName, firstName, midName,
        d.student.sex === 'M' ? 'Male' : 'Female',
      ];

      [
        'Filipino','English','Mathematics','Science',
        'Araling Panlipunan (AP)','Edukasyon sa Pagpapakatao (EsP)',
        'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
      ].forEach(subj => {
        const [t1,t2,t3] = d.termGrades[subj] ?? [0,0,0];
        row.push(t1?String(t1):'',t2?String(t2):'',t3?String(t3):'',d.finalGrades[subj]?String(d.finalGrades[subj]):'');
      });

      row.push(d.mapehFinal?String(d.mapehFinal):'', d.generalAverage?String(d.generalAverage):'', d.action);
      return row;
    });

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `SF5_${sectionName}_${schoolYear.replace(' ','')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Summary counts ─────────────────────────────────────────────────────────
  const promoted    = sf5Data.filter(d => d.action === 'Promoted').length;
  const conditional = sf5Data.filter(d => d.action === 'Conditionally Promoted').length;
  const retained    = sf5Data.filter(d => d.action === 'Retained').length;
  const classGA     = sf5Data.filter(d=>d.generalAverage>0).length > 0
    ? sf5Data.filter(d=>d.generalAverage>0).reduce((s,d)=>s+d.generalAverage,0)
      / sf5Data.filter(d=>d.generalAverage>0).length
    : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // SF5 PRINT VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const SF5PrintView = () => {
    const actionText = (d: typeof sf5Data[0]) => {
      if (d.action === 'Promoted' && d.generalAverage >= 90) return 'PROMOTED WITH HONORS';
      if (d.action === 'Promoted')               return 'PROMOTED';
      if (d.action === 'Conditionally Promoted')  return 'CONDITIONALLY PROMOTED';
      return 'RETAINED';
    };
    const males   = sf5Data.filter(d => d.student.sex === 'M');
    const females = sf5Data.filter(d => d.student.sex === 'F');
    const summaryRows = [
      { label:'PROMOTED',               m:sf5Data.filter(d=>d.student.sex==='M'&&d.action==='Promoted').length,               f:sf5Data.filter(d=>d.student.sex==='F'&&d.action==='Promoted').length },
      { label:'CONDITIONALLY PROMOTED', m:sf5Data.filter(d=>d.student.sex==='M'&&d.action==='Conditionally Promoted').length,  f:sf5Data.filter(d=>d.student.sex==='F'&&d.action==='Conditionally Promoted').length },
      { label:'RETAINED',               m:sf5Data.filter(d=>d.student.sex==='M'&&d.action==='Retained').length,               f:sf5Data.filter(d=>d.student.sex==='F'&&d.action==='Retained').length },
    ];
    const descriptorRows = [
      { label:'Did Not Meet Expectations (74 and below)', m:sf5Data.filter(d=>d.student.sex==='M'&&d.generalAverage>0&&d.generalAverage<75).length,  f:sf5Data.filter(d=>d.student.sex==='F'&&d.generalAverage>0&&d.generalAverage<75).length },
      { label:'Fairly Satisfactory (75-79)',              m:sf5Data.filter(d=>d.student.sex==='M'&&d.generalAverage>=75&&d.generalAverage<=79).length, f:sf5Data.filter(d=>d.student.sex==='F'&&d.generalAverage>=75&&d.generalAverage<=79).length },
      { label:'Satisfactory (80-84)',                     m:sf5Data.filter(d=>d.student.sex==='M'&&d.generalAverage>=80&&d.generalAverage<=84).length, f:sf5Data.filter(d=>d.student.sex==='F'&&d.generalAverage>=80&&d.generalAverage<=84).length },
      { label:'Very Satisfactory (85-89)',                m:sf5Data.filter(d=>d.student.sex==='M'&&d.generalAverage>=85&&d.generalAverage<=89).length, f:sf5Data.filter(d=>d.student.sex==='F'&&d.generalAverage>=85&&d.generalAverage<=89).length },
      { label:'Outstanding (90-100)',                     m:sf5Data.filter(d=>d.student.sex==='M'&&d.generalAverage>=90).length,                       f:sf5Data.filter(d=>d.student.sex==='F'&&d.generalAverage>=90).length },
    ];
    const tdB = {border:'1px solid black',padding:'1px 3px',fontSize:'8px'} as React.CSSProperties;
    const thB = {border:'1px solid black',padding:'1px 3px',fontSize:'8px',background:'#f3f4f6',textAlign:'center'} as React.CSSProperties;

    const renderGroup = (group: typeof sf5Data, label: string) => (
      <React.Fragment key={label}>
        <tr>
          <td colSpan={5} style={{...tdB, fontWeight:'bold', background: label==='MALE'?'#dbeafe':'#fce7f3', padding:'2px 4px'}}>{label}</td>
        </tr>
        {group.map((d, idx) => (
          <tr key={d.student.id} style={{background: idx%2===0?'white':'#f9fafb'}}>
            <td style={{...tdB, fontSize:'7px'}}>{d.student.lrn}</td>
            <td style={{...tdB, minWidth:'180px'}}>{d.student.full_name}</td>
            <td style={{...tdB, textAlign:'center', fontWeight:'bold', background: d.generalAverage>=90?'#d1fae5':d.generalAverage>0&&d.generalAverage<75?'#fee2e2':'white'}}>
              {d.generalAverage||''}
            </td>
            <td style={{...tdB, textAlign:'center', fontWeight:'bold', fontSize:'7px',
              color: d.action==='Promoted'?'#166534':d.action==='Retained'?'#991b1b':'#92400e'}}>
              {actionText(d)}
            </td>
            <td style={{...tdB, fontSize:'7px'}}>{d.failedSubjects.length>0?d.failedSubjects.join(', '):''}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={2} style={{...tdB, textAlign:'right', fontStyle:'italic', fontWeight:'bold'}}>
            {group.length} &lt;=== TOTAL {label}
          </td>
          <td colSpan={3} style={tdB}></td>
        </tr>
      </React.Fragment>
    );

    return (
      <div className="bg-white text-black font-sans" style={{padding:'4mm', fontSize:'9px'}}>
        <div style={{textAlign:'center', marginBottom:'3px'}}>
          <div style={{fontWeight:'bold', fontSize:'11px'}}>School Form 5 (SF 5) Report on Promotion and Level of Proficiency &amp; Achievement</div>
          <div style={{fontSize:'8px'}}>(This replaces Forms 18-E1, 18-E2, 18A and List of Graduates)</div>
        </div>
        <div style={{display:'flex', gap:'6px', alignItems:'flex-start'}}>
          {/* LEFT: Main table */}
          <div style={{flex:3}}>
            <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'3px', fontSize:'8px'}}>
              <tbody>
                <tr>
                  <td style={tdB}>Region</td><td style={{...tdB, fontWeight:'bold'}}>{region}</td>
                  <td style={tdB}>Division</td><td style={{...tdB, fontWeight:'bold'}}>{division}</td>
                </tr>
                <tr>
                  <td style={tdB}>School ID</td><td style={{...tdB, fontWeight:'bold'}}>{schoolId}</td>
                  <td style={tdB}>School Year</td><td style={{...tdB, fontWeight:'bold'}}>{schoolYear}</td>
                </tr>
                <tr>
                  <td style={tdB}>School Name</td>
                  <td colSpan={3} style={{...tdB, fontWeight:'bold'}}>{schoolName}</td>
                </tr>
                <tr>
                  <td style={tdB}>Grade Level</td><td style={{...tdB, fontWeight:'bold'}}>{gradeLevel}</td>
                  <td style={tdB}>Section</td><td style={{...tdB, fontWeight:'bold'}}>{sectionName}</td>
                </tr>
              </tbody>
            </table>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px'}}>
              <thead>
                <tr style={{background:'#f3f4f6'}}>
                  <th style={{...thB, minWidth:'110px'}}>LRN</th>
                  <th style={{...thB, minWidth:'180px', textAlign:'left' as const}}>
                    {"LEARNER'S NAME"}<br/>
                    <span style={{fontWeight:'normal', fontSize:'7px'}}>(Last Name, First Name, Middle Name)</span>
                  </th>
                  <th style={{...thB, minWidth:'55px'}}>GENERAL<br/>AVERAGE</th>
                  <th style={{...thB, minWidth:'100px'}}>
                    ACTION TAKEN:<br/>
                    <span style={{fontWeight:'normal', fontSize:'7px'}}>PROMOTED, CONDITIONAL or RETAINED</span>
                  </th>
                  <th style={{...thB, minWidth:'120px', textAlign:'left' as const}}>
                    Did Not Meet Expectations of the ff.<br/>
                    <span style={{fontWeight:'normal', fontSize:'7px'}}>Learning Area/s as of end of current School Year</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {renderGroup(males,  'MALE')}
                {renderGroup(females,'FEMALE')}
                <tr style={{background:'#f3f4f6', fontWeight:'bold'}}>
                  <td colSpan={2} style={{...tdB, textAlign:'right', fontStyle:'italic'}}>
                    {sf5Data.length} &lt;=== COMBINED
                  </td>
                  <td colSpan={3} style={tdB}></td>
                </tr>
              </tbody>
            </table>
            <div style={{border:'1px solid black', padding:'3px', marginTop:'4px', fontSize:'7px', lineHeight:'1.5'}}>
              <div style={{fontWeight:'bold', marginBottom:'2px'}}>Instructions:</div>
              <div>1. The SCC shall conduct checking in their own school, no swapping of SCC from one school to another is permitted.</div>
              <div>2. The name of SCC members shall be printed and put their signature on top (additional space may be added)</div>
              <div>3. The school head is accountable and liable for any wrongful entry on the forms (DepEd Order 4, 2014 par.5) therefore, the DCC is not required to put their names and signatures in SF 5</div>
              <div>4. Only LIS generated SF5 shall be recognized (DO 11, 2018, page 7)</div>
              <div>5. This form shall be submitted to the DCC together with the accomplished SFCR1 - SCC- (DepEd Order 11, 2018, page 11)</div>
            </div>
          </div>

          {/* RIGHT: Summary + Signatures */}
          <div style={{flex:1, minWidth:'185px'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px', marginBottom:'6px'}}>
              <thead>
                <tr><th colSpan={4} style={{...thB, padding:'2px'}}>SUMMARY TABLE</th></tr>
                <tr>
                  <th style={thB}>STATUS</th>
                  <th style={thB}>MALE</th>
                  <th style={thB}>FEMALE</th>
                  <th style={thB}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map(row=>(
                  <tr key={row.label}>
                    <td style={{...tdB, fontWeight:'bold', fontSize:'7px'}}>{row.label}</td>
                    <td style={{...tdB, textAlign:'center'}}>{row.m||''}</td>
                    <td style={{...tdB, textAlign:'center'}}>{row.f||''}</td>
                    <td style={{...tdB, textAlign:'center', fontWeight:'bold'}}>{(row.m+row.f)||''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8px', marginBottom:'8px'}}>
              <thead>
                <tr><th colSpan={4} style={{...thB, padding:'2px'}}>LEVEL OF PROGRESS AND ACHIEVEMENT</th></tr>
                <tr>
                  <th style={{...thB, textAlign:'left' as const, fontSize:'7px'}}>Descriptor &amp; Grading</th>
                  <th style={thB}>MALE</th>
                  <th style={thB}>FEMALE</th>
                  <th style={thB}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {descriptorRows.map(row=>(
                  <tr key={row.label}>
                    <td style={{...tdB, fontSize:'7px'}}>{row.label}</td>
                    <td style={{...tdB, textAlign:'center'}}>{row.m||''}</td>
                    <td style={{...tdB, textAlign:'center'}}>{row.f||''}</td>
                    <td style={{...tdB, textAlign:'center', fontWeight:'bold'}}>{(row.m+row.f)||''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{fontSize:'8px'}}>
              <div style={{fontWeight:'bold', marginBottom:'1px'}}>PREPARED BY:</div>
              <div style={{textAlign:'center', marginBottom:'10mm'}}>
                <div style={{fontWeight:'bold'}}>{adviser.toUpperCase()}</div>
                <div style={{borderTop:'1px solid black', paddingTop:'1px', fontSize:'7px'}}>Class Adviser (Name and Signature)</div>
              </div>
              <div style={{fontWeight:'bold', marginBottom:'1px'}}>CERTIFIED CORRECT &amp; SUBMITTED BY:</div>
              <div style={{textAlign:'center', marginBottom:'10mm'}}>
                <div style={{fontWeight:'bold'}}>{(schoolHead||'').toUpperCase()}</div>
                <div style={{borderTop:'1px solid black', paddingTop:'1px', fontSize:'7px'}}>School Head &amp; SCC Chair (Name and Signature)</div>
              </div>
              <div style={{fontWeight:'bold', marginBottom:'1px'}}>REVIEWED BY: SCC Members</div>
              <div style={{textAlign:'center', marginBottom:'8mm'}}>
                <div style={{borderTop:'1px solid black', paddingTop:'1px', fontSize:'7px'}}>(Signature Over Printed Name)</div>
              </div>
              <div style={{textAlign:'center', marginBottom:'8mm'}}>
                <div style={{borderTop:'1px solid black', paddingTop:'1px', fontSize:'7px'}}>(Signature Over Printed Name)</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{borderTop:'1px solid black', paddingTop:'1px', fontSize:'7px'}}>Generated thru TeacherHub PH (SCC CO-Chair)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`@media print{.no-print{display:none!important}body{background:white!important}@page{size:landscape;margin:8mm}}`}</style>
      <div className="min-h-screen bg-gray-950 text-white">

        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold">SF5 / LIS Export</h1>
              <p className="text-gray-400 text-sm">Report on Promotions · {sectionName} · {schoolYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              <button onClick={() => setView('table')} className={`px-4 py-2 text-sm font-medium transition ${view==='table'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>ðŸ“Š Table</button>
              <button onClick={() => setView('sf5')}   className={`px-4 py-2 text-sm font-medium transition ${view==='sf5'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>ðŸ“„ SF5 Form</button>
            </div>
            <button onClick={exportCSV}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Download size={16}/>Export LIS CSV
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Printer size={16}/>Print SF5
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/>Computing grades from Class Record"¦
          </div>
        ) : (
          <div className="p-6">

            {/* Summary cards */}
            <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5">
                <p className="text-white/70 text-sm">Total Learners</p>
                <p className="text-4xl font-bold text-white">{students.length}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-5">
                <p className="text-white/70 text-sm">Promoted</p>
                <p className="text-4xl font-bold text-white">{promoted}</p>
                <p className="text-white/60 text-xs">no failed subject</p>
              </div>
              <div className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-2xl p-5">
                <p className="text-white/70 text-sm">Conditionally Promoted</p>
                <p className="text-4xl font-bold text-white">{conditional}</p>
                <p className="text-white/60 text-xs">1"“2 failed subjects</p>
              </div>
              <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-5">
                <p className="text-white/70 text-sm">Retained</p>
                <p className="text-4xl font-bold text-white">{retained}</p>
                <p className="text-white/60 text-xs">3+ failed subjects</p>
              </div>
            </div>

            {/* TABLE VIEW */}
            {view === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0" style={{minWidth:'1200px'}}>
                  <thead>
                    <tr>
                      <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl min-w-[200px] sticky left-0 z-10">#  Learner's Name</th>
                      {['Filipino','English','Math','Science','AP','EsP','EPP'].map(s=>(
                        <th key={s} className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700" colSpan={4}>
                          <div className="text-xs">{s}</div>
                          <div className="flex gap-0.5 justify-center mt-0.5">
                            {['T1','T2','T3','F'].map(t=><span key={t} className="text-gray-500 text-xs">{t}</span>)}
                          </div>
                        </th>
                      ))}
                      <th className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700">MAPEH</th>
                      <th className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700">Gen. Ave.</th>
                      <th className="bg-gray-800 text-center px-3 py-3 border-l border-gray-700 rounded-tr-xl">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sf5Data.map((d, idx) => (
                      <tr key={d.student.id} className={`border-t border-gray-800 hover:bg-gray-900/40 ${d.action==='Retained'?'bg-red-950/10':''}`}>
                        <td className="px-3 py-2 sticky left-0 bg-gray-950 border-r border-gray-800 z-10">
                          <span className="text-gray-500 text-xs mr-2">{idx+1}</span>
                          <span className="font-medium text-white text-sm">{d.student.full_name}</span>
                          <div className="text-xs text-gray-600">{d.student.lrn}</div>
                        </td>
                        {['Filipino','English','Mathematics','Science',
                          'Araling Panlipunan (AP)','Edukasyon sa Pagpapakatao (EsP)',
                          'Edukasyong Pantahanan at Pangkabuhayan (EPP)'].map(subj => {
                          const [t1,t2,t3] = d.termGrades[subj]??[0,0,0];
                          const final = d.finalGrades[subj]??0;
                          return (
                            <React.Fragment key={subj}>
                              {[t1,t2,t3].map((v,vi)=>(
                                <td key={subj+vi} className="text-center py-2 border-l border-gray-800 text-xs text-gray-400 font-mono">{v||'"”'}</td>
                              ))}
                              <td className={`text-center py-2 border-l border-gray-800 font-bold ${final<75&&final>0?'text-red-400':final>=75?'text-white':'text-gray-600'}`}>
                                {final||'"”'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className={`text-center py-2 border-l border-gray-800 font-bold ${d.mapehFinal<75&&d.mapehFinal>0?'text-red-400':d.mapehFinal>=75?'text-white':'text-gray-600'}`}>
                          {d.mapehFinal||'"”'}
                        </td>
                        <td className={`text-center py-2 border-l border-gray-800 font-bold text-lg ${d.generalAverage<75&&d.generalAverage>0?'text-red-400':d.generalAverage>=75?'text-yellow-300':'text-gray-600'}`}>
                          {d.generalAverage||'"”'}
                        </td>
                        <td className="text-center py-2 border-l border-gray-800 px-2">
                          {d.action === 'Promoted' && (
                            <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold justify-center">
                              <CheckCircle size={14}/>Promoted
                            </span>
                          )}
                          {d.action === 'Conditionally Promoted' && (
                            <div>
                              <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold justify-center">
                                <AlertCircle size={14}/>Conditional
                              </span>
                              <div className="text-xs text-red-400 mt-0.5">{d.failedSubjects.join(', ')}</div>
                            </div>
                          )}
                          {d.action === 'Retained' && (
                            <div>
                              <span className="flex items-center gap-1 text-red-400 text-xs font-semibold justify-center">
                                <XCircle size={14}/>Retained
                              </span>
                              <div className="text-xs text-red-400 mt-0.5">{d.failedSubjects.join(', ')}</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {sf5Data.length === 0 && (
                  <div className="text-center py-16 text-gray-500">
                    <p className="text-lg">No grade data yet.</p>
                    <p className="text-sm mt-1">Encode grades in the Class Record module first.</p>
                  </div>
                )}
              </div>
            )}

            {/* SF5 FORM VIEW */}
            {view === 'sf5' && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                <SF5PrintView/>
              </div>
            )}
          </div>
        )}

        {/* Print-only */}
        <div className="hidden print:block">
          <SF5PrintView/>
        </div>
      </div>
    </>
  );
}



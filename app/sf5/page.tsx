'use client';
import React from 'react';

import { useState, useEffect } from 'react';
import { ArrowLeft, Printer, RefreshCw, Download, CheckCircle, XCircle, AlertCircle, UserX, ArrowRightLeft, UserPlus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';
import { finalGradeFromTerms, gradeFromClassRecord, isGMRCValuesRowKey, sf9RowsForSection, subjectStorageKeys } from '../../lib/sf9/gradePath';
import type { SF9SubjectRow, SHSTrack } from '../../lib/sf9/sf9GradeBands';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const MAPEH_COMPONENTS = ['MAPEH - Music & Arts', 'MAPEH - PE & Health'];
// ── STATUS ────────────────────────────────────────────────────────────────────
type StudentStatus = 'active'|'dropped'|'transferred_out'|'transferred_in';

const STATUS_CONFIG: Record<StudentStatus,{label:string;color:string;bg:string;icon:any}> = {
  active:          {label:'Active',          color:'text-emerald-400', bg:'bg-emerald-900/40 border-emerald-700', icon:CheckCircle},
  dropped:         {label:'Dropped',         color:'text-red-400',     bg:'bg-red-900/40 border-red-700',         icon:UserX},
  transferred_out: {label:'Transferred Out', color:'text-amber-400',   bg:'bg-amber-900/40 border-amber-700',     icon:ArrowRightLeft},
  transferred_in:  {label:'Transferred In',  color:'text-blue-400',    bg:'bg-blue-900/40 border-blue-700',       icon:UserPlus},
};

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
          <cfg.icon size={16}/>Currently: {cfg.label}
          {student.status_date && student.status !== 'active' && (
            <span className="text-xs font-normal opacity-70">since {student.status_date}</span>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Change Status</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(STATUS_CONFIG) as [StudentStatus, typeof STATUS_CONFIG[StudentStatus]][]).map(([key,conf]) => (
              <button key={key} onClick={() => setStatus(key)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition
                  ${status===key ? `${conf.bg} ${conf.color}` : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
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
                placeholder={status==='dropped'?'e.g. Family relocated...':'e.g. San Pedro NHS'}
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

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface Student {
  id: string; lrn: string; full_name: string; sex: string;
  status?: StudentStatus; status_date?: string; status_note?: string;
}
interface LearnerSF5 {
  student: Student;
  termGrades: Record<string, number[]>;
  finalGrades: Record<string, number>;
  mapehFinal: number;
  mapehTerms: number[];
  generalAverage: number;
  failedSubjects: string[];
  action: 'Promoted'|'Retained'|'Conditionally Promoted'|'Dropped'|'Transferred Out'|'Transferred In';
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function determineAction(student: Student, failedSubjects: string[]): LearnerSF5['action'] {
  if (student.status === 'dropped')         return 'Dropped';
  if (student.status === 'transferred_out') return 'Transferred Out';
  if (student.status === 'transferred_in')  return 'Transferred In';
  if (failedSubjects.length === 0)          return 'Promoted';
  if (failedSubjects.length <= 2)           return 'Conditionally Promoted';
  return 'Retained';
}

function rowTermsFromLeaf(row: SF9SubjectRow, termGrades: Record<string, number[]>): number[] {
  if (!row.isComputed || !row.subRows?.length) return termGrades[row.key] ?? [0,0,0];
  return [0,1,2].map(i => {
    const values = row.subRows!.map(sub => termGrades[sub.key]?.[i] ?? 0).filter(v => v > 0);
    return values.length ? Math.round(values.reduce((a,b)=>a+b,0) / values.length) : 0;
  });
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function SF5Page() {
  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, schoolYear, division, region, adviser, schoolHead, district, activeSection } = useActiveSection();
  const numericGradeLevel = Number(gradeLevel.match(/\d+/)?.[0]) || 0;

  const [students,    setStudents]    = useState<Student[]>([]);
  const [sf5Data,     setSF5Data]     = useState<LearnerSF5[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState<'table'|'sf5'>('table');
  const [statusModal, setStatusModal] = useState<Student|null>(null);
  const [gmrcSource, setGmrcSource] = useState('');
  const [activeTerm, setActiveTerm] = useState<1|2|3>(1);
  const [showFinalComposite, setShowFinalComposite] = useState(false);
  const [sf9Rows, setSf9Rows] = useState<SF9SubjectRow[]>([]);
  const [sf9GaKeys, setSf9GaKeys] = useState<string[]>([]);
  const sf5SubjectColumns = sf9Rows;
  const rowTerms = (d: LearnerSF5, row: SF9SubjectRow): number[] => {
    if (row.isComputed && row.subRows?.length) {
      return [0,1,2].map(i => {
        const values = row.subRows!.map(sub => d.termGrades[sub.key]?.[i] ?? 0).filter(v => v > 0);
        return values.length ? Math.round(values.reduce((a,b)=>a+b,0) / values.length) : 0;
      });
    }
    const values = d.termGrades[row.key] ?? [0,0,0];
    return values;
  };
  const rowFinal = (d: LearnerSF5, row: SF9SubjectRow) => finalGradeFromTerms(rowTerms(d, row));

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: studs } = await supabase
        .from('students').select('*').eq('section_id', sectionId).order('full_name');
      const studentList: Student[] = (studs ?? []).sort((a: Student, b: Student) => {
        const sa = a.sex === 'M' ? 0 : 1, sb = b.sex === 'M' ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return a.full_name.localeCompare(b.full_name);
      });
      setStudents(studentList);

      const { data: sectionMeta } = await supabase.from('sections')
        .select('gmrc_ve_source, shs_track, elective_subjects').eq('id', sectionId).maybeSingle();
      const selectedSource = sectionMeta?.gmrc_ve_source ?? '';
      setGmrcSource(selectedSource);
      const path = sf9RowsForSection(
        numericGradeLevel,
        (sectionMeta?.shs_track as SHSTrack | null) ?? null,
        sectionMeta?.elective_subjects ?? [],
        selectedSource,
      );
      setSf9Rows(path.rows);
      setSf9GaKeys(path.gaKeys);
      const leafRows = path.leafRows;
      const gradeStorageKeys = Array.from(new Set(
        leafRows.flatMap(row => {
          const source = isGMRCValuesRowKey(row.key) ? path.gradeSource.key : row.key;
          return subjectStorageKeys(source);
        })
      ));
      const studentIds = studentList.map(s => s.id);
      const { data: gradesRaw } = await supabase.from('grades').select('*')
        .in('subject', gradeStorageKeys.length ? gradeStorageKeys : ['none'])
        .in('term', [1,2,3])
        .in('student_id', studentIds.length > 0 ? studentIds : ['none']);

      const result: LearnerSF5[] = studentList.map(student => {
        const termGrades: Record<string, number[]> = {};
        const finalGrades: Record<string, number> = {};
        leafRows.forEach(row => {
          const sourceSubject = isGMRCValuesRowKey(row.key) ? path.gradeSource.key : row.key;
          const values = [1,2,3].map(term => {
            const rowData = gradesRaw?.find(g => g.student_id === student.id && subjectStorageKeys(sourceSubject).includes(g.subject) && g.term === term);
            return rowData ? gradeFromClassRecord(rowData, row.key) : 0;
          });
          termGrades[row.key] = values;
          finalGrades[row.key] = finalGradeFromTerms(values);
        });
        const computedFinals: Record<string, number> = {};
        const computedTerms: Record<string, number[]> = {};
        path.rows.filter(row => row.isComputed).forEach(row => {
          const values = rowTermsFromLeaf(row, termGrades);
          computedTerms[row.key] = values;
          computedFinals[row.key] = finalGradeFromTerms(values);
        });
        const gaValues = sf9GaKeys.map(key => computedFinals[key] ?? finalGrades[key] ?? 0);
        const generalAverage = gaValues.length > 0 && gaValues.every(v => v > 0)
          ? Math.round(gaValues.reduce((a,b)=>a+b,0) / gaValues.length) : 0;
        const failedSubjects = sf9GaKeys.filter(key => {
          const value = computedFinals[key] ?? finalGrades[key] ?? 0;
          return value > 0 && value < 75;
        }).map(key => path.rows.find(row => row.key === key)?.label ?? key);
        const mapehTerms = computedTerms['MAPEH'] ?? MAPEH_COMPONENTS.map(() => 0).map((_,i) => {
          const values = MAPEH_COMPONENTS.map(key => termGrades[key]?.[i] ?? 0).filter(v => v > 0);
          return values.length ? Math.round(values.reduce((a,b)=>a+b,0) / values.length) : 0;
        });
        const mapehFinal = computedFinals['MAPEH'] ?? finalGradeFromTerms(mapehTerms);
        return { student, termGrades, finalGrades: { ...finalGrades, ...computedFinals }, mapehFinal, mapehTerms, generalAverage, failedSubjects, action: determineAction(student, failedSubjects) };
      });
      setSF5Data(result);
      setLoading(false);
    })();
  }, [sectionId, numericGradeLevel]);

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = [
      'LRN','Last Name','First Name','Middle Name','Sex','Status',
      ...sf5SubjectColumns.flatMap(row => [`${row.label} T1`, `${row.label} T2`, `${row.label} T3`, `${row.label} Final`]),
      'General Average','Action','Notes',
    ];
    const rows = sf5Data.map(d => {
      const nameParts = d.student.full_name.split(',').map(s=>s.trim());
      const lastName  = nameParts[0] ?? '';
      const firstMid  = (nameParts[1] ?? '').split(' ');
      const firstName = firstMid.slice(0,-1).join(' ') || firstMid[0] || '';
      const midName   = firstMid.length>1 ? firstMid[firstMid.length-1] : '';
      const isInactive = d.student.status && d.student.status !== 'active';
      const row = [d.student.lrn, lastName, firstName, midName, d.student.sex==='M'?'Male':'Female', d.student.status ?? 'active'];
      sf5SubjectColumns.forEach(subjectRow => {
        const [t1,t2,t3] = rowTerms(d, subjectRow);
        const final = rowFinal(d, subjectRow);
        row.push(t1?String(t1):'', t2?String(t2):'', t3?String(t3):'', final?String(final):'');
      });
      row.push(d.generalAverage?String(d.generalAverage):'', d.action, isInactive?(d.student.status_note||''):'');
      return row;
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `SF5_${sectionName}_${schoolYear.replace(' ','')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived counts ────────────────────────────────────────────────────────
  const activeData  = sf5Data.filter(d => !d.student.status || d.student.status === 'active');
  const maleData    = sf5Data.filter(d => d.student.sex === 'M').sort((a,b) => a.student.full_name.localeCompare(b.student.full_name));
  const femaleData  = sf5Data.filter(d => d.student.sex === 'F').sort((a,b) => a.student.full_name.localeCompare(b.student.full_name));
  const promoted    = activeData.filter(d => d.action === 'Promoted').length;
  const conditional = activeData.filter(d => d.action === 'Conditionally Promoted').length;
  const retained    = activeData.filter(d => d.action === 'Retained').length;
  const dropped     = sf5Data.filter(d => d.action === 'Dropped').length;
  const transferred = sf5Data.filter(d => d.action === 'Transferred Out' || d.action === 'Transferred In').length;

  // ── SF5 Print View — matches official DepEd SF5 format ───────────────────
  const SF5PrintView = () => {
    const actionText = (d: typeof sf5Data[0]) => {
      if (d.action === 'Dropped')         return 'DROPPED OUT';
      if (d.action === 'Transferred Out') return 'TRANSFERRED OUT';
      if (d.action === 'Transferred In')  return 'TRANSFERRED IN';
      if (d.action === 'Promoted' && d.generalAverage >= 90) return 'PROMOTED WITH HONORS';
      if (d.action === 'Promoted')               return 'PROMOTED';
      if (d.action === 'Conditionally Promoted')  return 'CONDITIONALLY PROMOTED';
      return 'RETAINED';
    };

    const males   = sf5Data.filter(d => d.student.sex === 'M').sort((a,b) => a.student.full_name.localeCompare(b.student.full_name));
    const females = sf5Data.filter(d => d.student.sex === 'F').sort((a,b) => a.student.full_name.localeCompare(b.student.full_name));

    // Summary table rows — matching official SF5
    const summaryRows = [
      { label:'PROMOTED',               m:activeData.filter(d=>d.student.sex==='M'&&d.action==='Promoted').length,               f:activeData.filter(d=>d.student.sex==='F'&&d.action==='Promoted').length },
      { label:'CONDITIONALLY PROMOTED', m:activeData.filter(d=>d.student.sex==='M'&&d.action==='Conditionally Promoted').length,  f:activeData.filter(d=>d.student.sex==='F'&&d.action==='Conditionally Promoted').length },
      { label:'RETAINED',               m:activeData.filter(d=>d.student.sex==='M'&&d.action==='Retained').length,               f:activeData.filter(d=>d.student.sex==='F'&&d.action==='Retained').length },
    ];

    // Level of Progress rows — matching official SF5
    const progressRows = [
      { label:'Did Not Meet Expectations (74 and below)', m:activeData.filter(d=>d.student.sex==='M'&&d.generalAverage>0&&d.generalAverage<75).length,  f:activeData.filter(d=>d.student.sex==='F'&&d.generalAverage>0&&d.generalAverage<75).length },
      { label:'Fairly Satisfactory (75-79)',              m:activeData.filter(d=>d.student.sex==='M'&&d.generalAverage>=75&&d.generalAverage<=79).length, f:activeData.filter(d=>d.student.sex==='F'&&d.generalAverage>=75&&d.generalAverage<=79).length },
      { label:'Satisfactory (80-84)',                     m:activeData.filter(d=>d.student.sex==='M'&&d.generalAverage>=80&&d.generalAverage<=84).length, f:activeData.filter(d=>d.student.sex==='F'&&d.generalAverage>=80&&d.generalAverage<=84).length },
      { label:'Very Satisfactory (85-89)',                m:activeData.filter(d=>d.student.sex==='M'&&d.generalAverage>=85&&d.generalAverage<=89).length, f:activeData.filter(d=>d.student.sex==='F'&&d.generalAverage>=85&&d.generalAverage<=89).length },
      { label:'Outstanding (90-100)',                     m:activeData.filter(d=>d.student.sex==='M'&&d.generalAverage>=90).length,                       f:activeData.filter(d=>d.student.sex==='F'&&d.generalAverage>=90).length },
    ];

    const td  = {border:'1px solid black',padding:'1px 3px',fontSize:'8px'} as React.CSSProperties;
    const th  = {border:'1px solid black',padding:'1px 3px',fontSize:'8px',background:'#f3f4f6',textAlign:'center' as const,fontWeight:'bold' as const};
    const thL = {...th, textAlign:'left' as const};

    const renderGroup = (group: typeof sf5Data, label: string) => (
      <React.Fragment key={label}>
        <tr>
          <td colSpan={5} style={{...td,fontWeight:'bold',background:label==='MALE'?'#dbeafe':'#fce7f3',textAlign:'left',padding:'2px 4px'}}>
            {label}
          </td>
        </tr>
        {group.map((d, idx) => {
          const isInactive = d.student.status && d.student.status !== 'active';
          return (
            <tr key={d.student.id} style={{background:isInactive?'#fef2f2':idx%2===0?'white':'#f9fafb'}}>
              <td style={{...td,fontSize:'7px',fontFamily:'monospace'}}>{d.student.lrn}</td>
              <td style={{...td,minWidth:'180px',textDecoration:isInactive?'line-through':'none',color:isInactive?'#9ca3af':'inherit'}}>
                {d.student.full_name}
              </td>
              <td style={{...td,textAlign:'center',fontWeight:'bold',
                background:d.generalAverage>=90?'#fef3c7':d.generalAverage>0&&d.generalAverage<75?'#fee2e2':'transparent'}}>
                {d.generalAverage || ''}
              </td>
              <td style={{...td,textAlign:'center',fontWeight:'bold',fontSize:'7px',
                color:d.action==='Promoted'?'#166534':d.action==='Retained'||d.action==='Dropped'?'#991b1b':d.action==='Conditionally Promoted'?'#92400e':'#1e40af'}}>
                {actionText(d)}
              </td>
              <td style={{...td,fontSize:'7px'}}>
                {isInactive
                  ? `${d.student.status_date||''} ${d.student.status_note ? '— '+d.student.status_note : ''}`
                  : d.failedSubjects.length>0 ? d.failedSubjects.join(', ') : ''}
              </td>
            </tr>
          );
        })}
        <tr>
          <td colSpan={2} style={{...td,textAlign:'right',fontStyle:'italic',fontWeight:'bold',background:'#f3f4f6'}}>
            {group.length} &lt;=== TOTAL {label}
          </td>
          <td colSpan={3} style={{...td,background:'#f3f4f6'}}></td>
        </tr>
      </React.Fragment>
    );

    return (
      <div className="bg-white text-black font-sans" style={{padding:'4mm',fontSize:'9px'}}>

        {/* ── TITLE ── */}
        <div style={{textAlign:'center',marginBottom:'2px'}}>
          <div style={{fontWeight:'bold',fontSize:'11px'}}>School Form 5 (SF 5) Report on Promotion and Level of Proficiency &amp; Achievement</div>
          <div style={{fontSize:'8px'}}>(This replaces Forms 18-E1, 18-E2, 18A and List of Graduates)</div>
        </div>

        {/* ── MAIN LAYOUT: left = learner table, right = summary ── */}
        <div style={{display:'flex',gap:'6px',alignItems:'flex-start'}}>

          {/* LEFT SIDE */}
          <div style={{flex:3}}>

            {/* Header info */}
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'2px',fontSize:'8px'}}>
              <tbody>
                <tr>
                  <td style={td}><strong>Region</strong></td>
                  <td style={{...td,fontWeight:'bold'}}>{region}</td>
                  <td style={td}><strong>Division</strong></td>
                  <td style={{...td,fontWeight:'bold'}}>{division}</td>
                </tr>
                <tr>
                  <td style={td}><strong>School ID</strong></td>
                  <td style={{...td,fontWeight:'bold'}}>{schoolId}</td>
                  <td style={td}><strong>School Year</strong></td>
                  <td style={{...td,fontWeight:'bold'}}>{schoolYear}</td>
                </tr>
                <tr>
                  <td style={td}><strong>School Name</strong></td>
                  <td colSpan={3} style={{...td,fontWeight:'bold'}}>{schoolName}</td>
                </tr>
                <tr>
                  <td style={td}><strong>Grade Level</strong></td>
                  <td style={{...td,fontWeight:'bold'}}>{gradeLevel}</td>
                  <td style={td}><strong>Section</strong></td>
                  <td style={{...td,fontWeight:'bold'}}>{sectionName}</td>
                </tr>
              </tbody>
            </table>

            {/* Learner table */}
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'8px'}}>
              <thead>
                <tr>
                  <th style={{...thL,minWidth:'110px'}}>LRN</th>
                  <th style={{...thL,minWidth:'180px'}}>
                    LEARNER'S NAME<br/>
                    <span style={{fontWeight:'normal',fontSize:'7px'}}>(Last Name, First Name, Middle Name)</span>
                  </th>
                  <th style={{...th,minWidth:'50px'}}>GENERAL<br/>AVERAGE</th>
                  <th style={{...th,minWidth:'100px'}}>
                    ACTION TAKEN:<br/>
                    <span style={{fontWeight:'normal',fontSize:'7px'}}>PROMOTED, CONDITIONAL or RETAINED</span>
                  </th>
                  <th style={{...thL,minWidth:'130px'}}>
                    Did Not Meet Expectations of the ff.<br/>
                    <span style={{fontWeight:'normal',fontSize:'7px'}}>Learning Area/s as of end of current School Year</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {renderGroup(males,   'MALE')}
                {renderGroup(females, 'FEMALE')}
                <tr style={{background:'#f3f4f6',fontWeight:'bold'}}>
                  <td colSpan={2} style={{...td,textAlign:'right',fontStyle:'italic'}}>
                    {sf5Data.length} &lt;=== COMBINED
                  </td>
                  <td colSpan={3} style={td}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* RIGHT SIDE */}
          <div style={{flex:1,minWidth:'200px'}}>

            {/* Summary Table */}
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'8px',marginBottom:'4px'}}>
              <thead>
                <tr><th colSpan={4} style={{...th,padding:'2px',fontSize:'9px'}}>SUMMARY TABLE</th></tr>
                <tr>
                  <th style={{...thL,fontSize:'7px'}}>STATUS</th>
                  <th style={th}>MALE</th>
                  <th style={th}>FEMALE</th>
                  <th style={th}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map(row=>(
                  <tr key={row.label}>
                    <td style={{...td,fontSize:'7px',fontWeight:'bold'}}>{row.label}</td>
                    <td style={{...td,textAlign:'center'}}>{row.m||''}</td>
                    <td style={{...td,textAlign:'center'}}>{row.f||''}</td>
                    <td style={{...td,textAlign:'center',fontWeight:'bold'}}>{(row.m+row.f)||''}</td>
                  </tr>
                ))}
                {/* dropped/transferred rows */}
                {[
                  {label:'DROPPED OUT',    m:sf5Data.filter(d=>d.student.sex==='M'&&d.action==='Dropped').length,          f:sf5Data.filter(d=>d.student.sex==='F'&&d.action==='Dropped').length},
                  {label:'TRANSFERRED OUT',m:sf5Data.filter(d=>d.student.sex==='M'&&d.action==='Transferred Out').length,  f:sf5Data.filter(d=>d.student.sex==='F'&&d.action==='Transferred Out').length},
                  {label:'TRANSFERRED IN', m:sf5Data.filter(d=>d.student.sex==='M'&&d.action==='Transferred In').length,   f:sf5Data.filter(d=>d.student.sex==='F'&&d.action==='Transferred In').length},
                ].map(row=>(
                  <tr key={row.label}>
                    <td style={{...td,fontSize:'7px'}}>{row.label}</td>
                    <td style={{...td,textAlign:'center'}}>{row.m||''}</td>
                    <td style={{...td,textAlign:'center'}}>{row.f||''}</td>
                    <td style={{...td,textAlign:'center',fontWeight:'bold'}}>{(row.m+row.f)||''}</td>
                  </tr>
                ))}
                <tr style={{background:'#f0fdf4'}}>
                  <td style={{...td,fontSize:'7px',fontWeight:'bold'}}>TOTAL ENROLLMENT</td>
                  <td style={{...td,textAlign:'center',fontWeight:'bold'}}>{sf5Data.filter(d=>d.student.sex==='M').length}</td>
                  <td style={{...td,textAlign:'center',fontWeight:'bold'}}>{sf5Data.filter(d=>d.student.sex==='F').length}</td>
                  <td style={{...td,textAlign:'center',fontWeight:'bold'}}>{sf5Data.length}</td>
                </tr>
              </tbody>
            </table>

            {/* Level of Progress and Achievement */}
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'8px',marginBottom:'6px'}}>
              <thead>
                <tr><th colSpan={4} style={{...th,padding:'2px',fontSize:'8px'}}>LEVEL OF PROGRESS AND ACHIEVEMENT</th></tr>
                <tr>
                  <th style={{...thL,fontSize:'7px'}}>Descriptor &amp; Grading</th>
                  <th style={th}>MALE</th>
                  <th style={th}>FEMALE</th>
                  <th style={th}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map(row=>(
                  <tr key={row.label}>
                    <td style={{...td,fontSize:'7px'}}>{row.label}</td>
                    <td style={{...td,textAlign:'center'}}>{row.m||''}</td>
                    <td style={{...td,textAlign:'center'}}>{row.f||''}</td>
                    <td style={{...td,textAlign:'center',fontWeight:'bold'}}>{(row.m+row.f)||''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            
            {/* Instructions box */}
            <div style={{border:'1px solid black',padding:'3px',marginTop:'6px',fontSize:'7px',lineHeight:'1.5'}}>
              <strong>Instructions:</strong><br/>
              1. The SCC shall conduct checking in their own school, no swapping of SCC from one school to another is permitted.<br/>
              2. The name of SCC members shall be printed and put their signature on top (additional space may be added).<br/>
              3. The school head is accountable and liable for any wrongful entry on the forms (DepEd Order 4, 2014 par. 5).<br/>
              4. Only LIS generated SF5 shall be recognized (DO 11, 2018, page 7).<br/>
              5. This form shall be submitted to the DCC together with the accomplished SFCR1-SCC (DepEd Order 11, 2018, page 11).
            </div>

            {/* Signatures */}
            <div style={{fontSize:'8px'}}>
              <div style={{fontWeight:'bold',marginBottom:'1px'}}>PREPARED BY:</div>
              <div style={{textAlign:'center',marginBottom:'8mm'}}>
                <div style={{fontWeight:'bold'}}>{adviser.toUpperCase()}</div>
                <div style={{borderTop:'1px solid black',paddingTop:'1px',fontSize:'7px'}}>Class Adviser (Name and Signature)</div>
              </div>

              <div style={{fontWeight:'bold',marginBottom:'1px'}}>CERTIFIED CORRECT &amp; SUBMITTED BY:</div>
              <div style={{textAlign:'center',marginBottom:'8mm'}}>
                <div style={{fontWeight:'bold'}}>{(schoolHead||'').toUpperCase()}</div>
                <div style={{borderTop:'1px solid black',paddingTop:'1px',fontSize:'7px'}}>School Head &amp; SCC Chair (Name and Signature)</div>
              </div>

              <div style={{fontWeight:'bold',marginBottom:'1px'}}>REVIEWED BY: SCC Members</div>
              <div style={{textAlign:'center',marginBottom:'6mm'}}>
                <div style={{borderTop:'1px solid black',paddingTop:'1px',fontSize:'7px'}}>(Signature Over Printed Name)</div>
              </div>
              <div style={{textAlign:'center',marginBottom:'6mm'}}>
                <div style={{borderTop:'1px solid black',paddingTop:'1px',fontSize:'7px'}}>(Signature Over Printed Name)</div>
              </div>
              <div style={{textAlign:'center',marginBottom:'4mm'}}>
                <div style={{borderTop:'1px solid black',paddingTop:'1px',fontSize:'7px'}}>Generated thru TeacherHub PH (SCC CO-Chair)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  const printSubjects = sf5SubjectColumns;
  const printGrade = (d: LearnerSF5, row: SF9SubjectRow) => rowTerms(d, row)[activeTerm - 1] ?? 0;
  const printGeneralAverage = (d: LearnerSF5) => d.generalAverage;
  const rankedLearners = [...sf5Data]
    .filter(d => d.student.status === 'active' && printGeneralAverage(d) > 0)
    .sort((a,b) => printGeneralAverage(b) - printGeneralAverage(a) || a.student.full_name.localeCompare(b.student.full_name));
  const rankByStudent = new Map(rankedLearners.map((d, i) => [d.student.id, i + 1]));

  const CompositePrintView = () => (
    <div className="sf5-composite-print">
      <div className="title">COMPOSITE GRADES — {sectionName}</div>
      <div className="subtitle">{schoolName} · {gradeLevel} · {schoolYear} · TERM {activeTerm}{showFinalComposite ? ' + FINAL COMPOSITE' : ''}</div>
      <table>
        <thead><tr>
          <th style={{width:'4%'}}>#</th><th className="name-cell">LEARNER</th>
          {printSubjects.map(row => <th key={row.key}>{row.label}<br/>T{activeTerm}{showFinalComposite ? ' / FINAL' : ''}</th>)}
          <th>MAPEH<br/>T{activeTerm}{showFinalComposite ? ' / FINAL' : ''}</th><th>GEN.<br/>AVE.</th><th>RANK</th>
        </tr></thead>
        <tbody>
          {(['M','F'] as const).map(sex => {
            const group = sf5Data.filter(d => d.student.sex === sex);
            if (!group.length) return null;
            return <React.Fragment key={sex}>
              <tr className="section-row"><td colSpan={printSubjects.length + 4}>{sex === 'M' ? 'MALE' : 'FEMALE'}</td></tr>
              {group.map((d, i) => <tr key={d.student.id}>
                <td>{i + 1}</td><td className="name-cell">{d.student.full_name}</td>
                {printSubjects.map(row => <td key={row.key}>{printGrade(d, row) || ''}{showFinalComposite ? <><br/><strong>{rowFinal(d, row) || ''}</strong></> : null}</td>)}
                <td><strong>{printGeneralAverage(d) || ''}</strong></td><td>{rankByStudent.get(d.student.id) || ''}</td>
              </tr>)}
            </React.Fragment>;
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: portrait; margin: 5mm; }
          .sf5-screen-wrapper { display: none !important; }
          .sf5-print-only { display: block !important; }
          .sf5-composite-table, .sf5-composite-table th, .sf5-composite-table td { border: 1px solid #000 !important; border-color: #000 !important; color: #000 !important; }
          .sf5-composite-table { border-collapse: collapse !important; }
          .sf5-composite-screen { display: none !important; }
          .sf5-composite-print-only { display: block !important; }
          .sf5-composite-print { width: 100%; color: #000 !important; background: #fff !important; font-family: Arial, sans-serif; }
          .sf5-composite-print table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .sf5-composite-print th, .sf5-composite-print td { border: 1px solid #000; color: #000; padding: 2px 1px; font-size: 6.2pt; line-height: 1.05; text-align: center; }
          .sf5-composite-print th { background: #e5e7eb; font-weight: 700; }
          .sf5-composite-print .name-cell { text-align: left; font-weight: 600; width: 25%; word-break: break-word; }
          .sf5-composite-print .section-row td { background: #d9eaf7; font-weight: 700; text-align: left; }
          .sf5-composite-print .title { text-align: center; font-weight: 700; font-size: 11pt; margin-bottom: 2px; }
          .sf5-composite-print .subtitle { text-align: center; font-size: 7pt; margin-bottom: 5px; }
          .sf5-composite-table th { background: #f3f4f6 !important; color: #000 !important; }
          .sf5-composite-table td { background: #fff !important; color: #000 !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={()=>window.history.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold">SF5 / LIS Export</h1>
              <p className="text-gray-400 text-sm">Report on Promotions &middot; {sectionName} &middot; {schoolYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              <button onClick={()=>setView('table')} className={`px-4 py-2 text-sm font-medium transition ${view==='table'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                Table
              </button>
              <button onClick={()=>setView('sf5')} className={`px-4 py-2 text-sm font-medium transition ${view==='sf5'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                SF5 Form
              </button>
            </div>
            <button onClick={exportCSV} className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Download size={16}/>Export LIS CSV
            </button>
            <button onClick={()=>window.print()} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Printer size={16}/>Print SF5
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/>Computing grades...
          </div>
        ) : (
          <div className="p-6">
            <div className="no-print text-xs text-gray-600 italic mb-4">
              Click a learner's name to view info or update their status (Dropped, Transferred, etc.)
            </div>

            {/* Summary cards */}
            <div className="no-print grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-4">
                <p className="text-white/70 text-xs">Total Learners</p>
                <p className="text-3xl font-bold text-white">{sf5Data.length}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-4">
                <p className="text-white/70 text-xs">Promoted</p>
                <p className="text-3xl font-bold text-white">{promoted}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-2xl p-4">
                <p className="text-white/70 text-xs">Conditional</p>
                <p className="text-3xl font-bold text-white">{conditional}</p>
                <p className="text-white/60 text-xs">1-2 failed</p>
              </div>
              <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-4">
                <p className="text-white/70 text-xs">Retained</p>
                <p className="text-3xl font-bold text-white">{retained}</p>
                <p className="text-white/60 text-xs">3+ failed</p>
              </div>
              <div className="bg-gradient-to-br from-gray-600 to-gray-800 rounded-2xl p-4">
                <p className="text-white/70 text-xs">Dropped</p>
                <p className="text-3xl font-bold text-white">{dropped}</p>
              </div>
              <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl p-4">
                <p className="text-white/70 text-xs">Transferred</p>
                <p className="text-3xl font-bold text-white">{transferred}</p>
              </div>
            </div>

            {/* Composite table controls */}
            {view === 'table' && (
              <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900">
                <label className="text-sm font-semibold">Show term:</label>
                <select value={activeTerm} onChange={e => setActiveTerm(Number(e.target.value) as 1|2|3)} className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm">
                  <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option>
                </select>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={showFinalComposite} onChange={e => setShowFinalComposite(e.target.checked)} />
                  Show final composite (Terms 1–3 average)
                </label>
                <span className="text-xs text-gray-500">These settings also apply when printing the Table view.</span>
              </div>
            )}

            {/* Table view */}
            {view === 'table' && (
              <div className="sf5-composite-screen overflow-x-auto">
                <table className="sf5-composite-table w-full text-sm border-separate border-spacing-0" style={{minWidth:'1200px'}}>
                  <thead>
                    <tr>
                      <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl min-w-[200px] sticky left-0 z-10">Learner</th>
                      {sf5SubjectColumns.map(row=>(
                        <th key={row.key} className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700 min-w-[80px]">
                          <div className="text-xs">{row.label}</div>
                          <div className="flex gap-0.5 justify-center mt-0.5">
                            <span className="text-gray-500 text-xs">T{activeTerm}</span>{showFinalComposite && <span className="text-gray-500 text-xs ml-2">Final</span>}
                          </div>
                        </th>
                      ))}
                      <th className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700 min-w-[60px] text-xs">MAPEH</th>
                      <th className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700 min-w-[60px]">GA</th>
                      <th className="bg-gray-800 text-center px-2 py-3 border-l border-gray-700 rounded-tr-xl min-w-[140px]">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={sf5SubjectColumns.length + 3} className="bg-blue-950/50 px-3 py-1.5 text-blue-400 font-bold text-xs">MALE ({maleData.length})</td></tr>
                    {maleData.map((d,idx) => {
                      const isInactive = d.student.status && d.student.status !== 'active';
                      return (
                        <tr key={d.student.id} className={`border-t border-gray-800 ${isInactive?'opacity-60 bg-gray-900/60':'hover:bg-gray-900/40'}`}>
                          <td className="px-3 py-2 sticky left-0 bg-gray-950 border-r border-gray-800 z-10">
                            <span className="text-gray-500 text-xs mr-2">{idx+1}</span>
                            <button onClick={()=>setStatusModal(d.student)} className={`font-medium text-sm hover:text-blue-300 transition text-left ${isInactive?'line-through text-gray-500':'text-white'}`}>
                              {d.student.full_name}
                            </button>
                            <div className="text-xs text-gray-600">{d.student.lrn}</div>
                            {isInactive && <div className="text-xs text-amber-500 mt-0.5">{d.student.status==='dropped'?'Dropped':d.student.status==='transferred_out'?'Transferred Out':'Transferred In'}{d.student.status_date?` (${d.student.status_date})`:''}</div>}
                          </td>
                          {sf5SubjectColumns.map(row => {
                            const [t1,t2,t3] = rowTerms(d, row);
                            const final = rowFinal(d, row);
                            const subj = row.key;
                            return (
                              <td key={row.key} className="border-l border-gray-800">
                                <div className="flex justify-center">
                                  <span className="text-center py-2 px-1 text-xs text-gray-400 w-10 inline-block">{[t1,t2,t3][activeTerm-1]||''}</span>
                                  {showFinalComposite && <span className={`text-center py-2 px-1 text-xs font-bold w-10 inline-block ${final>=75?'text-emerald-400':final>0?'text-red-400':'text-gray-600'}`}>{final||''}</span>}
                                </div>
                              </td>
                            );
                          })}
                          <td className={`text-center py-2 border-l border-gray-800 font-bold text-lg ${d.generalAverage>=75?'text-white':d.generalAverage>0?'text-red-400':'text-gray-600'}`}>{d.generalAverage||''}</td>
                          <td className="px-3 py-2 border-l border-gray-800">
                            {d.action==='Promoted' && <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold"><CheckCircle size={14}/>Promoted{d.generalAverage>=90?' (Honors)':''}</span>}
                            {d.action==='Conditionally Promoted' && <div><span className="flex items-center gap-1 text-amber-400 text-xs font-semibold"><AlertCircle size={14}/>Conditional</span><div className="text-xs text-red-400 mt-0.5">{d.failedSubjects.join(', ')}</div></div>}
                            {d.action==='Retained' && <div><span className="flex items-center gap-1 text-red-400 text-xs font-semibold"><XCircle size={14}/>Retained</span><div className="text-xs text-red-400 mt-0.5">{d.failedSubjects.join(', ')}</div></div>}
                            {d.action==='Dropped' && <span className="flex items-center gap-1 text-gray-400 text-xs font-semibold"><UserX size={14}/>Dropped{d.student.status_date?` (${d.student.status_date})`:''}</span>}
                            {d.action==='Transferred Out' && <span className="flex items-center gap-1 text-violet-400 text-xs font-semibold"><ArrowRightLeft size={14}/>Transferred Out</span>}
                            {d.action==='Transferred In' && <span className="flex items-center gap-1 text-blue-400 text-xs font-semibold"><UserPlus size={14}/>Transferred In</span>}
                          </td>
                        </tr>
                      );
                    })}

                    <tr><td colSpan={sf5SubjectColumns.length + 3} className="bg-pink-950/50 px-3 py-1.5 text-pink-400 font-bold text-xs">FEMALE ({femaleData.length})</td></tr>
                    {femaleData.map((d,idx) => {
                      const isInactive = d.student.status && d.student.status !== 'active';
                      return (
                        <tr key={d.student.id} className={`border-t border-gray-800 ${isInactive?'opacity-60 bg-gray-900/60':'hover:bg-gray-900/40'}`}>
                          <td className="px-3 py-2 sticky left-0 bg-gray-950 border-r border-gray-800 z-10">
                            <span className="text-gray-500 text-xs mr-2">{idx+1}</span>
                            <button onClick={()=>setStatusModal(d.student)} className={`font-medium text-sm hover:text-blue-300 transition text-left ${isInactive?'line-through text-gray-500':'text-white'}`}>
                              {d.student.full_name}
                            </button>
                            <div className="text-xs text-gray-600">{d.student.lrn}</div>
                            {isInactive && <div className="text-xs text-amber-500 mt-0.5">{d.student.status==='dropped'?'Dropped':d.student.status==='transferred_out'?'Transferred Out':'Transferred In'}{d.student.status_date?` (${d.student.status_date})`:''}</div>}
                          </td>
                          {sf5SubjectColumns.map(row => {
                            const [t1,t2,t3] = rowTerms(d, row);
                            const final = rowFinal(d, row);
                            const subj = row.key;
                            return (
                              <td key={row.key} className="border-l border-gray-800">
                                <div className="flex justify-center">
                                  <span className="text-center py-2 px-1 text-xs text-gray-400 w-10 inline-block">{[t1,t2,t3][activeTerm-1]||''}</span>
                                  {showFinalComposite && <span className={`text-center py-2 px-1 text-xs font-bold w-10 inline-block ${final>=75?'text-emerald-400':final>0?'text-red-400':'text-gray-600'}`}>{final||''}</span>}
                                </div>
                              </td>
                            );
                          })}
                          <td className={`text-center py-2 border-l border-gray-800 font-bold text-lg ${d.generalAverage>=75?'text-white':d.generalAverage>0?'text-red-400':'text-gray-600'}`}>{d.generalAverage||''}</td>
                          <td className="px-3 py-2 border-l border-gray-800">
                            {d.action==='Promoted' && <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold"><CheckCircle size={14}/>Promoted{d.generalAverage>=90?' (Honors)':''}</span>}
                            {d.action==='Conditionally Promoted' && <div><span className="flex items-center gap-1 text-amber-400 text-xs font-semibold"><AlertCircle size={14}/>Conditional</span><div className="text-xs text-red-400 mt-0.5">{d.failedSubjects.join(', ')}</div></div>}
                            {d.action==='Retained' && <div><span className="flex items-center gap-1 text-red-400 text-xs font-semibold"><XCircle size={14}/>Retained</span><div className="text-xs text-red-400 mt-0.5">{d.failedSubjects.join(', ')}</div></div>}
                            {d.action==='Dropped' && <span className="flex items-center gap-1 text-gray-400 text-xs font-semibold"><UserX size={14}/>Dropped{d.student.status_date?` (${d.student.status_date})`:''}</span>}
                            {d.action==='Transferred Out' && <span className="flex items-center gap-1 text-violet-400 text-xs font-semibold"><ArrowRightLeft size={14}/>Transferred Out</span>}
                            {d.action==='Transferred In' && <span className="flex items-center gap-1 text-blue-400 text-xs font-semibold"><UserPlus size={14}/>Transferred In</span>}
                          </td>
                        </tr>
                      );
                    })}

                    {sf5Data.length === 0 && (
                      <tr><td colSpan={sf5SubjectColumns.length + 3} className="text-center py-16 text-gray-500"><p className="text-sm mt-1">Encode grades in the Class Record module first.</p></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SF5 Form screen view — hidden during print */}
            {view === 'sf5' && (
              <div className="sf5-screen-wrapper bg-white rounded-2xl overflow-hidden shadow-2xl">
                <SF5PrintView/>
              </div>
            )}
          </div>
        )}

        {/* Print-only — always rendered, hidden on screen, shown on print */}
        {view === 'table' && (
          <div className="sf5-composite-print-only" style={{display:'none'}}>
            <CompositePrintView/>
          </div>
        )}
        {view === 'sf5' && (
          <div className="sf5-print-only" style={{display:'none'}}>
            <SF5PrintView/>
          </div>
        )}
      </div>

      {statusModal && (
        <StudentStatusModal
          student={statusModal}
          onClose={() => setStatusModal(null)}
          onUpdate={updated => {
            setStudents(prev => prev.map(s => s.id===updated.id ? updated : s));
            setSF5Data(prev => prev.map(d => d.student.id===updated.id
              ? { ...d, student: updated, action: determineAction(updated, d.failedSubjects) }
              : d
            ));
            setStatusModal(null);
          }}
        />
      )}
    </>
  );
}

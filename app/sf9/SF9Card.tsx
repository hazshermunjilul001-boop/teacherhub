'use client';

import type { CSSProperties } from 'react';
import type { SF9SubjectRow } from '../../lib/sf9/sf9GradeBands';
import type { LearnerSF9, GradeCell } from '../../lib/sf9/useSF9Data';

// ─────────────────────────────────────────────────────────────────────────────
// Constants unrelated to grade-band logic
// ─────────────────────────────────────────────────────────────────────────────

const CORE_VALUES = [
  { value: '1. Maka-Diyos', behaviors: [
    "Expresses one's spiritual beliefs while respecting the spiritual beliefs of others.",
    'Shows adherence to ethical principles by upholding truth in all undertakings.',
  ]},
  { value: '2. Makatao', behaviors: [
    'Is sensitive to individual, social, and cultural differences.',
    'Demonstrates contributions towards solidarity.',
  ]},
  { value: '3. Makakalikasan', behaviors: [
    'Cares for the environment and utilizes resources wisely, judiciously, and economically.',
  ]},
  { value: '4. Makabansa', behaviors: [
    'Demonstrates pride in being a Filipino; exercises the rights and responsibilities of a Filipino citizen.',
    'Demonstrates appropriate behavior in carrying out activities in school, community, and country.',
  ]},
];

const CONDUCT_LABELS: Record<string,string> = {
  AO:'Always Observed', SO:'Sometimes Observed', RO:'Rarely Observed', NO:'Not Observed',
};

const DESCRIPTOR_LEGEND: [string, string, string][] = [
  ['ADVANCING',    '90–100', 'Passed'],
  ['BENCHMARKING', '80–89',  'Passed'],
  ['CONNECTING',   '75–79',  'Passed'],
  ['DEVELOPING',   '65–74',  'Failed'],
  ['EMERGING',     '0–64',   'Failed'],
];

const PROMOTION_COLOR: Record<string,string> = {
  'Promoted':               '#166534',
  'Conditionally Promoted': '#b45309',
  'Failed':                 '#b91c1c',
};

// ─────────────────────────────────────────────────────────────────────────────

function calcAge(birthdate?: string): number | null {
  if (!birthdate) return null;
  const bd = new Date(birthdate);
  if (isNaN(bd.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const monthDiff = today.getMonth() - bd.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

function computedRowTermCells(row: SF9SubjectRow, data: LearnerSF9): GradeCell[] {
  return [0,1,2].map(ti => {
    const scores = (row.subRows ?? [])
      .map(sr => data.grades[sr.key]?.[ti]?.value ?? 0)
      .filter(v => v > 0);
    const value = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    return { value, source: 'none' } as GradeCell;
  });
}

interface SF9CardProps {
  data: LearnerSF9;
  section: any;
  frontPage: SF9SubjectRow[];
  continuationPage: SF9SubjectRow[];
}

export default function SF9Card({ data, section, frontPage, continuationPage }: SF9CardProps) {
  const nameParts   = data.student.full_name.split(',').map((s:string) => s.trim());
  const lastName    = nameParts[0] ?? '';
  const rawThirdPart = (nameParts[2] ?? '').trim();
  const has3PartMiddle = rawThirdPart !== '' && !['-', '.', 'n/a'].includes(rawThirdPart.toLowerCase());
  const afterComma  = (nameParts[1] ?? '').trim();
  const afterTokens = afterComma.split(' ').filter(Boolean);
  const middleName  = (data.student.middle_name ?? '').trim()
    || (has3PartMiddle ? rawThirdPart : '')
    || (!has3PartMiddle && afterTokens.length > 1 ? afterTokens[afterTokens.length - 1] : '');
  const firstName   = has3PartMiddle
    ? afterComma
    : (afterTokens.length > 1 ? afterTokens.slice(0, -1).join(' ') : afterComma);
  const studentAge  = calcAge(data.student.birthdate);
  const schoolHead  = (section?.school_head ?? '').toUpperCase();
  const adviserName = (section?.adviser     ?? '').toUpperCase();

  const HALF_W = '138mm';

  const cellStyle = (bg='white'): CSSProperties => ({
    border:'1px solid black', textAlign:'center', padding:'1px 2px',
    fontSize:'8pt', background: bg,
  });

  const gradeCell = (cell: GradeCell, key: string|number) => (
    <td key={key} style={cellStyle(cell.value>0&&cell.value<75?'#fee2e2':'white')}>
      {cell.value||''}
    </td>
  );

  const SigLine = ({ name, title, marginTop='6mm' }: { name:string; title:string; marginTop?:string }) => (
    <div style={{textAlign:'center', marginTop}}>
      <div style={{
        borderTop:'1px solid black', paddingTop:'2px', fontSize:'7.5pt',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        maxWidth:'100%', fontWeight:'bold',
      }}>
        {name || '\u00a0'}
      </div>
      <div style={{fontSize:'7pt', fontStyle:'italic', marginTop:'1px'}}>{title}</div>
    </div>
  );

  /** One subject row + its optional sub-rows, for the grades table. */
  const renderSubjectRow = (row: SF9SubjectRow) => {
    const isParentComputed = row.isComputed && row.subRows?.length;
    const cells  = isParentComputed ? computedRowTermCells(row, data) : (data.grades[row.key] ?? [
      {value:0,source:'none'},{value:0,source:'none'},{value:0,source:'none'},
    ] as GradeCell[]);
    const final  = data.finalGrades[row.key] ?? 0;
    const failed = final > 0 && final < 75;

    return (
      <>
        <tr key={row.key}>
          <td style={{border:'1px solid black', padding:'2px 3px', fontWeight: isParentComputed ? 'bold' : undefined}}>
            {row.label}
          </td>
          {cells.map((cell,i)=>gradeCell(cell,i))}
          <td style={cellStyle(failed?'#fee2e2':'white')}><b>{final||''}</b></td>
          <td style={{border:'1px solid black', textAlign:'center', padding:'2px',
            fontSize:'7.5pt', color:failed?'red':'inherit'}}>
            {final>0?(failed?'Failed':'Passed'):''}
          </td>
        </tr>
        {isParentComputed && row.subRows!.map(sub => {
          const subCells = data.grades[sub.key] ?? [
            {value:0,source:'none'},{value:0,source:'none'},{value:0,source:'none'},
          ] as GradeCell[];
          const subFinal = data.finalGrades[sub.key] ?? 0;
          return (
            <tr key={sub.key}>
              <td style={{border:'1px solid black', padding:'2px 3px 2px 10px', fontSize:'7.5pt', color:'#555', fontStyle:'italic'}}>
                {sub.label}
              </td>
              {subCells.map((cell,i)=>(
                <td key={i} style={{border:'1px solid black', textAlign:'center', padding:'2px', fontSize:'7.5pt', color:'#666'}}>
                  {cell.value||''}
                </td>
              ))}
              <td style={{border:'1px solid black', textAlign:'center', padding:'2px', fontSize:'7.5pt', color:'#666'}}>
                {subFinal||''}
              </td>
              <td style={{border:'1px solid black'}}></td>
            </tr>
          );
        })}
      </>
    );
  };

  const GeneralAverageRow = () => (
    <tr style={{background:'#f0fdf4'}}>
      <td colSpan={4} style={{border:'1px solid black', padding:'2px 4px', fontWeight:'bold', textAlign:'right', fontSize:'8.5pt'}}>
        General Average
      </td>
      <td style={{border:'1px solid black', textAlign:'center', fontWeight:'bold', fontSize:'11pt', padding:'2px',
        background: data.genAverage>0 && data.genAverage<75 ? '#fee2e2' : '#dcfce7'}}>
        {data.genAverage||''}
      </td>
      <td style={{border:'1px solid black', textAlign:'center', fontWeight:'bold',
        color: data.promotionRemark ? PROMOTION_COLOR[data.promotionRemark] : 'inherit',
        fontSize:'7.5pt', padding:'2px'}}>
        {data.promotionRemark ? data.promotionRemark.toUpperCase() : ''}
      </td>
    </tr>
  );

  const GradesTableHead = () => (
    <thead>
      <tr style={{background:'#f3f4f6'}}>
        <th style={{border:'1px solid black', padding:'2px 3px', textAlign:'left', width:'34%'}}>Learning Areas</th>
        <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'12%'}}>Term 1</th>
        <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'12%'}}>Term 2</th>
        <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'12%'}}>Term 3</th>
        <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'14%'}}>Final Grade</th>
        <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'16%'}}>Remarks</th>
      </tr>
    </thead>
  );

  const MONTH_LABELS = data.attendance.map(a => a.monthLabel);
  const attendanceTotal = (key: 'days'|'present'|'absent') =>
    data.attendance.reduce((s,a)=>s+((a as any)[key]||0),0);

  return (
    <div className="sf9-card" style={{
      width:'278mm', margin:'0 auto', fontFamily:'Arial, sans-serif',
      fontSize:'9pt', color:'black', background:'white', boxSizing:'border-box' as const,
    }}>

      {/* ══════════════════════════════════════════════════════
          MAIN PAGE — matches the official single-page landscape
          layout exactly: LEFT = header/info/grades, RIGHT =
          attendance/comments/signatures/certificate. Same column
          order as generateSF9Docx.ts, so the on-screen preview,
          the print output, and the downloaded .docx all match.
          ══════════════════════════════════════════════════════ */}
      <div style={{
        display:'flex', width:'100%', border:'1px solid black', minHeight:'190mm',
        pageBreakAfter: continuationPage.length ? 'always' : undefined,
      }}>

        {/* ── LEFT: Header / Student Info / Learning Progress ── */}
        <div style={{ width: HALF_W, flexShrink:0, borderRight:'1px solid black', padding:'4mm 5mm', fontSize:'8pt', boxSizing:'border-box' as const }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'3mm', marginBottom:'2mm' }}>
            <img src="/depedseal.webp" alt="DepEd Seal" style={{width:'14mm', height:'14mm', objectFit:'contain', flexShrink:0}}/>
            <div style={{textAlign:'center', flex:1}}>
              <div style={{fontSize:'7.5pt'}}>Republic of the Philippines</div>
              <div style={{fontWeight:'bold', fontSize:'9pt'}}>DEPARTMENT OF EDUCATION</div>
              <div style={{fontSize:'7.5pt'}}>
                {section?.region ?? 'Region XI'} &mdash; {section?.division ?? ''}
              </div>
              {section?.header_scope_name && (
                <div style={{fontSize:'7pt'}}>{section.header_scope_name}</div>
              )}
              <div style={{ fontWeight:'bold', textDecoration:'underline', fontSize:'9.5pt', marginTop:'1mm', textTransform:'uppercase' }}>
                {section?.school_name ?? ''}
              </div>
              {section?.school_address && (
                <div style={{fontSize:'7pt'}}>{section.school_address}</div>
              )}
              {section?.school_id && (
                <div style={{fontSize:'6.5pt', color:'#555'}}>School ID: {section.school_id}</div>
              )}
            </div>
            <img src="/depedlogo.webp" alt="School Logo" style={{width:'14mm', height:'14mm', objectFit:'contain', flexShrink:0}}/>
          </div>

          <div style={{textAlign:'center', fontWeight:'bold', fontSize:'10.5pt', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'1mm'}}>
            Learner&apos;s Performance Report
          </div>
          <div style={{textAlign:'center', fontSize:'7.5pt', marginBottom:'2mm'}}>
            School Year {section?.school_year ?? ''}
          </div>

          {/* Compact 2-3 line student info, matching the official form's field arrangement */}
          <div style={{fontSize:'8pt', marginBottom:'2mm'}}>
            <div style={{display:'flex', alignItems:'flex-end', gap:'2mm', marginBottom:'1mm'}}>
              <span style={{fontWeight:'bold', whiteSpace:'nowrap'}}>Name:</span>
              <div style={{flex:1, borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px'}}>
                {lastName}, {firstName} {middleName}
              </div>
              <span style={{fontWeight:'bold', whiteSpace:'nowrap', marginLeft:'2mm'}}>Age:</span>
              <div style={{width:'20px', borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px'}}>{studentAge ?? ''}</div>
              <span style={{fontWeight:'bold', whiteSpace:'nowrap', marginLeft:'2mm'}}>Sex:</span>
              <div style={{width:'40px', borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px'}}>{data.student.sex==='M'?'Male':'Female'}</div>
            </div>
            <div style={{display:'flex', alignItems:'flex-end', gap:'2mm', marginBottom: section?.shs_track ? '1mm' : 0}}>
              <span style={{fontWeight:'bold', whiteSpace:'nowrap'}}>LRN:</span>
              <div style={{flex:1, borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px'}}>{data.student.lrn}</div>
              <span style={{fontWeight:'bold', whiteSpace:'nowrap', marginLeft:'2mm'}}>Grade:</span>
              <div style={{width:'40px', borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px'}}>{section?.grade_level??''}</div>
              <span style={{fontWeight:'bold', whiteSpace:'nowrap', marginLeft:'2mm'}}>Section:</span>
              <div style={{width:'60px', borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px'}}>{section?.name??''}</div>
            </div>
            {section?.shs_track && (
              <div style={{display:'flex', alignItems:'flex-end', gap:'2mm'}}>
                <span style={{fontWeight:'bold', whiteSpace:'nowrap', fontSize:'7.5pt'}}>Track (SHS only):</span>
                <div style={{flex:1, borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px', fontSize:'7.5pt'}}>
                  {section.shs_track === 'techpro' ? 'TechPro (TVL/Sports/Arts & Design)' : 'Academic'}
                </div>
              </div>
            )}
          </div>

          <div style={{fontSize:'7pt', lineHeight:'1.3', marginBottom:'1.5mm'}}>
            <p>Dear Parents,</p>
            <p>
              This Performance Report presents your child&apos;s progress and achievement in the different learning areas.
              The school welcomes you to reach out should you wish to know more about your child&apos;s learning and performance.
            </p>
          </div>

          <div style={{display:'flex', justifyContent:'space-between', gap:'4mm', marginBottom:'2mm'}}>
            <SigLine name={schoolHead} title="School Head" marginTop="2mm"/>
            <SigLine name={adviserName} title="Adviser" marginTop="2mm"/>
          </div>

          <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'1.5mm', fontSize:'8.5pt'}}>
            LEARNING PROGRESS AND ACHIEVEMENT
          </div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8pt'}}>
            <GradesTableHead/>
            <tbody>
              {frontPage.map(row => renderSubjectRow(row))}
              {!continuationPage.length && <GeneralAverageRow/>}
            </tbody>
          </table>

          {/* Performance Descriptors — plain columns, no grid lines, matching
              the official form's borderless layout (Grading Scale first). */}
          <div style={{marginTop:'3mm', fontSize:'7pt'}}>
            <div style={{fontWeight:'bold', marginBottom:'1mm'}}>PERFORMANCE DESCRIPTORS</div>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  <th style={{padding:'1px 8px 1px 0', textAlign:'left', fontWeight:'bold'}}>Grading Scale</th>
                  <th style={{padding:'1px 8px', textAlign:'left', fontWeight:'bold'}}>Descriptors</th>
                  <th style={{padding:'1px 0', textAlign:'left', fontWeight:'bold'}}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {DESCRIPTOR_LEGEND.map(([d,s,r])=>(
                  <tr key={d}>
                    <td style={{padding:'1px 8px 1px 0'}}>{s}</td>
                    <td style={{padding:'1px 8px'}}>{d.charAt(0)+d.slice(1).toLowerCase()}</td>
                    <td style={{padding:'1px 0'}}>{r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── RIGHT: Attendance / Comments / Signatures / Certificate ── */}
        <div style={{ width: HALF_W, flexShrink:0, padding:'5mm', fontSize:'8pt', boxSizing:'border-box' as const }}>
          <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'2mm', fontSize:'8.5pt'}}>
            REPORT ON ATTENDANCE
          </div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'6pt', marginBottom:'5mm'}}>
            <thead>
              <tr>
                <td style={{border:'1px solid black', padding:'1px'}}></td>
                {MONTH_LABELS.map(m=>(
                  <td key={m} style={{border:'1px solid black', padding:'1px', textAlign:'center', fontWeight:'bold'}}>{m}</td>
                ))}
                <td style={{border:'1px solid black', padding:'1px', textAlign:'center', fontWeight:'bold'}}>Total</td>
              </tr>
            </thead>
            <tbody>
              {[
                {label:'No. of Class Days',   key:'days'},
                {label:'No. of Days Present', key:'present'},
                {label:'No. of Days Absent',  key:'absent'},
              ].map(row=>(
                <tr key={row.key}>
                  <td style={{border:'1px solid black', padding:'1px 2px', fontSize:'6pt', whiteSpace:'nowrap'}}>{row.label}</td>
                  {data.attendance.map((att,i)=>(
                    <td key={i} style={{border:'1px solid black', textAlign:'center', padding:'1px'}}>
                      {(att as any)[row.key]||''}
                    </td>
                  ))}
                  <td style={{border:'1px solid black', textAlign:'center', fontWeight:'bold', padding:'1px'}}>
                    {attendanceTotal(row.key as 'days'|'present'|'absent')||''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Teacher's Comments — bordered box per term, matching the
              official form's rectangles instead of a plain underline. */}
          <div style={{fontWeight:'bold', marginBottom:'2mm', fontSize:'8pt'}}>TEACHER&apos;S COMMENTS / REMARKS</div>
          <div style={{display:'flex', flexDirection:'column', gap:'2mm', marginBottom:'4mm'}}>
            {['Term 1','Term 2','Term 3'].map(t=>(
              <div key={t} style={{border:'1px solid black', minHeight:'12mm', padding:'2px 4px'}}>
                <span style={{fontSize:'7.5pt', fontWeight:'bold'}}>{t}:</span>
              </div>
            ))}
          </div>

          <div style={{fontWeight:'bold', textAlign:'center', margin:'4mm 0 3mm', fontSize:'8pt'}}>
            PARENT/S GUARDIAN&apos;S SIGNATURE
          </div>
          {['Term 1','Term 2','Term 3'].map(t=>(
            <div key={t} style={{display:'flex', alignItems:'flex-end', marginBottom:'5mm', gap:'2mm'}}>
              <span style={{fontSize:'7.5pt', whiteSpace:'nowrap', minWidth:'50px'}}>{t}</span>
              <div style={{flex:1, borderBottom:'1px solid black', marginBottom:'1px'}}></div>
            </div>
          ))}

          <div style={{fontSize:'7.5pt', marginTop:'3mm', borderTop:'1px solid #ccc', paddingTop:'3mm'}}>
            <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'2mm', fontSize:'8pt'}}>Certificate of Transfer</div>
            <p style={{fontSize:'7pt', marginBottom:'2mm'}}>
              This is to certify that the above-named learner has satisfactorily completed the requirements for the grade level indicated.
            </p>
            <div style={{marginBottom:'2mm'}}>Admitted to Grade: ______________</div>
            <div style={{marginBottom:'4mm'}}>Eligible for Admission to Grade: ______________</div>

            <div style={{display:'flex', alignItems:'flex-end', gap:'2mm', marginBottom:'6mm'}}>
              <span style={{whiteSpace:'nowrap'}}>Approved:</span>
              <div style={{flex:1}}>
                <div style={{borderBottom:'1px solid black', minHeight:'4mm'}}></div>
                <div style={{textAlign:'center', fontStyle:'italic', fontSize:'7pt', marginTop:'1px'}}>Adviser</div>
              </div>
            </div>
            <div style={{width:'55%'}}>
              <div style={{borderBottom:'1px solid black', minHeight:'4mm'}}></div>
              <div style={{textAlign:'center', fontStyle:'italic', fontSize:'7pt', marginTop:'1px'}}>School Head</div>
            </div>

            <div style={{fontWeight:'bold', textAlign:'center', margin:'5mm 0 3mm', fontSize:'8pt'}}>
              CANCELLATION OF ELIGIBILITY TO TRANSFER
            </div>
            <div style={{display:'flex', gap:'4mm', marginBottom:'6mm'}}>
              <span style={{whiteSpace:'nowrap'}}>Admitted in:</span>
              <div style={{flex:1, borderBottom:'1px solid black'}}></div>
              <span style={{whiteSpace:'nowrap'}}>Date:</span>
              <div style={{width:'25mm', borderBottom:'1px solid black'}}></div>
            </div>
            <div style={{width:'55%'}}>
              <div style={{borderBottom:'1px solid black', minHeight:'4mm'}}></div>
              <div style={{textAlign:'center', fontStyle:'italic', fontSize:'7pt', marginTop:'1px'}}>School Head</div>
            </div>
          </div>
        </div>
      </div>


      {/* ══════════════════════════════════════════════════════
          SHS CONTINUATION SHEET (electives 4+ / Work Immersion)
          Only rendered for SHS sections with overflow rows.
          ══════════════════════════════════════════════════════ */}
      {continuationPage.length > 0 && (
        <div style={{ width:'100%', border:'1px solid black', padding:'6mm', fontSize:'8pt', boxSizing:'border-box' as const, pageBreakAfter:'always' }}>
          <div style={{textAlign:'center', marginBottom:'4mm'}}>
            <div style={{fontWeight:'bold', fontSize:'9pt', textTransform:'uppercase'}}>
              Learner&apos;s Report Card — Continuation Sheet
            </div>
            <div style={{fontSize:'7.5pt', marginTop:'1mm'}}>
              {lastName}, {firstName} {middleName} &nbsp;|&nbsp; LRN: {data.student.lrn} &nbsp;|&nbsp;
              Grade {section?.grade_level ?? ''} &ndash; {section?.name ?? ''}
            </div>
          </div>
          <table style={{width:'60%', margin:'0 auto', borderCollapse:'collapse', fontSize:'8pt'}}>
            <GradesTableHead/>
            <tbody>
              {continuationPage.map(row => renderSubjectRow(row))}
              <GeneralAverageRow/>
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TEACHERHUB EXTRA — Report on Learner's Observed Values.
          Not part of the official DepEd SF9 template (the released
          form has no Core Values section) — kept here as an
          IN-APP-ONLY extra: visible on screen, excluded from both
          print and the .docx export (className="no-print" is
          defined in page.tsx's @media print block).
          ══════════════════════════════════════════════════════ */}
      <div className="no-print" style={{ width:'100%', border:'2px dashed #999', padding:'6mm', fontSize:'8pt', boxSizing:'border-box' as const }}>
        <div style={{textAlign:'center', marginBottom:'3mm'}}>
          <span style={{fontSize:'7pt', color:'#888', fontStyle:'italic'}}>
            TeacherHub Extra — not part of the official SF9, not included in the downloaded .docx
          </span>
          <div style={{fontWeight:'bold', fontSize:'8.5pt', marginTop:'1mm'}}>
            REPORT ON LEARNER&apos;S OBSERVED VALUES
          </div>
        </div>
        <table style={{width:'80%', margin:'0 auto', borderCollapse:'collapse', fontSize:'7pt', marginBottom:'4mm'}}>
          <thead>
            <tr style={{background:'#f3f4f6'}}>
              <th style={{border:'1px solid black', padding:'2px', width:'22%', textAlign:'center'}}>Core Values</th>
              <th style={{border:'1px solid black', padding:'2px', textAlign:'left', width:'44%'}}>Behavior Statements</th>
              <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'11%'}}>T1</th>
              <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'11%'}}>T2</th>
              <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'11%'}}>T3</th>
            </tr>
          </thead>
          <tbody>
            {CORE_VALUES.map(cv=>cv.behaviors.map((b,bi)=>(
              <tr key={b}>
                {bi===0&&(
                  <td style={{border:'1px solid black', padding:'2px', fontWeight:'bold', verticalAlign:'middle', textAlign:'center', fontSize:'7pt'}} rowSpan={cv.behaviors.length}>
                    {cv.value}
                  </td>
                )}
                <td style={{border:'1px solid black', padding:'2px', fontSize:'6.5pt', lineHeight:'1.3'}}>{b}</td>
                {[1,2,3].map(term=>(
                  <td key={term} style={{border:'1px solid black', textAlign:'center', fontWeight:'bold', padding:'2px', fontSize:'9pt'}}>
                    {data.conduct[`${b}_${term}`]??''}
                  </td>
                ))}
              </tr>
            )))}
          </tbody>
        </table>
        <div style={{fontSize:'7pt', width:'50%', margin:'0 auto'}}>
          <div style={{fontWeight:'bold', marginBottom:'2px', textAlign:'center'}}>Non-Numerical Rating</div>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <tbody>
              {Object.entries(CONDUCT_LABELS).map(([k,v])=>(
                <tr key={k}>
                  <td style={{border:'1px solid black', padding:'1px 3px', fontWeight:'bold', width:'25px', textAlign:'center'}}>{k}</td>
                  <td style={{border:'1px solid black', padding:'1px 3px'}}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SF9 Multi-Grade Revamp — Phase 5: docx export
//
// IMPORTANT STRUCTURAL NOTE — please read before wiring this in:
// The 7 official PDFs you provided are each a SINGLE landscape page with two
// columns (left: header/student info/grades table/descriptor legend; right:
// monthly attendance/comments/parent signatures/certificate of transfer).
// There is NO Core Values / behavior-rating section anywhere in the new
// official template — that page only exists in TeacherHub's current
// folded-booklet SF9Card design (Phase 4), not in DepEd's released form.
//
// This generator matches the OFFICIAL single-page structure exactly, since
// that's almost certainly what schools need for compliance/printing. If you
// want the printed docx to also carry the Core Values page as a TeacherHub
// value-add, say so and I'll append it as an optional second page — right
// now it's intentionally left out to match the source PDFs precisely.
//
// No logo is embedded — matches the PDFs' "Insert School Logo" placeholder
// circle, since schools add their own crest before printing.
// ============================================================================

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, HeadingLevel,
  PageOrientation, VerticalAlign, PageBreak, ImageRun,
} from 'docx';
import JSZip from 'jszip';
import type { SF9SubjectRow } from '../../lib/sf9/sf9GradeBands';
import type { LearnerSF9, GradeCell } from '../../lib/sf9/useSF9Data';

// ── Layout constants (twips = 1/20 pt; 1440 = 1") ──────────────────────────
// docx-js swaps width/height internally for LANDSCAPE, so the `size` passed
// to Document must be the PORTRAIT dimensions (11906 x 16838) — PAGE_W/PAGE_H
// below are the resulting RENDERED landscape dimensions, used only for our
// own usable-width math, not passed directly as page.size.
const PORTRAIT_W = 11906, PORTRAIT_H = 16838; // A4 portrait — what page.size must receive
const PAGE_W = PORTRAIT_H, PAGE_H = PORTRAIT_W; // rendered landscape dims, for our layout math
const MARGIN = 560;                    // ~0.39"
const USABLE_W = PAGE_W - MARGIN * 2;  // ~15718
const LEFT_W  = Math.round(USABLE_W * 0.46);
const RIGHT_W = USABLE_W - LEFT_W;

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const ALL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
const NO_BORDERS  = {
  top:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, bottom:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},
  left:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, right:{style:BorderStyle.NONE,size:0,color:'FFFFFF'},
};
const HEADER_SHADING = { type: ShadingType.CLEAR, fill: 'F3F4F6' };
const PASS_SHADING   = { type: ShadingType.CLEAR, fill: 'DCFCE7' };
const FAIL_SHADING   = { type: ShadingType.CLEAR, fill: 'FEE2E2' };

const cell = (children: Paragraph[], opts: Partial<ConstructorParameters<typeof TableCell>[0]> = {}) =>
  new TableCell({ children, borders: ALL_BORDERS, verticalAlign: VerticalAlign.CENTER, margins:{top:20,bottom:20,left:60,right:60}, ...opts });

const p = (text: string, opts: { bold?:boolean; italics?:boolean; size?:number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; underline?:boolean } = {}) =>
  new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    children: [ new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size ?? 16, underline: opts.underline ? {} : undefined }) ],
  });

// ─────────────────────────────────────────────────────────────────────────

function computedRowTermValues(row: SF9SubjectRow, data: LearnerSF9): number[] {
  return [0,1,2].map(ti => {
    const scores = (row.subRows ?? []).map(sr => data.grades[sr.key]?.[ti]?.value ?? 0).filter(v=>v>0);
    return scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
  });
}

function buildGradesTable(rows: SF9SubjectRow[], data: LearnerSF9, width: number, gaKeys: string[]): Table {
  const colW = [
    Math.round(width*0.34), Math.round(width*0.12), Math.round(width*0.12),
    Math.round(width*0.12), Math.round(width*0.14), Math.round(width*0.16),
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: ['Learning Areas','T1','T2','T3','Final Grade','Remarks'].map((h,i)=>
      cell([p(h,{bold:true,size:14,align:AlignmentType.CENTER})], { width:{size:colW[i],type:WidthType.DXA}, shading: HEADER_SHADING })
    ),
  });

  const dataRows: TableRow[] = [];
  rows.forEach(row => {
    const isParentComputed = row.isComputed && row.subRows?.length;
    const termVals = isParentComputed ? computedRowTermValues(row, data)
      : (data.grades[row.key] ?? []).map((c: GradeCell) => c.value);
    const final = data.finalGrades[row.key] ?? 0;
    const failed = final > 0 && final < 75;

    dataRows.push(new TableRow({ children: [
      cell([p(row.label,{bold: !!isParentComputed, size:14})], { width:{size:colW[0],type:WidthType.DXA} }),
      ...[0,1,2].map(i => cell([p(termVals[i]?String(termVals[i]):'',{align:AlignmentType.CENTER,size:14})], { width:{size:colW[i+1],type:WidthType.DXA} })),
      cell([p(final?String(final):'',{bold:true,align:AlignmentType.CENTER,size:14})], { width:{size:colW[4],type:WidthType.DXA}, shading: failed?FAIL_SHADING:undefined }),
      cell([p(final?(failed?'Failed':'Passed'):'',{align:AlignmentType.CENTER,size:14})], { width:{size:colW[5],type:WidthType.DXA} }),
    ]}));

    if (isParentComputed) {
      row.subRows!.forEach(sub => {
        const subVals = (data.grades[sub.key] ?? []).map((c: GradeCell) => c.value);
        const subFinal = data.finalGrades[sub.key] ?? 0;
        dataRows.push(new TableRow({ children: [
          cell([p(sub.label,{italics:true,size:12})], { width:{size:colW[0],type:WidthType.DXA} }),
          ...[0,1,2].map(i => cell([p(subVals[i]?String(subVals[i]):'',{align:AlignmentType.CENTER,size:12})], { width:{size:colW[i+1],type:WidthType.DXA} })),
          cell([p(subFinal?String(subFinal):'',{align:AlignmentType.CENTER,size:12})], { width:{size:colW[4],type:WidthType.DXA} }),
          cell([p('')], { width:{size:colW[5],type:WidthType.DXA} }),
        ]}));
      });
    }
  });

  const gaFailed = data.genAverage > 0 && data.genAverage < 75;
  const remarkText = data.promotionRemark ? data.promotionRemark.toUpperCase() : '';
  dataRows.push(new TableRow({ children: [
    cell([p('General Average',{bold:true,align:AlignmentType.RIGHT,size:14})], { columnSpan:4, width:{size:colW[0]+colW[1]+colW[2]+colW[3],type:WidthType.DXA} }),
    cell([p(data.genAverage?String(data.genAverage):'',{bold:true,align:AlignmentType.CENTER,size:18})], { width:{size:colW[4],type:WidthType.DXA}, shading: data.genAverage ? (gaFailed?FAIL_SHADING:PASS_SHADING) : undefined }),
    cell([p(remarkText,{bold:true,align:AlignmentType.CENTER,size:11})], { width:{size:colW[5],type:WidthType.DXA} }),
  ]}));

  return new Table({ width:{size:width,type:WidthType.DXA}, columnWidths: colW, rows: [headerRow, ...dataRows] });
}

function buildDescriptorLegend(width: number): Table {
  // The preview uses a compact, borderless three-column legend rather than a
  // second fully boxed table. Keep the same labels and ranges while matching
  // that visual hierarchy in the exported document.
  const colW = [Math.round(width*0.42), Math.round(width*0.28), width - Math.round(width*0.42) - Math.round(width*0.28)];
  const legend: [string,string,string][] = [
    ['ADVANCING','90–100','Passed'], ['BENCHMARKING','80–89','Passed'], ['CONNECTING','75–79','Passed'],
    ['DEVELOPING','65–74','Failed'], ['EMERGING','0–64','Failed'],
  ];
  return new Table({
    width:{size:width,type:WidthType.DXA}, columnWidths: colW,
    rows: [
      new TableRow({ children: ['Descriptors','Grading Scale','Remarks'].map((h,i)=>cell([p(h,{bold:true,size:11,align:i===0?AlignmentType.LEFT:AlignmentType.CENTER})],{borders:NO_BORDERS,width:{size:colW[i],type:WidthType.DXA}})) }),
      ...legend.map(([d,s,r])=>new TableRow({ children: [d,s,r].map((v,i)=>cell([p(v,{size:10,align:i===0?AlignmentType.LEFT:AlignmentType.CENTER})],{borders:NO_BORDERS,width:{size:colW[i],type:WidthType.DXA}})) })),
    ],
  });
}

function buildCommentBox(label: string, width: number): Table {
  const rows = Array.from({length: 3}, (_, i) => new TableRow({ children: [
    cell([p(i === 0 ? label : '', { bold: i === 0, size: 11 })], {
      borders: ALL_BORDERS, width:{size:width,type:WidthType.DXA}, margins:{top:45,bottom:45,left:70,right:70},
    }),
  ]}));
  return new Table({width:{size:width,type:WidthType.DXA}, columnWidths:[width], rows});
}

function buildSignatureLines(width: number, title: string): Table {
  return new Table({ width:{size:width,type:WidthType.DXA}, columnWidths:[width], rows: [
    new TableRow({ children: [cell([p('',{size:11}), p(title,{align:AlignmentType.CENTER,size:10})], { borders:{...NO_BORDERS, bottom:THIN_BORDER}, width:{size:width,type:WidthType.DXA}, margins:{top:90,bottom:30,left:70,right:70} })] }),
    new TableRow({ children: [cell([p('',{size:11}), p(title,{align:AlignmentType.CENTER,size:10})], { borders:{...NO_BORDERS, bottom:THIN_BORDER}, width:{size:width,type:WidthType.DXA}, margins:{top:90,bottom:30,left:70,right:70} })] }),
    new TableRow({ children: [cell([p('',{size:11}), p(title,{align:AlignmentType.CENTER,size:10})], { borders:{...NO_BORDERS, bottom:THIN_BORDER}, width:{size:width,type:WidthType.DXA}, margins:{top:90,bottom:30,left:70,right:70} })] }),
  ]});
}

function buildAttendanceTable(data: LearnerSF9, width: number): Table {
  const labelW = Math.round(width*0.26);
  const colCount = data.attendance.length + 1; // + Total
  const colW = Math.floor((width - labelW) / colCount);
  const widths = [labelW, ...Array(colCount).fill(colW)];
  widths[widths.length-1] += width - widths.reduce((a,b)=>a+b,0); // absorb rounding into Total col

  const header = new TableRow({ children: [
    cell([p('')], { width:{size:labelW,type:WidthType.DXA} }),
    ...data.attendance.map(a => cell([p(a.monthLabel,{bold:true,align:AlignmentType.CENTER,size:11})], { width:{size:colW,type:WidthType.DXA}, shading:HEADER_SHADING })),
    cell([p('Total',{bold:true,align:AlignmentType.CENTER,size:11})], { width:{size:widths[widths.length-1],type:WidthType.DXA}, shading:HEADER_SHADING }),
  ]});

  const rows = ([
    {label:'No. of Class Days', key:'days'},
    {label:'No. of Days Present', key:'present'},
    {label:'No. of Days Absent', key:'absent'},
  ] as const).map(r => {
    const total = data.attendance.reduce((s,a)=>s+((a as any)[r.key]||0),0);
    return new TableRow({ children: [
      cell([p(r.label,{size:10})], { width:{size:labelW,type:WidthType.DXA} }),
      ...data.attendance.map((a,i) => cell([p(String((a as any)[r.key]||''),{align:AlignmentType.CENTER,size:11})], { width:{size:colW,type:WidthType.DXA} })),
      cell([p(String(total||''),{bold:true,align:AlignmentType.CENTER,size:11})], { width:{size:widths[widths.length-1],type:WidthType.DXA} }),
    ]});
  });

  return new Table({ width:{size:width,type:WidthType.DXA}, columnWidths: widths, rows: [header, ...rows] });
}

function fieldRow(label: string, value: string, labelW=1600): TableRow {
  return new TableRow({ children: [
    cell([p(label,{size:14})], { borders: NO_BORDERS, width:{size:labelW,type:WidthType.DXA} }),
    cell([p(value,{bold:true,size:14})], { borders:{...NO_BORDERS, bottom:THIN_BORDER}, width:{size:LEFT_W-labelW,type:WidthType.DXA} }),
  ]});
}

// ─────────────────────────────────────────────────────────────────────────

export interface SF9PreviewImage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface SF9DocxParams {
  data: LearnerSF9;
  section: any;                 // sections row — includes Phase 1 fields
  frontPage: SF9SubjectRow[];
  continuationPage: SF9SubjectRow[];
  gaKeys: string[];
  /** PNG snapshots of the exact visible preview pages. When present, these are
   * embedded directly so DOCX output and browser print use one source of truth. */
  previewImages?: SF9PreviewImage[];
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function buildSF9Docx({ data, section, frontPage, continuationPage, gaKeys, previewImages }: SF9DocxParams): Promise<Blob> {
  const nameParts = data.student.full_name.split(',').map(s=>s.trim());
  const lastName = nameParts[0] ?? '';
  const firstMiddle = nameParts.slice(1).join(', ');
  const scopeLabel = section?.header_scope_type === 'cluster' ? 'Cluster' : 'District';

  // ── LEFT COLUMN content ──
  const leftChildren: (Paragraph|Table)[] = [
    p('Republic of the Philippines', { align: AlignmentType.CENTER, size: 14 }),
    p('DEPARTMENT OF EDUCATION', { align: AlignmentType.CENTER, bold: true, size: 18 }),
    p(`${section?.region ?? ''} — ${section?.division ?? ''}`, { align: AlignmentType.CENTER, size: 14 }),
    ...(section?.header_scope_name ? [p(section.header_scope_name, { align: AlignmentType.CENTER, size: 13 })] : []),
    p('[ Insert School Logo ]', { align: AlignmentType.CENTER, italics: true, size: 12 }),
    p((section?.school_name ?? '').toUpperCase(), { align: AlignmentType.CENTER, bold: true, size: 20, underline: true }),
    p(section?.school_address ?? '', { align: AlignmentType.CENTER, size: 12 }),
    p('LEARNER\'S PERFORMANCE REPORT', { align: AlignmentType.CENTER, bold: true, size: 18 }),
    p(`School Year ${section?.school_year ?? ''}`, { align: AlignmentType.CENTER, size: 14 }),
    new Paragraph({ text: '' }),
    new Table({
      width:{size:LEFT_W,type:WidthType.DXA}, columnWidths:[1600, LEFT_W-1600],
      rows: [
        fieldRow('Name:', `${lastName}, ${firstMiddle}`),
        fieldRow('LRN:', data.student.lrn ?? ''),
        fieldRow('Age:', data.student.birthdate ? '' : ''),
        fieldRow('Sex:', data.student.sex === 'M' ? 'Male' : 'Female'),
        fieldRow('Grade:', String(section?.grade_level ?? '')),
        fieldRow('Section:', section?.name ?? ''),
        ...(section?.shs_track ? [fieldRow('Track:', section.shs_track === 'techpro' ? 'TechPro' : 'Academic')] : []),
      ],
    }),
    new Paragraph({ text: '' }),
    p('Dear Parents,', { size: 14 }),
    p('This Performance Report presents your child\'s progress and achievement in the different learning areas.', { size: 13 }),
    p('The school welcomes you to reach out should you wish to know more about your child\'s learning and performance.', { size: 13 }),
    new Paragraph({ text: '' }),
    new Table({
      width:{size:LEFT_W,type:WidthType.DXA}, columnWidths:[LEFT_W/2, LEFT_W/2],
      rows: [ new TableRow({ children: [
        cell([p('School Head',{align:AlignmentType.CENTER,size:12})], { borders:{...NO_BORDERS, top:THIN_BORDER}, width:{size:LEFT_W/2,type:WidthType.DXA} }),
        cell([p((section?.adviser??'').toUpperCase()||'Adviser',{align:AlignmentType.CENTER,size:12})], { borders:{...NO_BORDERS, top:THIN_BORDER}, width:{size:LEFT_W/2,type:WidthType.DXA} }),
      ]})],
    }),
    new Paragraph({ text: '' }),
    p('LEARNING PROGRESS AND ACHIEVEMENT', { align: AlignmentType.CENTER, bold: true, size: 15 }),
    buildGradesTable(frontPage, data, LEFT_W, gaKeys),
    new Paragraph({ text: '' }),
    buildDescriptorLegend(LEFT_W),
  ];

  // ── RIGHT COLUMN content ──
  const rightChildren: (Paragraph|Table)[] = [
    p('REPORT ON ATTENDANCE', { align: AlignmentType.CENTER, bold: true, size: 15 }),
    buildAttendanceTable(data, RIGHT_W),
    new Paragraph({ text: '' }),
    p('TEACHER\'S COMMENTS / REMARKS', { align: AlignmentType.CENTER, bold: true, size: 14 }),
    buildCommentBox('Term 1:', RIGHT_W),
    buildCommentBox('Term 2:', RIGHT_W),
    buildCommentBox('Term 3:', RIGHT_W),
    new Paragraph({ text: '' }),
    p('PARENT/S GUARDIAN\'S SIGNATURE', { align: AlignmentType.CENTER, bold: true, size: 14 }),
    buildSignatureLines(RIGHT_W, 'Parent/Guardian'),
    new Paragraph({ text: '' }),
    p('CERTIFICATE OF TRANSFER', { align: AlignmentType.CENTER, bold: true, size: 14 }),
    p('This is to certify that the above-named learner has satisfactorily completed the requirements for the grade level indicated.', { size: 11 }),
    p('Admitted to Grade: ____________________', { size: 12 }),
    p('Eligible for Admission to Grade: ____________________', { size: 12 }),
    p('Approved:', { size: 11 }),
    buildSignatureLines(RIGHT_W, 'Adviser'),
    p('Cancellation of Eligibility to Transfer', { align: AlignmentType.CENTER, bold: true, size: 12 }),
    p('This learner is no longer eligible for transfer because of the following reason: ________________________________', { size: 10 }),
    buildSignatureLines(RIGHT_W, 'School Head'),
  ];

  const outerTable = new Table({
    width: { size: USABLE_W, type: WidthType.DXA },
    columnWidths: [LEFT_W, RIGHT_W],
    rows: [ new TableRow({ children: [
      cell(leftChildren as Paragraph[], { borders: NO_BORDERS, width:{size:LEFT_W,type:WidthType.DXA} }),
      cell(rightChildren as Paragraph[], { borders:{...NO_BORDERS, left:THIN_BORDER}, width:{size:RIGHT_W,type:WidthType.DXA} }),
    ]})],
  });

  const bodyChildren: (Paragraph|Table)[] = [outerTable];

  // SHS continuation page — only if there are overflow electives / Work Immersion
  if (continuationPage.length) {
    bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));
    bodyChildren.push(p('Learner\'s Report Card — Continuation Sheet', { align: AlignmentType.CENTER, bold: true, size: 18 }));
    bodyChildren.push(p(`${lastName}, ${firstMiddle}  |  LRN: ${data.student.lrn}  |  Grade ${section?.grade_level ?? ''} - ${section?.name ?? ''}`, { align: AlignmentType.CENTER, size: 13 }));
    bodyChildren.push(new Paragraph({ text: '' }));
    const continuationWidth = Math.round(USABLE_W * 0.6);
    bodyChildren.push(new Table({
      width:{size:USABLE_W,type:WidthType.DXA}, columnWidths:[Math.round((USABLE_W-continuationWidth)/2), continuationWidth, Math.round((USABLE_W-continuationWidth)/2)],
      rows:[new TableRow({ children:[
        cell([p('')],{borders:NO_BORDERS,width:{size:Math.round((USABLE_W-continuationWidth)/2),type:WidthType.DXA}}),
        cell([buildGradesTable(continuationPage, data, continuationWidth, gaKeys) as any],{borders:NO_BORDERS,width:{size:continuationWidth,type:WidthType.DXA}}),
        cell([p('')],{borders:NO_BORDERS,width:{size:Math.round((USABLE_W-continuationWidth)/2),type:WidthType.DXA}}),
      ]})]
    }));
  }

  const pageProperties = {
    page: {
      size: { width: PORTRAIT_W, height: PORTRAIT_H, orientation: PageOrientation.LANDSCAPE },
      margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    },
  };

  // Exact-preview mode is used by the interactive Download This action. Each
  // preview page becomes one DOCX section/page, preserving the same wrapping,
  // borders, images, whitespace, and continuation-page pagination as print.
  const doc = previewImages?.length
    ? new Document({
        sections: previewImages.map(image => {
          // ImageRun dimensions are pixels, not twips. 1050px is the usable
          // width of an A4 landscape page at roughly 96dpi.
          const width = 1050;
          const height = Math.max(1, Math.round(width * image.height / image.width));
          return {
            properties: pageProperties,
            children: [new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [new ImageRun({ type: 'png', data: dataUrlBytes(image.dataUrl), transformation: { width, height } })],
            })],
          };
        }),
      })
    : new Document({ sections: [{ properties: pageProperties, children: bodyChildren }] });

  return Packer.toBlob(doc);
}

/** Triggers a browser download of the generated docx. Call from a client component. */
export async function downloadSF9Docx(params: SF9DocxParams) {
  const blob = await buildSF9Docx(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = params.data.student.full_name.replace(/[^a-z0-9]+/gi, '_');
  a.href = url;
  a.download = `SF9_${safeName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface SF9BulkDocxParams {
  allData: LearnerSF9[];
  section: any;
  frontPage: SF9SubjectRow[];
  continuationPage: SF9SubjectRow[];
  gaKeys: string[];
  /** Called after each learner's docx is generated, for a progress indicator. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Generates one .docx per learner and bundles them into a single .zip —
 * this is the "give the adviser all N files at once" download. A single
 * combined multi-section docx was considered but rejected: each learner
 * needs their own independent page numbering/margins for printing, and a
 * ZIP of individually-named files is what an adviser actually wants to hand
 * off or print one-by-one anyway.
 */
export async function downloadAllSF9Docx({
  allData, section, frontPage, continuationPage, gaKeys, onProgress,
}: SF9BulkDocxParams) {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (let i = 0; i < allData.length; i++) {
    const data = allData[i];
    const blob = await buildSF9Docx({ data, section, frontPage, continuationPage, gaKeys });

    let safeName = data.student.full_name.replace(/[^a-z0-9]+/gi, '_');
    let fileName = `SF9_${safeName}.docx`;
    let dupeCount = 1;
    while (usedNames.has(fileName)) {
      fileName = `SF9_${safeName}_${++dupeCount}.docx`;
    }
    usedNames.add(fileName);

    zip.file(fileName, blob);
    onProgress?.(i + 1, allData.length);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  const sectionLabel = (section?.name ?? 'Section').replace(/[^a-z0-9]+/gi, '_');
  const yearLabel = (section?.school_year ?? '').replace(/[^a-z0-9]+/gi, '_');
  a.href = url;
  a.download = `SF9_${sectionLabel}${yearLabel ? '_'+yearLabel : ''}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============================================================================
// SF9 Multi-Grade Revamp — Class Record scoring
//
// Extracted verbatim from the current page.tsx (no logic changes). This is
// grade-band agnostic: WEIGHTS falls back to a sensible default for any
// subject key not explicitly listed (which covers every new G2/G3/SHS
// subject automatically).
// ============================================================================
import { domainSummary } from '../gmrcValues/domainScoring';

// Adjusted Transmutation Table (starting SY 2027–2028).
export const TRANSMUTATION = [
  {min:99.50,max:100.00,trans:100},
  {min:98.32,max:99.49,trans:99},
  {min:97.14,max:98.31,trans:98},
  {min:95.96,max:97.13,trans:97},
  {min:94.78,max:95.95,trans:96},
  {min:93.60,max:94.77,trans:95},
  {min:92.42,max:93.59,trans:94},
  {min:91.24,max:92.41,trans:93},
  {min:90.06,max:91.23,trans:92},
  {min:88.88,max:90.05,trans:91},
  {min:87.70,max:88.87,trans:90},
  {min:86.52,max:87.69,trans:89},
  {min:85.34,max:86.51,trans:88},
  {min:84.16,max:85.33,trans:87},
  {min:82.98,max:84.15,trans:86},
  {min:81.80,max:82.97,trans:85},
  {min:80.62,max:81.79,trans:84},
  {min:79.44,max:80.61,trans:83},
  {min:78.26,max:79.43,trans:82},
  {min:77.08,max:78.25,trans:81},
  {min:75.90,max:77.07,trans:80},
  {min:74.72,max:75.89,trans:79},
  {min:73.54,max:74.71,trans:78},
  {min:72.36,max:73.53,trans:77},
  {min:71.18,max:72.35,trans:76},
  {min:70.00,max:71.17,trans:75},
  {min:65.34,max:69.99,trans:74},
  {min:60.67,max:65.33,trans:73},
  {min:56.01,max:60.66,trans:72},
  {min:51.34,max:56.00,trans:71},
  {min:46.67,max:51.33,trans:70},
  {min:42.01,max:46.66,trans:69},
  {min:37.34,max:42.00,trans:68},
  {min:32.68,max:37.33,trans:67},
  {min:28.01,max:32.67,trans:66},
  {min:23.35,max:28.00,trans:65},
  {min:18.68,max:23.34,trans:64},
  {min:14.01,max:18.67,trans:63},
  {min:9.35,max:14.00,trans:62},
  {min:4.68,max:9.34,trans:61},
  {min:0.00,max:4.67,trans:60},
];

export const WEIGHTS: Record<string,{ww:number;pt:number;ta:number}> = {
  'Filipino':{ww:0.20,pt:0.50,ta:0.30},'English':{ww:0.20,pt:0.50,ta:0.30},
  'Mathematics':{ww:0.20,pt:0.50,ta:0.30},'Science':{ww:0.20,pt:0.50,ta:0.30},
  'Araling Panlipunan (AP)':{ww:0.20,pt:0.50,ta:0.30},
  'Edukasyon sa Pagpapakatao (EsP)':{ww:0.20,pt:0.50,ta:0.30},
  'EPP/TLE':{ww:0.20,pt:0.60,ta:0.20},
  'MAPEH - Music & Arts':{ww:0.20,pt:0.60,ta:0.20},
  'MAPEH - PE & Health':{ww:0.20,pt:0.60,ta:0.20},
  'GMRC/VE':{ww:0.20,pt:0.50,ta:0.30},
  // SHS G11 subjects.
  'Mabisang Komunikasyon':{ww:0.20,pt:0.50,ta:0.30},
  'Effective Communication':{ww:0.20,pt:0.50,ta:0.30},
  'Life and Career Skills':{ww:0.20,pt:0.50,ta:0.30},
  'General Science':{ww:0.20,pt:0.50,ta:0.30},
  'General Mathematics':{ww:0.20,pt:0.50,ta:0.30},
  'Pag-Aaral ng Kasanayan at Lipunang Pilipino':{ww:0.20,pt:0.50,ta:0.30},
  // Restored legacy SHS subjects. These keys match the values stored in
  // grades.subject, so existing Class Record rows remain readable.
  'SHS Core Subjects':{ww:0.20,pt:0.50,ta:0.30},
  'SHS Applied Track':{ww:0.20,pt:0.60,ta:0.20},
  'SHS Specialized Subjects':{ww:0.20,pt:0.60,ta:0.20},
  'SHS Work Immersion':{ww:0.20,pt:0.80,ta:0.00},
  'SHS Research / Capstone':{ww:0.40,pt:0.60,ta:0.00},
  '21st Century Literature form the Philippines and the World':{ww:0.25,pt:0.50,ta:0.25},
  // G12 core subjects.
  'Philippine Politics and Governance':{ww:0.25,pt:0.50,ta:0.25},
  'Personal Development':{ww:0.25,pt:0.50,ta:0.25},
  'Introduction to Philosophy of the Human Person':{ww:0.25,pt:0.50,ta:0.25},
  'Filipino sa Piling Larang (Akademik)':{ww:0.25,pt:0.50,ta:0.25},
  'Contemporary Philippine Arts from the Regions':{ww:0.25,pt:0.50,ta:0.25},
  'Physical Education and Health (Grade 12)':{ww:0.25,pt:0.50,ta:0.25},
  // G12 TVL electives.
  'Food and Beverage Services':{ww:0.20,pt:0.60,ta:0.20},
  'Housekeeping':{ww:0.20,pt:0.60,ta:0.20},
  // No explicit entry needed for GMRC / Values Education, Makabansa, or any
  // other subject — computeFromClassRecord() falls back to {0.25,0.50,0.25}
  // for anything not listed here.
};

export const transmute = (v: number) => {
  const rounded = Math.round((v + Number.EPSILON) * 100) / 100;
  return TRANSMUTATION.find(t => rounded >= t.min && rounded <= t.max)?.trans ?? 60;
};

export const descriptor = (g: number) => {
  if (g >= 90) return 'Advancing / Namumukod-tangi';
  if (g >= 80) return 'Benchmarking / Napamamalas';
  if (g >= 75) return 'Connecting / Natutungo';
  return 'Developing / Napauunlad';
};

export const calcAvg = (s: number[], h: number[]) => {
  let sumScore = 0, sumHigh = 0;
  s.forEach((v, i) => {
    if (h[i] > 0) { sumScore += v; sumHigh += h[i]; }
  });
  return sumHigh > 0 ? (sumScore / sumHigh) * 100 : 0;
};

export const calcEX = (
  st1: number, st2: number, te: number,
  highSt1: number, highSt2: number, highTe: number,
): number => {
  const parts = [
    { w: 0.30, score: st1, high: highSt1 },
    { w: 0.30, score: st2, high: highSt2 },
    { w: 0.40, score: te,  high: highTe },
  ].filter(p => p.high > 0);
  if (parts.length === 0) return 0;
  const totalW = parts.reduce((sum, p) => sum + p.w, 0);
  return parts.reduce((sum, p) => sum + (p.score / p.high) * 100 * (p.w / totalW), 0);
};

export function computeFromClassRecord(row: any, subject: string): number {
  if (!row) return 0;
  if (row.domain_scores && typeof row.domain_scores === 'object') {
    const domain = domainSummary(row.domain_scores);
    if (domain.hasScores) return transmute(domain.initial);
  }
  const w  = WEIGHTS[subject] ?? {ww:0.25,pt:0.50,ta:0.25};
  const ww = Array.from({length:5},(_,i)=>row.written_scores?.[i]??0);
  const pt = Array.from({length:3},(_,i)=>row.pt_scores?.[i]??0);
  const st = Array.from({length:2},(_,i)=>row.st_scores?.[i]??0);
  const te = row.te_score??0;

  const hasWW = ww.some(v => v > 0);
  const hasPT = pt.some(v => v > 0);
  const hasST = st.some(v => v > 0) || te > 0;
  if (!hasWW && !hasPT && !hasST) return 0;

  const avgWW = calcAvg(ww, row.highest_ww??[100,100,100,100,100]);
  const avgPT = calcAvg(pt, row.highest_pt??[100,100,100]);
  const avgTA = calcEX(st[0], st[1], te, (row.highest_st ?? [50,50])[0], (row.highest_st ?? [50,50])[1], row.highest_te ?? 100);

  // Match Class Record exactly: component weights are applied as configured;
  // missing components contribute zero and are not redistributed.
  const initial = avgWW*w.ww + avgPT*w.pt + avgTA*w.ta;
  return initial > 0 ? transmute(initial) : 0;
}

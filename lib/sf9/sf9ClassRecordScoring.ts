// ============================================================================
// SF9 Multi-Grade Revamp — Class Record scoring
//
// Extracted verbatim from the current page.tsx (no logic changes). This is
// grade-band agnostic: WEIGHTS falls back to a sensible default for any
// subject key not explicitly listed (which covers every new G2/G3/SHS
// subject automatically).
// ============================================================================

export const TRANSMUTATION = [
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

export const WEIGHTS: Record<string,{ww:number;pt:number;ta:number}> = {
  'Filipino':{ww:0.25,pt:0.50,ta:0.25},'English':{ww:0.25,pt:0.50,ta:0.25},
  'Mathematics':{ww:0.25,pt:0.50,ta:0.25},'Science':{ww:0.25,pt:0.50,ta:0.25},
  'Araling Panlipunan (AP)':{ww:0.25,pt:0.50,ta:0.25},
  'Edukasyon sa Pagpapakatao (EsP)':{ww:0.25,pt:0.50,ta:0.25},
  'EPP/TLE':{ww:0.20,pt:0.60,ta:0.20},
  'MAPEH - Music & Arts':{ww:0.20,pt:0.60,ta:0.20},
  'MAPEH - PE & Health':{ww:0.20,pt:0.60,ta:0.20},
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

export const transmute = (v: number) => TRANSMUTATION.find(t => v >= t.min && v <= t.max)?.trans ?? 60;

export const descriptor = (g: number) => {
  if (g >= 90) return 'Advancing / Namumukod-tangi';
  if (g >= 80) return 'Benchmarking / Napamamalas';
  if (g >= 75) return 'Connecting / Natutungo';
  return 'Developing / Napauunlad';
};

export const calcAvg = (s: number[], h: number[]) => {
  let t = 0, c = 0;
  s.forEach((v, i) => { if (h[i] > 0 && v > 0) { t += (v / h[i]) * 100; c++; } });
  return c > 0 ? t / c : 0;
};

export function computeFromClassRecord(row: any, subject: string): number {
  if (!row) return 0;
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
  const avgTA = calcAvg([...st,te],[...(row.highest_st??[50,50]),row.highest_te??100]);

  const activeComponents: {avg:number; weight:number}[] = [];
  if (hasWW) activeComponents.push({avg:avgWW, weight:w.ww});
  if (hasPT) activeComponents.push({avg:avgPT, weight:w.pt});
  if (hasST) activeComponents.push({avg:avgTA, weight:w.ta});
  const totalWeight = activeComponents.reduce((s,comp)=>s+comp.weight, 0);
  const initial = totalWeight > 0
    ? activeComponents.reduce((s,comp)=>s+(comp.avg*(comp.weight/totalWeight)), 0)
    : 0;
  return initial > 0 ? transmute(initial) : 0;
}

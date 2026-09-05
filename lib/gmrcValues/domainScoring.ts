export type DomainScores = Record<string, Record<number, number>>;

export const GMRC_VALUES_BLOCKS = [
  { key: 'ww_cognitive', label: 'COGNITIVE DOMAIN', count: 5, weight: 0.10, kind: 'standard' },
  { key: 'ww_affective', label: 'AFFECTIVE DOMAIN', count: 5, weight: 0.10, kind: 'standard' },
  { key: 'pt_cognitive', label: 'COGNITIVE DOMAIN', count: 3, weight: 0.10, kind: 'standard' },
  { key: 'pt_affective', label: 'AFFECTIVE DOMAIN', count: 3, weight: 0.10, kind: 'standard' },
  { key: 'behavioral', label: 'BEHAVIORAL DOMAIN', count: 3, weight: 0.30, kind: 'standard' },
  { key: 'examinations', label: 'EXAMINATIONS (EXs)', count: 3, weight: 0.30, kind: 'examination' },
] as const;

export const DOMAIN_FORMAT_SUBJECTS = ['GMRC (Elem)', 'Values Education (JHS)'] as const;

export type DomainHighestScores = Record<string, number[]>;

export function domainSummary(scores: DomainScores | null | undefined, highestScores?: DomainHighestScores | null) {
  const source = scores || {};
  const hps = highestScores || {};
  const summaries = GMRC_VALUES_BLOCKS.map(block => {
    const values = Array.from({ length: block.count }, (_, i) => Number(source[block.key]?.[i] ?? 0));
    const total = values.reduce((a, b) => a + b, 0);
    const entered = values.filter(v => v > 0).length;
    const highestValues = Array.from({ length: block.count }, (_, i) => Number(hps[block.key]?.[i] ?? (block.kind === 'examination' ? [30,30,40][i] : 100)));
    const highest = highestValues.reduce((a, b) => a + b, 0);
    const ps = block.kind === 'examination'
      ? values.reduce((sum, value, i) => sum + (highestValues[i] > 0 ? (value / highestValues[i]) * ([30,30,40][i]) : 0), 0)
      : (highest > 0 ? (total / highest) * 100 : 0);
    const ws = ps * block.weight;
    return { ...block, values, highestValues, total, entered, highest, ps, ws, average: entered ? total / entered : 0 };
  });
  const initial = summaries.reduce((sum, item) => sum + item.ws, 0);
  return { summaries, initial, hasScores: summaries.some(item => item.entered > 0) };
}

export function gmrcValuesTermGrade(scores: DomainScores | null | undefined, transmute: (value: number) => number, highestScores?: DomainHighestScores | null) {
  const summary = domainSummary(scores, highestScores);
  return { ...summary, termGrade: summary.hasScores ? transmute(summary.initial) : 0 };
}

export function gmrcValuesDescriptor(termGrade: number) {
  if (termGrade >= 90) return 'ADVANCING';
  if (termGrade >= 80) return 'BENCHMARKING';
  if (termGrade >= 75) return 'CONNECTING';
  if (termGrade >= 65) return 'DEVELOPING';
  return 'EMERGING';
}

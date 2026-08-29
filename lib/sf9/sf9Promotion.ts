// ============================================================================
// SF9 Multi-Grade Revamp — Promotion remark
//
// Replaces the current `promoted: genAverage >= 75` boolean. DepEd's actual
// rule counts FAILING SUBJECTS, not the overall average:
//   0 failing subjects        → Promoted
//   1-2 failing subjects      → Conditionally Promoted
//   3+ failing subjects       → Failed
// ============================================================================

export type PromotionRemark = 'Promoted' | 'Conditionally Promoted' | 'Failed';

/**
 * @param finalGradesByKey  map of subject key -> final grade for the ROWS
 *   that count toward General Average (band.gaCoreKeys + active electives +
 *   work immersion, from buildSubjectRows().gaKeys) — sub-rows like MAPEH's
 *   Music and Arts are intentionally excluded, matching the printed form.
 * @param requireAllFilled  if true (default), returns null until every
 *   counted subject has a non-zero final grade — a partial year shouldn't
 *   show a premature remark.
 */
export function getPromotionRemark(
  finalGradesByKey: Record<string, number>,
  gaKeys: string[],
  requireAllFilled = true,
): PromotionRemark | null {
  const values = gaKeys.map(k => finalGradesByKey[k] ?? 0);

  if (requireAllFilled && values.some(v => v <= 0)) return null;

  const failingCount = values.filter(v => v > 0 && v < 75).length;

  if (failingCount === 0) return 'Promoted';
  if (failingCount <= 2) return 'Conditionally Promoted';
  return 'Failed';
}

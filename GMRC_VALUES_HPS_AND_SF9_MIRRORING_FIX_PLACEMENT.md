# GMRC/Values HPS and SF9 Mirroring Fix

Replace these files in the TeacherHub project:

`app/gmrc-values-record/page.tsx`

`lib/sf9/sf9ClassRecordScoring.ts`

The GMRC/Values page now highlights a learner score cell with a red background and border when the score is greater than that column's current Highest Possible Score. HPS controls themselves remain normal inputs. Domain totals continue to calculate from the entered HPS values rather than fixed 500 or 300 values.

SF9 continues to calculate GMRC/Values from the same saved `domain_scores` and `domain_highest_scores` used by the separate class record. The SF9 helper also accepts the legacy alternate HPS field names `domain_highest_scores_json` and `highest_domain_scores` when present, preventing a fallback to default HPS values.

No database migration is required. After deployment, reload the GMRC/Values page and SF9 page to clear old client bundles.

# SF9 GMRC/Values Grade-Mirroring Fix

Replace the following file in the TeacherHub project:

`lib/sf9/sf9ClassRecordScoring.ts`

The issue was in the SF9 calculation, not the SQL query. The separate GMRC/Values class record already saves the learner's `domain_scores` and `domain_highest_scores`. SF9 was reading the row correctly but recalculating the domain grade with default highest scores instead of the saved values. The fix passes `domain_highest_scores` into `domainSummary`, aligning the SF9 term grade with the separate GMRC/Values E-Class Record.

After deployment, reload the SF9 page and confirm that the selected Values Education or GMRC source displays the same term grade as the separate class record. Existing database rows do not need to be migrated.

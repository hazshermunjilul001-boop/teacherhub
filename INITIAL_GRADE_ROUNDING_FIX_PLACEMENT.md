# Initial-Grade Rounding Fix

Replace these files in the TeacherHub project:

`app/class-record/page.tsx`

`lib/gmrcValues/domainScoring.ts`

`lib/sf9/sf9ClassRecordScoring.ts`

The previous behavior calculated the initial grade from full-precision weighted components, while displaying each WS value rounded to two decimals. In borderline cases, the hidden full-precision sum could round differently from the visible WS values. For example, the visible components can sum to 88.87 while the hidden values are slightly above 88.875, producing 88.88 and a transmuted grade of 91.

The corrected code rounds each weighted component to two decimals first, then sums those displayed-precision components. The same rule is used in the regular class record, GMRC/Values scoring, and SF9 scoring so the initial grade and mirrored SF9 term grade remain consistent.

No database migration is required.

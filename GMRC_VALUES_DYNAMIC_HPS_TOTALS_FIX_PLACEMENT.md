# GMRC/Values Dynamic HPS Totals Fix

Replace this file in the TeacherHub project:

`app/gmrc-values-record/page.tsx`

The GMRC/Values Highest Possible Score row previously displayed hardcoded totals: 500 for five-item domains and 300 for three-item domains. The totals now calculate from the actual HPS values entered in the individual columns. The same dynamic totals are used in the GMRC/Values Excel export. Examination weighting columns remain unchanged because they represent fixed weighted components rather than domain score totals.

No database migration is required. The existing `domain_highest_scores` values continue to be saved and used for grade calculations and SF9 mirroring.

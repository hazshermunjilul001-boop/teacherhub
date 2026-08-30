# TeacherHub Fixes

## Manual SF9 grade entry
Pressing **Enter** in a Term 1, Term 2, or Term 3 manual-grade field now focuses and selects the same-term field for the next learner below. Navigation stays within the selected subject and term column.

## SF9 attendance report
SF9 monthly attendance is now calculated from the daily `attendance` table and section holidays rather than relying on a stale monthly view. The report covers June through April, excludes weekends and declared holidays, excludes future dates, counts an explicit `A` as absent, and derives present days as class days minus absences. Monthly and total values therefore reconcile as `class days = present + absent`.

## SF9 DOCX export
The DOCX export was brought closer to the established in-app preview by aligning the descriptor legend, boxed teacher-comment areas, parent/guardian signature lines, certificate-of-transfer content, adviser approval line, cancellation section, and centered continuation-sheet table.

## Verification
`npm ci --no-audit --no-fund` completed successfully and `npm run build` completed successfully with TypeScript checking and route generation.

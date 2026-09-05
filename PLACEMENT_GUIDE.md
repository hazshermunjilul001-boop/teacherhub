# GMRC / Values Education exact-layout replacement

Replace this project file:

`app/class-record/page.tsx`

with the bundled file at the same path. If Vercel is compiling your root-level legacy file instead, also copy the same contents to the exact path shown by your build log, such as:

`app/class-record-page.tsx`

The replacement is gated exclusively by these subject keys:

- `GMRC (Elem)`
- `Values Education (JHS)`

For those two subjects only, the live class-record screen uses the wide DepEd-style hierarchy shown in the supplied screenshot: official class-record title/header, term block, grade/section and teacher fields, subject field, WW Cognitive and Affective Domain groups, PT Cognitive and Affective Domain groups, Behavioral Domain, Examinations, Initial Grade, Term Grade, Descriptor, Learners’ Names, Male/Female sections, and bordered score cells.

The normal legacy `GMRC/VE` record and every other subject remain on the existing class-record renderer. The previous compact amber domain panel is disabled so it cannot appear together with the official layout.

The E-Class Record / print-preview button opens a dedicated wide preview for these two subjects. Its **Print / Save PDF** button invokes the browser print dialog with landscape page settings and hides the preview controls, so the printed/downloaded PDF uses the same wide table. Entered domain values remain editable in the live table and are read-only in the print preview.

The six workbook-aligned score groups are saved through the existing `grades.domain_scores` field and use the previously configured weights: WW Cognitive 10%, WW Affective 10%, PT Cognitive 10%, PT Affective 10%, Behavioral Domain 30%, and Examinations 30%.

Run `npx tsc --noEmit` after copying; the replacement passed this check in the extracted project.

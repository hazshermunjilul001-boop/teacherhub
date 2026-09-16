# SF5 View, Print, and Composite-Term Fix

Replace this file in the TeacherHub project:

`app/sf5/page.tsx`

## Changes

The subject heading is now dynamic:

- Normal class-record source: `EsP`
- Separate Values Education source: `Values Education`
- Separate elementary GMRC source: `GMRC`

The SF5 print action follows the active view:

- **Table** active: prints only the composite-grade table.
- **SF5 Form** active: prints only the official SF5 form.

The composite table now has controls for:

- Showing Term 1, Term 2, or Term 3 only.
- Optionally showing the final composite, calculated from the available Terms 1–3.

The selected term and final-composite option are also used in browser print output. Printed composite tables have complete black cell borders and black text, including learner names.

The existing SF9-compatible GMRC/Values source resolution and scoring remain in this file.

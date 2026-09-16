# SF5 GMRC/Values Mirroring and Print Formatting Fix

Replace this file in the TeacherHub project:

`app/sf5/page.tsx`

The SF5 page now reads the section's `gmrc_ve_source` setting and uses the same separate subject source as SF9:

- `GMRC (Elem)` for elementary sections
- `Values Education (JHS)` for junior-high sections

For the EsP/Values subject column, SF5 now computes the term grades from the separate domain-format class-record row using the existing SF9 `computeFromClassRecord` helper. The displayed column is labeled `GMRC` or `Values Ed.` while preserving the canonical internal EsP key used for final-grade and general-average calculations.

The SF5 composite-grade table also receives print-only formatting with black borders, black text, and a light header background for clearer printed output. The official SF5 form remains unchanged.

No database migration is required. The existing section `gmrc_ve_source` value and `grades` rows are reused.

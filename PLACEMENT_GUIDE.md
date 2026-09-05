# Final dedicated GMRC / Values Education interaction and print fix

Copy the bundled files to the matching repository paths.

The dedicated page now renders exactly one print document. The live editable table is hidden during printing, while the print-only overlay is rendered as the sole printable document. The preview uses one unified 47-column table with fixed widths and landscape print CSS, preventing duplicate copies, clipping, and overlap.

HPS fields are editable and persisted in `grades.domain_highest_scores`. Scores are persisted with `upsert` using the student/term/subject key and are loaded again when the page is reopened. If no HPS values exist, the workbook defaults are used.

Pressing Enter in a score input moves focus to the same domain column for the next learner. The page includes a visible Summary of Grades button; the summary is also printed below the table. Teacher and School Head signatories are shown in the live record and print preview. Back now routes to `/`.

The shared scorer uses the workbook rules and the SF9 legacy alias selection still reads the same dedicated records. Ensure the Supabase columns `grades.domain_scores` and `grades.domain_highest_scores` exist before deploying.

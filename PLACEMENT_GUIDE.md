# Final GMRC / Values Education dedicated-page repair

Copy the bundled files to their matching repository paths. The dedicated page is `app/gmrc-values-record/page.tsx`.

This version uses one printable document only. The page controls and editable live table are hidden during printing, leaving the single print table and its summary/signatures. The table uses one 47-column grid with fixed widths; the Descriptor column is widened and allowed to wrap so it remains readable.

The Summary of Grades button is visible and toggles a three-term report with GSA and counts for Advancing (90–100), Benchmarking (80–89), Connecting (75–79), Developing (65–74), and Emerging (0–64). The same term summary is included below the record in print preview.

Pressing Enter in a score input moves focus to the same domain column for the next student. Back routes to `/`. Teacher and School Head signatories are included in the live and printed record.

Scores are saved with Supabase `upsert` using `(student_id, term, subject)` and are loaded for all three terms when the subject or term changes. HPS changes are also upserted for every student, including sections where no score row existed yet. Run `supabase_final_gmrc_values.sql` in Supabase if the HPS column is not present.

The shared computation follows the updated workbook. SF9 legacy `GMRC/VE` resolves to the same dedicated record for the active grade level, so legacy and sidebar entry points mirror the same grades.

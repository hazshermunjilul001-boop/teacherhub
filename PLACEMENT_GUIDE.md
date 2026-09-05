# SF9, Summary of Grades, and GMRC/Values linking fix

Replace the bundled files at the matching repository paths.

The SF9 data hook now deterministically selects the configured dedicated source. The default/legacy `GMRC/VE` choice resolves to `GMRC (Elem)` for Grades 2–6 and `Values Education (JHS)` for Grades 7–10. Explicit dedicated choices select the corresponding exact subject key first, then use domain rows. The SF9 scorer uses the same workbook domain computation and transmutation as the dedicated page, so the reflected term and final averages match.

The SF9 Subject Teacher Access list includes both `GMRC (Elem)` and `Values Education (JHS)` for Grades 2–10. Existing assigned-subject handling remains unchanged for other subjects.

The dedicated page loads all three terms for the selected subject and has a working Summary of Grades button. The summary displays Term 1, Term 2, and Term 3, each with GSA and counts for Advancing (90–100), Benchmarking (80–89), Connecting (75–79), Developing (65–74), and Emerging (0–64).

Run `supabase_final_gmrc_values.sql` if the columns are missing. Then run `npx tsc --noEmit` and deploy.

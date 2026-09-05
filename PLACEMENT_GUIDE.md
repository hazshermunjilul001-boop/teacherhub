# Corrected policy patch placement guide

Copy each source file over the same relative path in the existing project. Run `supabase_policy_recommendations.sql` in Supabase SQL Editor before deploying. The SQL is additive and preserves legacy class-record rows.

| File | Destination | Change |
|---|---|---|
| `app/class-record/page.tsx` | `app/class-record/page.tsx` | Adds the visible Cognitive Domain and Affective Domain input panel for `GMRC (Elem)` and `Values Education (JHS)`, stores domain scores, retains the legacy record, and adds a term performance summary below every E-Class Record preview and below Summary of Grades. |
| `lib/sf9/sf9ClassRecordScoring.ts` | `lib/sf9/sf9ClassRecordScoring.ts` | Mirrors the average of the two domain ratings to SF9 only for the two new domain-format records; all existing subject scoring remains unchanged. |
| `app/sf9/page.tsx` | `app/sf9/page.tsx` | Adds the actual teacher-name field when linking a subject teacher and includes the new record choices. |
| `context/SectionContext.tsx` | `context/SectionContext.tsx` | Loads the saved linked-teacher actual name. |
| `app/sf9/SectionSF9Settings.tsx` | `app/sf9/SectionSF9Settings.tsx` | Adds the adviser’s section-wide choice of legacy GMRC/VE, GMRC (Elem), or Values Education (JHS) as the SF9 source. |
| `lib/sf9/useSF9Data.ts` | `lib/sf9/useSF9Data.ts` | Applies the adviser’s source choice only to the GMRC/Values SF9 row. |
| `supabase_policy_recommendations.sql` | Supabase SQL Editor | Adds `section_collaborators.display_name`, `sections.gmrc_ve_source`, and `grades.domain_scores`. |

After running the migration, edit each existing linked teacher from the SF9 Subject Teacher Access panel and enter the teacher’s actual full name. The email remains the login/invitation identifier; the saved actual name is used in the class-record teacher field and related print/export views.

The corrected implementation treats the workbook’s two prescribed headings as score-bearing fields: **Cognitive Domain** and **Affective Domain**. For the new formats, the SF9 term grade is the average of the entered domain ratings. Existing `GMRC/VE` records continue through their original WW/PT/TA path and are not converted.

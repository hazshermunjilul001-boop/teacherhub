# Corrected authoritative GMRC / Values Education replacement

Copy the source files to the exact destinations below, then run `supabase_policy_recommendations.sql` in Supabase SQL Editor before deploying.

| Bundle file | Destination | Purpose |
|---|---|---|
| `app/class-record/page.tsx` | `app/class-record/page.tsx` | Always lists `GMRC/VE`, `GMRC (Elem)`, and `Values Education (JHS)`. The two new records show workbook-aligned groups: WW Cognitive, WW Affective, PT Cognitive, PT Affective, Behavioral Domain, and Examinations. The Term Performance Summary is included below each E-Class Record preview and below Summary of Grades. |
| `lib/sf9/sf9ClassRecordScoring.ts` | `lib/sf9/sf9ClassRecordScoring.ts` | Mirrors the six domain groups into SF9 for the two new record keys only. |
| `app/sf9/page.tsx` | `app/sf9/page.tsx` | Shows the source selector directly on SF9 and includes all three GMRC/Values choices in subject linking. |
| `lib/sf9/useSF9Data.ts` | `lib/sf9/useSF9Data.ts` | Uses the selected source only for the SF9 GMRC/Values row. |
| `app/sf9/SectionSF9Settings.tsx` | `app/sf9/SectionSF9Settings.tsx` | Retains the source choice in section settings. |
| `context/SectionContext.tsx` | `context/SectionContext.tsx` | Loads linked-teacher display metadata. |
| `supabase_policy_recommendations.sql` | Supabase SQL Editor | Adds `section_collaborators.display_name`, `sections.gmrc_ve_source`, and `grades.domain_scores`. |

On SF9, the adviser now sees **Choose the GMRC / Values Education class record used by SF9** with three choices: legacy/existing GMRC/VE, separate GMRC (Elem), or separate Values Education (JHS). The choice is saved to the section and applies to all learners.

The supplied workbook’s headings were mapped to the UI as WW Cognitive, WW Affective, PT Cognitive, PT Affective, Behavioral Domain, and Examinations. The six averages use the workbook-aligned weights 10%, 10%, 10%, 10%, 30%, and 30%. Existing GMRC/VE records and other subject mirroring are left on the existing calculation path.

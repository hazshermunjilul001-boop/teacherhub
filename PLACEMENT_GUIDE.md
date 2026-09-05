# TeacherHub policy patch placement guide

Copy each file in this bundle over the file at the same relative path in the existing Next.js project. Before deployment, run `supabase_policy_recommendations.sql` in the Supabase SQL Editor. The migration is additive and preserves existing rows and existing grade mirroring.

| File | Place at | Purpose |
|---|---|---|
| `app/class-record/page.tsx` | `app/class-record/page.tsx` | Adds the separate GMRC (Elem) and Values Education (JHS) class-record choices, linked-teacher display-name fallback, Emerging descriptor, and term GSA/performance-band summary below the existing Summary of Grades table. |
| `app/sf9/page.tsx` | `app/sf9/page.tsx` | Lets the adviser save the linked teacher’s actual name and exposes the applicable separate GMRC/Values Education records when assigning subjects. |
| `app/sf9/SectionSF9Settings.tsx` | `app/sf9/SectionSF9Settings.tsx` | Adds the adviser’s section-wide SF9 source selector. |
| `context/SectionContext.tsx` | `context/SectionContext.tsx` | Loads the linked teacher display name without changing access controls. |
| `lib/sf9/useSF9Data.ts` | `lib/sf9/useSF9Data.ts` | Uses the adviser-selected GMRC/Values Education source only for the SF9 GMRC/VE row; all other subject mirroring remains unchanged. |
| `supabase_policy_recommendations.sql` | Run in Supabase SQL Editor | Adds `section_collaborators.display_name` and `sections.gmrc_ve_source`. |

The existing class-record and SF9 print/PDF controls were not rewritten. The requested summary is appended below the existing Summary of Grades learner table, and the linked teacher’s actual name is passed through the existing teacher/signature fields used by the class-record and export views.

The supplied GMRC/Values workbook was inspected and contains separate **COGNITIVE DOMAIN** and **AFFECTIVE DOMAIN** headings. This patch adds the separate record identities and source selection while preserving the current app’s existing WW/PT/EX scoring model. It does not silently reinterpret old GMRC/Values records or migrate scores between schemas. If the school requires domain-level score entry as separate grade components rather than the supplied workbook headings, that is a further data-model change and should be implemented as a separately approved feature so current grade mirroring is not compromised.

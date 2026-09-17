# TeacherHub Grade-Path and SF5/Principal-Title Replacement Package

Copy each source file from this archive into the matching path under the TeacherHub project root, replacing the existing file.

The package includes the prior SF5/SF9/principal-title correction plus the current-term composite GA and ranking exception.

| Archive path | Replace at project-root path | Purpose |
|---|---|---|
| `app/sf5/page.tsx` | `app/sf5/page.tsx` | Uses SF9-derived subjects/scoring, removes duplicate MAPEH, aligns GA/Status, displays current-term composite GA and Rank in the SF5 table/print preview, and preserves final-grade logic. |
| `app/sf9/SectionSF9Settings.tsx` | `app/sf9/SectionSF9Settings.tsx` | Persists the selected GMRC/Values source. |
| `app/sf9/SF9Card.tsx` | `app/sf9/SF9Card.tsx` | Displays the configured school-head position instead of hardcoded `School Head`. |
| `app/class-record/page.tsx` | `app/class-record/page.tsx` | Removes GMRC/VE from the regular class-record subject selector. |
| `app/class-record-page.tsx` | `app/class-record-page.tsx` | Removes GMRC/VE from the duplicate legacy selector. |
| `app/sections/page.tsx` | `app/sections/page.tsx` | Adds the Position / Title field for the school head/principal. |
| `context/SectionContext.tsx` | `context/SectionContext.tsx` | Adds the optional title field to section metadata. |
| `lib/useActiveSection.ts` | `lib/useActiveSection.ts` | Provides a default `Principal` title to active-section consumers. |
| `lib/sf9/useSF9Data.ts` | `lib/sf9/useSF9Data.ts` | Keeps SF9 source, labels, and final-grade logic on the shared path. |
| `lib/sf9/gradePath.ts` | `lib/sf9/gradePath.ts` | Shared SF9 subject/source/scoring path used by SF5 and SF9. |
| `lib/sf9/generateSF9Docx.ts` | `lib/sf9/generateSF9Docx.ts` | Uses the configured title in SF9 DOCX signatures. |
| `principal_position_migration.sql` | Run in Supabase SQL Editor | Adds `sections.school_head_title` with default `Principal`. |

## SF5 current-term GA exception

SF9 and SF5 final-grade logic still require all three terms before producing a final/general average. However, the SF5 **composite table** and its **composite print preview** now display a separate current-term GA using the selected `Term 1`, `Term 2`, or `Term 3` control. The current-term GA averages the available SF9 learning-area values for that selected term. Its Rank is calculated from that same selected-term GA.

This exception does not change:

- SF9 final grades.
- SF9 general average.
- SF5 final grades.
- SF5 promotion status/action.
- Official SF5 form summary calculations.

The print preview labels the value as `GA T1`, `GA T2`, or `GA T3` so teachers can distinguish it from the final general average.

## Required database step

Run `principal_position_migration.sql` once in the Supabase SQL Editor before saving a new Position / Title value from the Sections page. Existing sections default to `Principal`.

## Principal title configuration

Open the Sections page, edit a section, and enter one of the following, or any school-approved title:

- `Principal`
- `Principal I`
- `Principal II`
- `Principal III`
- `Principal IV`
- `School Head`

The name remains in the School Head / Principal Name field. The title is stored separately and is rendered below the name in the SF9 card and SF9 DOCX output.

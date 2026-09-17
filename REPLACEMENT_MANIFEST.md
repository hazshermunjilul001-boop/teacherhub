# TeacherHub Grade-Path and SF5/Principal-Title Replacement Package

Copy each source file from this archive into the matching path under the TeacherHub project root, replacing the existing file.

| Archive path | Replace at project-root path | Purpose |
|---|---|---|
| `app/sf5/page.tsx` | `app/sf5/page.tsx` | Removes duplicate MAPEH, aligns GA and Status, restores print GA/Rank columns, includes null-status learners in ranking, and keeps SF5 on the SF9-derived subjects/scoring path. |
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

## Required database step

Run `principal_position_migration.sql` once in the Supabase SQL Editor **before saving a new Position / Title value** from the Sections page. Existing sections default to `Principal`.

## How to configure

Open the Sections page, edit a section, and enter one of the following, or any school-approved title:

- `Principal`
- `Principal I`
- `Principal II`
- `Principal III`
- `Principal IV`
- `School Head`

The name remains in the School Head / Principal Name field. The title is stored separately and is rendered below the name in the SF9 card and SF9 DOCX output.

## SF5 correction details

SF5 now has exactly one MAPEH column. The GA and Status columns are positioned after the dynamic SF9 subject columns. The print preview has exactly one GA column and one Rank column after the subject columns. Ranking includes learners whose legacy status is blank/null but otherwise treats them as active.

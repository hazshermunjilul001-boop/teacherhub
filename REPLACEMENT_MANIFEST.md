# TeacherHub Grade-Path Replacement Package

Copy each file from this archive into the matching path under the TeacherHub project root, replacing the existing file.

| Archive path | Replace at project-root path | Purpose |
|---|---|---|
| `app/sf5/page.tsx` | `app/sf5/page.tsx` | Makes SF5 use SF9-derived active subjects, electives, GMRC/Values source resolution, shared class-record scoring, and the same three-term final-grade rule. |
| `app/sf9/SectionSF9Settings.tsx` | `app/sf9/SectionSF9Settings.tsx` | Persists the selected GMRC/Values source so SF5 and SF9 use the same setting. |
| `app/sf9/useSF9Data.ts` | `lib/sf9/useSF9Data.ts` | Makes SF9 use the shared source resolver, shared score helper, shared aliases, and centralized final-grade rule. |
| `lib/sf9/gradePath.ts` | `lib/sf9/gradePath.ts` | New shared SF9 subject/source/scoring path used by SF5 and SF9. |
| `app/class-record/page.tsx` | `app/class-record/page.tsx` | Removes GMRC/VE from the regular class-record subject selector. The dedicated GMRC/Values page remains the entry point. |
| `app/class-record-page.tsx` | `app/class-record-page.tsx` | Removes GMRC/VE from the duplicate legacy selector so it cannot be exposed by an alternate implementation. |

## Deployment notes

The archive contains source replacements only. It does not contain database migrations and does not require a database migration for these changes. Existing GMRC/Values rows remain readable by the dedicated `app/gmrc-values-record/page.tsx` page and by SF9 through the configured/automatic source resolver.

After copying the files, restart the application and verify one section with a learner who has values in all three terms. Compare the class record, SF5, SF9, and exports. If the section setting is blank, both SF5 and SF9 now follow SF9's automatic rule: `GMRC (Elem)` for Grades 2–6 and `Values Education (JHS)` for Grades 7–10.

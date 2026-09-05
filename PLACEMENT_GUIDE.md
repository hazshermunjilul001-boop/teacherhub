# GMRC / Values Education dedicated-page fix

Copy each bundled file to the same path in the repository. The dedicated page is `app/gmrc-values-record/page.tsx`; the sidebar entry is in `app/page.tsx`.

The ordinary `app/class-record/page.tsx` replacement removes the broken dedicated-subject renderer from the legacy subject list but keeps the old `GMRC/VE` compatibility record. The dedicated page is the only place where `GMRC (Elem)` and `Values Education (JHS)` are entered.

The dedicated table follows the supplied workbook’s exact column hierarchy. Standard groups use item columns followed by Total, PS, and WS. Examinations use ST1, ST2, TE, WS ST1, WS ST2, WS TE, PS, and WS. Standard PS is total divided by highest possible score times 100; standard WS is PS times the group weight; examination PS is ST1×30% + ST2×30% + TE×40%; examination WS is examination PS×30%; Initial Grade is the sum of all six WS values; Term Grade uses the adjusted transmutation table; and the final grade is the average of three completed term grades.

The SF9 files now resolve the legacy `GMRC/VE` choice to the same dedicated record: GMRC (Elem) for Grades 2–6 and Values Education (JHS) for Grades 7–10. Explicit dedicated choices also read the same canonical records. The SF9 scorer uses the same six-block workbook formula whenever `domain_scores` is present.

Run the existing Supabase migration that adds `grades.domain_scores` before using the page. Existing grade mirroring for other subjects is unchanged. Run `npx tsc --noEmit` after copying; it passed in the prepared project.

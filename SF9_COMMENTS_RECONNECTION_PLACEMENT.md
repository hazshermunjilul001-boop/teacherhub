# SF9 Teacher Comments Reconnection

Replace these files in the TeacherHub project:

`app/sf9/page.tsx`

`lib/sf9/useSF9Data.ts`

The existing `app/sf9/SF9CommentsEditor.tsx` is also included in this package for completeness; it already supports separate Term 1, Term 2, and Term 3 comments and saves to `sf9_comments`.

The SF9 page now has a **Teacher's Comments** button for the selected learner. The editor opens with three term text areas, saves the entries to `sf9_comments`, and refreshes the SF9 data after saving. The data hook now loads each learner's saved comments so they appear in the on-screen SF9 card, print output, and PDF output.

No database migration is required, provided the existing `sf9_comments` table is present with `section_id`, `student_id`, `term`, and `comment` columns.

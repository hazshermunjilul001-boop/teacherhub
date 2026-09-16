# SF5 Composite Portrait Print and Ranking

Replace this file in the TeacherHub project:

`app/sf5/page.tsx`

## Included behavior

When the SF5 **Table** view is active and the user chooses Print:

- The composite-grade table prints as a compact portrait report.
- The report is structured as a one-page-style sheet with school/section heading, learner name, subject grades, MAPEH, general average, and rank.
- Male and female learners are grouped separately.
- Ranking is calculated within the active section using the selected term's composite general average.
- The selected term from the Table controls is printed.
- The final composite column is shown only when **Show final composite** is enabled.
- Cell borders, learner names, headings, and grades print in black.

The official SF5 form remains available separately. When **SF5 Form** is active, only the official SF5 form prints.

No database migration is required.

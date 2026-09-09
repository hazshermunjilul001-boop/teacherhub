# Class-Record PS/WS Two-Decimal Formatting

Replace these two files in the TeacherHub project:

`app/class-record/page.tsx`

`app/gmrc-values-record/page.tsx`

All PS and WS-related displayed values in the regular class-record page and the separate GMRC/Values class-record page now use two decimal places, including the live table, print-preview content, and Excel exports. The underlying score calculations and SF9 mirroring logic were not changed; SF9 continues to use the same numeric values and grade calculations.

No database migration is required, and no SF9 file needs replacement for this formatting-only update.

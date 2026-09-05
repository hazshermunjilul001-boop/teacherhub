# Dedicated GMRC / Values Education layout fix

Replace the five bundled source files at their matching repository paths.

The page now renders exactly one unified table for both live entry and print preview. The table uses a fixed 47-column grid so the WW, PT, and EXs group headers align with the item columns beneath them and do not overlap. HPS cells are editable and saved to `grades.domain_highest_scores`; defaults are 100 for standard items and 30/30/40 for ST1/ST2/TE.

The same term performance summary appears below the table in the live page and in the print preview. Print Preview has one table only and its Print / Save PDF action uses landscape page settings.

The canonical workbook calculation is used by both the dedicated page and SF9: standard PS = total/HPS×100; standard WS = PS×weight; examination PS = ST1×30% + ST2×30% + TE×40%; examination WS = examination PS×30%; Initial Grade = sum of all six WS; Term Grade = adjusted transmutation result.

SF9 alias resolution is shared: selecting legacy `GMRC/VE` resolves to `GMRC (Elem)` for Grades 2–6 and `Values Education (JHS)` for Grades 7–10. Explicit dedicated selections read the same canonical rows. Ensure `grades.domain_scores` and `grades.domain_highest_scores` exist in Supabase.

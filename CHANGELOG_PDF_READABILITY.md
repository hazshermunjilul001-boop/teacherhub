# SF9 PDF Table Readability Fix

Adjusted the SF9 preview table cells used by the exact-preview PDF export. Grade values, final grades, remarks, attendance values, totals, subject labels, and summary cells now use vertical middle alignment, slightly increased inner padding, and consistent line height so text sits clear of the borders and is easier to read.

No grade-level routing, attendance calculation, manual-grade behavior, preview structure, or PDF export logic was changed.

Verification: `npm run build` completed successfully with TypeScript validation and route generation.

# SF9 Editable DOCX and Grade-Level Layout Update

The SF9 DOCX export no longer embeds a screenshot. It is generated from editable DOCX paragraphs, tables, borders, and text elements.

Grade 2 now uses a dedicated SF9 preview layout based on the supplied `G2SchoolForm9.pdf`, including its five learning areas, merged TERM heading, attendance table, comments boxes, signatures, certificate of transfer, and performance descriptors. The existing Grade 4–10 layout remains available for those grade levels.

The SF9 page routes to the Grade 2 layout when the active section has `grade_number = 2`. Grade 3 remains pending the Grade 3 reference form.

Verification: `npm run build` completed successfully with TypeScript checking and route generation.

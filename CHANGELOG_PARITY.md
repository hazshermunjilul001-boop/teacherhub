# SF9 Preview/DOCX Parity Fix

The SF9 `Download This` action now captures the exact printable SF9 preview rendered by `SF9Card` and embeds each printable page as a high-resolution PNG in the DOCX. This removes the separate reconstructed DOCX layout that caused differences in wrapping, spacing, borders, logos, comments, signatures, and continuation-page pagination.

The existing manual-grade Enter navigation and SF2-to-SF9 attendance aggregation remain unchanged.

Verification: `npm run build` passed with TypeScript validation and static route generation.

# TeacherHub Class-Record Backup Patch

Copy the files in this package into the matching paths in the TeacherHub project, replacing the existing files:

| Package file | Destination in the project |
|---|---|
| `app/class-record/page.tsx` | `app/class-record/page.tsx` |
| `app/gmrc-values-record/page.tsx` | `app/gmrc-values-record/page.tsx` |
| `lib/classRecordBackup.ts` | `lib/classRecordBackup.ts` |

No database migration or package dependency change is required. The project already contains the required `exceljs`, `html2canvas`, and `jspdf` dependencies.

After copying the files, run:

```bash
npm run build
```

The backup button now downloads the Excel Restore Backup first, then captures the rendered class-record print-preview layout as the PDF. The Excel file remains the machine-readable restore file; the PDF is the readable/print-style verification copy. The uploaded Excel restore file can be used on the matching regular-subject or GMRC/Values class-record page to restore the scores.

The patch does not claim that weak internet is the only cause of missing scores. A weak or interrupted connection can cause an asynchronous database save to fail, but users should also verify the save result and use the backup files as an additional safeguard.

The app's existing restore flow validates the backup type, section, and subject before writing records back to Supabase.

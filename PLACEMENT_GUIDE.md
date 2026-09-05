# Exact Vercel build-path fix

Vercel reports that it is compiling:

`./app/class-record-page.tsx`

Therefore copy the bundled file to exactly:

`app/class-record-page.tsx`

Do not copy it to `app/class-record/page.tsx` for this particular build if your repository is intentionally using the root-level filename shown in the Vercel error. The corrected file uses project-root imports such as:

`@/lib/supabase`

`@/lib/useActiveSection`

`@/lib/useSubscription`

`@/context/SectionContext`

`@/lib/sf9/sf9GradeBands`

The file must be inside the same Next.js project that contains the matching `lib/` and `context/` directories. Also retain this in `tsconfig.json`:

```json
"paths": { "@/*": ["./*"] }
```

If your repository contains both `app/class-record/page.tsx` and `app/class-record-page.tsx`, replace the one Vercel identifies in the build error. Do not create a duplicate route unless your project already intentionally uses both files.

The extracted project was checked with `npx tsc --noEmit` successfully using this exact root-level path.

# Module-resolution fix

Replace the existing project file at:

`app/class-record/page.tsx`

with the bundled file at:

`app/class-record/page.tsx`

The imports now use the project-root alias:

`@/lib/supabase`

`@/lib/useActiveSection`

`@/lib/useSubscription`

`@/context/SectionContext`

`@/lib/sf9/sf9GradeBands`

Do not copy this file into a new standalone folder. It must be placed inside the existing Next.js project that already contains the matching `lib/` and `context/` directories. The project’s `tsconfig.json` must retain the standard alias mapping:

```json
"paths": { "@/*": ["./*"] }
```

If your project uses a `src/` directory, place the file at `src/app/class-record/page.tsx` and ensure `@/*` maps to `./src/*`; otherwise use the root `app/class-record/page.tsx` path.

The replacement was checked with `npx tsc --noEmit` successfully.

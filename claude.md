# DMP Grants - Cemetery Management

React+TS frontend, Express+PostgreSQL backend.

## Commands

`npm run dev` | `npm run test` | `npm run build`

## Rules

- No `any` types. Named exports. Parameterized SQL only.
- Use `src/components/ui.tsx` components
- Use `src/lib/errors.ts` and `server/utils/errors.js`
- Auth required on all routes except `/auth/login`

## Structure

`/src` = React | `/server` = Express API | `/server/db` = PostgreSQL

# Security Rules — Detroit Memorial Park

Always enforced. No exceptions.

- **No secrets in source** — no API keys, tokens, or passwords in any `.ts`/`.tsx`/`.js` file
- **Validate all user input** — use Zod schemas before any database operation or business logic
- **Parameterized queries only** — never interpolate user data into SQL strings
- **No `dangerouslySetInnerHTML`** — unless content is sanitized with DOMPurify first
- **Supabase RLS** — all new tables must have Row Level Security policies enabled
- Never read or log `.env` values in client-side code

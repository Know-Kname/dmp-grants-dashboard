# 10 — Troubleshooting

> **TL;DR:** This is a quick-reference guide to the most common failures. Each entry tells you exactly what to look for and exactly what to do. Start with the symptom (what you see), not the cause (which you don't know yet).

---

## Table of Contents
- [How to approach a bug](#how-to-approach-a-bug)
- [White screen / app won't load](#white-screen--app-wont-load)
- [Login problems](#login-problems)
- [Demo mode problems](#demo-mode-problems)
- [Data not loading or showing wrong data](#data-not-loading-or-showing-wrong-data)
- [Vercel build failures](#vercel-build-failures)
- [GitHub Actions CI failures](#github-actions-ci-failures)
- [Local dev problems](#local-dev-problems)
- [AI assistant problems](#ai-assistant-problems)
- [Supabase errors](#supabase-errors)
- [TypeScript errors](#typescript-errors)
- [Performance problems](#performance-problems)
- [Nuclear option: full reset](#nuclear-option-full-reset)

---

## How to approach a bug

Before diving in, open the browser DevTools and check two things:

1. **Console tab** (F12 → Console): Red errors here tell you exactly what went wrong in the JavaScript. This is almost always the fastest path to the answer.

2. **Network tab** (F12 → Network): Filter by "XHR" or "Fetch". Look for red rows (failed requests). Click a failed row → click "Response" — this shows what Supabase or OpenRouter said.

**The question to ask:** "Is this a frontend error (something in the React app) or a backend error (Supabase returned an error)?"

- Frontend errors appear in the Console tab.
- Backend errors appear in the Network tab (usually a 400 or 401 from `supabase.co`).

---

## White screen / app won't load

### Symptom
You open the app and see nothing — a blank white (or black) page with no UI at all.

### Step 1: Check the console

Open F12 → Console. You'll almost always see a red error. Common ones:

**"Missing Supabase environment variables"**

This is thrown by `src/lib/supabase.ts` if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing.

Fix for local dev:
```bash
# Verify your .env.local exists and has the right variables:
cat .env.local
# Should show:
# VITE_SUPABASE_URL=https://...
# VITE_SUPABASE_ANON_KEY=eyJ...

# If the file doesn't exist:
cp .env.example .env.local
# Then edit .env.local with real values, then:
npm run dev
```

Fix for production: Go to Vercel → dmpgrants → Settings → Environment Variables. Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Then trigger a redeploy.

**"Cannot read properties of undefined"** or **"X is not a function"**

A JavaScript crash at startup. Look at the file name and line number in the error — navigate to that file and read the code. Often caused by a recent code change that introduced a bug.

**No errors at all — just blank**

Try a hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac). This clears the cached JS bundle.

If still blank after hard refresh, check the Network tab — is `index.html` loading? If `index.html` returns 404, the Vercel deploy failed or the rewrite rules are broken.

### Step 2: Check if it's a production-only issue

If the app works locally (`npm run dev`) but not on Vercel:
1. Check Vercel → Deployments → latest → View Build Logs. Did the build succeed?
2. Check that env vars are set in Vercel (see above).
3. Check that the latest commit didn't introduce a TypeScript error that only shows up in a full production build (`npm run build` locally to verify).

---

## Login problems

### "Invalid login credentials"

The email or password is wrong. Double-check:
- Is the user account created in Supabase? (Supabase → Authentication → Users)
- Is the email verified? (Some Supabase configs require email confirmation)
- Are you using the right Supabase project? (The URL in your `.env.local` should match the project where the user was created)

To reset a password via the Supabase dashboard:
1. Supabase → Authentication → Users
2. Find the user → click the three-dot menu → "Send password reset"
3. The user gets an email with a reset link

### "Email not confirmed"

The user signed up but never clicked the confirmation email.

Fix: In Supabase → Authentication → Users → find the user → three-dot menu → "Confirm email" (manually confirms without needing the email).

Or, to disable email confirmation entirely (useful for internal apps):
Supabase → Authentication → Email → disable "Enable email confirmations".

### Login succeeds but redirects back to login page immediately

Symptom: You log in, the loading spinner appears, then you're back on the login page.

Cause: The session was set, but immediately lost. Usually means `AuthProvider` is unmounting and remounting.

Check `src/App.tsx` — is `AuthProvider` wrapping all routes? It must be a single instance wrapping the entire app, not inside a route component (which re-mounts on navigation).

### Logged-in user gets kicked to login on page refresh

The `supabase.auth.getSession()` call in `AuthProvider` (`src/lib/auth.tsx:53`) failed. Open Network tab on page load — look for a request to `supabase.co/auth/v1/token` that returned an error.

If the refresh token expired: normal behavior. User must log in again.
If getting a CORS error: something is misconfigured in Supabase → Settings → API → CORS.

---

## Demo mode problems

### Demo mode button doesn't log in

First check: are you on the login page? The demo button is only on the login page (`src/pages/Login.tsx`).

If clicking "View Demo" does nothing (no redirect, no error):

1. Open Console — any errors?
2. Check that `enableDemoMode()` in `src/lib/demo-data.ts` dispatches the event correctly:
   ```ts
   window.dispatchEvent(new CustomEvent('dmp-demo-change', { detail: true }))
   ```
3. Check that `AuthProvider` in `src/lib/auth.tsx` is listening for this event (see line 41-45).

### Demo mode shows blank data (or errors)

**This is expected, not a bug.** Demo mode only bypasses Supabase authentication — it
does not provide mock data. Every `useData.ts` hook queries live Supabase regardless
of demo mode, so without real `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` values set,
every page will show empty lists or a failed-to-load state. If you need to see the app
populated with data, configure real Supabase credentials (see
[docs/08-environment.md](08-environment.md)) — there is no demo-mode branch in any
hook to fix; none was ever built.

### Can't exit demo mode

Clicking logout in demo mode should call `disableDemoMode()` from `src/lib/demo-data.ts`, which:
1. Removes `dmp-demo-mode` from localStorage
2. Dispatches `dmp-demo-change` event with `detail: false`
3. `AuthProvider` sets `isDemoActive = false` → `isAuthenticated = false` → redirects to login

If this isn't working: open DevTools → Application tab → Local Storage → look for `dmp-demo-mode`. Delete it manually, then refresh.

---

## Data not loading or showing wrong data

### Loading spinner that never stops

The data hook is stuck waiting for a Supabase response.

1. Open Network tab — is there a pending request to `supabase.co`?
2. If the request exists but is taking forever: Supabase is slow or unreachable. Check [status.supabase.com](https://status.supabase.com).
3. If there's no request at all: the query key might be wrong, or React Query is using cached data. Try adding `?fresh=true` to the URL (forces a page reload).

### Data loads but looks stale (outdated)

React Query caches data. After a mutation (create/update/delete), the cache must be invalidated to trigger a refetch.

If you make a change and the table doesn't update: look at the mutation function in the page's `.tsx` file. After the Supabase call, there should be:
```ts
queryClient.invalidateQueries({ queryKey: ['burials'] })
```
If this line is missing, the table won't refresh until the next page load.

### "Row not found" or data disappears

This is usually an RLS issue. The user doesn't have SELECT permission for that row.

To diagnose:
1. Supabase → SQL Editor → run this with the user's ID:
   ```sql
   SET request.jwt.claim.sub = 'YOUR-USER-UUID';
   SET ROLE authenticated;
   SELECT * FROM burials WHERE id = 'THE-ROW-ID';
   ```
   If this returns nothing, RLS is blocking it.

2. Check the RLS policy for the `burials` table. Does it allow SELECT for this user?

### Numbers or money values look wrong

Check that the column type in Supabase is `numeric` or `decimal`, not `text`. If money is stored as text, arithmetic operations won't work.

Also check `src/lib/api.ts` — the snake_case → camelCase transformation happens there. If a field isn't showing up, the column name might not be transforming correctly.

---

## Vercel build failures

### Where to find build logs

Vercel dashboard → dmpgrants → Deployments → click the failed deployment → "View Build Logs".

**Important:** The build log shows output in order. Scroll up from the bottom to find the **first** error — later errors are usually cascading from the first.

### Common Vercel build errors

**`error TS2345: Argument of type '...' is not assignable to parameter of type '...'`**

A TypeScript error. The code that caused it is referenced in the error (e.g., `src/pages/Burials.tsx:123`).

Fix: Run `npm run typecheck` locally. If it passes locally, check that both environments use the same TypeScript version (`package.json` → `"typescript"` version).

**`'X' is defined but never used`**

ESLint error. An imported variable or function isn't used in the file.

Fix: Either use the variable, remove the import, or prefix it with `_` if it must exist but not be used (e.g., `_unusedParam`). Run `npm run lint` locally to catch these before pushing.

**`Module not found: Error: Can't resolve './SomeComponent'`**

A file referenced in an import doesn't exist, or the path is wrong.

Fix: Check that the file exists at the exact path with the exact filename. Note: on Windows, filenames are case-insensitive; on Linux (Vercel's build environment), they're case-sensitive. `SomeComponent.tsx` ≠ `somecomponent.tsx`.

**`npm run build exited with 1`** (with no clear error above it)

Scroll further up in the logs. There's always a more specific error earlier.

**`Missing Supabase environment variables`**

The env vars aren't set in Vercel. Go to Settings → Environment Variables and add them, then trigger a new deploy.

---

## GitHub Actions CI failures

Go to the GitHub repo → Actions tab → click the failed run → click the failed job → expand the failed step.

### Lint failure

```
error  'someVar' is defined but never used  no-unused-vars
```

Remove the unused variable. Or if it's a parameter that must exist (like a callback signature), prefix with `_`:

```ts
// Before (fails lint):
const handler = (event: Event) => { /* event not used */ }

// After (passes lint):
const handler = (_event: Event) => { /* intentionally unused */ }
```

### Type check failure

```
error TS2304: Cannot find name 'X'
```

Usually means a missing import or a type that doesn't exist. The error includes the file name and line number.

### Build failure

Same as Vercel build failures above — run `npm run build` locally to reproduce.

### Test failure

```
AssertionError: expected 'Jan 1, 2024' to equal 'January 1, 2024'
```

A test expectation doesn't match the current output. Either:
- The implementation changed and the test needs to be updated (if the new behavior is intentional)
- A bug was introduced that broke something that was working

Run `npm test` locally to see the full test output.

---

## Local dev problems

### `npm run dev` fails to start

**Port already in use:**
```
Error: Port 5173 is already in use
```
Another process is using port 5173. Either kill it (`lsof -ti:5173 | xargs kill`) or use a different port:
```bash
npm run dev -- --port 3000
```

**`node_modules` issues:**
```
Cannot find module 'vite'
```
Run `npm install` to reinstall dependencies. If that doesn't help, delete and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Changes not showing up in the browser

Vite has hot module replacement (HMR) — most changes update the browser instantly. But some changes require a full page reload:
- Changes to `vite.config.ts`
- Changes to `tailwind.config.js`
- Adding a new env variable to `.env.local`

If changes genuinely aren't reflecting, press Ctrl+C to stop the dev server and run `npm run dev` again.

### TypeScript errors showing in editor but not in build

Your editor's TypeScript language server might be using a different TypeScript version. In VS Code: `Ctrl+Shift+P` → "Select TypeScript Version" → "Use Workspace Version".

---

## AI assistant problems

### The AI button doesn't appear

The `<AIAssistant />` component is rendered in `src/components/Layout.tsx` only for authenticated users. If you're not logged in (or demo mode isn't active), the component won't render.

### The AI button appears but clicking it shows an error

Check the console for the exact error. Common causes:

**"OpenRouter API key not configured" / AI assistant returns a 503**

In production this means `OPENROUTER_API_KEY` (no `VITE_` prefix, server-only) is
missing from Vercel's environment variables — that's the one `/api/chat` actually
reads. Locally with plain `npm run dev`, it means `VITE_OPENROUTER_API_KEY` is
missing from `.env.local` (or you need `vercel dev` instead, which serves `/api/chat`
locally using `OPENROUTER_API_KEY`).

Fix local: add `VITE_OPENROUTER_API_KEY` to `.env.local`, restart dev server.
Fix production: add `OPENROUTER_API_KEY` (not the `VITE_` one) to Vercel → Settings →
Environment Variables → redeploy.

**"429 Too Many Requests"**

You've hit the OpenRouter rate limit. Wait a minute and try again. If this happens frequently, consider upgrading your OpenRouter plan.

**"fetch failed" or network error**

The browser can't reach `openrouter.ai`. Check your internet connection. In production, check Supabase/Vercel status.

### AI responses are wrong or confusing

The system prompt (in `src/lib/gemini.ts`) gives the AI context about DMP. If it's giving bad answers about the cemetery business, the system prompt may need updating.

---

## Supabase errors

### "JWT expired"

The user's session token expired and the refresh failed. The user must log in again. This is normal behavior.

To see when this happened: Supabase → Logs → Auth logs.

### "new row violates row-level security policy"

You tried to INSERT or UPDATE a row but RLS blocked it. The current user doesn't have permission.

Check the RLS policies on the relevant table. The `WITH CHECK` clause (for INSERT/UPDATE) must evaluate to true for the current user.

### "relation 'tablename' does not exist"

The table name is wrong in the code. Check `src/lib/api.ts` — the table name passed to `supabase.from('tablename')` must exactly match the table name in Supabase.

### "column 'column_name' does not exist"

The column name in the SELECT or filter doesn't exist. Remember: Supabase uses snake_case column names (`created_at`, `work_order_id`), and `src/lib/api.ts` converts them to camelCase for the frontend. If you're writing a raw query, use snake_case.

### Supabase is down

Check [status.supabase.com](https://status.supabase.com). If there's an incident, there's nothing you can do but wait.

---

## TypeScript errors

### "Property 'X' does not exist on type 'Y'"

You're accessing a property that TypeScript doesn't know about. Either:
1. The type definition in `src/types/index.ts` doesn't include that property (add it)
2. The object might be null (add a null check: `if (!obj) return`)
3. You're using the wrong type entirely (look at what type the function actually returns)

### "Type 'X | null' is not assignable to type 'X'"

You have a value that might be null, but the function expects a non-null value.

Fixes:
```ts
// Option 1: Null check
if (!value) return;
doSomething(value);  // TypeScript knows it's not null here

// Option 2: Non-null assertion (use only if you're certain it can't be null)
doSomething(value!);

// Option 3: Fallback
doSomething(value ?? 'default');
```

### "Object is possibly 'undefined'"

Same as above, but for undefined. Use optional chaining: `obj?.property` or a guard: `if (!obj) return`.

---

## Performance problems

### App loads slowly

Open F12 → Network tab → set throttling to "Fast 3G" → reload. Look for large files.

The main bundle should be under 500KB. If it's larger:
1. Run `npm run build` — Vite will warn about chunks over 500KB
2. Look for large imports (Moment.js, lodash, etc.) that could be replaced with lighter alternatives
3. Dynamic import heavy pages: `const Burials = lazy(() => import('./pages/Burials'))`

### Specific page loads slowly

Open F12 → Network tab with no throttling. How long do the Supabase requests take?

If Supabase is slow: the query may be missing an index. Go to Supabase → Table Editor → the relevant table → check if the columns you're filtering on are indexed.

If the page has many components mounting: React DevTools Profiler can show which components are taking the most time.

### Memory usage grows over time

Usually a React effect that adds an event listener but never removes it. Look for `useEffect` blocks that add listeners — every `addEventListener` must have a corresponding `removeEventListener` in the cleanup function.

---

## Nuclear option: full reset

If you've broken something and can't figure it out, here's the full local reset procedure:

```bash
# 1. Save any uncommitted work
git stash

# 2. Reset to the last clean commit
git status               # see what's changed
git checkout -- .        # discard all unstaged changes (DESTRUCTIVE)

# 3. Clean node_modules
rm -rf node_modules package-lock.json
npm install

# 4. Reset your env file
cp .env.example .env.local
# Edit .env.local with real values

# 5. Clear localStorage (clears demo mode, cached auth, etc.)
# Open browser → F12 → Application → Local Storage → right-click → Clear

# 6. Start fresh
npm run dev
```

For a production incident requiring rollback, see [docs/07-deployment.md](07-deployment.md#rollback-procedure).

---

← [09 Security](09-security.md) | Next: [11 Design System](11-design-system.md) →

# 05 — Vercel Guide

> **TL;DR:** Vercel hosts the app. Push to `main` → auto-deploys in ~60 seconds. Every PR branch gets a unique preview URL. Env vars (Supabase keys, OpenRouter key) live in Vercel dashboard → Settings → Environment Variables. Never store secrets in code.

---

## Table of Contents
- [What Vercel does](#what-vercel-does)
- [Accessing the Vercel dashboard](#accessing-the-vercel-dashboard)
- [How deployments work](#how-deployments-work)
- [Preview deployments](#preview-deployments)
- [Environment variables in Vercel](#environment-variables-in-vercel)
- [vercel.json explained](#verceljson-explained)
- [Reading build logs](#reading-build-logs)
- [Rollback a deployment](#rollback-a-deployment)
- [Custom domain](#custom-domain)
- [Vercel CLI (optional, advanced)](#vercel-cli-optional-advanced)
- [Troubleshooting Vercel issues](#troubleshooting-vercel-issues)

---

## What Vercel does

Vercel is a cloud platform that:
1. **Watches your GitHub repository** for new commits
2. **Runs `npm run build`** to compile the React app into static files
3. **Serves those files** from a global CDN (content delivery network) — so users worldwide get fast load times
4. **Manages SSL certificates** automatically (HTTPS works without any setup)
5. **Handles environment variables** securely — they're injected at build time

You don't manage servers, you don't configure nginx, you don't pay for compute when no one's using the app. Vercel handles all of that.

**Cost:** The project is on the free Hobby tier. Limits are generous (100 GB bandwidth/month, unlimited deployments). Upgrading to Pro (~$20/mo) adds team features and more bandwidth if needed.

---

## Accessing the Vercel dashboard

1. Go to [vercel.com](https://vercel.com) and sign in (use the GitHub account that owns `Know-Kname/dmp-grants-dashboard`).
2. You'll see the **dmpgrants** project on the dashboard.
3. Click it to see the project page.

**Key sections of the project page:**

| Section | What you'll find |
|---|---|
| **Overview** | Latest deployment status, preview URL, visit count |
| **Deployments** | Full history of every deploy, with links to each version |
| **Settings → General** | Project name, build settings, root directory |
| **Settings → Environment Variables** | Where to add/edit/delete the app's env vars |
| **Settings → Domains** | Custom domain management |
| **Settings → Git** | Which branch triggers production deploys |
| **Analytics** | Page views, visitors, Web Vitals (if enabled) |
| **Functions** | Serverless function logs (not used currently) |

---

## How deployments work

Every time you push a commit to `main`:

```
git push origin main
         ↓
GitHub receives the push
         ↓
Vercel's GitHub app is notified (webhook)
         ↓
Vercel queues a new deployment
         ↓
Vercel runs: npm ci && npm run build
         ↓
TypeScript compiles + Vite bundles → dist/ folder
         ↓
dist/ is uploaded to Vercel's edge network
         ↓
Old production URL now points to new build
         ↓
Done — typically 45–90 seconds from push to live
```

You can watch this happen in real time:
1. Push a commit
2. Go to [vercel.com](https://vercel.com) → dmpgrants → Deployments
3. You'll see a new deployment appear with status "Building"

---

## Preview deployments

This is one of Vercel's best features. **Every branch gets its own URL.**

When you push a feature branch:
```bash
git push origin feat/add-burial-export
```

Vercel automatically:
1. Builds that branch
2. Creates a unique URL like: `dmpgrants-git-feat-add-burial-export-chi.vercel.app`
3. Posts the URL in the GitHub PR as a comment

This lets you:
- Test changes without touching production
- Share a working preview with stakeholders before merging
- Run A/B comparisons between the current production and a new design

Preview deployments use the **Preview** tier environment variables (see next section).

---

## Environment variables in Vercel

This is where the app's secrets live: two values the frontend JavaScript needs to
run, plus one server-only value the `/api/chat` Edge Function needs.

### Where to set them

1. Go to [vercel.com](https://vercel.com) → dmpgrants → **Settings → Environment Variables**.
2. Click **"Add New"**.
3. Enter the name (e.g. `VITE_SUPABASE_URL`), the value, and select which environments it applies to.

### Environment scopes

Vercel has three scopes:

| Scope | When it's used | Example use |
|---|---|---|
| **Production** | Code deployed from `main` branch | Real Supabase database |
| **Preview** | Code deployed from any other branch | Same Supabase database (or a test one) |
| **Development** | When using `vercel dev` locally | Usually mirrors Production |

Most of the time, set all three variables to the same values across all three scopes.

### Current variables that must be set

| Variable | Value source | Scope | Required? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL | All | ✅ Required |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key | All | ✅ Required |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys | All | ✅ Required for the AI assistant to work — server-only, read by the `/api/chat` Edge Function (`api/chat.ts`) |
| `VITE_OPENROUTER_API_KEY` | openrouter.ai → Keys | — | ❌ **Do not set this one in Vercel.** It's a dev-only fallback for `npm run dev` without `vercel dev` running, gated behind `import.meta.env.DEV` and stripped from production builds. See [docs/09-security.md](09-security.md). |

### How env vars flow into the app

Vercel injects env vars at **build time**. Vite reads all `VITE_*` variables and bakes them into the compiled JavaScript. This means:

- You **cannot** change an env var and have the running app pick it up immediately — you need to **trigger a redeploy**.
- The values are embedded in the JS bundle — they're visible in browser devtools. This is fine for the Supabase anon key (it's designed to be public) but **don't put sensitive secrets** like the Supabase service_role key or a private API key.

**To trigger a redeploy after changing an env var:**
1. Go to Deployments tab
2. Find the latest deployment
3. Click the three-dot menu → "Redeploy"

---

## vercel.json explained

The `vercel.json` file in the root of the repo configures how Vercel builds and serves the app.

```json
{
  "version": 2,
  "name": "dmpgrants",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null,
  "installCommand": "npm ci",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [...],
  "cleanUrls": true,
  "trailingSlash": false
}
```

**Line-by-line explanation:**

`"name": "dmpgrants"` — The Vercel *project* name (unrelated to the GitHub repo name — the repo is `dmp-grants-dashboard`, this is just what Vercel's dashboard/URLs call the project).

`"buildCommand": "npm run build"` — Run this to compile the app. Our script runs TypeScript + Vite.

`"outputDirectory": "dist"` — After building, the compiled files are in `dist/`. Vercel uploads this folder.

`"installCommand": "npm ci"` — Clean install from `package-lock.json` (not `npm install`), so CI/deploys always get exactly the locked versions.

`"framework": null` — We're not using a framework-specific preset (like Next.js). Vite handles everything.

`"rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]` — This is the **crucial SPA rule**. When a user navigates to `/burials` directly (or refreshes), Vercel would return a 404 (there's no `burials.html` file). This rule says: for any URL that *doesn't* start with `/api/`, serve `index.html` instead — React Router then reads the URL and shows the right page. The `(?!api/)` negative-lookahead exists so this rule doesn't swallow requests meant for the `/api/chat` Edge Function.

`"headers"` — Security headers added to every response:
- `X-Content-Type-Options: nosniff` — Prevents browsers from guessing file types (protects against certain attacks)
- `X-Frame-Options: DENY` — Prevents the site from being embedded in an iframe (protects against clickjacking)
- `X-XSS-Protection: 1; mode=block` — Legacy XSS protection in older browsers
- `Referrer-Policy: strict-origin-when-cross-origin` — Controls what URL is sent when navigating to external sites
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — Forces HTTPS for the next 2 years on this domain and its subdomains, even if a user types `http://`
- `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()` — Allows the Geolocation API only for this origin (used by the cemetery map's GPS-capture feature), and explicitly blocks camera/microphone/payment APIs, none of which the app uses

`"headers": [{ "source": "/assets/(.*)", "Cache-Control": "public, max-age=31536000, immutable" }]` — Tells browsers to cache all files in `/assets/` (Vite puts hashed JS/CSS bundles here) for 1 year. When files change, Vite generates new hash-named files, so browsers always get fresh content.

`"cleanUrls": true` — Removes `.html` extensions from URLs (irrelevant for SPA, but clean).

`"trailingSlash": false` — `/burials` not `/burials/`.

---

## Reading build logs

When a deployment fails, the build logs tell you exactly why.

1. Go to Vercel dashboard → dmpgrants → Deployments.
2. Click the failed deployment.
3. Click **"View Build Logs"**.
4. Scroll to the first red error — that's where the build broke.

**Common failures and what they mean:**

| Log message | Cause | Fix |
|---|---|---|
| `error TS2345: Argument of type...` | TypeScript error | Fix the type error in the referenced file |
| `Module not found: Can't resolve '...'` | Missing import or package not installed | Check the import path or run `npm install` |
| `'X' is defined but never used` | ESLint error (unused variable) | Remove the unused variable |
| `Build failed: exit code 1` with no details | Check earlier in the log for the actual error | Scroll up |
| `Cannot find module '@tanstack/react-query'` | Dependency missing from `package.json` | Add it with `npm install @tanstack/react-query` |

---

## Rollback a deployment

If a deployment introduces a bug in production:

1. Go to Vercel dashboard → dmpgrants → Deployments.
2. Find the last **working** deployment (look for the green checkmark on an earlier entry).
3. Click the three-dot menu on that deployment.
4. Click **"Promote to Production"**.

This instantly points the production URL back to the old build. No code changes needed.

---

## Custom domain

The production deployment is currently on a Vercel-generated URL (e.g. `dmpgrants-*.vercel.app`).

To add a custom domain (e.g. `cms.detroitmemorialpark.org`):

1. Buy or use an existing domain (via your registrar — GoDaddy, Namecheap, etc.)
2. Go to Vercel → Settings → Domains → Add domain
3. Enter the domain name
4. Vercel shows you DNS records to add — typically a CNAME record
5. Log in to your domain registrar and add those DNS records
6. Wait up to 48 hours for DNS propagation
7. Vercel automatically provisions an SSL certificate

> ⚠️ Once you add a custom domain, update the `HTTP-Referer` header in `src/lib/gemini.ts` to use it, so OpenRouter's rate limiting applies to your domain.

---

## Vercel CLI (optional, advanced)

The Vercel CLI lets you deploy from your terminal and manage env vars without using the web dashboard.

```bash
npm install -g vercel     # Install CLI globally

vercel login              # Authenticate with your account
vercel link               # Link this folder to your Vercel project

vercel env ls             # List all env vars for this project
vercel env add VITE_X     # Add a new env var interactively
vercel env pull           # Download env vars to .env.local

vercel deploy             # Deploy current directory to preview
vercel deploy --prod      # Deploy to production (same as pushing to main)
```

---

## Troubleshooting Vercel issues

**Deployment succeeds but app shows white screen**
- Open browser devtools → Console tab. Look for `TypeError` or missing module errors.
- Usually means an env var is missing. Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel → Settings → Environment Variables.
- Trigger a redeploy after adding the vars.

**Build fails with "cannot find module"**
- A package in `package.json` might not be installed. Run `npm install` locally, commit the updated `package-lock.json`, and push.

**Preview URL works but production doesn't**
- Check if Production scope env vars differ from Preview scope. They might be pointing to a different database or missing a key.

**Changes not showing up on the live site**
- Force a hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac).
- Check the Deployments tab — did the latest push actually deploy successfully?

**"Rewrite rules not working" — direct URL navigation gives 404**
- Check that `vercel.json` has the rewrite rule: `{ "source": "/(.*)", "destination": "/index.html" }`. Without this, navigating directly to any page (or refreshing on any page) returns 404.

---

← [04 GitHub](04-github.md) | Next: [06 Supabase](06-supabase.md) →

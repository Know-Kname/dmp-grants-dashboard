# Detroit Memorial Park — Cemetery Management System

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-DB%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?logo=vercel&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)

Internal management system for **Detroit Memorial Park Association, Inc.** — operating three Michigan cemetery locations since 1925. Manages burials, work orders, inventory, contracts, financial records, customers, and grants.

**Live app:** auto-deploys to Vercel on every push to `main`.

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/Know-Kname/dmpgrants.git
cd dmpgrants

# 2. Install dependencies
npm install

# 3. Copy and fill in environment variables
cp .env.example .env.local
# Edit .env.local — add your Supabase URL + anon key
# (see docs/08-environment.md for the full explanation)

# 4. Start the dev server
npm run dev
# → Opens at http://localhost:5173
```

> **No Supabase credentials yet?** Click **Preview Demo** on the login page — you get a full tour with realistic mock data, no account needed.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI framework | React 18 + TypeScript 5 | Component-based SPA |
| Build tool | Vite 4 | Dev server + production bundler |
| Styling | Tailwind CSS 3 + CSS variables | Design tokens, dark/light mode |
| Routing | React Router DOM v6 | Client-side page routing |
| Server state | TanStack React Query v5 | Data fetching, caching, mutations |
| Database | Supabase (PostgreSQL) | 13 tables, row-level security |
| Auth | Supabase Auth | Email/password + demo mode |
| AI assistant | OpenRouter → Gemini 2.5 Pro | Floating chat panel in the app |
| Deployment | Vercel | Auto CI/CD from `main` branch |
| Charts | Recharts 2 | Dashboard visualizations |
| Icons | Lucide React | SVG icon library |

---

## Project Structure

```
dmpgrants/
├── src/
│   ├── pages/          # One file per page (Dashboard, Burials, Inventory…)
│   ├── components/     # Layout, AIAssistant, shared ui.tsx component library
│   ├── hooks/          # useData.ts — all React Query data hooks
│   ├── lib/            # auth, supabase client, api, toast, gemini, utils…
│   ├── config/         # company.ts — DMP locations, phone numbers, metadata
│   ├── types/          # TypeScript types for every data model
│   └── styles/         # index.css — Tailwind base + CSS design tokens
├── public/             # Static assets: DMP logo, hero image, cemetery photos
├── docs/               # 📚 All documentation (start here → docs/README.md)
├── .github/            # CI workflows, PR template, issue templates, Dependabot
├── vercel.json         # Vercel config: SPA rewrites, security headers, cache
└── .env.example        # Template — copy to .env.local and fill in values
```

---

## Commands

```bash
npm run dev          # Local dev server (http://localhost:5173, hot-reload)
npm run build        # TypeScript check + Vite production build → dist/
npm run preview      # Serve the production build locally for testing
npm run typecheck    # Type-check only (no build output)
npm run lint         # ESLint — zero warnings policy enforced
npm test             # Vitest in watch mode
npm run test:run     # Vitest single run (used in CI)
```

---

## Documentation

All guides live in [`/docs/`](docs/README.md). **New to the project?** Read in this order:

1. [Getting Started](docs/01-getting-started.md) — local setup, first run, demo mode
2. [Architecture](docs/02-architecture.md) — how the app is built end-to-end
3. [GitHub Guide](docs/04-github.md) — branches, PRs, CI, code review
4. [Vercel Guide](docs/05-vercel.md) — deployments, env vars, preview URLs
5. [Supabase Guide](docs/06-supabase.md) — database, auth, schema, RLS

| Guide | What it covers |
|---|---|
| [01 Getting Started](docs/01-getting-started.md) | Install, first run, demo mode, folder map |
| [02 Architecture](docs/02-architecture.md) | Data flow, routing, auth, state management |
| [03 Development](docs/03-development.md) | Daily workflow, conventions, testing, linting |
| [04 GitHub](docs/04-github.md) | Branches, PRs, CI workflows, secrets, Dependabot |
| [05 Vercel](docs/05-vercel.md) | Deployments, env vars, preview URLs, rollbacks |
| [06 Supabase](docs/06-supabase.md) | Database tables, auth, RLS, schema changes |
| [07 Deployment Pipeline](docs/07-deployment.md) | Push → preview → production end-to-end |
| [08 Environment Variables](docs/08-environment.md) | Every variable explained, where to set each one |
| [09 Security](docs/09-security.md) | Keys, RLS, secrets management, security headers |
| [10 Troubleshooting](docs/10-troubleshooting.md) | Common errors and exactly how to fix them |
| [11 Design System](docs/11-design-system.md) | Colors, components, dark mode, Tailwind tokens |
| [12 Roadmap](docs/12-roadmap.md) | Upcoming features, known limitations |

---

## Locations

| Location | Address | Phone |
|---|---|---|
| DMP East | 4280 E. Thirteen Mile Rd, Warren, MI 48092 | (586) 751-1313 |
| DMP West | 25062 Plymouth Road, Redford, MI 48239 | (313) 533-1302 |
| Gracelawn | 5710 N. Saginaw Street, Flint, MI 48505 | (810) 785-7890 |

---

© Detroit Memorial Park Association, Inc. · Internal use only

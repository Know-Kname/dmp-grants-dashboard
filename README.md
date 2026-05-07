# RIP — Cemetery Management Platform

Professional operations management software for independent cemetery and memorial park operators.

Built on React + TypeScript + Supabase + Vercel. Forked from the Detroit Memorial Park CMS.

---

## Modules

| Module | What it does |
|---|---|
| **Burials** | Burial records, plot assignments, memorials, public memorial pages |
| **Work Orders** | Field crew scheduling, task tracking, completion photos |
| **Inventory** | Cemetery supplies, equipment, stock levels |
| **Financial** | Deposits, accounts receivable/payable, payment schedules |
| **Contracts** | Pre-need and at-need contract management |
| **Customers** | Family records, contact history |
| **Grants** | Grant tracking and reporting |
| **Cemeteries** | Property hierarchy: Cemetery → Section → Lot → Grave |
| **Cemetery Map** | Interactive satellite map with grave markers and GPS drop-pin |

---

## Setup

### 1. Configure your cemetery

Edit `src/config/company.ts` with your cemetery's name, locations, and contact info.

### 2. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com). Then apply all migrations:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### 3. Set environment variables

```bash
cp .env.example .env.local
# Fill in your values
```

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon (public) |
| `VITE_OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) → API Keys |

### 4. Deploy to Vercel

```bash
npm install
npm run build    # verify clean build first
```

Then: Vercel Dashboard → New Project → Import this repo → set environment variables → Deploy.

---

## Development

```bash
npm run dev          # localhost:5173
npm run typecheck    # TypeScript — must be zero errors
npm run lint         # ESLint — zero warnings policy
npm run build        # production build
```

---

## Tech Stack

React 18 · TypeScript 5 · Vite 4 · Tailwind CSS 3 · TanStack React Query v5 ·
Supabase (auth + PostgreSQL) · React Router v6 · Recharts · Lucide icons ·
AI assistant via OpenRouter (Gemini 2.5 Pro)

---

## License

Private. Contact the repository owner for licensing information.

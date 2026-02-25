# Project Instructions

> Compatible with Cursor, Zed, OpenCode, and other AI coding tools.

## Project Overview

Detroit Memorial Park cemetery business management software.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL
- **Testing**: Vitest + React Testing Library

## Code Style

- TypeScript strict mode, no `any` types
- Named exports over default exports
- Functional React components with hooks
- Use existing components from `src/components/ui.tsx`

## Commands

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run test` - Run tests
- `npm run db:setup` - Initialize database

## Architecture

- `/src` - React frontend
- `/server` - Express API
- `/docs` - Documentation

## Key Rules

- NEVER commit .env files
- Use error utilities from `src/lib/errors.ts`
- All API routes require authentication
- Use parameterized database queries only
- Co-locate tests with source files

## Branch Workflow

- `main` = production (protected, requires PR + approval)
- `develop` = integration
- `feature/LIN-XXX-desc` = feature branches
- `fix/LIN-XXX-desc` = bug fixes
- Use Conventional Commits: `feat(scope): description`

## Platform Integrations

- **GitHub**: CI/CD, code review, branch protection
- **Vercel**: Deployment (auto-preview on PRs, auto-prod on main)
- **Linear**: Issue tracking (auto-links with branch names)
- **Figma**: Design tokens, component specs
- **Notion**: Documentation hub
- **n8n**: Cross-platform automation

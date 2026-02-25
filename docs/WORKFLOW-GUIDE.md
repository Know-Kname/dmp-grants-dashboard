# Development Workflow Guide

## Quick Reference

### Starting a New Feature

```bash
# 1. Create Linear issue (or use existing)
# 2. Create branch from develop
git checkout develop && git pull origin develop
git checkout -b feature/LIN-123-feature-name

# 3. Make changes
# ... code ...

# 4. Commit with conventional format
git add .
git commit -m "feat(scope): description

Implements LIN-123"

# 5. Push and create PR
git push -u origin HEAD
gh pr create --base develop --title "feat(scope): description [LIN-123]"

# 6. Monitor CI
gh pr checks
```

### Fixing a Bug

```bash
git checkout develop && git pull
git checkout -b fix/LIN-456-bug-description

# Fix the bug, write tests
git add .
git commit -m "fix(scope): description

Fixes LIN-456"

git push -u origin HEAD
gh pr create --base develop
```

### Deploying to Production

```bash
# 1. Create PR from develop to main
gh pr create --base main --head develop --title "Release: description"

# 2. Wait for CI checks and approval
gh pr checks

# 3. Merge (triggers production deployment)
gh pr merge --squash

# 4. Verify deployment
# Check Vercel dashboard or preview URL
```

### Emergency Hotfix

```bash
# Branch directly from main
git checkout main && git pull
git checkout -b fix/hotfix-description

# Fix, commit, push
git commit -m "fix: critical issue description"
git push -u origin HEAD
gh pr create --base main
```

## Daily Workflow

### Morning Standup (`run daily-standup`)

1. Check Linear board for assigned issues
2. Review any pending PR reviews
3. Check GitHub Actions for any failed builds
4. Review deployment status on Vercel

### During Development

1. Work in feature branches
2. Commit frequently with conventional messages
3. Push regularly to trigger CI checks
4. Request reviews when ready

### End of Day

1. Push any work-in-progress branches
2. Update Linear issue status if needed
3. Leave comments on any blocking issues

## Platform Quick Links

| Platform | URL | Purpose |
|----------|-----|---------|
| GitHub | https://github.com/Know-Kname/dmpgrants | Code & CI |
| Vercel | https://vercel.com (project dashboard) | Deployments |
| Linear | https://linear.app | Issues & Sprints |
| Figma | https://figma.com (project file) | Designs |
| Notion | https://notion.so (workspace) | Documentation |

## Cursor AI Commands

| Command | What it Does |
|---------|-------------|
| `run deploy-preview` | Deploy current changes to preview |
| `run sync-platforms` | Sync status across all platforms |
| `run design-update` | Pull latest design tokens from Figma |
| `run platform-health` | Check all platform connectivity |
| `run daily-standup` | Morning setup routine |
| `run ship-it` | Pre-deploy checklist |
| `run quick-research [topic]` | Fast research lookup |
| `run new-feature [name]` | Feature kickoff workflow |

## Available AI Skills

| Skill | Use For |
|-------|---------|
| `github-workflow` | PR creation, commit messages, CI |
| `vercel-deploy` | Deployment, rollback, monitoring |
| `linear-issue` | Issue creation, linking, tracking |
| `design-handoff` | Figma to code implementation |
| `notion-doc` | Documentation generation |
| `code-review` | Code quality review |
| `testing` | Test-driven development |
| `debugging` | Systematic bug investigation |

## Troubleshooting

### CI Checks Failing

```bash
# Run locally first
npm run lint
npx tsc --noEmit
npm test
npm run build
```

### Preview Deployment Not Working

1. Check Vercel dashboard for build logs
2. Verify environment variables are set
3. Check webhook in GitHub Settings > Webhooks
4. Try manual deploy: `vercel`

### Linear Not Syncing

1. Verify integration in Linear Settings > Integrations
2. Check branch name includes `LIN-XXX` identifier
3. Verify webhook delivery in Linear API settings

### Design Tokens Out of Sync

1. Run `npm run tokens:sync` (if configured)
2. Or manually check Figma for updated values
3. Update `tailwind.config.js` accordingly

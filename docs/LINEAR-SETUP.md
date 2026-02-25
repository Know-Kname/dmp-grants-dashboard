# Linear + GitHub Integration Setup Guide

## Step 1: Install the Integration

1. Open Linear and navigate to **Settings > Integrations > GitHub**
2. Click **Connect** and select the GitHub organization: `Know-Kname`
3. Choose **All repositories** or select `dmpgrants` specifically
4. Authorize the integration

## Step 2: Configure Workflow Automation

In Linear, navigate to **Settings > Teams > [Your Team] > Workflow**:

### Automatic Status Transitions

| GitHub Action | Linear Status Change |
|---------------|---------------------|
| Branch created with issue ID | -> In Progress |
| PR opened | -> In Review |
| PR merged to `main` | -> Done |
| PR closed (not merged) | -> Returns to previous |

### Enable these settings:
- [x] Auto-move issues when branch is created
- [x] Auto-move issues when PR is opened
- [x] Auto-close issues when PR is merged
- [x] Enable personal GitHub automations

## Step 3: Linking Conventions

### Branch Names (recommended)
```
feature/LIN-123-add-burial-form
fix/LIN-456-date-parsing
```

### PR Titles
```
feat(burials): add burial record form [LIN-123]
```

### Commit Messages
```
fix(auth): resolve session timeout

Fixes LIN-456
```

### PR Description Magic Words
- `Closes LIN-123` - Closes the issue when PR is merged
- `Fixes LIN-456` - Same as above
- `Resolves LIN-789` - Same as above

## Step 4: Team Structure

Create these teams in Linear:

| Team | Prefix | Scope |
|------|--------|-------|
| Engineering | ENG | All code work |
| Design | DES | UI/UX work |
| Product | PRD | Feature specs |

## Step 5: Labels (match GitHub)

Create these labels in Linear to match GitHub:
- `bug`, `feature`, `chore`, `documentation`
- `P0`, `P1`, `P2`
- `frontend`, `backend`, `database`, `deployment`

## Step 6: Cycles

Configure 2-week sprint cycles:
1. Go to **Settings > Teams > [Team] > Cycles**
2. Set cycle length: 2 weeks
3. Set start day: Monday
4. Enable auto-archiving of completed cycles

## Step 7: Projects

Create these projects:
- **DMP Cemetery Management** - Main application
- **Infrastructure & DevOps** - CI/CD, deployment, tooling
- **Design System** - UI components and tokens

## Verification Checklist

- [ ] GitHub integration shows "Connected" in Linear settings
- [ ] Creating a branch with `LIN-XXX` moves the issue
- [ ] Opening a PR auto-links to the Linear issue
- [ ] Merging a PR closes the Linear issue
- [ ] Labels are consistent between GitHub and Linear

# Metrics Tracking & Continuous Optimization

## Key Metrics (DORA)

Track these four key metrics to measure engineering effectiveness:

### 1. Deployment Frequency

**Target**: Multiple times per week

How to measure:
- Count merges to `main` per week
- Track via GitHub API or Vercel deployment count
- Dashboard: Vercel project > Deployments

### 2. Lead Time for Changes

**Target**: Less than 1 day (code commit to production)

How to measure:
- Time from first commit on branch to production deployment
- Track via GitHub PR creation date to merge date
- Formula: `merge_date - first_commit_date`

### 3. Mean Time to Recovery (MTTR)

**Target**: Less than 1 hour

How to measure:
- Time from incident detection to resolution
- Track via Notion incident reports
- Formula: `resolution_time - detection_time`

### 4. Change Failure Rate

**Target**: Less than 15%

How to measure:
- Percentage of deployments causing incidents
- Track: `failed_deployments / total_deployments`
- Source: Vercel deployment status + incident reports

## Monitoring Dashboards

### Vercel Speed Insights
- **What**: Core Web Vitals (LCP, FID, CLS)
- **Where**: Vercel Dashboard > Speed Insights
- **Action**: Investigate any metric in "Needs Improvement" range

### Vercel Web Analytics
- **What**: Page views, unique visitors, traffic sources
- **Where**: Vercel Dashboard > Analytics
- **Action**: Monitor for traffic anomalies

### GitHub Actions
- **What**: CI/CD pipeline health
- **Where**: GitHub > Actions tab
- **Action**: Fix any failing workflows within 24 hours

### Linear Velocity
- **What**: Sprint velocity, burndown
- **Where**: Linear > Cycles
- **Action**: Adjust sprint capacity based on trends

## Weekly Review Checklist

Every Monday:
- [ ] Review DORA metrics
- [ ] Check Speed Insights for regressions
- [ ] Review open Dependabot PRs
- [ ] Check CodeQL security alerts
- [ ] Review sprint burndown in Linear
- [ ] Update Notion project dashboard

## Monthly Retrospective

### Agenda
1. Review month's DORA metrics
2. Identify biggest bottleneck
3. Review workflow friction points
4. Assess tool utilization
5. Plan improvements for next month

### Questions to Ask
- Which workflows caused the most friction?
- Were there any incidents? What caused them?
- Which automation saved the most time?
- What manual steps should be automated next?
- Are our tools working well together?

### Improvement Categories

| Category | Examples |
|----------|---------|
| **Speed** | Faster builds, reduced CI time |
| **Quality** | Better tests, fewer bugs |
| **Automation** | New n8n workflows, reduced manual steps |
| **Visibility** | Better dashboards, clearer metrics |
| **Collaboration** | Improved handoffs, fewer blockers |

## Optimization Targets

### Build Time
- **Current**: Measure baseline
- **Target**: <3 minutes for CI pipeline
- **Actions**: Caching, parallel jobs, incremental builds

### PR Cycle Time
- **Current**: Measure baseline
- **Target**: <24 hours from open to merge
- **Actions**: Smaller PRs, async reviews, clear templates

### Deployment Success Rate
- **Current**: Measure baseline
- **Target**: >95%
- **Actions**: Preview verification, staging env, rollback procedures

### Design Implementation Accuracy
- **Current**: Measure baseline
- **Target**: <2 rounds of design review
- **Actions**: Better token sync, clearer Figma specs

## Cost Tracking

### Vercel
- Monitor via Spend Management alerts
- Review monthly: functions, bandwidth, builds
- Optimize: Fluid compute, ISR, caching

### GitHub
- Monitor: Actions minutes used
- Optimize: Caching, conditional workflows

### Linear / Notion / Figma
- Review subscription tier vs usage
- Ensure we're on appropriate plan

## Quarterly Goals Template

```markdown
# Q[X] 202X Engineering Goals

## Metrics Targets
- Deployment Frequency: X/week → Y/week
- Lead Time: X hours → Y hours
- MTTR: X hours → Y hours
- Change Failure Rate: X% → Y%

## Workflow Improvements
1. [Improvement 1]
2. [Improvement 2]
3. [Improvement 3]

## Automation Goals
1. [Automation 1]
2. [Automation 2]

## Success Criteria
- [Measurable outcome 1]
- [Measurable outcome 2]
```

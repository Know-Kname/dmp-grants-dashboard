# Notion Workspace Structure

## Overview

Notion serves as our central documentation hub and knowledge base. It complements (not replaces) Linear for project management and GitHub for code.

## Workspace Structure

```
DMP Cemetery Management
├── Engineering Wiki
│   ├── Architecture Overview
│   ├── System Diagrams
│   ├── API Documentation
│   ├── Database Schema Reference
│   ├── Deployment Procedures
│   └── Development Environment Setup
│
├── Product Specs
│   ├── Feature Specifications
│   ├── User Stories
│   └── Requirements Documents
│
├── Design System
│   ├── Component Library Reference
│   ├── Brand Guidelines
│   ├── Design Token Documentation
│   └── Accessibility Standards
│
├── Operations
│   ├── Runbooks
│   ├── Incident Response Procedures
│   ├── Monitoring Dashboard Links
│   └── Deployment Checklist
│
├── Decision Log
│   ├── Architecture Decision Records (ADRs)
│   └── Technology Evaluations
│
└── Dashboards
    ├── Project Dashboard
    ├── Deployments Log
    └── Sprint Progress
```

## Databases

### 1. Decisions Database (ADRs)

| Property | Type | Purpose |
|----------|------|---------|
| Title | Title | ADR name |
| Status | Select | Proposed, Accepted, Deprecated |
| Date | Date | Decision date |
| Category | Select | Architecture, Frontend, Backend, Infra |
| Linked PR | URL | GitHub PR implementing the decision |

### 2. Deployments Log

| Property | Type | Purpose |
|----------|------|---------|
| Version | Title | Deployment version/commit |
| Date | Date | Deployment timestamp |
| Environment | Select | Preview, Staging, Production |
| Status | Select | Success, Failed, Rolled Back |
| Deployed By | Person | Who triggered deployment |
| Changes | Rich Text | Summary of changes |
| Vercel URL | URL | Deployment URL |

### 3. Features Database

| Property | Type | Purpose |
|----------|------|---------|
| Feature | Title | Feature name |
| Linear Issue | URL | Link to Linear |
| Status | Select | Draft, In Progress, Done |
| Sprint | Select | Current sprint/cycle |
| Figma Link | URL | Design reference |
| PR | URL | Implementation PR |

### 4. Runbooks Database

| Property | Type | Purpose |
|----------|------|---------|
| Procedure | Title | Runbook name |
| Category | Select | Deploy, Incident, Maintenance |
| Severity | Select | P0, P1, P2 |
| Last Updated | Date | When last reviewed |
| Owner | Person | Responsible person |

## Automation (via n8n)

### GitHub → Notion

| Trigger | Action |
|---------|--------|
| PR merged to main | Add entry to Deployments Log |
| Release created | Update changelog page |
| Issue closed | Update Features Database |

### Vercel → Notion

| Trigger | Action |
|---------|--------|
| Deployment succeeded | Update Deployments Log (Success) |
| Deployment failed | Create incident page |

## MCP Integration

The Notion MCP server is configured for direct access:

```
# Read a Notion page
Use the Notion MCP to read the Engineering Wiki page.

# Create a new entry
Use the Notion MCP to add a deployment entry to the Deployments Log.

# Update existing content
Use the Notion MCP to update the Feature Database entry for LIN-123.
```

## Setup Instructions

1. **Notion API Key**: Generate at https://www.notion.so/my-integrations
2. **Share pages**: Share workspace pages with the integration
3. **Set env var**: `NOTION_API_KEY=your-key`
4. **Verify MCP**: Test connection via Cursor

## Best Practices

- Keep pages focused (one topic per page)
- Use callout blocks for important warnings
- Include "Last Updated" dates
- Link to source code when documenting technical details
- Use toggles for detailed sections
- Reference Linear issues for context

# n8n Workflow Automation Guide

## Overview

n8n orchestrates cross-platform automation between GitHub, Vercel, Linear, Notion, and Slack. These workflows eliminate manual status updates and keep all platforms synchronized.

## Prerequisites

- n8n instance running (self-hosted or cloud)
- n8n MCP server configured in `mcp.json`
- API keys/tokens for each platform:
  - `N8N_API_URL`: Your n8n instance URL
  - `N8N_API_KEY`: n8n API key
  - GitHub webhook secret
  - Vercel webhook secret
  - Notion API key
  - Linear API key (optional)

## Workflow 1: GitHub PR → Notion Deployments Log

### Trigger
GitHub webhook: Pull Request event (merged)

### Actions
1. **Extract PR data**: title, author, merged date, commit SHA
2. **Create Notion entry**: Add to Deployments Log database
3. **Post to Slack**: Send deployment notification

### n8n Configuration

```
[GitHub Trigger] → [Extract Data] → [Create Notion Page] → [Send Slack Message]
```

#### Nodes:

1. **GitHub Trigger** (Webhook)
   - Event: `pull_request`
   - Action: `closed` (where merged = true)

2. **Extract Data** (Function)
   ```javascript
   return [{
     json: {
       title: $input.item.json.pull_request.title,
       author: $input.item.json.pull_request.user.login,
       mergedAt: $input.item.json.pull_request.merged_at,
       sha: $input.item.json.pull_request.merge_commit_sha.substring(0, 7),
       url: $input.item.json.pull_request.html_url,
       branch: $input.item.json.pull_request.head.ref,
     }
   }];
   ```

3. **Create Notion Page** (Notion node)
   - Database: Deployments Log
   - Properties:
     - Title: `{{ $json.sha }} - {{ $json.title }}`
     - Date: `{{ $json.mergedAt }}`
     - Status: "Success"
     - Environment: "Production"
     - Changes: `{{ $json.title }}`
     - Vercel URL: (populated by next workflow)

4. **Send Slack Message** (Slack node)
   ```
   🚀 *Deployment to Production*
   PR: {{ $json.title }}
   Author: {{ $json.author }}
   Commit: `{{ $json.sha }}`
   Link: {{ $json.url }}
   ```

## Workflow 2: Vercel Deployment → Notion + Slack

### Trigger
Vercel webhook: Deployment event

### Actions
1. **Parse deployment data**: status, URL, timestamp
2. **Update Notion**: Update Deployments Log entry
3. **Notify Slack**: Success or failure notification
4. **If failed**: Create incident page in Notion

### n8n Configuration

```
[Vercel Webhook] → [Parse Data] → [Switch: Success/Failed]
                                    ├── Success → [Update Notion] → [Slack: Success]
                                    └── Failed  → [Create Incident] → [Slack: Alert]
```

#### Nodes:

1. **Vercel Webhook** (Webhook)
   - Path: `/vercel-deploy`
   - Method: POST

2. **Parse Data** (Function)
   ```javascript
   const payload = $input.item.json;
   return [{
     json: {
       status: payload.type === 'deployment.succeeded' ? 'Success' : 'Failed',
       url: payload.payload?.deployment?.url || 'N/A',
       project: payload.payload?.deployment?.name || 'dmpgrants',
       environment: payload.payload?.deployment?.meta?.environment || 'production',
       timestamp: new Date().toISOString(),
     }
   }];
   ```

3. **Switch** (Switch node)
   - Condition: `{{ $json.status }}` equals "Success"

4. **Update Notion** (Notion node)
   - Find page in Deployments Log by date
   - Update Vercel URL property

5. **Create Incident** (Notion node - failure path)
   - Database: Operations > Incidents
   - Title: `Deployment Failed - {{ $json.timestamp }}`
   - Properties: severity, environment, deployment URL

## Workflow 3: Linear Issue → Notion Features Database

### Trigger
Linear webhook: Issue updated

### Actions
1. **Parse issue data**: title, status, assignee, priority
2. **Find or create Notion entry**: In Features Database
3. **Update status**: Sync Linear status to Notion

### n8n Configuration

```
[Linear Webhook] → [Parse Issue] → [Search Notion] → [Create or Update]
```

## Workflow 4: GitHub Release → Notion Changelog

### Trigger
GitHub webhook: Release published

### Actions
1. **Extract release notes**: version, body, assets
2. **Create Notion changelog entry**: Formatted release notes
3. **Notify Slack**: New release announcement

### n8n Configuration

```
[GitHub Trigger: release] → [Format Notes] → [Create Notion Page] → [Slack Announcement]
```

## Setup Instructions

### Step 1: Create Webhooks

In each platform, configure webhooks pointing to your n8n instance:

**GitHub:**
1. Go to repo Settings > Webhooks > Add webhook
2. Payload URL: `https://your-n8n.com/webhook/github-events`
3. Content type: `application/json`
4. Events: Pull requests, Releases

**Vercel:**
1. Go to Project Settings > Webhooks
2. Add webhook URL: `https://your-n8n.com/webhook/vercel-deploy`
3. Events: Deployment succeeded, Deployment failed

**Linear:**
1. Go to Settings > API > Webhooks
2. Add webhook URL: `https://your-n8n.com/webhook/linear-events`
3. Events: Issue updated, Issue created

### Step 2: Configure n8n Credentials

In n8n, set up credentials for:
- GitHub (Personal Access Token)
- Notion (Internal Integration Token)
- Slack (Bot Token)
- Linear (API Key)

### Step 3: Import Workflows

Import each workflow template into n8n and configure:
- Webhook paths
- Database IDs for Notion
- Channel IDs for Slack
- Repository references for GitHub

### Step 4: Test

1. Create a test PR in GitHub
2. Verify Notion entry created
3. Verify Slack notification sent
4. Merge PR and verify deployment workflow triggers

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not received | Check n8n is publicly accessible, verify URL |
| Notion page not created | Verify API key, check database permissions |
| Slack message fails | Check bot token, verify channel membership |
| Duplicate entries | Add deduplication logic (check by commit SHA) |
| Webhook timeout | Increase n8n timeout settings |

## MCP Integration

Use the n8n MCP server to manage workflows programmatically:

```
# List all workflows
Use the n8n MCP to list all active workflows.

# Trigger a workflow manually
Use the n8n MCP to trigger the "GitHub PR → Notion" workflow.

# Check workflow execution status
Use the n8n MCP to check the last execution of workflow ID [id].
```

# AI Development Tools Configuration Guide (2026)

> **Complete guide to configuring Cursor IDE, Claude, and Microsoft 365 Copilot for development workflows.**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Beginner's Overview](#beginners-overview)
3. [Cursor IDE Configuration](#cursor-ide-configuration)
   - [Rules Configuration](#rules-configuration)
   - [Worktrees Configuration](#worktrees-configuration)
   - [MCP (Model Context Protocol)](#mcp-model-context-protocol)
   - [HTTP Requests](#http-requests)
4. [Claude Configuration](#claude-configuration)
   - [CLAUDE.md Files](#claudemd-files)
   - [File Hierarchy](#claude-file-hierarchy)
5. [Microsoft 365 Copilot](#microsoft-365-copilot)
   - [Declarative Agents](#declarative-agents)
   - [Agent Configuration](#agent-configuration)
6. [Best Practices](#best-practices)
7. [Quick Reference](#quick-reference)

---

## Introduction

Modern AI-assisted development relies on configuration files that provide persistent context to AI assistants. These files eliminate repetitive instructions and ensure consistent behavior across sessions and team members.

**What this guide covers:**

- **Cursor IDE**: Rules, worktrees, MCP servers, and project configuration
- **Claude**: CLAUDE.md configuration files for Claude Code
- **M365 Copilot**: Declarative agents and customization

---

## Beginner's Overview

### What Are AI Configuration Files?

AI assistants like Claude, Cursor, and Copilot don't retain memory between sessions. Configuration files solve this by:

1. **Providing persistent context** - Your preferences load automatically every session
2. **Encoding project knowledge** - Tech stack, conventions, and gotchas
3. **Standardizing team workflows** - Everyone gets the same AI behavior
4. **Automating repetitive setup** - Commands, dependencies, and environment setup

### Key Concept: The Context Window

AI models have a "context window" - a limited amount of text they can process at once. Configuration files are loaded into this window, so:

- **Shorter is better** - Every line competes for attention
- **Specificity matters** - Vague instructions waste context space
- **Relevance is key** - Only include what the AI needs to know

---

## Cursor IDE Configuration

Cursor is a VS Code-based AI IDE. Its configuration lives primarily in the `.cursor/` folder.

### Directory Structure

```
your-project/
├── .cursor/
│   ├── rules/              # AI rules (modern format)
│   │   ├── code-style.mdc
│   │   ├── testing.mdc
│   │   └── api-guidelines.mdc
│   ├── worktrees.json      # Parallel agent setup
│   └── http/               # HTTP request testing
│       ├── llms.txt        # Configuration docs
│       └── .environments/  # Environment variables
├── .cursorrules            # DEPRECATED - migrate to rules/
├── AGENTS.md               # Simple alternative to rules/
└── claude.md               # Project documentation for AI
```

---

### Rules Configuration

Rules provide system-level instructions to Cursor's AI. They're version-controlled and shareable.

#### Rule Types

| Type | Behavior |
|------|----------|
| **Always Apply** | Included in every chat session |
| **Apply Intelligently** | AI decides based on description |
| **Apply to Specific Files** | Triggered by glob patterns |
| **Apply Manually** | Use `@rule-name` to invoke |

#### Creating Rules (Modern Format)

Create `.mdc` files in `.cursor/rules/`:

```yaml
---
description: "TypeScript coding standards for this project"
globs: "**/*.{ts,tsx}"
alwaysApply: false
---

# TypeScript Standards

## Code Style
- Use strict TypeScript, no `any` types
- Prefer named exports over default exports
- Use async/await over raw promises

## Naming Conventions
- Components: PascalCase
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE

## File Organization
- One component per file
- Co-locate tests with source files
```

#### Rule Examples

**`code-style.mdc`** - General coding standards:

```yaml
---
description: "Code formatting and style guidelines"
alwaysApply: true
---

# Code Style

- Format with Prettier before committing
- Max line length: 100 characters
- Use single quotes for strings
- Add trailing commas in multiline structures
```

**`testing.mdc`** - Testing conventions:

```yaml
---
description: "Testing patterns and requirements"
globs: "**/*.test.{ts,tsx}"
alwaysApply: false
---

# Testing Standards

- Use Vitest for unit tests
- Test file naming: `ComponentName.test.tsx`
- Minimum coverage: 80% for new code
- Mock external dependencies, not internal modules
```

**`api.mdc`** - API development rules:

```yaml
---
description: "Backend API development standards"
globs: "server/**/*.{js,ts}"
alwaysApply: false
---

# API Standards

- Use RESTful conventions
- Always validate request bodies
- Return consistent error shapes
- Log all errors with request context
```

#### Legacy Format (Deprecated)

The `.cursorrules` file at project root is deprecated. Migrate to `.cursor/rules/`:

```bash
# Old (deprecated)
.cursorrules

# New (recommended)
.cursor/rules/*.mdc
```

#### Simple Alternative: AGENTS.md

For straightforward projects, use `AGENTS.md` in your project root:

```markdown
# Project Instructions

## Code Style
- Use TypeScript for all new files
- Prefer functional components in React
- Use snake_case for database columns

## Architecture
- Follow the repository pattern
- Keep business logic in service layers
```

This is simpler but lacks glob patterns and conditional activation.

---

### Worktrees Configuration

**What is `.cursor/worktrees.json`?**

This file configures how Cursor sets up parallel agent environments. When you run multiple agents simultaneously, each gets its own Git worktree - an isolated copy of your codebase.

#### Your Current Configuration

```json
{
  "setup-worktree": [
    "npm install"
  ]
}
```

This tells Cursor: "When creating a new worktree, run `npm install` to set up dependencies."

#### Why Worktrees Matter

1. **Isolation** - Agents can make changes without interfering with each other
2. **Parallel execution** - Run the same prompt on multiple models simultaneously
3. **Safe testing** - Build and test code in isolation before applying changes

#### Configuration Options

```json
{
  "setup-worktree-unix": ["npm ci", "cp $ROOT_WORKTREE_PATH/.env .env"],
  "setup-worktree-windows": ["npm ci", "copy %ROOT_WORKTREE_PATH%\\.env .env"],
  "setup-worktree": ["npm install"]
}
```

| Key | Purpose |
|-----|---------|
| `setup-worktree-unix` | Commands for macOS/Linux (takes precedence) |
| `setup-worktree-windows` | Commands for Windows (takes precedence) |
| `setup-worktree` | Fallback for all operating systems |

#### Common Patterns

**Node.js Project:**

```json
{
  "setup-worktree": [
    "npm ci",
    "cp $ROOT_WORKTREE_PATH/.env .env"
  ]
}
```

**Python Project:**

```json
{
  "setup-worktree": [
    "python -m venv venv",
    "source venv/bin/activate && pip install -r requirements.txt",
    "cp $ROOT_WORKTREE_PATH/.env .env"
  ]
}
```

**Project with Database Migrations:**

```json
{
  "setup-worktree": [
    "npm ci",
    "cp $ROOT_WORKTREE_PATH/.env .env",
    "npm run db:migrate"
  ]
}
```

**Using Script Files (Complex Setup):**

```json
{
  "setup-worktree-unix": "setup-worktree-unix.sh",
  "setup-worktree-windows": "setup-worktree-windows.ps1"
}
```

#### Using Parallel Agents

1. Open Agent chat in Cursor
2. Select "Run in worktree" from the dropdown
3. Optionally select multiple models for "Best-of-N" comparison
4. Submit your prompt
5. Review changes and click "Apply" to merge into your branch

#### Debugging Worktree Setup

Open **Output** panel → Select **"Worktrees Setup"** to see setup logs.

#### Cleanup Settings

```json
// In Cursor settings (v2.1+)
{
  "cursor.worktreeCleanupIntervalHours": 6,
  "cursor.worktreeMaxCount": 20
}
```

---

### MCP (Model Context Protocol)

MCP is an open protocol that connects AI assistants to external tools and data sources.

#### What MCP Enables

- **Database access** - Query and modify databases directly
- **File system operations** - Read/write files outside the workspace
- **Web browsing** - Navigate and interact with web pages
- **External APIs** - Connect to GitHub, Notion, SharePoint, etc.
- **Documentation** - Access up-to-date library documentation

#### Your MCP Servers

Based on your configuration, you have these MCP servers available:

| Server | Purpose |
|--------|---------|
| `cursor-ide-browser` | Browser automation for testing |
| `user-filesystem` | File operations |
| `user-github-official` | GitHub integration |
| `user-git` | Git operations |
| `user-notion` | Notion integration |
| `user-sharepoint` | SharePoint access |
| `user-power-apps` | Power Platform integration |
| `user-context7` | Library documentation |
| `user-memory` | Persistent memory |
| `user-n8n` | Workflow automation |

#### Using MCP in Cursor

MCP tools are available in **Composer Agent** mode:

1. The agent automatically uses relevant tools
2. You can explicitly request tools: "Use the browser to test this page"
3. Tool execution requires user approval

#### Example: Browser Testing

```
"Navigate to localhost:3000, take a screenshot, and check for console errors"
```

The `cursor-ide-browser` MCP handles this via:

1. `browser_navigate` → Open the URL
2. `browser_snapshot` → Capture page state
3. `browser_console_messages` → Check for errors

#### MCP Configuration Location

MCP settings are managed through:

- Cursor Settings → Features → Model Context Protocol
- `~/.cursor/mcp.json` for global configuration

---

### HTTP Requests

The `.cursor/http/` folder enables API testing directly in Cursor.

#### File Format

Create `.req` or `.request` files:

```http
### Get All Users
GET {{BASE_URL}}/api/users
Authorization: Bearer {{API_KEY}}

### Create User
POST {{BASE_URL}}/api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### Environment Variables

Store in `.cursor/http/.environments/`:

```env
# .env.dev
BASE_URL=http://localhost:3000
API_KEY=dev-key-123

# .env.prod
BASE_URL=https://api.example.com
API_KEY=prod-key-456
```

Switch environments: **Command Palette → "CursorToys: Select HTTP Environment"**

#### Helper Functions

```http
### Create User with Dynamic Data
POST {{BASE_URL}}/api/users
Content-Type: application/json

{
  "id": "{{@uuid()}}",
  "name": "User{{@randomString(8)}}",
  "createdAt": "{{@datetime}}"
}
```

| Function | Purpose |
|----------|---------|
| `{{@uuid()}}` | Random UUID v4 |
| `{{@datetime}}` | Current timestamp |
| `{{@randomIn(min, max)}}` | Random integer |
| `{{@randomString(n)}}` | Random alphanumeric |
| `{{@prompt("label")}}` | User input |

---

## Claude Configuration

### CLAUDE.md Files

`CLAUDE.md` is Claude Code's configuration file - automatically loaded at session start.

#### File Locations (Priority Order)

1. **`~/.claude/CLAUDE.md`** - Global (all projects)
2. **`./CLAUDE.md`** - Project root (team-shared)
3. **`./.claude/CLAUDE.md`** - Alternative location
4. **`./subdirectory/CLAUDE.md`** - Directory-specific

More specific files override less specific ones.

#### Creating CLAUDE.md

**Quick start:**

```bash
# In Claude Code
/init
```

Claude generates a starter file based on your project structure.

#### Example CLAUDE.md

```markdown
# Project: DMP Grants Management

Next.js 14 application with Express backend, PostgreSQL database.

## Code Style
- TypeScript strict mode, no `any` types
- Use named exports, not default exports
- Tailwind CSS for styling

## Commands
- `npm run dev`: Start development server
- `npm run test`: Run Vitest tests
- `npm run db:migrate`: Run database migrations

## Architecture
- `/src`: React frontend (App Router)
- `/server`: Express API
- `/server/db`: Database schemas and migrations

## Important Notes
- NEVER commit .env files
- Use the logger utility, not console.log
- All API routes require authentication middleware
- See @docs/SETUP_GUIDE.md for environment setup
```

#### @imports System

Reference other files to keep CLAUDE.md lean:

```markdown
See @README.md for project overview
See @docs/API.md for API documentation
See @package.json for available scripts
```

Imports are resolved automatically and can be recursive.

#### Best Practices

1. **Keep under 300 lines** - Context is precious
2. **Be specific** - "Use ESLint" not "Format properly"
3. **Include commands** - Exact scripts for test/build/deploy
4. **Document gotchas** - Edge cases and workarounds
5. **Update organically** - Add rules when Claude makes mistakes

#### CLAUDE.local.md

For personal preferences not to be committed:

```markdown
# My Preferences

- Use verbose explanations
- Show full diffs, not summaries
- Ask before deleting files
```

Add to `.gitignore`: `CLAUDE.local.md`

---

## Microsoft 365 Copilot

### Declarative Agents

Declarative agents are customized versions of M365 Copilot for specific business scenarios.

#### Core Components

| Component | Purpose | Limit |
|-----------|---------|-------|
| **Name** | Display name | 30-100 chars |
| **Description** | What the agent does | ≤1,000 chars |
| **Instructions** | Behavioral guidelines | Varies |
| **Actions** | API plugins/capabilities | Multiple |
| **Knowledge** | Custom data sources | SharePoint, connectors |

#### Creating a Declarative Agent

**Prerequisites:**

- Microsoft 365 Copilot license
- Visual Studio Code + Microsoft 365 Agents Toolkit
- Access to Teams Store for deployment

**Steps:**

1. Open VS Code with Agents Toolkit extension
2. **Create New Agent** → **Declarative Agent**
3. Choose capabilities (with or without Actions)
4. Configure manifest files:
   - `manifest.json` - App configuration
   - `declarativeAgent.json` - Agent behavior

#### Agent Manifest Structure

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.0/schema.json",
  "version": "v1.0",
  "name": "IT Support Helper",
  "description": "Helps employees resolve common IT issues using internal knowledge bases",
  "instructions": "You are an IT support assistant. Help employees troubleshoot technical issues by searching the IT knowledge base. Always provide step-by-step solutions. If you cannot find an answer, direct users to submit a support ticket.",
  "capabilities": [
    {
      "name": "WebSearch",
      "enabled": false
    },
    {
      "name": "GraphicArt",
      "enabled": false
    }
  ],
  "conversation_starters": [
    {
      "title": "Reset my password",
      "text": "How do I reset my password?"
    },
    {
      "title": "VPN issues",
      "text": "I can't connect to the VPN from home"
    }
  ]
}
```

#### Writing Effective Instructions

**Include:**

- Agent role and purpose
- Target audience
- Step-by-step workflows
- Business rules and constraints
- Tone and communication style

**Example:**

```
You are a Customer Support agent for Contoso Electronics.

ROLE: Help support staff resolve customer inquiries efficiently.

WORKFLOWS:
1. For order status questions, retrieve order from the Order Management plugin
2. For returns, check the 30-day return policy before processing
3. For technical issues, search the product knowledge base first

CONSTRAINTS:
- Never promise refunds without manager approval for orders over $500
- Always verify customer identity before sharing order details
- Escalate fraud suspicions to the security team

TONE: Professional, empathetic, solution-oriented
```

#### Knowledge Sources

Declarative agents can access:

- **SharePoint files** - Documents, wikis, lists
- **Microsoft 365 Connectors** - External data sources
- **API Plugins** - Real-time data from external systems

#### Deployment

1. Package the agent (Teams app manifest format)
2. Submit to Microsoft 365 admin center
3. Admin approves for tenant distribution
4. Users access via Copilot interface or Teams

---

## Best Practices

### For All AI Configuration

| Practice | Why |
|----------|-----|
| **Version control configs** | Team consistency, change tracking |
| **Keep configs short** | Context window is limited |
| **Be specific** | Vague = wasted tokens |
| **Update iteratively** | Add rules when AI makes mistakes |
| **Separate concerns** | One rule file per domain |

### Cursor-Specific

1. **Migrate from `.cursorrules`** to `.cursor/rules/*.mdc`
2. **Use glob patterns** for file-specific rules
3. **Configure worktrees** for parallel agent workflows
4. **Enable relevant MCP servers** for extended capabilities

### Claude-Specific

1. **Use `/init`** as a starting point, then trim
2. **Use `@imports`** for detailed docs
3. **Create `CLAUDE.local.md`** for personal preferences
4. **Review weekly** and remove outdated rules

### M365 Copilot-Specific

1. **Write clear instructions** - Define role, workflows, constraints
2. **Test conversation starters** - Common entry points
3. **Connect knowledge sources** - SharePoint, connectors
4. **Follow RAI guidelines** - Responsible AI validation required

---

## Quick Reference

### File Locations Summary

| Tool | Config Location | Purpose |
|------|-----------------|---------|
| **Cursor** | `.cursor/rules/*.mdc` | AI behavioral rules |
| **Cursor** | `.cursor/worktrees.json` | Parallel agent setup |
| **Cursor** | `.cursor/http/` | API testing |
| **Cursor** | `AGENTS.md` | Simple rules alternative |
| **Claude** | `CLAUDE.md` | Project instructions |
| **Claude** | `~/.claude/CLAUDE.md` | Global preferences |
| **M365** | `declarativeAgent.json` | Agent definition |

### Common Commands

```bash
# Cursor - Create new rule
Command Palette → "New Cursor Rule"

# Claude Code - Initialize config
/init

# Claude Code - Add instruction
"Add to CLAUDE.md: always use logger instead of console.log"

# Git - List worktrees
git worktree list
```

### Frontmatter Reference (.mdc files)

```yaml
---
description: "Brief rule description"    # Required for intelligent apply
globs: "**/*.{ts,tsx}"                   # File patterns
alwaysApply: true                        # Always include in context
---
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Context Window** | Maximum text an AI can process at once |
| **MCP** | Model Context Protocol - standard for AI tool integration |
| **Worktree** | Git feature for parallel working directories |
| **Declarative Agent** | Custom M365 Copilot for specific scenarios |
| **Glob Pattern** | Wildcard pattern for matching files (e.g., `**/*.ts`) |
| **Frontmatter** | YAML metadata at the start of markdown files |

---

## Resources

### Official Documentation

- [Cursor Docs - Rules](https://cursor.com/docs/context/rules)
- [Cursor Docs - Worktrees](https://cursor.com/docs/configuration/worktrees)
- [Claude Code Documentation](https://claude.com/product/claude-code)
- [M365 Copilot Extensibility](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/)

### Community Resources

- [Cursor Rules Best Practices](https://cursor.fan/tutorial/HowTo/best-practices-for-cursor-rules/)
- [CLAUDE.md Guide](https://www.builder.io/blog/claude-md-guide)
- [MCP Integrations](https://mcpez.com/integrations)

---

*Last updated: February 2026*

# Contributing to DMP Cemetery Management

Thank you for contributing to the Detroit Memorial Park Cemetery Management Software.

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or Docker)
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Know-Kname/dmpgrants.git
cd dmpgrants

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Set up database (if PostgreSQL is running)
npm run db:migrate
npm run db:import

# Start development server
npm run dev
```

## Branch Workflow (GitHub Flow)

We use **GitHub Flow** with the following conventions:

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<description>` | `feature/user-authentication` |
| Bug fix | `fix/<description>` | `fix/login-redirect-loop` |
| Documentation | `docs/<description>` | `docs/api-endpoints` |
| Chore | `chore/<description>` | `chore/update-dependencies` |
| Linear issue | `feature/LIN-123-description` | `feature/LIN-42-add-burial-form` |

### Workflow

1. Create a branch from `develop` (or `main` for hotfixes)
2. Make your changes in small, focused commits
3. Push your branch and create a Pull Request
4. Request review and address feedback
5. Merge after approval and CI checks pass

## Commit Message Convention

We follow **Conventional Commits**:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code formatting (no logic changes) |
| `refactor` | Code restructuring (no behavior changes) |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |
| `ci` | CI/CD changes |
| `perf` | Performance improvements |

### Examples

```
feat(auth): add two-factor authentication
fix(burials): correct date parsing for burial records
docs: update API endpoint documentation
chore(deps): update express to 4.19
```

### Linking to Linear Issues

Include the Linear issue ID in your commit or PR:

```
feat(grants): add grant application form

Implements LIN-42
```

## Pull Request Guidelines

1. **Fill out the PR template** completely
2. **Keep PRs small** -- under 400 lines of changes when possible
3. **Self-review** your code before requesting review
4. **Link to issues** using "Closes #123" or "Fixes LIN-42"
5. **Add tests** for new features and bug fixes
6. **Include screenshots** for UI changes
7. **Get design approval** for visual changes (link to Figma)

## Code Standards

### TypeScript

- Strict mode enabled, no `any` types
- Named exports over default exports
- Functional React components with hooks
- Use existing components from `src/components/ui.tsx`

### Backend

- Use error utilities from `server/utils/errors.js`
- All API routes require authentication middleware
- Use parameterized database queries only (never concatenate user input)
- Validate request bodies before processing

### Testing

- Co-locate tests with source files
- Write tests for critical business logic
- Use Vitest + React Testing Library for frontend
- Use Vitest + Supertest for backend

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run frontend tests only
npm run test:frontend

# Run backend tests only
npm run test:backend
```

### Styling

- Use Tailwind CSS utility classes
- Use design tokens from the design system (avoid hardcoded colors)
- Mobile-first responsive design
- Follow component patterns in `src/components/ui.tsx`

## Code Review Expectations

### For Authors

- Respond to feedback within 24 hours
- Resolve all conversations before merging
- Keep the PR description updated as changes are made

### For Reviewers

- Provide constructive feedback with rationale
- Approve or request changes within 24 hours
- Focus on logic and architecture, not style (linters handle that)

## Getting Help

- Check the [Notion wiki](https://notion.so) for documentation
- Review existing code patterns before implementing new ones
- Ask in the team channel if you're unsure about approach

## Security

- Never commit secrets, API keys, or passwords
- Report vulnerabilities per [SECURITY.md](SECURITY.md)
- Use environment variables for all sensitive configuration

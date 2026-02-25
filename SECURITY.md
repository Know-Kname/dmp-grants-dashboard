# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do NOT open a public issue for security vulnerabilities.**

### How to Report

1. Email the security team with details of the vulnerability
2. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if available)

### Response Timeline

| Action | Timeframe |
|--------|-----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix development | Varies by severity |
| Public disclosure | After fix is deployed |

## Supported Versions

| Version | Support Status |
|---------|----------------|
| 1.x (current) | Actively maintained |

## Security Practices

### What We Do

- All API routes require JWT authentication
- Passwords hashed with bcrypt
- Parameterized SQL queries (no string concatenation)
- Input validation on all endpoints
- Rate limiting on authentication routes
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Dependency scanning via Dependabot
- CodeQL static analysis
- Secret scanning with push protection

### What We Expect from Contributors

- Never hardcode secrets, API keys, or passwords
- Use environment variables for sensitive configuration
- Validate and sanitize all user inputs
- Use parameterized queries for database operations
- Return generic error messages to clients (log details server-side)
- Follow the principle of least privilege

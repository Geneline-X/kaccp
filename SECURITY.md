# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (master) | Yes |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues by emailing **info@geneline-x.net** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

We will acknowledge receipt within 48 hours and provide a timeline for a fix within 7 days.

## Disclosure Policy

- Reporters are credited in release notes (unless they prefer anonymity)
- We ask for 90 days before public disclosure to allow time to patch
- Coordinated disclosure is preferred

## Scope

In scope:
- Authentication bypass
- Privilege escalation (accessing another user's data/recordings)
- Injection vulnerabilities (SQL, command, XSS)
- Insecure direct object references
- Sensitive data exposure (PII, voice recordings)

Out of scope:
- Issues requiring physical device access
- Social engineering attacks
- Rate limiting on non-authenticated endpoints (report as a bug instead)

## Security Practices

- Passwords hashed with bcrypt (salt rounds: 10)
- JWT tokens for session management (HS256, 7-day expiry)
- Role-based access control (ADMIN / SPEAKER / TRANSCRIBER / REVIEWER)
- All database access via Prisma ORM (parameterised queries)
- Voice recordings stored in GCS with signed URLs (15-min expiry for uploads, 1-hour for reads)

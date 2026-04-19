# Contributing to KACCP

Thank you for your interest in contributing to the Krio Audio Corpus Curation Platform.

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Google Cloud Storage bucket (for production) or local storage (for development)

### Local Setup

```bash
git clone https://github.com/Geneline-X/kaccp.git
cd kaccp
cp .env.example .env        # fill in required values
npm install
npx prisma migrate dev
npm run seed:v2             # optional: seed demo data
npm run dev
```

## Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes and add tests where applicable
4. Run checks: `npm run lint && npm test`
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, etc.
6. Open a pull request against `master`

## Pull Request Guidelines

- Keep PRs focused — one concern per PR
- Update documentation if behaviour changes
- Add or update tests for new API routes
- Reference related issues with `Closes #N`

## Reporting Bugs

Open a [GitHub Issue](https://github.com/Geneline-X/kaccp/issues) with:
- Steps to reproduce
- Expected vs actual behaviour
- Environment details (OS, Node version)

## Security Vulnerabilities

Do **not** open a public issue. See [SECURITY.md](SECURITY.md) for responsible disclosure.

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md).

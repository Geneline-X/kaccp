# KACCP

[![Build Status](https://github.com/geneline-x/kaccp/actions/workflows/ci.yml/badge.svg)](https://github.com/geneline-x/kaccp/actions)
[![MIT License](https://img.shields.io/github/license/geneline-x/kaccp)](LICENSE)
[![NPM Version](https://img.shields.io/npm/v/next?label=next.js)](https://www.npmjs.com/package/next)

## Table of Contents

- [About](#about)
- [Features](#features)
- [Folder / Project Structure](#folder--project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [Scope and licensing](#scope-and-licensing)
- [Acknowledgements](#acknowledgements)

---

## About

**KACCP** (Krio Audio Corpus Curation Platform) is an open-source web platform for building
speech datasets in languages that have none.

Roughly 88% of the world's languages are unsupported by language technology. The barrier is
rarely that nobody cares — it is that caring is not enough when you must first build a data
collection platform. KACCP is that platform, already built: prompt-driven recording,
multi-stage human review, contributor payment and export in standard training formats.

A university department, a community organisation, a ministry, or a group of speakers
determined to see their language online can deploy it and begin collecting on day one,
without writing software. Language, country, prompt bank and payment rates are configuration,
not code. Developed by [Geneline-X](https://geneline-x.net) and proven on Krio; currently
configured for Krio, Mende, Temne, Susu and Mandinka.

**Audience:**  
- Language researchers  
- Transcribers and linguists  
- Open data and NLP communities  
- Organizations building speech/language datasets

**Use Case:**  
- Crowdsourcing accurate English transcriptions of Krio audio  
- Building a public dataset for machine learning and language research  
- Managing workflow, quality, and payouts for contributors

---

## Features

- **Transcription Workflow:** Claim, transcribe, save drafts, and submit audio chunks.
- **Leaderboard:** Public leaderboard ranks contributors by approved minutes and earnings.
- **Payouts:** Earn 1.2 SLE per approved minute, paid via Orange Money.
- **AI Suggestions:** Get AI-powered English corrections for your transcriptions.
- **Admin Review:** Submissions are reviewed, approved, or rejected by admins.
- **Draft Saving:** Save work-in-progress and resume later.
- **Profile Management:** Manage your display name, country, phone, and leaderboard visibility.
- **Admin Console:** Manage audio sources, review submissions, export datasets, and monitor system health.
- **Google Cloud Storage Integration:** Audio files and datasets are stored securely in GCS.
- **Open Source:** MIT licensed and ready for community contributions.

---

## Folder / Project Structure

```plaintext
.
├── prisma/                  # Prisma schema, migrations, seed scripts
├── public/                  # Static assets (images, icons)
├── scripts/                 # Dev/ops scripts (seed, admin setup)
├── src/
│   ├── app/
│   │   ├── [locale]/        # Localised Next.js app routes (en, kri, …)
│   │   │   ├── (admin)/     # Admin dashboard pages
│   │   │   ├── (speaker)/   # Speaker recording pages
│   │   │   ├── (transcriber)/ # Transcriber pages
│   │   │   └── legal/       # Terms, privacy pages
│   │   └── api/             # API route handlers
│   │       ├── auth/        # login, register, forgot-password
│   │       └── v2/          # Versioned API (speaker, transcriber, admin, reviewer)
│   ├── components/          # Shared React components (UI, layout, forms)
│   ├── lib/
│   │   └── infra/           # Infrastructure: db, auth, storage, email, payments
│   │       └── storage/     # Pluggable storage providers (GCS, local)
│   └── middleware.ts         # Next.js middleware (i18n routing)
├── .env.example             # Environment variable template
├── .github/workflows/ci.yml # CI pipeline (lint, test, build)
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE
├── MAINTAINERS.md
├── PRIVACY.md
└── SECURITY.md
```

---

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Google Cloud Storage bucket **or** set `STORAGE_PROVIDER=local` for local dev

### Steps

1. **Clone the repository:**

   ```bash
   git clone https://github.com/geneline-x/kaccp.git
   cd kaccp
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env — at minimum set DATABASE_URL and JWT_SECRET
   ```

   See `.env.example` for full documentation of all variables.

4. **Run database migrations:**

   ```bash
   npx prisma migrate dev
   # Optional: seed demo data
   npm run seed:v2
   ```

5. **Run the development server:**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`.

6. **Access Prisma Studio (optional):**

   ```bash
   npx prisma studio
   ```

---

## Usage

Once KACCP is up and running, you can access the application in your web browser. The main features include:

- **Transcription Interface:** Where contributors can transcribe audio clips.
- **Admin Dashboard:** For administrators to manage the platform, review submissions, and export datasets.
- **Profile Settings:** To manage your account details and preferences.

---

## How It Works

KACCP is built using Next.js, a React framework for server-rendered applications, and Prisma, an ORM for database access. The application follows a modular structure, separating concerns like API routes, database access, and frontend components.

1. **Next.js Pages:** The `pages` directory contains the application's routes. Each file corresponds to a route, and the default export is a React component that renders the page.
2. **API Routes:** The `api` directory inside `pages` contains serverless functions that handle API requests. These functions can access the database and perform actions like creating, reading, updating, and deleting records.
3. **Prisma Client:** The Prisma client is generated based on the schema defined in `prisma/schema.prisma`. It provides a type-safe API for interacting with the database.
4. **React Components:** The `components` directory contains reusable React components used throughout the application.
5. **Middleware:** Custom middleware functions can be defined in the `middleware` directory to handle tasks like authentication, logging, or error handling.

---

## Contributing

We welcome contributions to KACCP! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and the pull request process. All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Scope and licensing

**The KACCP platform is open source under the MIT License.** Anyone may deploy, modify
and operate it — including commercially — for any language. See [LICENSE.md](LICENSE.md).

**Speech corpora are not part of this release.** Audio recordings and transcriptions
collected through a KACCP deployment belong to whoever operates that deployment, and are
licensed by them. The Krio corpus collected by Geneline-X is proprietary: contributors
were compensated for their work under agreements specific to that programme.

We open-source the means of collection, not our dataset — so that anyone can build a
corpus for a language that has none, on the same terms we built ours.

### Ownership

KACCP is built and maintained by [Geneline-X](https://geneline-x.net), Freetown, Sierra
Leone. Copyright in this software is held by Geneline-X. The canonical repository is
[github.com/Geneline-X/kaccp](https://github.com/Geneline-X/kaccp).

---

## Acknowledgements

KACCP is developed and maintained by [Geneline-X](https://geneline-x.net). We acknowledge the contributions of the open-source community and the support of organizations and individuals invested in language preservation and technology.

---
## Support
For questions or support, contact [Geneline-X](mailto:info@geneline-x.net).

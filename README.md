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
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## About

**KACCP** (Krio Audio Corpus Curation Platform) is an open-source web platform for transcribing Krio audio clips into English, helping to build a high-quality, low-resource language dataset. Developed by [Geneline-X](https://geneline-x.net), KACCP enables collaborative transcription, review, and dataset export for research and language technology. The platform is designed for scalability and future support for additional languages.

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

## License

KACCP is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

---

## Acknowledgements

KACCP is developed and maintained by [Geneline-X](https://geneline-x.net). We acknowledge the contributions of the open-source community and the support of organizations and individuals invested in language preservation and technology.

---
## Support
For questions or support, contact [Geneline-X](mailto:contact@geneline-x.net)

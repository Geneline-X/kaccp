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
├── app/                     # Application code
│   ├── api/                 # API routes
│   ├── components/          # React components
│   ├── lib/                 # Library code
│   ├── middleware/          # Middleware functions
│   ├── pages/               # Next.js pages
│   ├── prisma/              # Prisma schema and client
│   └── public/              # Public assets
├── scripts/                 # Scripts for development and maintenance
├── .env                      # Environment variables
├── .gitignore                # Ignored files in Git
├── next.config.js           # Next.js configuration
├── package.json             # NPM package configuration
└── tsconfig.json            # TypeScript configuration
```

- **`app/`**: Contains all the application-specific code, including API routes, React components, and Prisma setup.
- **`prisma/`**: Holds the Prisma schema file (`schema.prisma`) and the generated Prisma client. This is where the data model is defined, and the database connection is configured.
- **`public/`**: Static files like images, fonts, and other assets that are served directly.
- **`scripts/`**: Contains scripts for tasks like seeding the database, migrating Prisma schema changes, or other development utilities.
- **`.env`**: Environment variables for configuring the application, such as database connection strings and API keys.
- **`next.config.js`**: Configuration file for Next.js, where you can customize the framework's behavior.
- **`package.json`**: Manages project dependencies, scripts, and metadata.
- **`tsconfig.json`**: TypeScript configuration file, specifying the compiler options and file inclusions.

---

## Installation

To get started with KACCP, follow these steps:

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

   Copy the `.env.example` file to `.env` and update the values as needed.

   ```bash
   cp .env.example .env
   ```

4. **Run the development server:**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`.

5. **Access the Prisma Studio:**

   To view and manage your database records, you can use the Prisma Studio. Start it with the following command:

   ```bash
   npx prisma studio
   ```

   This will open a new browser window with the Prisma Studio interface.

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

We welcome contributions to KACCP! To get involved:

1. **Fork the repository**
2. **Create a new branch** for your feature or bug fix
3. **Make your changes** and commit them with clear messages
4. **Push your branch** to your forked repository
5. **Open a pull request** describing your changes

Please ensure your code follows the existing style and conventions used in the project. Additionally, update any relevant documentation or tests to reflect your changes.

---

## License

KACCP is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

---

## Acknowledgements

KACCP is developed and maintained by [Geneline-X](https://geneline-x.net). We acknowledge the contributions of the open-source community and the support of organizations and individuals invested in language preservation and technology.

---
## Support
For questions or support, contact [Geneline-X](mailto:contact@geneline-x.net)

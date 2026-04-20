# Privacy Policy

**Effective date:** 15 April 2026
**Data controller:** Geneline-X (info@geneline-x.net)

---

## 1. What We Collect

| Data | Purpose | Basis |
|------|---------|-------|
| Email address | Account authentication, notifications | Contract |
| Phone number | Account identification, payment delivery | Contract |
| Display name | Profile, attribution in platform | Contract |
| Password (bcrypt hash) | Authentication | Contract |
| Voice recordings | Core platform function — speech corpus curation | Explicit consent |
| Transcription text | Core platform function | Explicit consent |
| Payment amounts & wallet balances | Contributor compensation via Orange Money | Contract |
| IP address (server logs) | Security, abuse prevention | Legitimate interest |

## 2. Voice Recordings — Biometric Data

Voice recordings are biometric data and receive heightened protection:

- Recordings are stored in Google Cloud Storage with access controls
- Signed URLs expire within 1 hour (read) / 15 minutes (upload)
- Recordings are exported using anonymous speaker labels (e.g., `speaker_0017`), never personal names
- Recordings are used exclusively for building open speech corpora for low-resource African languages
- Recordings are not sold to or shared with third parties beyond the open dataset export

**Consent:** You provide explicit consent for voice recording use at registration and before each recording session. You may withdraw consent at any time by deleting your account.

## 3. How We Use Your Data

- Operate the KACCP platform (recording, transcription, review, export)
- Process payments for contributor work
- Send account-related email notifications
- Improve platform quality and detect fraud

We do not use your data for advertising or sell it to third parties.

## 4. Data Retention

| Data type | Retention |
|-----------|-----------|
| Account data (email, phone, name) | Until account deletion |
| Voice recordings | Until account deletion or explicit withdrawal |
| Payment records | 7 years (legal/accounting obligation) |
| Server logs | 90 days |

## 5. Your Rights

You have the right to:

- **Access** — request a copy of your personal data
- **Rectification** — correct inaccurate data
- **Erasure** — delete your account and all associated data (see below)
- **Data portability** — export all your personal data (profile, recordings, transcriptions, wallet history, payments) via **Settings → Account → Download My Data** or `GET /api/v2/account/export`
- **Withdraw consent** — stop participating at any time

### Deleting Your Account

You can delete your account and all personal data (recordings, transcriptions, payment history) via **Settings → Account → Delete Account** in the platform, or by emailing info@geneline-x.net.

Note: payment records may be retained for 7 years for legal compliance even after account deletion.

## 6. Age Restriction

KACCP is not intended for users under 18. By registering, you confirm you are 18 or older. We do not knowingly collect data from minors. If we discover a minor has registered, we will delete their account and data immediately.

## 7. Data Transfers

Data is stored on Google Cloud Storage (GCS) and PostgreSQL. GCS is operated by Google LLC. Standard contractual clauses apply for data transfers outside your jurisdiction.

## 8. Security

- Passwords are hashed using bcrypt (never stored in plain text)
- JWT tokens expire after 7 days
- Storage access uses short-lived signed URLs
- Role-based access control limits data visibility

See [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy.

## 9. Contact

For privacy requests or concerns: **info@geneline-x.net**

For data deletion requests that cannot be completed in-app, email us with subject line: **"Data Deletion Request"**.

## 10. Changes

We will notify registered users by email of material changes to this policy with at least 14 days notice.

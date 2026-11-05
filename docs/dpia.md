# Data Protection Impact Assessment

**System:** KACCP — Krio Audio Corpus Curation Platform
**Controller:** Geneline-X, Freetown, Sierra Leone (info@geneline-x.net)
**Assessment date:** 23 September 2026
**Review cycle:** annually, or on any material change to what is collected

---

## 1. Why this assessment exists

KACCP collects **voice recordings**, which are biometric data. Under GDPR these are Article 9
special category data, and comparable protections appear in the African Union Malabo Convention
and in Sierra Leone's Data Protection and Right to Access Information Bill 2025.

Voice is distinctive among personal data in three ways that shape this assessment:

1. **It identifies a person directly** and cannot be changed if compromised, unlike a password or
   a phone number.
2. **It carries more than words** — accent, age, health, emotional state and regional origin are
   all inferable from a recording.
3. **Its purpose here is to be retained and processed at length.** The recording is not incidental
   to the service; it *is* the service.

Contributors are also, by design, people in a lower economic position than the controller, paid
per task. That asymmetry is relevant to whether consent is freely given, and is addressed in §5.

---

## 2. What is processed

| Data | Category | Purpose | Lawful basis |
|---|---|---|---|
| Voice recording | **Biometric / special category** | Building a speech corpus — core function | Explicit consent |
| Transcription text | Personal (content of speech) | Core function | Explicit consent |
| Email address | Personal | Authentication, notifications | Contract |
| Phone number | Personal | Identification, payment delivery | Contract |
| Display name | Personal | Profile, in-platform attribution | Contract |
| Password hash (bcrypt) | Authentication credential | Authentication | Contract |
| Payment amounts, wallet balance | Financial | Compensation | Contract / legal obligation |
| IP address (server logs) | Personal | Security, abuse prevention | Legitimate interest |

**Not collected:** date of birth, government ID, address, gender, ethnicity, income, or any
demographic profiling. Speaker metadata in an exported corpus is reduced to an opaque label.

---

## 3. Necessity and proportionality

| Test | Assessment |
|---|---|
| Is voice collection necessary? | Yes. A speech corpus cannot be built without speech. There is no less intrusive alternative that achieves the purpose. |
| Is the volume proportionate? | Yes. Recordings are short (typically under 20 seconds) and prompt-bounded, rather than continuous or ambient capture. |
| Is the PII set minimal? | Yes. Email and phone are required to authenticate and to pay. Display name is optional. Nothing is collected for analytics or marketing. |
| Could the purpose be met anonymously? | Partly, and it is. **Published corpora carry anonymous labels only.** Identity is retained internally solely to pay people and let them exercise their rights. |

---

## 4. Risks and mitigations

### R1 — Re-identification of a speaker from published audio
**Likelihood:** Medium · **Impact:** High · **Residual:** Medium

Voice is inherently identifying. A person who knows the speaker may recognise them, and
voice-matching technology makes this easier over time. Anonymous labels prevent *linkage to a
name in the dataset*; they cannot make a voice unrecognisable.

*Mitigations:* corpora identify speakers only by opaque label; names, emails and phone numbers are
never exported; pseudonymisation is structural — the export code reads from labels, so publishing
a name would require deliberately changing it. **This risk is disclosed to contributors before
consent**, because it cannot be engineered away. Geneline-X's own corpus is not published openly,
which materially limits exposure.

### R2 — Consent that is not genuinely free
**Likelihood:** Medium · **Impact:** Medium · **Residual:** Low

Contributors are paid per task, in a context of limited employment. Payment can pressure consent.

*Mitigations:* consent is recorded **per recording**, not once at signup, so it can be withheld at
any point without losing the account; a contributor may stop at any time and keep earnings already
accrued; consent language states plainly what the recording is for and who holds it; no
contributor is required to record any particular prompt, and prompts can be skipped.

### R3 — Unauthorised access to recordings or PII
**Likelihood:** Low · **Impact:** High · **Residual:** Low

*Mitigations:* audio is never in a public bucket — access is by signed URL only, expiring in one
hour (read) or fifteen minutes (write); role-based access enforced **server-side on every
request**, not hidden in the UI; transcribers see audio and text but not contributor contact
details or payments; only administrators can reach PII; passwords bcrypt-hashed; sessions via
signed JWTs; TLS throughout; database credentials held in environment configuration, never in the
repository.

### R4 — A contributor cannot exercise their rights
**Likelihood:** Low · **Impact:** Medium · **Residual:** Low

*Mitigations:* self-service data export (`GET /api/v2/account/export`) returns everything held
about the person as JSON; self-service account deletion (`DELETE /api/v2/account`); retention
periods published in the Privacy Policy; a contact address that is monitored.

**Stated limitation:** material already delivered to a third party under licence cannot be
recalled from copies held by others. This is disclosed in the Terms of Service before consent
rather than left to be discovered.

### R5 — Harmful or third-party personal content inside a recording
**Likelihood:** Medium · **Impact:** Medium · **Residual:** Low

A speaker may read out another person's phone number, or say something unlawful.

*Mitigations:* collection is **prompt-driven, not open submission**, so the content space is
bounded before anyone speaks; every recording is reviewed by at least two people; an
`INAPPROPRIATE` flag routes content breaches to an administrator; rejected and flagged audio is
excluded from exports by default, enforced in the export tooling; recordings containing third-party
personal data are deleted rather than edited, since the data is in the audio itself. See
[content-moderation.md](content-moderation.md).

### R6 — Data from a minor
**Likelihood:** Low · **Impact:** High · **Residual:** Low

A minor cannot validly consent to publication of their biometric data, nor to a paid work
agreement.

*Mitigations:* contributors must be **18 or older**, stated in the Terms of Service and confirmed
explicitly at registration in both signup flows; accounts found to belong to under-18s are
deactivated and unpublished recordings deleted; no recordings of children are solicited by any
prompt.

### R7 — Breach of the payment channel
**Likelihood:** Low · **Impact:** Medium · **Residual:** Low

*Mitigations:* KACCP stores amounts owed and paid, not payment credentials; no card or mobile-money
PINs are held; settlement occurs in the payment provider's own system; payment records are retained
seven years for accounting obligations and are administrator-access only.

---

## 5. Consent — how it is obtained

1. **At registration** — the contributor confirms they are 18 or older and accepts the Terms of
   Service and Privacy Policy. Both are linked, not merely referenced.
2. **Per recording** — consent is recorded on each `Recording` (`consentGiven`), so it is a
   repeated act rather than a one-time click.
3. **Withdrawable** — a contributor may stop at any time and delete their account, which removes
   their personal data.

Consent language must state, in plain terms: what is recorded, what it will be used for, who holds
it, that the voice may be recognisable to someone who knows them, and what can and cannot be
undone.

---

## 6. Retention

| Data | Retained |
|---|---|
| Account data (email, phone, name) | Until account deletion |
| Voice recordings | Until account deletion or withdrawal of consent |
| Payment records | 7 years — legal and accounting obligation |
| Server logs | 90 days |

---

## 7. Conclusion

**Residual risk: acceptable, with one risk that cannot be eliminated.**

Technical and organisational measures address R2–R7 to a low residual level. **R1
(re-identification from voice) remains medium and is inherent to the purpose** — it cannot be
engineered away, only disclosed. The controller's position is that this is acceptable because the
risk is disclosed before consent, contributors are compensated, published data carries no names,
and Geneline-X's corpus is not openly published.

For operators deploying KACCP themselves: **you become the data controller** and should carry out
your own assessment against your jurisdiction. This document is a starting point, not legal advice.

---

**Related:** [Privacy Policy](../PRIVACY.md) · [Terms of Service](../TERMS.md) ·
[Content moderation](content-moderation.md) · [Architecture](architecture.md)

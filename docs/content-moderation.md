# Content Moderation Policy

**Applies to:** KACCP deployments operated by Geneline-X
**Contact:** info@geneline-x.net
**Last updated:** 23 September 2026

KACCP collects audio recordings and written transcriptions from contributors. This document
describes what is not allowed, how it is detected, and what happens when it is found.

---

## 1. Prohibited content

The following must not be recorded, transcribed or uploaded:

| Category | Examples |
|---|---|
| **Child sexual abuse material (CSAM)** | Any sexual content involving a minor |
| **Illegal content** | Anything unlawful under the laws of Sierra Leone, including under the Cyber Security and Crime Act 2021 |
| **Non-consensual recordings** | Recordings of other people made without their knowledge and consent |
| **Threats and incitement** | Threats of violence, incitement to violence or criminal acts |
| **Hate speech** | Attacks on people based on ethnicity, religion, gender, disability or other protected characteristic |
| **Third-party personal data** | Names, phone numbers, addresses, account details or ID numbers belonging to other people |
| **Deliberate misinformation** | Transcriptions knowingly misrepresenting what was said |
| **Infringing material** | Copyrighted works the contributor has no right to record or transcribe |

---

## 2. Why exposure is structurally limited

KACCP is **prompt-driven, not open submission**. This is a design decision with a moderation
consequence worth stating plainly:

- Speakers record responses to a **curated prompt bank authored by the deployment operator**.
  The subject matter of a recording is bounded before anyone speaks.
- There is **no free-text public posting**, **no user-to-user messaging**, **no public profile**
  and **no arbitrary file upload**.
- There is **no public publishing surface**. Recordings are visible only to authenticated users
  holding the relevant role, and dataset export is restricted to administrators.

The realistic risk is therefore not a platform used to distribute harmful content — it is a
contributor who says something prohibited while responding to an ordinary prompt. The controls
below target that.

---

## 3. Detection

**Every recording passes human review before it can enter a dataset.** Nothing is published or
exported on the strength of automated processing alone.

### Flagging

Any transcriber or reviewer can flag a recording. Flagging removes it from the working queue
immediately and routes it to an administrator.

| Flag | Meaning |
|---|---|
| `NOISE` | Background noise makes the audio unusable |
| `UNCLEAR` | Speech is unintelligible |
| `TOO_QUIET` | Volume too low to transcribe |
| `WRONG_LANGUAGE` | Not the expected language |
| `INCOMPLETE` | Recording is cut off |
| `INAPPROPRIATE` | **Content breaches this policy** — harmful, illegal, or personal data about a third party |
| `OTHER` | Anything else, with a written note |

### Review stages

```
Recording submitted
      ↓
Audio review          — quality and content screening
      ↓
Transcription         — a second person listens in full
      ↓
Reviewer approval     — a third person reads the transcript against the audio
      ↓
Language Lead verification
      ↓
Eligible for dataset export
```

A recording is heard by **at least two people** before it can be exported, and prohibited content
can be flagged at any stage.

---

## 4. Removal

- Administrators can reject or delete any recording at any time.
- **Rejected and flagged recordings are excluded from dataset exports by default.** This is
  enforced in the export tooling, not left to an operator to remember: records with status
  `REJECTED` or `FLAGGED` are dropped, and the exclusion count is reported on every export run.
- Because there is no public publishing surface, removal at source is sufficient — there is no
  separate distribution channel to clean up.
- Where a dataset containing the material has already been delivered to a partner, the operator
  notifies that partner and requests deletion under the terms of their agreement.

---

## 5. Reporting

**Anyone may report content** — contributor, reviewer or member of the public — by emailing
**info@geneline-x.net**. Reports are acknowledged within 48 hours.

### Escalation for illegal content

| Content | Action |
|---|---|
| **CSAM** | Preserved as required by law, reported to the Sierra Leone Police immediately, account suspended without warning. **No exceptions, no warnings.** |
| **Other illegal content** | Removed, reported to the relevant authority under the Cyber Security and Crime Act 2021, account suspended pending review |
| **Policy breach, not illegal** | Removed; contributor notified with the reason; repeated breaches lead to suspension |
| **Third-party personal data** | Recording deleted rather than corrected, since the audio itself carries the data |

Accounts are suspended by deactivation, which revokes access immediately while preserving
records required for any investigation.

---

## 6. Contributor rights

- Contributors are told **why** work was rejected, through the review feedback shown in their
  dashboard.
- A rejection for quality reasons is not a penalty — it is guidance, and the contributor may
  resubmit.
- A contributor who believes a moderation decision was wrong may appeal to
  **info@geneline-x.net**.

---

## 7. For operators running their own deployment

KACCP is open-source software. If you operate your own deployment, **you are the data
controller and the moderator** for the content your contributors produce. You should:

1. Publish your own version of this policy, reflecting the law in your jurisdiction.
2. Author your prompt bank deliberately — it is your first and strongest moderation control.
3. Ensure at least one reviewer other than the contributor hears every recording.
4. Know your local reporting obligations for illegal content, particularly CSAM.
5. Keep the default export exclusions in place, so rejected and flagged audio cannot reach a
   dataset by accident.

---

**Related:** [Terms of Service](../TERMS.md) · [Privacy Policy](../PRIVACY.md) ·
[Code of Conduct](../CODE_OF_CONDUCT.md)

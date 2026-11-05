# Adapting KACCP to a New Language

**You do not need to write any code.** Language, country, prompt bank and pay rates are
configuration. This guide takes you from a fresh deployment to collecting audio.

If you can answer "who speaks it, what should they say, and how will I pay them", you can run
KACCP for your language.

---

## Before you start

You need:

| | |
|---|---|
| **A deployment** | PostgreSQL, plus the app. See [deployment.md](deployment.md). Local filesystem storage is fine to begin with |
| **An admin account** | `npm run seed:admin` |
| **~200–500 prompt sentences** | Sentences in a language your speakers read fluently — usually English. See §3 |
| **Speakers** | People who speak the target language natively |
| **Transcribers** | People who can *write* the target language. Often the harder group to find |
| **A way to pay** | Mobile money, bank transfer, cash. KACCP records what is owed; settlement is yours |

---

## 1. Add the country and language

Admin → Countries → New.

| Field | Value | Notes |
|---|---|---|
| `code` | `GN` | ISO 3166-1 alpha-2 |
| `name` | Guinea | |

Admin → Languages → New.

| Field | Example | Notes |
|---|---|---|
| `code` | `fuf` | **ISO 639-3.** Look it up at [iso639-3.sil.org](https://iso639-3.sil.org) |
| `name` | Pular | English name |
| `nativeName` | Pular | As speakers call it |
| `targetMinutes` | `12000` | 200 hours. Set an honest goal |
| `speakerRatePerMinute` | | Per minute of **accepted** audio |
| `transcriberRatePerMin` | | Per minute transcribed |

### Setting rates

Rates are in your own currency — KACCP stores numbers, not a currency conversion. Anchor them to
local expectations, not to what data labelling pays elsewhere. Two things worth deciding early:

- Paying **per accepted minute** rather than per submitted minute aligns pay with quality. It is
  the default, and it is why review exists.
- Transcription takes **considerably longer** than recording — often 4–6× the audio duration.
  Price it accordingly or you will not keep transcribers.

---

## 2. A note on orthography

Before writing a single prompt, settle how the language is **written**. This is the step most
projects skip and most regret.

- Is there a standard orthography? Is it actually used, or do people write ad hoc?
- Which characters are needed beyond ASCII? Krio needs `ɔ`, `ɛ`, `ŋ`. Confirm your transcribers
  can type them — on phones as well as laptops.
- Are there competing spellings for common words?

Write the answers down and give them to every transcriber **before** they start. Inconsistent
spelling is the single biggest source of unusable transcription data, and it is very expensive to
fix afterwards. KACCP's `WordBank` model exists for exactly this: seed it with agreed spellings of
frequent words.

---

## 3. Build the prompt bank

Prompts are what speakers say. Quality here determines the quality of everything downstream.

### Format

CSV, imported via Admin → Prompts → Import.

```csv
englishText,category,emotion,targetDurationSec,hint
"Hello, nice to meet you!",GREETINGS,HAPPY,4,"A friendly first meeting"
"How much is a cup of rice?",MARKET_SHOPPING,QUESTION,4,"Asking a trader the price"
"The clinic opens at eight in the morning.",HEALTH,NEUTRAL,5,
```

Categories and emotions are listed in the [data dictionary](data-dictionary.md#5-enumerations).

### What makes a good prompt bank

- **Cover the sounds, not just the topics.** Include prompts that exercise every phoneme in the
  language, including ones rare in everyday speech. Use the `PHONETIC_COVERAGE` category.
- **Write what people actually say.** "Send me 50 leones on this number" is more useful than a
  textbook sentence, because real systems must handle real speech.
- **Vary length.** A mix of 3-second phrases and 15-second sentences. Models trained only on short
  clips handle long input poorly.
- **Vary emotion.** Neutral-only data produces flat, robotic synthesis.
- **Include numbers, money, dates and place names.** These are where speech systems fail most and
  are disproportionately valuable.
- **Use local names and places.** A model that cannot say the names of towns in its own country is
  not finished.

### Free-form prompts

Setting `isFreeForm` asks the speaker to talk about a topic rather than read a sentence. This gives
natural, spontaneous speech — valuable, and different in character from read speech.

**Understand the cost first.** For free-form prompts, `englishText` is an *instruction*
("Describe how you prepare cassava"), not a translation of what the speaker said. Those recordings
therefore have no English counterpart until a human writes one. Budget for that work, or accept
they will be usable only for same-language tasks.

---

## 4. Onboard people

**Speakers** register and select the language under "languages I speak". Then:

- Record somewhere quiet. A quiet room beats an expensive microphone.
- Same device, same position, every session — consistency matters more than absolute quality.
- Speak naturally. Over-enunciated speech produces unnatural models.

**Transcribers** register and select the language under "languages I write". Give them the
orthography guide from §2 before their first task.

**Reviewers** are transcribers you promote once you trust their judgement. They approve or reject
others' work, so choose people who will give useful feedback rather than only a verdict.

---

## 5. Run a pilot before you scale

Collect **~50 recordings** and take them all the way through review and export. Then look hard at
the result before recruiting anyone else.

Check:

- Does the exported audio sound right? Correct sample rate, no clipping, no truncation?
- Are transcriptions spelled consistently between different transcribers?
- Do prompts and recordings actually correspond?
- Is the review workload sustainable, or is one person becoming a bottleneck?

Fixing a prompt bank after 50 recordings costs an afternoon. After 5,000 it can cost the project.

### Verify your export

`docs/krio-tts-dataset.md` includes a validation script that confirms every exported path resolves
to readable audio and reports duration statistics. Run the equivalent for your language before
trusting a dataset.

---

## 6. Keep contributors

Getting people to sign up is easy. Getting them to come back in week three is the whole problem,
and it decides whether your corpus reaches usable size.

KACCP ships a progression layer for this: levels, daily goals, streaks, badges, leaderboards and
milestone celebrations. **Scoring is tied to reviewer-approved work**, so the incentive pushes
accuracy rather than volume — a leaderboard counting raw submissions would reward whoever types
fastest and quietly ruin the dataset.

Beyond the software:

- **Pay promptly.** Nothing ends a data collection programme faster than late payment.
- **Give reasons when rejecting.** "Rejected" teaches nothing; "the last two seconds were cut off"
  fixes the next twenty recordings.
- **Tell people what it is for.** Contributors who understand they are building something for
  their own language behave differently from contributors doing piecework.

---

## 7. Export

Admin → Export, or `scripts/export-krio-dataset.ts` for scripted builds.

Formats: CSV, JSON, and an LJSpeech-style ZIP (`wavs/` + `metadata.csv`) that most speech toolkits
read directly. Fields are documented in the [data dictionary](data-dictionary.md).

Exports exclude rejected and flagged audio by default. Do not disable that without a reason.

---

## 8. Your responsibilities as an operator

Running your own deployment makes you the **data controller** for the data you collect.

- **Consent.** Speakers must understand that their voice is being recorded, what it will be used
  for, and who will hold it. KACCP records consent per recording; the wording is yours to get
  right.
- **Your own Terms and Privacy Policy**, reflecting your jurisdiction's law. Ours
  ([TERMS.md](../TERMS.md), [PRIVACY.md](../PRIVACY.md)) are a starting point, not legal advice.
- **Age.** We require contributors to be 18+, because they are paid and grant rights over
  biometric data. Decide deliberately if you differ.
- **Moderation.** You are responsible for content your contributors produce. See
  [content-moderation.md](content-moderation.md), particularly the reporting obligations.
- **Voice is biometric data** in many jurisdictions and attracts heightened protection. Check what
  applies where you operate.

---

## Getting help

Open an issue at [github.com/Geneline-X/kaccp](https://github.com/Geneline-X/kaccp).

If you are collecting for an African language, the [Masakhane](https://www.masakhane.io/)
community is a good place to find collaborators.

---

**Related:** [Architecture](architecture.md) · [Data dictionary](data-dictionary.md) ·
[Content moderation](content-moderation.md)

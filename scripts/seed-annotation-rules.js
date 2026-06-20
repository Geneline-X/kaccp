#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* Seed the annotation_rules table with the Krio Speech Annotation Standard v1.0 */

const { PrismaClient } = require('@prisma/client')

const rules = [
  {
    ruleId: 'canonical-orthography',
    title: 'Canonical Orthography',
    description:
      'Every Krio word has exactly one approved spelling. Never alternate between variants, even if common in everyday writing.',
    examples: {
      approved: 'A wan send 50 leones go Mariama',
      notApproved: 'Ah want send fifty leones to Mariama',
      canonicalPairs: [
        { standard: 'A', avoid: 'Ah' },
        { standard: 'wan', avoid: 'want' },
        { standard: 'go', avoid: 'to' },
        { standard: 'sabi', avoid: 'sabih, savi' },
        { standard: 'di', avoid: 'the' },
        { standard: 'dis', avoid: 'this' },
        { standard: 'dem', avoid: 'them, dey' },
        { standard: 'na', avoid: 'is/are (copula)' },
        { standard: 'send', avoid: 'sen' },
      ],
    },
    category: 'spelling',
  },
  {
    ruleId: 'never-translate',
    title: 'Never Translate',
    description:
      'Transcribe exactly what was spoken, never the English equivalent. This is the most common error new annotators make.',
    examples: {
      approved: 'A wan buy airtime',
      notApproved: 'I want to buy airtime',
    },
    category: 'spelling',
  },
  {
    ruleId: 'preserve-spoken-language',
    title: 'Preserve Spoken Language Exactly',
    description:
      'Do not normalize Krio toward English. Write exactly what the speaker said in Krio orthography, even when an English-influenced phrase would be "correct" English.',
    examples: null,
    category: 'spelling',
  },
  {
    ruleId: 'numbers-as-digits',
    title: 'Numbers Are Always Digits',
    description:
      'Always digits, never spelled out. A transcription error on a number is a financial error, not just a language error. Apply to amounts, phone numbers, PINs, and any numeric value.',
    examples: {
      approved: 'A wan send 500 leones',
      notApproved: 'A wan send five hundred leones',
    },
    category: 'numbers',
  },
  {
    ruleId: 'mark-unclear-audio',
    title: 'Mark Unclear Audio, Never Guess',
    description:
      'If a word or phrase cannot be confidently identified, mark it explicitly rather than guessing. Guessing introduces silent errors far more damaging than an honestly marked gap.',
    examples: {
      shortUnclear: '[unk]',
      longUnclear: '<inaudible>',
    },
    category: 'quality',
  },
  {
    ruleId: 'background-speech',
    title: 'Background Speech',
    description:
      'When a second speaker or background conversation is audible, tag it distinctly from the primary speaker\'s words.',
    examples: {
      secondSpeaker: '[speaker_2]',
      indistinctBackground: '[background]',
    },
    category: 'tagging',
  },
  {
    ruleId: 'fillers-kept',
    title: 'Fillers Are Kept',
    description:
      'Keep filler words (eh, um, hmm) in the transcript. They can be stripped programmatically before training, but if deleted at annotation stage the information is unrecoverable.',
    examples: {
      kept: 'Eh, A no sabi, um, di price na 500',
      incorrectlyStripped: 'A no sabi, di price na 500',
    },
    category: 'tagging',
  },
  {
    ruleId: 'laughter-tag',
    title: 'Laughter — One Tag',
    description:
      'Use exactly one tag for laughter across the entire dataset: [laughs]. Never also use "[laughter]" or any other variant.',
    examples: {
      correct: '[laughs]',
      incorrect: '[laughter]',
    },
    category: 'tagging',
  },
  {
    ruleId: 'code-switching',
    title: 'Code-Switching Is Preserved',
    description:
      'Code-switching between Krio and English is common in Sierra Leone. Transcribe exactly what was spoken — do not convert, normalize, or "correct" it to one language.',
    examples: {
      approved: 'A wan buy airtime now',
      notApproved: 'A wan buy airtime' + ' (removing English)',
    },
    category: 'spelling',
  },
  {
    ruleId: 'financial-entities',
    title: 'Financial Entities Use Approved Spelling',
    description:
      'Named financial services and channels must always use the approved spelling. This dictionary governs every transaction-related utterance.',
    examples: {
      dictionary: [
        { term: 'Orange Money', category: 'Mobile money provider' },
        { term: 'Afrimoney', category: 'Mobile money provider' },
        { term: 'QMoney', category: 'Mobile money provider' },
        { term: 'EDSA', category: 'Electricity bill payment' },
        { term: 'Flot', category: 'Product name' },
        { term: 'Top-up', category: 'Transaction type' },
        { term: 'Transfer', category: 'Transaction type' },
        { term: 'Remittance', category: 'Transaction type' },
        { term: 'Balance', category: 'Account term' },
        { term: 'PIN', category: 'Security term' },
        { term: 'OTP', category: 'Security term' },
      ],
    },
    category: 'financial',
  },
  {
    ruleId: 'new-rules-process',
    title: 'How New Rules Get Added',
    description:
      'When annotators disagree: 1) Both versions logged. 2) Language Lead decides canonical form. 3) Added to canonical spelling list or relevant rule. 4) annotation_rules table updated immediately so all annotators see it.',
    examples: null,
    category: 'process',
  },
]

async function main() {
  const prisma = new PrismaClient()
  try {
    let created = 0
    let skipped = 0

    for (const rule of rules) {
      const existing = await prisma.annotationRule.findUnique({
        where: { ruleId: rule.ruleId },
      })
      if (existing) {
        console.log(`Skipped (exists): ${rule.ruleId}`)
        skipped++
        continue
      }

      await prisma.annotationRule.create({ data: rule })
      console.log(`Created: ${rule.ruleId} — ${rule.title}`)
      created++
    }

    console.log(`\nDone: ${created} created, ${skipped} skipped, ${rules.length} total rules`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

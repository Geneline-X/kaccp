import OpenAI from 'openai'

let _client: OpenAI | null = null

export function getOpenAI() {
  if (_client) return _client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  _client = new OpenAI({ apiKey })
  return _client
}

export async function improveEnglish(input: string): Promise<{ corrected: string; score: number; model: string }> {
  const client = getOpenAI()
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const system =
    'You are an expert English editor. Improve grammar, clarity, and naturalness while preserving meaning. Return only the corrected sentence(s) without extra commentary.'

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: input },
  ]

  const resp = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.2,
  })

  const corrected = resp.choices?.[0]?.message?.content?.trim() || input

  // Heuristic score: higher reduction of errors -> higher score. For MVP, simple length/identity check.
  const score = corrected === input ? 0.7 : 0.9

  return { corrected, score, model }
}

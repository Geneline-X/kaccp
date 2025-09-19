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

  const system = [
    'You are an expert English editor.',
    'Improve grammar, clarity, and naturalness while preserving meaning.',
    'Return ONLY valid JSON with the following shape and nothing else:',
    '{"corrected": string, "score": number}',
    'Where score is a continuous value in [0,1] indicating confidence in your correction quality.',
  ].join(' ')

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: input },
  ]

  const resp = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.2,
    response_format: { type: 'json_object' as any },
  })

  const raw = resp.choices?.[0]?.message?.content?.trim() || ''
  try {
    const parsed = JSON.parse(raw)
    const corrected = typeof parsed.corrected === 'string' && parsed.corrected.trim().length > 0 ? parsed.corrected.trim() : input
    const score = typeof parsed.score === 'number' && isFinite(parsed.score) ? Math.max(0, Math.min(1, parsed.score)) : (corrected === input ? 0.7 : 0.9)
    return { corrected, score, model }
  } catch {
    const corrected = raw || input
    const score = corrected === input ? 0.7 : 0.9
    return { corrected, score, model }
  }
}

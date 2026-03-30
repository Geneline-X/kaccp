import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: (process.env.OPENAI_API_KEY || 'mock-key').trim(),
    dangerouslyAllowBrowser: true // Just in case, though this is server side
})

// Generate a plain-language hint to help speakers understand what to say
export async function generatePromptHint(englishText: string): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) return null
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You help West African speakers (Krio, Fula, Mandingo, temne, etc) understand English prompts.
Write a single short hint (max 12 words) that explains the IDEA of the sentence in the simplest possible English — like you are explaining it to someone who speaks very little English.
Do NOT translate. Just say what the person should talk about.
Examples:
- "I need to pay five thousand leones for a bag of rice" → "Talk about paying money for food"
- "Good morning, how did you sleep last night?" → "Greet someone in the morning and ask how they slept"
- "The doctor said I need to rest for one week" → "Say what a doctor told you to do"
Return only the hint text, nothing else.`
                },
                { role: 'user', content: englishText }
            ],
            max_tokens: 40,
            temperature: 0.3,
        })
        return response.choices[0].message.content?.trim() || null
    } catch {
        return null
    }
}

// Generate narrow, specific free-form topic prompts for a given category
export async function generateFreeFormTopics(category: string, count: number = 20): Promise<string[]> {
    if (!process.env.OPENAI_API_KEY) return []

    const SYSTEM_PROMPT = `You generate short, specific scenario prompts for a speech recording platform.
Each prompt should describe a very specific situation that a speaker can talk about naturally in 5-10 seconds.

Rules:
- Each prompt must be a narrow, concrete scenario — NOT an open-ended topic
- The speaker should be able to respond in 1-3 sentences
- Use simple English (will be spoken by West African speakers in their own language)
- Frame as instructions: "Tell someone...", "Explain how...", "Warn a child...", "Ask a friend...", "Describe..."
- Make them culturally relevant to West Africa (markets, family, farming, cooking, travel, health, faith, etc.)
- No duplicates or near-duplicates

Good examples:
- "Tell someone what you had for breakfast today"
- "Warn a child not to play near the road"
- "Ask a market seller how much the tomatoes cost"
- "Explain to a visitor how to get to the mosque"

Bad examples (too vague):
- "Talk about your life"
- "Describe food"
- "Tell a story"

Return a JSON object with a "topics" key containing an array of strings.`

    // Batch into chunks of 50 to avoid quality degradation on large requests
    const BATCH_SIZE = 50
    const allTopics: string[] = []

    try {
        for (let remaining = count; remaining > 0; remaining -= BATCH_SIZE) {
            const batchCount = Math.min(remaining, BATCH_SIZE)
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: `Generate ${batchCount} scenario prompts for the category: ${category.replace(/_/g, ' ')}${allTopics.length > 0 ? `\n\nAvoid these already-generated prompts:\n${allTopics.slice(-20).map(t => `- ${t}`).join('\n')}` : ''}`
                    }
                ],
                max_tokens: batchCount <= 50 ? 2000 : 4000,
                temperature: 0.9,
                response_format: { type: 'json_object' },
            })
            const content = response.choices[0].message.content
            if (!content) continue
            const parsed = JSON.parse(content)
            const topics = Array.isArray(parsed) ? parsed : (parsed.topics || parsed.prompts || parsed.scenarios || [])
            allTopics.push(...topics.filter((t: any) => typeof t === 'string'))
        }
        return allTopics.slice(0, count)
    } catch (e) {
        console.error('Failed to generate free-form topics:', e)
        return allTopics // Return whatever we got so far
    }
}

export async function improveEnglish(text: string): Promise<{ corrected: string, model: string, score: number }> {
    if (!process.env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not found, using mock response')
        return {
            corrected: text.trim() + " (Mock corrected)",
            model: 'mock-model',
            score: 0.95
        }
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // or gpt-3.5-turbo
            messages: [
                {
                    role: 'system',
                    content: `You are an expert editor who corrects Krio/English transcriptions. 
          The input text might be Sierra Leonean Krio or simple English. 
          Correct the grammar and spelling to standard English while preserving the original meaning.
          
          Return JSON with keys:
          - corrected: string (the corrected text)
          - score: number (0-1 confidence score or quality score of the original)
          `
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            response_format: { type: 'json_object' }
        })

        const content = response.choices[0].message.content
        if (!content) throw new Error('No content from OpenAI')

        const json = JSON.parse(content)

        return {
            corrected: json.corrected,
            model: response.model,
            score: json.score || 0
        }
    } catch (e) {
        console.error('AI Error:', e)
        throw e
    }
}

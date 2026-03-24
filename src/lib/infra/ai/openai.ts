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
                    content: `You help West African speakers (Krio, Fula, Mandingo) understand English prompts.
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

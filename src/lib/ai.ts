import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    dangerouslyAllowBrowser: true // Just in case, though this is server side
})

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

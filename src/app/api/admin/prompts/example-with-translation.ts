// Example: Prompt API with translation triggers
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/infra/db/prisma';
import { triggerAdminTranslation } from '@/lib/translations/triggers';

/**
 * Example API route for creating/updating prompts with automatic translation
 * 
 * This demonstrates the pattern:
 * 1. Save the original content in default language
 * 2. Trigger background translation to all enabled languages
 * 3. Return immediately (don't wait for translations)
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { englishText, category, emotion, instruction, languageId } = body;

        // 1. Create the prompt in the default language (English)
        const prompt = await prisma.prompt.create({
            data: {
                englishText,
                category,
                emotion,
                instruction,
                languageId,
                isActive: true,
            },
        });

        // 2. Trigger translation for all enabled languages
        // This runs in the background - we don't await it
        triggerAdminTranslation({
            entityType: 'prompt',
            entityId: prompt.id,
            fields: ['englishText', 'instruction'],
            sourceLanguage: 'en',
        }).catch((error) => {
            // Log errors but don't fail the request
            console.error('Background translation failed:', error);
        });

        // 3. Return immediately
        return NextResponse.json({
            success: true,
            prompt,
            message: 'Prompt created. Translations are being generated in the background.',
        });
    } catch (error) {
        console.error('Failed to create prompt:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create prompt' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, englishText, category, emotion, instruction } = body;

        // 1. Update the prompt
        const prompt = await prisma.prompt.update({
            where: { id },
            data: {
                englishText,
                category,
                emotion,
                instruction,
            },
        });

        // 2. Trigger re-translation for updated fields
        const fieldsToTranslate: string[] = [];
        if (englishText !== undefined) fieldsToTranslate.push('englishText');
        if (instruction !== undefined) fieldsToTranslate.push('instruction');

        if (fieldsToTranslate.length > 0) {
            triggerAdminTranslation({
                entityType: 'prompt',
                entityId: prompt.id,
                fields: fieldsToTranslate,
                sourceLanguage: 'en',
            }).catch((error) => {
                console.error('Background translation failed:', error);
            });
        }

        // 3. Return immediately
        return NextResponse.json({
            success: true,
            prompt,
            message: 'Prompt updated. Translations are being regenerated in the background.',
        });
    } catch (error) {
        console.error('Failed to update prompt:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update prompt' },
            { status: 500 }
        );
    }
}

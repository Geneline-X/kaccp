// DB access abstraction
import { prisma } from '@/lib/infra/db/prisma';
import type { TranslationQuery, CreateTranslationInput, TranslationRecord } from './types';

export class TranslationRepository {
    /**
     * Find a cached translation
     */
    async findTranslation(query: TranslationQuery): Promise<TranslationRecord | null> {
        return await prisma.translation.findUnique({
            where: {
                entityType_entityId_fieldName_targetLanguage: {
                    entityType: query.entityType,
                    entityId: query.entityId,
                    fieldName: query.fieldName,
                    targetLanguage: query.targetLanguage,
                },
            },
        });
    }

    /**
     * Store a new translation or update existing one
     */
    async createTranslation(input: CreateTranslationInput): Promise<TranslationRecord> {
        return await prisma.translation.upsert({
            where: {
                entityType_entityId_fieldName_targetLanguage: {
                    entityType: input.entityType,
                    entityId: input.entityId,
                    fieldName: input.fieldName,
                    targetLanguage: input.targetLanguage,
                },
            },
            update: {
                translatedText: input.translatedText,
                sourceText: input.sourceText,
                sourceLanguage: input.sourceLanguage,
            },
            create: input,
        });
    }
}

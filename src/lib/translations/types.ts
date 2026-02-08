// Translation domain types

export interface TranslationRecord {
    id: string;
    entityType: string;
    entityId: string;
    fieldName: string;
    sourceLanguage: string;
    targetLanguage: string;
    sourceText: string;
    translatedText: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface TranslationQuery {
    entityType: string;
    entityId: string;
    fieldName: string;
    targetLanguage: string;
}

export interface CreateTranslationInput {
    entityType: string;
    entityId: string;
    fieldName: string;
    sourceLanguage: string;
    targetLanguage: string;
    sourceText: string;
    translatedText: string;
}

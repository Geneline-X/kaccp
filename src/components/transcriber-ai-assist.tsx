import { useEffect } from "react";
import { Edit3, AlertCircle } from "lucide-react";

interface TranscriberAIAssistProps {
  recording: {
    id: string;
    transcript?: string | null; // Krio transcript from Kay X
    transcriptConfidence?: number | null;
    autoTranscriptionStatus: "PENDING" | "COMPLETED" | "FAILED" | "SKIPPED";
  };
  promptText: string; // English prompt shown to speaker
  languageName?: string;
  onSaveTranscription: (text: string) => Promise<void> | void;
  value?: string; // Controlled value (was initialValue)
}

import { useTranslations } from "next-intl";

// ... existing code ...

export function TranscriberAIAssist({
  recording,
  promptText,
  languageName = "Krio",
  onSaveTranscription,
  value = "",
}: TranscriberAIAssistProps) {
  const t = useTranslations('transcriber.aiAssist');

  // ... useEffects ...

  return (
    <div className="space-y-4">
      {recording.autoTranscriptionStatus === "FAILED" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">{t('failed')}</p>
            <p className="text-xs text-red-700">{t('manual')}</p>
          </div>
        </div>
      )}

      {/* Transcription Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="transcription" className="text-sm font-medium flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            {t('editor')}
          </label>
          <span className="text-xs text-gray-500">
            {t('characters', { count: value.length })}
          </span>
        </div>

        <textarea
          id="transcription"
          value={value}
          onChange={(e) => {
            onSaveTranscription(e.target.value);
          }}
          className="w-full min-h-[120px] rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('placeholder', { language: languageName })}
        />
      </div>
    </div>
  );
}

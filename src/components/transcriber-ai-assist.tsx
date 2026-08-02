import { useEffect } from "react";
import { Edit3, AlertCircle, RotateCcw } from "lucide-react";

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

export function TranscriberAIAssist({
  recording,
  promptText,
  languageName = "Krio",
  onSaveTranscription,
  value = "",
}: TranscriberAIAssistProps) {
  const t = useTranslations('transcriber.aiAssist');

  // Pre-fill the editor with the AI transcript when the component first loads
  // and the textarea is currently empty. This lets the transcriber correct the AI
  // output instead of typing from scratch.
  useEffect(() => {
    if (!value && recording.transcript && recording.autoTranscriptionStatus === "COMPLETED") {
      onSaveTranscription(recording.transcript);
    }
  }, [recording.id, recording.transcript, recording.autoTranscriptionStatus]);

  const hasTranscript = recording.autoTranscriptionStatus === "COMPLETED" && recording.transcript;
  const confidencePercent = recording.transcriptConfidence
    ? Math.round(recording.transcriptConfidence * 100)
    : null;

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

      {/* AI Transcript (read-only reference) */}
      {hasTranscript && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-900">AI Transcript (Krio)</span>
              {confidencePercent !== null && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                  {confidencePercent}% confidence
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSaveTranscription(recording.transcript!)}
              className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium"
              title="Reset editor to the AI transcript"
            >
              <RotateCcw className="h-3 w-3" />
              Use AI transcript
            </button>
          </div>
          <p className="text-sm text-gray-900">{recording.transcript}</p>
          <p className="text-xs text-blue-700 mt-1">
            Listen carefully and correct the text above. Keep the Krio spelling exactly as spoken.
          </p>
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

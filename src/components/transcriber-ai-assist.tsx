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

export function TranscriberAIAssist({
  recording,
  promptText,
  languageName = "Krio",
  onSaveTranscription,
  value = "",
}: TranscriberAIAssistProps) {
  // Sync initial AI transcript to parent if provided and we have no other value
  // This ensures the "Submit" button has text even if user types nothing
  // Added recording.id dependency to handle navigation between tasks without unmounting
  useEffect(() => {
    if (!value && recording.transcript) {
      onSaveTranscription(recording.transcript);
    }
    // We only want to auto-fill if specific conditions are met, so explicit deps are good.
    // If value changes to something else, we don't re-run.
    // If recording changes (new task), we re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording.id, recording.transcript]);

  return (
    <div className="space-y-4">
      {recording.autoTranscriptionStatus === "FAILED" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Auto-transcription failed</p>
            <p className="text-xs text-red-700">Please transcribe manually</p>
          </div>
        </div>
      )}

      {/* Transcription Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="transcription" className="text-sm font-medium flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Transcription Editor
          </label>
          <span className="text-xs text-gray-500">
            {value.length} characters
          </span>
        </div>

        <textarea
          id="transcription"
          value={value}
          onChange={(e) => {
            onSaveTranscription(e.target.value);
          }}
          className="w-full min-h-[120px] rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`Type the ${languageName} transcription here...`}
        />
      </div>
    </div>
  );
}

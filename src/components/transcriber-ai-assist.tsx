/**
 * Transcriber AI-Assist Component
 * 
 * Shows Kay X auto-generated KRIO transcript for transcribers to review and edit.
 * Speaker sees English prompt, speaks in Krio, Kay X transcribes to Krio text.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bot, Edit3, AlertCircle } from "lucide-react";

interface TranscriberAIAssistProps {
  recording: {
    id: string;
    transcript?: string | null; // Krio transcript from Kay X
    transcriptConfidence?: number | null;
    autoTranscriptionStatus: "PENDING" | "COMPLETED" | "FAILED" | "SKIPPED";
  };
  promptText: string; // English prompt shown to speaker
  onSaveTranscription: (text: string) => Promise<void>;
  initialValue?: string; // Existing Krio transcription if any
}

export function TranscriberAIAssist({
  recording,
  promptText,
  onSaveTranscription,
  initialValue = "",
}: TranscriberAIAssistProps) {
  const [transcriptionText, setTranscriptionText] = useState(
    initialValue || recording.transcript || ""
  );
  const [isSaving, setIsSaving] = useState(false);

  const hasKayXTranscript = 
    recording.autoTranscriptionStatus === "COMPLETED" && recording.transcript;
  
  const confidence = recording.transcriptConfidence || 0;
  const isLowConfidence = confidence < 0.7;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSaveTranscription(transcriptionText);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* English Prompt (What speaker saw) */}
      <div className="rounded-lg border p-4 bg-gray-50">
        <p className="text-sm font-medium text-gray-700 mb-1">English Prompt (What speaker saw)</p>
        <p className="text-base">{promptText}</p>
      </div>

      {/* Kay X Auto-Transcript Status */}
      {hasKayXTranscript && (
        <div className={cn(
          "rounded-lg border p-3 flex items-start gap-3",
          isLowConfidence ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"
        )}>
          <Bot className={cn(
            "h-5 w-5 mt-0.5",
            isLowConfidence ? "text-yellow-600" : "text-blue-600"
          )} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">Kay X Krio Transcript</span>
              <Badge variant={isLowConfidence ? "secondary" : "default"} className="text-xs">
                {(confidence * 100).toFixed(0)}% confidence
              </Badge>
            </div>
            {isLowConfidence && (
              <div className="flex items-center gap-1 text-xs text-yellow-700 mb-2">
                <AlertCircle className="h-3 w-3" />
                <span>Low confidence - please review carefully</span>
              </div>
            )}
            <p className="text-sm text-gray-600">
              Verify the Krio transcript below is correct
            </p>
          </div>
        </div>
      )}

      {recording.autoTranscriptionStatus === "FAILED" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Auto-transcription failed</p>
            <p className="text-xs text-red-700">Please transcribe manually</p>
          </div>
        </div>
      )}

      {/* Krio Transcription Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="transcription" className="text-sm font-medium flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            {hasKayXTranscript ? "Verify Krio Transcript" : "Manual Krio Transcription"}
          </label>
          <span className="text-xs text-gray-500">
            {transcriptionText.length} characters
          </span>
        </div>
        
        <textarea
          id="transcription"
          value={transcriptionText}
          onChange={(e) => setTranscriptionText(e.target.value)}
          className="w-full min-h-[120px] rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={hasKayXTranscript 
            ? "Verify and edit the Krio transcript if needed..." 
            : "Type the Krio transcription here..."
          }
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving || !transcriptionText.trim()}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSaving ? "Saving..." : hasKayXTranscript ? "Save Verified Transcript" : "Save Transcription"}
      </button>

      {hasKayXTranscript && (
        <p className="text-xs text-center text-gray-500">
          💡 Tip: Kay X has transcribed the spoken Krio. Just verify it's correct.
        </p>
      )}
    </div>
  );
}

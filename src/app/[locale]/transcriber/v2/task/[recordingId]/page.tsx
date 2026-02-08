"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getToken } from "@/lib/infra/client/client";
import { TranscriberAIAssist } from "@/components/transcriber-ai-assist";
import { useTranslations } from "next-intl";

interface Recording {
  id: string;
  audioUrl: string;
  durationSec: number;
  transcript?: string | null;
  transcriptConfidence?: number | null;
  autoTranscriptionStatus: "PENDING" | "COMPLETED" | "FAILED" | "SKIPPED";
  prompt: {
    englishText: string;
    category: string;
    emotion: string;
    instruction?: string;
  };
  language: {
    code: string;
    name: string;
  };
}

export default function TranscriptionTaskPage() {
  const router = useRouter();
  const t = useTranslations();
  const params = useParams();
  const recordingId = params.recordingId as string;
  const audioRef = useRef<HTMLAudioElement>(null);

  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcription, setTranscription] = useState("");
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [playCount, setPlayCount] = useState(0);
  const [audioPlayUrl, setAudioPlayUrl] = useState<string | null>(null);

  const FLAG_REASONS = [
    { value: "NOISE", label: t('transcriber.flagNoise') },
    { value: "UNCLEAR", label: t('transcriber.flagUnclear') },
    { value: "TOO_QUIET", label: t('transcriber.flagTooQuiet') },
    { value: "WRONG_LANGUAGE", label: t('transcriber.flagWrongLanguage') },
    { value: "INCOMPLETE", label: t('transcriber.flagIncomplete') },
    { value: "OTHER", label: t('transcriber.flagOther') },
  ];

  const token = typeof window !== "undefined" ? getToken() : null;

  // Fetch recording details
  useEffect(() => {
    if (!token || !recordingId) {
      router.push("/transcriber/v2");
      return;
    }

    // First claim the recording if not already claimed
    fetch("/api/v2/transcriber/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recordingId }),
    })
      .then((res) => res.json())
      .then(async (data) => {
        let rec = null;
        if (data.recording) {
          rec = data.recording;
        } else if (data.error?.includes("already have")) {
          // Already claimed, fetch from my-work
          const workRes = await fetch("/api/v2/transcriber/my-work", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const workData = await workRes.json();
          const assignment = workData.activeAssignments?.find(
            (a: any) => a.recording?.id === recordingId
          );
          if (assignment?.recording) {
            rec = assignment.recording;
          }
        }

        if (rec) {
          setRecording(rec);
          // Fetch signed audio URL
          const audioRes = await fetch(`/api/v2/audio/${recordingId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const audioData = await audioRes.json();
          if (audioData.url) {
            setAudioPlayUrl(audioData.url);
          }
        } else {
          setError(data.error || t('transcriber.recordingNotFound'));
        }
        setLoading(false);
      })
      .catch(() => {
        setError(t('transcriber.failedToLoadRecording'));
        setLoading(false);
      });
  }, [token, recordingId, router, t]);

  // Handle audio play
  const handlePlay = () => {
    setPlayCount((c) => c + 1);
  };

  // Submit transcription
  const handleSubmit = async () => {
    if (!transcription.trim()) {
      setError(t('transcriber.pleaseEnterTranscription'));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/v2/transcriber/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recordingId,
          text: transcription.trim(),
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      // Success - go back to dashboard
      router.push("/transcriber/v2");
    } catch {
      setError(t('transcriber.failedToSubmitTranscription'));
    } finally {
      setSubmitting(false);
    }
  };

  // Flag recording
  const handleFlag = async () => {
    if (!flagReason) {
      setError(t('transcriber.selectFlagReason'));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/v2/transcriber/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recordingId,
          isFlagged: true,
          flagReason,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      // Success - go back to dashboard
      router.push("/transcriber/v2");
    } catch {
      setError(t('transcriber.failedToFlagRecording'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">{t('transcriber.recordingNotFound')}</h2>
          <p className="text-gray-400 mb-6">{error || t('transcriber.recordingNotAvailable')}</p>
          <button
            onClick={() => router.push("/transcriber/v2")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('transcriber.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button
            onClick={() => router.push("/transcriber/v2")}
            className="text-gray-400 hover:text-white"
          >
            ← {t('common.back')}
          </button>
          <span className="text-sm text-gray-400">
            {recording.language.name} • {recording.durationSec.toFixed(1)}s
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Prompt Info */}
        <div className="bg-gray-800 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm">
              {recording.prompt.category.replace(/_/g, " ")}
            </span>
            <span className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-sm">
              {recording.prompt.emotion}
            </span>
          </div>

          <p className="text-sm text-gray-400 mb-2">{t('transcriber.originalEnglishPrompt')}:</p>
          <h2 className="text-2xl font-bold mb-4">{recording.prompt.englishText}</h2>

          {recording.prompt.instruction && (
            <p className="text-sm text-yellow-400 italic">
              💡 {recording.prompt.instruction}
            </p>
          )}
        </div>

        {/* Audio Player */}
        <div className="bg-gray-800 rounded-2xl p-8 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{t('transcriber.listenToRecording')}</h3>
            <span className="text-sm text-gray-400">
              {t('transcriber.playedTimes', { count: playCount })}
            </span>
          </div>
          {audioPlayUrl ? (
            <audio
              ref={audioRef}
              controls
              onPlay={handlePlay}
              className="w-full"
              src={audioPlayUrl}
            />
          ) : (
            <div className="text-center py-4 text-gray-400">
              {t('transcriber.loadingAudio')}...
            </div>
          )}
          <p className="text-sm text-gray-400 mt-2">
            {t('transcriber.listenAndWrite', { language: recording.language.name })}
          </p>
        </div>

        {/* Kay X AI-Assisted Transcription */}
        <div className="bg-gray-800 rounded-2xl p-8 mb-8">
          <TranscriberAIAssist
            recording={{
              id: recording.id,
              transcript: recording.transcript,
              transcriptConfidence: recording.transcriptConfidence,
              autoTranscriptionStatus: recording.autoTranscriptionStatus || "PENDING",
            }}
            promptText={recording.prompt.englishText}
            languageName={recording.language.name}
            onSaveTranscription={async (text) => {
              setTranscription(text);
            }}
            value={transcription}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowFlagModal(true)}
            className="px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
          >
            🚩 {t('transcriber.flagIssue')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !transcription.trim()}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? t('transcriber.submitting') : t('transcriber.submitTranscription')}
          </button>
        </div>

        {/* Tips */}
        <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
          <h3 className="font-semibold mb-2">{t('transcriber.transcriptionTips')}:</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            {recording.language.code.toLowerCase() === "kri" ? (
              <>
                <li>• {t('transcriber.tipReviewAuto')}</li>
                <li>• {t('transcriber.tipCorrectWrong')}</li>
                <li>• {t('transcriber.tipPerfect')}</li>
                <li>• {t('transcriber.tipFlagPoor')}</li>
              </>
            ) : (
              <>
                <li>• {t('transcriber.tipListenCarefully')}</li>
                <li>• {t('transcriber.tipNoTranslate')}</li>
                <li>• {t('transcriber.tipProperSpelling', { language: recording.language.name })}</li>
                <li>• {t('transcriber.tipFlagPoorOrWrong')}</li>
              </>
            )}
          </ul>
        </div>
      </main>

      {/* Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">{t('transcriber.flagRecording')}</h2>
            <p className="text-gray-400 mb-4">
              {t('transcriber.selectReasonForFlagging')}:
            </p>

            <div className="space-y-2 mb-6">
              {FLAG_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${flagReason === reason.value
                    ? "bg-red-900/50 border border-red-500"
                    : "bg-gray-700 hover:bg-gray-600"
                    }`}
                >
                  <input
                    type="radio"
                    name="flagReason"
                    value={reason.value}
                    checked={flagReason === reason.value}
                    onChange={(e) => setFlagReason(e.target.value)}
                    className="mr-3"
                  />
                  {reason.label}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowFlagModal(false);
                  setFlagReason("");
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleFlag}
                disabled={submitting || !flagReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? t('transcriber.flagging') : t('transcriber.flagRecording')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

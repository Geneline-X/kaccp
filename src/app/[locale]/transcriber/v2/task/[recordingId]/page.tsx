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
    isFreeForm?: boolean;
  };
  language: {
    id: string;
    code: string;
    name: string;
  };
}

export default function TranscriptionTaskPage() {
  const router = useRouter();
  const t = useTranslations();
  const params = useParams();
  const recordingId = params.recordingId as string;
  const locale = (params?.locale as string) || "en";
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
  // Keeping the transcriber in the editor is the single biggest throughput win:
  // the old loop was submit -> dashboard -> find a row -> claim -> open, four
  // interactions between one clip and the next.
  const [autoNext, setAutoNext] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [noMore, setNoMore] = useState(false);
  const [previousRejection, setPreviousRejection] = useState<{
    text: string;
    reviewNotes: string | null;
    reviewedAt: string | null;
    reviewer: { displayName: string | null } | null;
  } | null>(null);

  // Draft cache key for localStorage persistence
  const draftKey = `transcription_draft_${recordingId}`;

  const FLAG_REASONS = [
    { value: "NOISE", label: t('transcriber.flagNoise') },
    { value: "UNCLEAR", label: t('transcriber.flagUnclear') },
    { value: "TOO_QUIET", label: t('transcriber.flagTooQuiet') },
    { value: "WRONG_LANGUAGE", label: t('transcriber.flagWrongLanguage') },
    { value: "INCOMPLETE", label: t('transcriber.flagIncomplete') },
    { value: "OTHER", label: t('transcriber.flagOther') },
  ];

  const token = typeof window !== "undefined" ? getToken() : null;

  // Remember the choice across clips and sessions.
  useEffect(() => {
    const saved = localStorage.getItem("transcriber_auto_next");
    if (saved !== null) setAutoNext(saved === "true");
    const session = sessionStorage.getItem("transcriber_session_done");
    if (session) setDoneCount(parseInt(session) || 0);
  }, []);

  const toggleAutoNext = (value: boolean) => {
    setAutoNext(value);
    localStorage.setItem("transcriber_auto_next", String(value));
  };

  // Keyboard submit: at 500 items a day, reaching for the mouse between every
  // clip is a meaningful share of the work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!submitting && !advancing && transcription.trim()) handleSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcription, submitting, advancing, autoNext, doneCount]);

  // Claim the next clip and swap it in without a full page load, so the audio
  // element and text box are ready immediately.
  const goToNext = async () => {
    setAdvancing(true);
    setError("");
    try {
      const res = await fetch("/api/v2/transcriber/claim-next", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.done) {
        setNoMore(true);
        return;
      }
      if (data.error || !data.recording) {
        setError(data.error || "Could not load the next recording");
        return;
      }
      router.replace(`/${locale}/transcriber/v2/task/${data.recording.id}`);
    } catch {
      setError("Could not load the next recording");
    } finally {
      setAdvancing(false);
    }
  };

  // Advancing to the next clip changes the route param without unmounting this
  // component, so every field has to be cleared explicitly. Without this the
  // previous clip's text stays in the box and can be submitted against the wrong
  // audio. Declared before the fetch effect so it runs first.
  useEffect(() => {
    setTranscription("");
    setRecording(null);
    setPreviousRejection(null);
    setAudioPlayUrl(null);
    setPlayCount(0);
    setError("");
    setShowFlagModal(false);
    setFlagReason("");
    setLoading(true);
  }, [recordingId]);

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
          const rejected = data.previousTranscription || null;
          setPreviousRejection(rejected);

          // Check for cached draft in localStorage first
          const cachedDraft = localStorage.getItem(draftKey);
          if (cachedDraft) {
            setTranscription(cachedDraft);
          } else if (rejected && rejected.text) {
            // Pre-fill with rejected text so transcriber only edits what was rejected
            setTranscription(rejected.text);
            localStorage.setItem(draftKey, rejected.text);
          }

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

  // Save transcription draft to localStorage whenever it changes
  useEffect(() => {
    if (transcription) {
      localStorage.setItem(draftKey, transcription);
    }
  }, [transcription, draftKey]);

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

      // Success — clear the draft and keep the transcriber in the editor.
      localStorage.removeItem(draftKey);
      const done = doneCount + 1;
      setDoneCount(done);
      sessionStorage.setItem("transcriber_session_done", String(done));

      if (autoNext) {
        await goToNext();
      } else {
        router.push(`/${locale}/transcriber/v2`);
      }
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

      // Success — clear the draft and keep the transcriber in the editor.
      localStorage.removeItem(draftKey);
      const done = doneCount + 1;
      setDoneCount(done);
      sessionStorage.setItem("transcriber_session_done", String(done));

      if (autoNext) {
        await goToNext();
      } else {
        router.push(`/${locale}/transcriber/v2`);
      }
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

        {previousRejection && (
          <div className="mb-6 p-4 bg-orange-900/40 border border-orange-500 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-orange-400 font-semibold">
                ⚠️ {t('transcriber.previousRejected')}
              </span>
              {previousRejection.reviewedAt && (
                <span className="text-xs text-orange-300">
                  {new Date(previousRejection.reviewedAt).toLocaleString()}
                </span>
              )}
            </div>
            {previousRejection.reviewNotes && (
              <p className="text-sm text-orange-200 mb-2">
                <span className="font-medium">Reviewer feedback:</span> {previousRejection.reviewNotes}
              </p>
            )}
            <p className="text-xs text-orange-300">
              Your previous submission has been pre-filled in the editor below. Please review the feedback and make corrections as needed.
            </p>
          </div>
        )}

        {/* Prompt Info */}
        <div className="bg-gray-800 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-2 mb-4">
            {recording.prompt.isFreeForm && (
              <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm">
                {t('transcriber.freeSpeech')}
              </span>
            )}
            <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm">
              {recording.prompt.category.replace(/_/g, " ")}
            </span>
            {!recording.prompt.isFreeForm && (
              <span className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-sm">
                {recording.prompt.emotion}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-400 mb-2">
            {recording.prompt.isFreeForm ? t('transcriber.topicPrompt') : t('transcriber.originalEnglishPrompt')}:
          </p>
          <h2 className="text-2xl font-bold mb-4">{recording.prompt.englishText}</h2>

          {recording.prompt.isFreeForm && (
            <p className="text-sm text-yellow-400 italic">
              {t('transcriber.freeSpeechNote')}
            </p>
          )}
          {!recording.prompt.isFreeForm && recording.prompt.instruction && (
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
            languageId={recording.language.id}
            onSaveTranscription={async (text) => {
              setTranscription(text);
            }}
            value={transcription}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <button
            onClick={() => setShowFlagModal(true)}
            disabled={submitting || advancing}
            className="px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            🚩 {t('transcriber.flagIssue')}
          </button>

          <div className="flex items-center gap-3 flex-wrap">
            {doneCount > 0 && (
              <span className="text-sm text-gray-400" title="Completed in this session">
                ✅ <strong className="text-white">{doneCount}</strong> this session
              </span>
            )}

            <label
              className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none"
              title="Jump straight to the next clip after submitting"
            >
              <input
                type="checkbox"
                checked={autoNext}
                onChange={(e) => toggleAutoNext(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-green-500 focus:ring-green-500"
              />
              Auto-next
            </label>

            {/* Skip without submitting — a clip you can't do shouldn't cost a
                trip back to the dashboard either. */}
            <button
              onClick={goToNext}
              disabled={submitting || advancing}
              className="px-4 py-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 disabled:opacity-50"
              title="Leave this one and load the next"
            >
              {advancing ? "Loading…" : "Skip →"}
            </button>

            <button
              onClick={handleSubmit}
              disabled={submitting || advancing || !transcription.trim()}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {submitting
                ? t('transcriber.submitting')
                : advancing
                  ? "Loading next…"
                  : autoNext
                    ? `${t('transcriber.submitTranscription')} → Next`
                    : t('transcriber.submitTranscription')}
            </button>
          </div>
        </div>

        <p className="mt-2 text-right text-xs text-gray-500">
          Tip: press <kbd className="px-1 py-0.5 bg-gray-700 rounded">Ctrl</kbd>+
          <kbd className="px-1 py-0.5 bg-gray-700 rounded">Enter</kbd> to submit
        </p>

        {noMore && (
          <div className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-lg text-center">
            <p className="text-lg font-semibold">🎉 Queue cleared</p>
            <p className="text-sm text-gray-400 mt-1">
              No more recordings waiting in your languages.
              {doneCount > 0 && ` You did ${doneCount} this session.`}
            </p>
            <button
              onClick={() => router.push(`/${locale}/transcriber/v2`)}
              className="mt-3 px-5 py-2 bg-green-600 rounded-lg hover:bg-green-700"
            >
              Back to dashboard
            </button>
          </div>
        )}

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

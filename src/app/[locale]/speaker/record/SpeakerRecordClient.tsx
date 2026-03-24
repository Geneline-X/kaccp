"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken } from "@/lib/infra/client/client";
import toWav from "audiobuffer-to-wav";
import { useTranslations } from "next-intl";
import { formatDuration } from "@/lib/utils/format";

interface Prompt {
  id: string;
  englishText: string;
  category: string;
  emotion: string;
  instruction?: string;
  hint?: string;
  targetDurationSec: number;
  language: {
    code: string;
    name: string;
  };
}

const MIN_DURATION_SEC = 1.0;
const MAX_DURATION_SEC = 20;

// ─── Amplitude Visualizer ──────────────────────────────────────────────────

function AmplitudeBar({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 32;
      const barWidth = canvas.width / barCount;
      const step = Math.floor(dataArray.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        const barHeight = value * canvas.height;
        const x = i * barWidth;

        ctx.fillStyle = value > 0.7 ? "#ef4444" : value > 0.4 ? "#3b82f6" : "#6366f1";
        ctx.fillRect(x + 1, canvas.height - barHeight, barWidth - 2, barHeight);
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={48}
      className="w-full h-12 rounded-lg opacity-80"
    />
  );
}

// ─── Toast Notification ─────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      }`}
    >
      <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm">
        {message}
      </div>
    </div>
  );
}

// ─── Main Record Content ────────────────────────────────────────────────────

function RecordContent({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations();
  const searchParams = useSearchParams();
  const languageId = searchParams.get("languageId");

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [recordingCount, setRecordingCount] = useState(0);
  const [sessionDurationSec, setSessionDurationSec] = useState(0);
  const [canRetry, setCanRetry] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // Refs for keyboard handler to read current state without stale closures
  const recordingRef = useRef(false);
  const audioBlobRef = useRef<Blob | null>(null);
  const submittingRef = useRef(false);
  const durationRef = useRef(0);

  const currentPrompt = prompts[currentPromptIndex];

  // Keep refs in sync with state
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { audioBlobRef.current = audioBlob; }, [audioBlob]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // Show toast briefly
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  // Convert audio blob to WAV format
  const convertToWav = useCallback(async (blob: Blob): Promise<Blob> => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }
      const audioContext = audioContextRef.current;
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const wavBuffer = toWav(audioBuffer);
      return new Blob([wavBuffer], { type: "audio/wav" });
    } catch (err) {
      console.error("Failed to convert to WAV:", err);
      return blob;
    }
  }, []);

  // Acquire mic stream once, reuse across recordings
  const ensureStream = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current && streamRef.current.active) {
      return streamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    streamRef.current = stream;

    // Set up analyser for amplitude visualizer
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    }
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const node = audioContextRef.current.createAnalyser();
    node.fftSize = 256;
    source.connect(node);
    analyserRef.current = node;

    return stream;
  }, []);

  // Release mic on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Fetch prompts
  useEffect(() => {
    if (!languageId) {
      router.push("/speaker");
      return;
    }

    const token = getToken();
    if (!token) {
      router.push(`/${locale}/speaker/login`);
      return;
    }

    fetch(`/api/v2/speaker/prompts?languageId=${languageId}&limit=20&uiLocale=${locale}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setPrompts(data.prompts || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(t('speaker.failedToLoadPrompts'));
        setLoading(false);
      });
  }, [languageId, router, t, locale]);

  // Advance to next prompt (shared helper)
  const advanceToNextPrompt = useCallback(() => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setCanRetry(false);

    if (currentPromptIndex < prompts.length - 1) {
      setCurrentPromptIndex((i) => i + 1);
    } else {
      // Fetch more prompts
      const token = getToken();
      setLoading(true);
      fetch(`/api/v2/speaker/prompts?languageId=${languageId}&limit=20&uiLocale=${locale}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.prompts?.length > 0) {
            setPrompts(data.prompts);
            setCurrentPromptIndex(0);
          } else {
            // No more prompts — auto-redirect after a moment
            setError(t('speaker.noMorePrompts'));
            setTimeout(() => router.push(`/${locale}/speaker`), 3000);
          }
          setLoading(false);
        });
    }
  }, [currentPromptIndex, prompts.length, languageId, locale, router, t]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setCanRetry(false);
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);

      const stream = await ensureStream();
      setAnalyser(analyserRef.current);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAnalyser(null);
      };

      mediaRecorder.start(100);
      setRecording(true);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        if (elapsed >= MAX_DURATION_SEC) {
          // Auto-stop: directly stop the MediaRecorder to avoid stale closure
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
            setRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
          }
        }
      }, 100);
    } catch {
      setError(t('speaker.microphoneAccessDenied'));
    }
  }, [t, ensureStream]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      // Enforce minimum duration
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      if (elapsed < MIN_DURATION_SEC) {
        return; // Ignore — too short
      }
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, []);

  // Submit recording
  const submitRecording = useCallback(async () => {
    if (!audioBlob || !currentPrompt) return;

    setSubmitting(true);
    setError(null);
    setCanRetry(false);

    try {
      const token = getToken();

      // Convert WAV + get upload URL in parallel
      setStatus(t('speaker.convertingToWav'));
      const [wavBlob, uploadUrlRes] = await Promise.all([
        convertToWav(audioBlob),
        fetch("/api/v2/speaker/upload-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            promptId: currentPrompt.id,
            languageId: languageId,
            contentType: "audio/wav",
          }),
        }),
      ]);
      setStatus(null);

      const uploadUrlData = await uploadUrlRes.json();
      if (uploadUrlData.error) {
        throw new Error(uploadUrlData.error);
      }

      // Upload WAV audio to GCS
      const uploadRes = await fetch(uploadUrlData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/wav" },
        body: wavBlob,
      });

      if (!uploadRes.ok && uploadUrlData.mode === "gcs") {
        const errorText = await uploadRes.text();
        console.error("GCS upload failed:", errorText);
        throw new Error(t('speaker.failedToUpload'));
      }

      // Create recording record
      const recordingRes = await fetch("/api/v2/speaker/recordings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptId: currentPrompt.id,
          languageId: languageId,
          audioUrl: uploadUrlData.audioUrl,
          durationSec: duration,
          fileSize: wavBlob.size,
          sampleRate: 48000,
          deviceInfo: navigator.userAgent,
        }),
      });

      const recordingData = await recordingRes.json();
      if (recordingData.error) {
        throw new Error(recordingData.error);
      }

      // Success — update counts and immediately advance
      setRecordingCount((c) => c + 1);
      setSessionDurationSec((s) => s + duration);
      showToast(t('speaker.recordingSubmitted'));
      advanceToNextPrompt();
    } catch (err: any) {
      setError(err.message || t('speaker.failedToSubmitRecording'));
      setCanRetry(true); // Allow retry with existing blob
    } finally {
      setSubmitting(false);
    }
  }, [audioBlob, currentPrompt, duration, languageId, t, convertToWav, showToast, advanceToNextPrompt]);

  // Skip prompt — persist skip so they never see it again
  const skipPrompt = useCallback(() => {
    if (currentPrompt) {
      const token = getToken();
      fetch("/api/v2/speaker/prompts/skip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ promptId: currentPrompt.id }),
      }).catch(() => {}); // fire-and-forget
    }
    advanceToNextPrompt();
  }, [advanceToNextPrompt, currentPrompt]);

  // Re-record
  const reRecord = useCallback(() => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setCanRetry(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (audioBlobRef.current && !submittingRef.current) {
          // Has a recording ready — submit it
          submitRecording();
        } else if (recordingRef.current) {
          // Currently recording — stop
          stopRecording();
        } else if (!audioBlobRef.current) {
          // Idle — start recording
          startRecording();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [startRecording, stopRecording, submitRecording]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (prompts.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">{t('speaker.noPromptsAvailable')}</h2>
          <p className="text-gray-400 mb-6">
            {t('speaker.noPromptsForLanguage')}
          </p>
          <button
            onClick={() => router.push(`/${locale}/speaker`)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('speaker.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  if (error && prompts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4 text-red-500">{t('speaker.errorLoadingPrompts')}</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/${locale}/speaker`)}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            {t('speaker.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Toast */}
      <Toast message={toast || ""} visible={!!toast} />

      {/* Header */}
      <header className="bg-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button
            onClick={() => {
              streamRef.current?.getTracks().forEach((t) => t.stop());
              router.push(`/${locale}/speaker`);
            }}
            className="text-gray-400 hover:text-white"
          >
            ← {t('common.back')}
          </button>
          <div className="text-center">
            <span className="text-sm text-gray-400">
              {currentPrompt?.language?.name || t('speaker.universal')}
            </span>
            <span className="mx-2 text-gray-600">|</span>
            <span className="text-sm text-green-400">
              {recordingCount} clips / {formatDuration(sessionDurationSec)}
            </span>
          </div>
          <span className="text-sm text-gray-400">
            {currentPromptIndex + 1} / {prompts.length}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-3">
        {/* Error / status banners */}
        {error && (
          <div className="mb-3 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm flex items-center justify-between">
            <span>{error}</span>
            {canRetry && (
              <button
                onClick={submitRecording}
                disabled={submitting}
                className="ml-4 px-3 py-1 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
              >
                {submitting ? t('speaker.submitting') : t('speaker.retry')}
              </button>
            )}
          </div>
        )}
        {status && (
          <div className="mb-3 p-3 bg-blue-900/50 border border-blue-500 rounded-lg text-blue-200 text-sm flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-200"></div>
            {status}
          </div>
        )}

        {/* Single card: Prompt + Controls */}
        <div className="bg-gray-800 rounded-2xl px-5 py-4 flex flex-col">

          {/* Prompt section */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded-full text-xs">
                {currentPrompt?.category.replace(/_/g, " ")}
              </span>
              <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 rounded-full text-xs">
                {currentPrompt?.emotion}
              </span>
            </div>

            <p className="text-xs text-gray-400 mb-1">{t('speaker.sayThisInYourLanguage')}:</p>
            <h2 className="text-xl md:text-2xl font-bold leading-snug">{currentPrompt?.englishText}</h2>

            {/* Hint — helps speakers who struggle to translate */}
            {currentPrompt?.hint?.trim() && (
              <div className="mt-2 px-3 py-2 bg-blue-900/30 border border-blue-700/40 rounded-lg">
                <p className="text-xs text-blue-300">💡 {currentPrompt.hint}</p>
              </div>
            )}

            {currentPrompt?.instruction?.trim() && (
              <p className="text-xs text-yellow-400 italic mt-1">
                {currentPrompt.instruction}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 my-2"></div>

          {/* Controls */}
          <div className="flex flex-col items-center">
            {/* Timer + progress bar inline */}
            <div className="flex items-center gap-3 mb-3 w-full">
              <span className="text-3xl font-mono font-bold tabular-nums w-20 text-center flex-shrink-0">
                {duration.toFixed(1)}s
              </span>
              <div className="flex-1">
                <div className="w-full bg-gray-700 rounded-full h-2 relative">
                  <div
                    className="absolute top-0 h-2 w-0.5 bg-yellow-500/60"
                    style={{ left: `${(MIN_DURATION_SEC / MAX_DURATION_SEC) * 100}%` }}
                  ></div>
                  <div
                    className={`h-2 rounded-full transition-all ${
                      duration >= MAX_DURATION_SEC ? "bg-red-500" : duration < MIN_DURATION_SEC ? "bg-yellow-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min((duration / MAX_DURATION_SEC) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {recording && duration < MIN_DURATION_SEC ? (
                    <span className="text-yellow-400">{t('speaker.tooShort')}</span>
                  ) : duration >= MAX_DURATION_SEC ? (
                    <span className="text-red-400">{t('speaker.maximumReached')}</span>
                  ) : (
                    <span>{t('speaker.maxSeconds', { seconds: MAX_DURATION_SEC })}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Amplitude visualizer */}
            {recording && (
              <div className="mb-3 w-full">
                <AmplitudeBar analyser={analyser} />
              </div>
            )}

            {/* Record Button */}
            {!audioBlob && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={recording ? stopRecording : startRecording}
                  className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all ${
                    recording
                      ? duration < MIN_DURATION_SEC
                        ? "bg-yellow-600 animate-pulse cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700 animate-pulse"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {recording ? (
                    <div className="w-7 h-7 bg-white rounded-sm"></div>
                  ) : (
                    <div className="w-7 h-7 bg-white rounded-full"></div>
                  )}
                </button>
                <span className="text-xs text-gray-500">
                  {recording ? t('speaker.pressSpaceToStop') : t('speaker.pressSpaceToRecord')}
                </span>
              </div>
            )}

            {/* Playback & Submit */}
            {audioBlob && audioUrl && (
              <div className="space-y-4">
                <audio src={audioUrl} controls className="w-full h-10" />
                <div className="flex justify-center gap-3">
                  <button
                    onClick={reRecord}
                    className="px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                  >
                    {t('speaker.reRecord')}
                  </button>
                  <button
                    onClick={submitRecording}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {submitting ? t('speaker.submitting') : t('common.submit')}
                  </button>
                </div>
                <p className="text-center text-xs text-gray-500">
                  {t('speaker.pressSpaceToSubmit')}
                </p>
              </div>
            )}

            {/* Skip Button */}
            {!recording && !audioBlob && (
              <div className="text-center mt-3">
                <button
                  onClick={skipPrompt}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  {t('speaker.skipPrompt')}
                </button>
              </div>
            )}
          </div>
        </div>{/* end single card */}

        {/* Tips — desktop only */}
        <div className="mt-4 p-4 bg-gray-800/50 rounded-lg hidden md:block">
          <h3 className="font-semibold mb-2">{t('speaker.recordingTips')}:</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• {t('speaker.tip1')}</li>
            <li>• {t('speaker.tip2')}</li>
            <li>• {t('speaker.tip3')}</li>
            <li>• {t('speaker.tip4')}</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default function SpeakerRecordClient({ locale }: { locale: string }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    }>
      <RecordContent locale={locale} />
    </Suspense>
  )
}

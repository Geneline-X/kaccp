"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken } from "@/lib/client";

interface Prompt {
  id: string;
  englishText: string;
  category: string;
  emotion: string;
  instruction?: string;
  targetDurationSec: number;
  language: {
    code: string;
    name: string;
  };
}

export default function RecordPage() {
  const router = useRouter();
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
  const [success, setSuccess] = useState<string | null>(null);
  const [recordingCount, setRecordingCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const currentPrompt = prompts[currentPromptIndex];

  // Fetch prompts
  useEffect(() => {
    if (!languageId) {
      router.push("/speaker");
      return;
    }

    const token = getToken();
    if (!token) {
      router.push("/speaker/login");
      return;
    }

    fetch(`/api/v2/speaker/prompts?languageId=${languageId}&limit=20`, {
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
      .catch((err) => {
        setError("Failed to load prompts");
        setLoading(false);
      });
  }, [languageId, router]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

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
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setRecording(true);
      startTimeRef.current = Date.now();

      // Update duration every 100ms
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        // Auto-stop at 10 seconds
        if (elapsed >= 10) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      setError("Could not access microphone. Please allow microphone access.");
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [recording]);

  // Submit recording
  const submitRecording = async () => {
    if (!audioBlob || !currentPrompt) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = getToken();

      // 1. Get upload URL
      const uploadUrlRes = await fetch("/api/v2/speaker/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptId: currentPrompt.id,
          contentType: audioBlob.type,
        }),
      });

      const uploadUrlData = await uploadUrlRes.json();
      if (uploadUrlData.error) {
        throw new Error(uploadUrlData.error);
      }

      // 2. Upload to GCS
      await fetch(uploadUrlData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": audioBlob.type,
        },
        body: audioBlob,
      });

      // 3. Create recording record
      const recordingRes = await fetch("/api/v2/speaker/recordings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptId: currentPrompt.id,
          audioUrl: uploadUrlData.audioUrl,
          durationSec: duration,
          fileSize: audioBlob.size,
          sampleRate: 48000,
          deviceInfo: navigator.userAgent,
        }),
      });

      const recordingData = await recordingRes.json();
      if (recordingData.error) {
        throw new Error(recordingData.error);
      }

      setSuccess("Recording submitted successfully!");
      setRecordingCount((c) => c + 1);

      // Move to next prompt after 1 second
      setTimeout(() => {
        setSuccess(null);
        setAudioBlob(null);
        setAudioUrl(null);
        setDuration(0);
        if (currentPromptIndex < prompts.length - 1) {
          setCurrentPromptIndex((i) => i + 1);
        } else {
          // Fetch more prompts
          setLoading(true);
          fetch(`/api/v2/speaker/prompts?languageId=${languageId}&limit=20`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.prompts?.length > 0) {
                setPrompts(data.prompts);
                setCurrentPromptIndex(0);
              } else {
                setError("No more prompts available. Great job!");
              }
              setLoading(false);
            });
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to submit recording");
    } finally {
      setSubmitting(false);
    }
  };

  // Skip prompt
  const skipPrompt = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    if (currentPromptIndex < prompts.length - 1) {
      setCurrentPromptIndex((i) => i + 1);
    }
  };

  // Re-record
  const reRecord = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">No Prompts Available</h2>
          <p className="text-gray-400 mb-6">
            There are no prompts available for this language yet.
          </p>
          <button
            onClick={() => router.push("/speaker")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
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
            onClick={() => router.push("/speaker")}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <div className="text-center">
            <span className="text-sm text-gray-400">
              {currentPrompt?.language.name}
            </span>
            <span className="mx-2 text-gray-600">|</span>
            <span className="text-sm text-green-400">
              {recordingCount} recorded this session
            </span>
          </div>
          <span className="text-sm text-gray-400">
            {currentPromptIndex + 1} / {prompts.length}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-200">
            {success}
          </div>
        )}

        {/* Prompt Card */}
        <div className="bg-gray-800 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm">
              {currentPrompt?.category.replace(/_/g, " ")}
            </span>
            <span className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-sm">
              {currentPrompt?.emotion}
            </span>
          </div>

          <p className="text-sm text-gray-400 mb-2">Say this in your language:</p>
          <h2 className="text-3xl font-bold mb-4">{currentPrompt?.englishText}</h2>

          {currentPrompt?.instruction && (
            <p className="text-sm text-yellow-400 italic">
              💡 {currentPrompt.instruction}
            </p>
          )}
        </div>

        {/* Recording Controls */}
        <div className="bg-gray-800 rounded-2xl p-8">
          {/* Duration Display */}
          <div className="text-center mb-8">
            <div className="text-6xl font-mono font-bold">
              {duration.toFixed(1)}s
            </div>
            <div className="text-gray-400 mt-2">
              {duration >= 10 ? (
                <span className="text-red-400">Maximum reached</span>
              ) : (
                <span>Max 10 seconds</span>
              )}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-700 rounded-full h-2 mt-4">
              <div
                className={`h-2 rounded-full transition-all ${
                  duration >= 10 ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{ width: `${Math.min((duration / 10) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Record Button */}
          {!audioBlob && (
            <div className="flex justify-center">
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  recording
                    ? "bg-red-600 hover:bg-red-700 animate-pulse"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {recording ? (
                  <div className="w-8 h-8 bg-white rounded-sm"></div>
                ) : (
                  <div className="w-8 h-8 bg-white rounded-full"></div>
                )}
              </button>
            </div>
          )}

          {/* Playback & Submit */}
          {audioBlob && audioUrl && (
            <div className="space-y-6">
              <audio src={audioUrl} controls className="w-full" />

              <div className="flex justify-center gap-4">
                <button
                  onClick={reRecord}
                  className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  Re-record
                </button>
                <button
                  onClick={submitRecording}
                  disabled={submitting}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          )}

          {/* Skip Button */}
          {!recording && !audioBlob && (
            <div className="text-center mt-6">
              <button
                onClick={skipPrompt}
                className="text-gray-400 hover:text-white text-sm"
              >
                Skip this prompt →
              </button>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
          <h3 className="font-semibold mb-2">Recording Tips:</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Find a quiet place with minimal background noise</li>
            <li>• Speak clearly and naturally</li>
            <li>• Keep recordings between 3-10 seconds</li>
            <li>• Avoid long pauses between words</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

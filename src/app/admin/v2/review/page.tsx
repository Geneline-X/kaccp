"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";

interface Transcription {
  id: string;
  text: string;
  status: string;
  submittedAt: string;
  recording: {
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
    };
    language: {
      code: string;
      name: string;
    };
    speaker: {
      id: string;
      displayName: string;
    };
  };
  transcriber: {
    id: string;
    displayName: string;
    qualityScore: number;
  };
}

interface User {
  id: string;
  role: string;
  displayName?: string;
}

export default function AdminReviewPage() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTranscription, setSelectedTranscription] = useState<Transcription | null>(null);
  const [editedText, setEditedText] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingAction, setSubmittingAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const token = typeof window !== "undefined" ? getToken() : null;

  // Fetch user and check role
  useEffect(() => {
    if (!token) {
      router.push("/reviewer/login");
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push("/reviewer/login");
          return;
        }
        // Only ADMIN and REVIEWER can access this page
        if (data.user.role !== "ADMIN" && data.user.role !== "REVIEWER") {
          router.push("/");
          return;
        }
        setUser(data.user);
      });
  }, [token, router]);

  // Fetch transcriptions pending review
  useEffect(() => {
    if (!token || !user) return;

    setLoading(true);
    fetch(`/api/v2/admin/review?status=PENDING_REVIEW&page=${pagination.page}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          if (data.error === "Unauthorized") {
            router.push("/reviewer/login");
          }
          return;
        }
        setTranscriptions(data.transcriptions || []);
        setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
        setLoading(false);
      });
  }, [token, router, user, pagination.page]);

  // Fetch signed audio URL when transcription is selected
  useEffect(() => {
    if (!selectedTranscription || !token) {
      setSignedAudioUrl(null);
      return;
    }

    // Fetch signed URL for audio playback
    fetch(`/api/v2/audio/${selectedTranscription.recording.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.signedUrl) {
          setSignedAudioUrl(data.signedUrl);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch audio URL:", err);
      });
  }, [selectedTranscription, token]);

  // Handle review decision
  const handleReview = async (decision: "APPROVED" | "REJECTED") => {
    if (!selectedTranscription) return;

    setSubmittingAction(decision);
    try {
      const res = await fetch("/api/v2/admin/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transcriptionId: selectedTranscription.id,
          decision,
          reviewNotes: reviewNotes || undefined,
          editedText: editedText !== selectedTranscription.text ? editedText : undefined,
        }),
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      // Remove from list and select next
      const newList = transcriptions.filter((t) => t.id !== selectedTranscription.id);
      setTranscriptions(newList);
      setSelectedTranscription(newList[0] || null);
      setEditedText(newList[0]?.text || "");
      setReviewNotes("");
    } catch {
      alert("Failed to submit review");
    } finally {
      setSubmittingAction(null);
    }
  };

  // Select transcription
  const selectTranscription = (t: Transcription) => {
    setSelectedTranscription(t);
    setEditedText(t.text);
    setReviewNotes("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/admin/v2" className="text-blue-600 hover:underline text-sm">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                Review Transcriptions
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              {pagination.total} pending review
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {transcriptions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">All caught up!</h2>
            <p className="text-gray-500">No transcriptions pending review.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Pending Review</h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-[70vh] overflow-y-auto">
                {transcriptions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTranscription(t)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedTranscription?.id === t.id ? "bg-blue-50" : ""
                      }`}
                  >
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {t.recording.prompt.englishText}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t.recording.language.name} • {t.recording.durationSec.toFixed(1)}s
                    </div>
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      &quot;{t.text}&quot;
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Review Panel */}
            <div className="lg:col-span-2">
              {selectedTranscription ? (
                <div className="bg-white rounded-lg shadow">
                  {/* Prompt Info */}
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {selectedTranscription.recording.prompt.category.replace(/_/g, " ")}
                      </span>
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                        {selectedTranscription.recording.prompt.emotion}
                      </span>
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                        {selectedTranscription.recording.language.name}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {selectedTranscription.recording.prompt.englishText}
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">
                      Speaker: {selectedTranscription.recording.speaker.displayName || "Anonymous"} •
                      Transcriber: {selectedTranscription.transcriber.displayName || "Anonymous"}
                      (Score: {selectedTranscription.transcriber.qualityScore.toFixed(1)})
                    </p>
                  </div>

                  {/* Audio Player */}
                  <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recording ({selectedTranscription.recording.durationSec.toFixed(1)}s)
                    </label>
                    {signedAudioUrl ? (
                      <audio
                        ref={audioRef}
                        controls
                        className="w-full"
                        src={signedAudioUrl}
                        key={signedAudioUrl}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-12 bg-gray-200 rounded-lg">
                        <span className="text-sm text-gray-500">Loading audio...</span>
                      </div>
                    )}
                  </div>

                  {/* Transcription */}
                  <div className="p-6 border-b border-gray-200">
                    {/* Kay X Auto-Transcript (Krio) */}
                    {selectedTranscription.recording.autoTranscriptionStatus === "COMPLETED" && selectedTranscription.recording.transcript && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-blue-900">🤖 Kay X Krio Transcript</span>
                          {selectedTranscription.recording.transcriptConfidence && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                              {(selectedTranscription.recording.transcriptConfidence * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-900">
                          {selectedTranscription.recording.transcript}
                        </div>
                      </div>
                    )}
                    
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Human Transcription (edit if needed)
                    </label>
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {editedText !== selectedTranscription.text && (
                      <p className="text-xs text-orange-600 mt-1">
                        ⚠️ Text has been modified
                      </p>
                    )}
                  </div>

                  {/* Review Notes */}
                  <div className="p-6 border-b border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Review Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="Any feedback for the transcriber..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="p-6 flex justify-end gap-4">
                    <button
                      onClick={() => handleReview("REJECTED")}
                      disabled={submittingAction !== null}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {submittingAction === "REJECTED" && (
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                      )}
                      {submittingAction === "REJECTED" ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      onClick={() => handleReview("APPROVED")}
                      disabled={submittingAction !== null}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {submittingAction === "APPROVED" && (
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                      )}
                      {submittingAction === "APPROVED" ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <p className="text-gray-500">Select a transcription to review</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

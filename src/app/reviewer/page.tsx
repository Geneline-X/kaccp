"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken } from "@/lib/client";
import { useTranslations } from "next-intl";

interface Transcription {
  id: string;
  text: string;
  status: string;
  submittedAt: string;
  recording: {
    id: string;
    audioUrl: string;
    durationSec: number;
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
  email: string;
}

interface Stats {
  pendingReview: number;
  reviewedToday: number;
  totalReviewed: number;
}

export default function ReviewerDashboard() {
  const router = useRouter();
  const t = useTranslations();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTranscription, setSelectedTranscription] = useState<Transcription | null>(null);
  const [editedText, setEditedText] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingAction, setSubmittingAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ pendingReview: 0, reviewedToday: 0, totalReviewed: 0 });

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
        setStats((prev) => ({ ...prev, pendingReview: data.pagination?.total || 0 }));
        setLoading(false);
      });
  }, [token, router, user, pagination.page]);

  // Fetch signed audio URL when transcription is selected
  useEffect(() => {
    if (!selectedTranscription || !token) {
      setSignedAudioUrl(null);
      return;
    }

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

      // Update stats
      setStats((prev) => ({
        ...prev,
        pendingReview: prev.pendingReview - 1,
        reviewedToday: prev.reviewedToday + 1,
        totalReviewed: prev.totalReviewed + 1,
      }));

      // Remove from list and select next
      const newList = transcriptions.filter((t) => t.id !== selectedTranscription.id);
      setTranscriptions(newList);
      setSelectedTranscription(newList[0] || null);
      setEditedText(newList[0]?.text || "");
      setReviewNotes("");
      setSignedAudioUrl(null);
    } catch {
      alert(t('reviewer.failedToSubmitReview'));
    } finally {
      setSubmittingAction(null);
    }
  };

  // Select transcription
  const selectTranscription = (t: Transcription) => {
    setSelectedTranscription(t);
    setEditedText(t.text);
    setReviewNotes("");
    setSignedAudioUrl(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('reviewer.dashboard')}</h1>
              <p className="text-sm text-gray-500">
                {t('reviewer.welcome')} {user?.displayName || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {stats.pendingReview} {t('reviewer.pending')}
              </div>
              <button
                onClick={() => {
                  clearToken();
                  router.push("/reviewer/login");
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t('common.logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('reviewer.pendingReview')}</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.pendingReview}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('reviewer.reviewedToday')}</h3>
            <p className="text-3xl font-bold text-green-600">{stats.reviewedToday}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('reviewer.totalReviewed')}</h3>
            <p className="text-3xl font-bold text-gray-900">{stats.totalReviewed}</p>
          </div>
        </div>

        {transcriptions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('reviewer.allCaughtUp')}</h2>
            <p className="text-gray-500">{t('reviewer.noPending')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-purple-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">{t('reviewer.pendingReview')}</h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-[70vh] overflow-y-auto">
                {transcriptions.map((transcription) => (
                  <button
                    key={transcription.id}
                    onClick={() => selectTranscription(transcription)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedTranscription?.id === transcription.id ? "bg-purple-50" : ""
                      }`}
                  >
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {transcription.recording.prompt.englishText}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {transcription.recording.language.name} • {transcription.recording.durationSec.toFixed(1)}s
                    </div>
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      &quot;{transcription.text}&quot;
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
                      {t('reviewer.speaker')}: {selectedTranscription.recording.speaker.displayName || t('reviewer.anonymous')} •
                      {t('reviewer.transcriber')}: {selectedTranscription.transcriber.displayName || t('reviewer.anonymous')}
                      ({t('reviewer.score')}: {selectedTranscription.transcriber.qualityScore.toFixed(1)})
                    </p>
                  </div>

                  {/* Audio Player */}
                  <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('reviewer.recording')} ({selectedTranscription.recording.durationSec.toFixed(1)}s)
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
                        <span className="text-sm text-gray-500">{t('reviewer.loadingAudio')}</span>
                      </div>
                    )}
                  </div>

                  {/* Transcription */}
                  <div className="p-6 border-b border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('reviewer.transcriptionEdit')}
                    </label>
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {editedText !== selectedTranscription.text && (
                      <p className="text-xs text-orange-600 mt-1">
                        ⚠️ {t('reviewer.textModified')}
                      </p>
                    )}
                  </div>

                  {/* Review Notes */}
                  <div className="p-6 border-b border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('reviewer.reviewNotes')}
                    </label>
                    <input
                      type="text"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder={t('reviewer.feedbackPlaceholder')}
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
                      {submittingAction === "REJECTED" ? t('reviewer.rejecting') : t('reviewer.reject')}
                    </button>
                    <button
                      onClick={() => handleReview("APPROVED")}
                      disabled={submittingAction !== null}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {submittingAction === "APPROVED" && (
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                      )}
                      {submittingAction === "APPROVED" ? t('reviewer.approving') : t('reviewer.approve')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <p className="text-gray-500">{t('reviewer.selectToReview')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/infra/client/client";
import { useTranslations } from "next-intl";
import { ProgressPanel } from "@/components/gamification/ProgressPanel";

interface Recording {
  id: string;
  audioUrl: string;
  durationSec: number;
  estimatedCents?: number;
  prompt: {
    englishText: string;
    category: string;
    emotion: string;
  };
  language: {
    code: string;
    name: string;
    transcriberRatePerMin: number;
  };
  speaker: {
    displayName: string;
  };
}

interface Assignment {
  assignment: {
    id: string;
    expiresAt: string;
  };
  recording: Recording;
  minutesRemaining: number;
}

interface Stats {
  total: number;
  byStatus: { status: string; _count: number }[];
  totalSecondsTranscribed?: number;
  pipeline?: { total: number; approved: number; pending: number };
}

interface RecentTranscription {
  id: string;
  text: string;
  status: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  kind?: "transcription" | "reviewQueue";
  audioPath?: string;
  recording: {
    id: string;
    audioUrl: string;
    durationSec: number;
    prompt: { englishText: string };
    language: { name: string };
  };
}



export default function TranscriberV2DashboardClient({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations();
  const [user, setUser] = useState<any>(null);
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [availableRecordings, setAvailableRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedbackItems, setFeedbackItems] = useState<RecentTranscription[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<RecentTranscription | null>(null);
  const [feedbackAudioUrl, setFeedbackAudioUrl] = useState<string | null>(null);
  const [feedbackAudioLoading, setFeedbackAudioLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [languages, setLanguages] = useState<{ id: string; code: string; name: string }[]>([]);
  const [languageFilter, setLanguageFilter] = useState("");
  const limit = 10;

  // The queue is far larger than one page. Track the server's total so the badge
  // reports the real backlog instead of however many rows this page happens to hold.

  // English translation queue: free-form clips that have Krio text but no English,
  // because their prompt was an instruction rather than a sentence to translate.

  // Bumped after any submission so the progress panel refetches and can fire the
  // milestone / level-up celebration straight away.
  const [progressSignal] = useState(0);
  // Supplied by ProgressPanel from the profile payload it already fetches.
  const [queueCounts, setQueueCounts] = useState<{ english: number; pipeline: number } | null>(null);

  const token = typeof window !== "undefined" ? getToken() : null;

  const loadData = () => {
    if (!token) {
      router.push(`/${locale}/transcriber/login`);
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push(`/${locale}/transcriber/login`);
          return;
        }
        setUser(data.user);
      });

    fetch("/api/v2/transcriber/my-work", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setActiveAssignments(data.activeAssignments || []);
        setStats(data.stats || null);
        setFeedbackItems(data.feedback || []);
      });

    fetch("/api/v2/languages?activeOnly=true", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setLanguages((data.languages || []).map((l: any) => ({ id: l.id, code: l.code, name: l.name })));
      });

    const availableParams = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) });
    if (languageFilter) availableParams.set("languageId", languageFilter);

    fetch(`/api/v2/transcriber/available?${availableParams}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setAvailableRecordings(data.recordings || []);
        setTotalAvailable(data.totalAvailable || 0);
        setLoading(false);
      });
  };


  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, languageFilter]);









  const releaseAssignment = async (recordingId: string) => {
    setReleasingId(recordingId);
    try {
      const res = await fetch("/api/v2/transcriber/release", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recordingId }),
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      loadData();
    } catch {
      alert(t('transcriber.failedToRelease'));
    } finally {
      setReleasingId(null);
    }
  };

  const claimRecording = async (recordingId: string) => {
    setClaimingId(recordingId);
    try {
      const res = await fetch("/api/v2/transcriber/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recordingId }),
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      router.push(`/${locale}/transcriber/v2/task/${recordingId}`);
    } catch {
      alert(t('transcriber.failedToClaim'));
    } finally {
      setClaimingId(null);
    }
  };


  const selectFeedbackItem = async (tr: RecentTranscription) => {
    setSelectedFeedback(tr);
    setFeedbackAudioUrl(null);
    if (!token) return;
    setFeedbackAudioLoading(true);
    try {
      if (tr.kind === "reviewQueue" && tr.audioPath) {
        // Pipeline items are served by the pipeline audio endpoint (GCS path).
        const res = await fetch(`/api/v2/pipeline/audio?path=${encodeURIComponent(tr.audioPath)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.signedUrl || data.url) {
          setFeedbackAudioUrl(data.signedUrl || data.url);
        }
      } else {
        const res = await fetch(`/api/v2/audio/${tr.recording.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.signedUrl || data.url) {
          setFeedbackAudioUrl(data.signedUrl || data.url);
        }
      }
    } catch {
      // ignore audio load errors — notes still shown
    } finally {
      setFeedbackAudioLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Cards combine classic claim-flow transcriptions with pipeline review work.
  const classicApproved = stats?.byStatus.find((s) => s.status === "APPROVED")?._count || 0;
  const classicPending = stats?.byStatus.find((s) => s.status === "PENDING_REVIEW")?._count || 0;
  const totalTranscriptionsCount = (stats?.total || 0) + (stats?.pipeline?.total || 0);
  const approvedCount = classicApproved + (stats?.pipeline?.approved || 0);
  const pendingCount = classicPending + (stats?.pipeline?.pending || 0);
  const totalMinutes = (stats?.totalSecondsTranscribed || 0) / 60;

  const rejectedFeedbacks = feedbackItems;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('transcriber.dashboard')}
              </h1>
              <p className="text-sm text-gray-500">
                {t('transcriber.welcomeBack')} {user?.displayName || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/${locale}/transcriber/leaderboard`}
                className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-colors font-medium"
              >
                🏆 Leaderboard
              </Link>
              {user?.roles?.includes("SPEAKER") && (
                <Link
                  href={`/${locale}/speaker`}
                  className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  {t('transcriber.switchToSpeaker')}
                </Link>
              )}
              <button
                onClick={() => {
                  clearToken();
                  router.push(`/${locale}/transcriber/v2`);
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
        {/* Level, streak, daily goal and where you stand this week */}
        <ProgressPanel
          token={token}
          locale={locale}
          refreshSignal={progressSignal}
          onQueues={setQueueCounts}
        />

        {/* Earnings Card */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 mb-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-medium text-blue-100">{t('transcriber.totalEarnings')}</h3>
              <p className="text-4xl font-bold mt-1">
                Le{((user?.totalEarningsCents || 0) / 100).toFixed(2)}
              </p>
              <p className="text-sm text-blue-100 mt-2">
                {t('transcriber.fromApproved', { count: approvedCount })}
              </p>
              <p className="text-sm text-blue-100 mt-1">
                {t('transcriber.minutesTranscribed', { minutes: totalMinutes.toFixed(1) })}
              </p>
              <p className="text-xs text-blue-200 mt-1">
                {t('transcriber.rateNote')}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <p className="text-xs text-blue-100">{t('transcriber.pendingReview')}</p>
                <p className="text-lg font-semibold">
                  {pendingCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">
              {t('transcriber.totalTranscriptions')}
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {totalTranscriptionsCount}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('transcriber.approved')}</h3>
            <p className="text-3xl font-bold text-green-600">
              {approvedCount}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('transcriber.pendingReview')}</h3>
            <p className="text-3xl font-bold text-yellow-600">
              {pendingCount}
            </p>
          </div>
        </div>

        {/* Feedback notifications from language lead */}
        {rejectedFeedbacks.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200 bg-orange-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('transcriber.feedbackNotifications')}
                </h2>
                <p className="text-sm text-gray-500">
                  {t('transcriber.reviewerFeedbackNote')}
                </p>
              </div>
              <span className="px-3 py-1 text-sm bg-orange-100 text-orange-800 rounded-full font-medium">
                {rejectedFeedbacks.length} {t('transcriber.rejected')}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3">
              {/* List of rejected items */}
              <div className="lg:col-span-1 border-r border-gray-200 max-h-[420px] overflow-y-auto">
                {rejectedFeedbacks.map((tr) => (
                  <button
                    key={tr.id}
                    onClick={() => selectFeedbackItem(tr)}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selectedFeedback?.id === tr.id ? "bg-orange-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded font-medium">
                        REJECTED
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(tr.reviewedAt || tr.submittedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {tr.recording.prompt.englishText}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {tr.recording.language.name} • {tr.recording.durationSec.toFixed(1)}s
                    </p>
                    {tr.reviewNotes && (
                      <p className="text-xs text-orange-700 mt-1 truncate">
                        {tr.reviewNotes}
                      </p>
                    )}
                  </button>
                ))}
              </div>

              {/* Detail panel */}
              <div className="lg:col-span-2 p-6">
                {selectedFeedback ? (
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          {selectedFeedback.recording.prompt.englishText}
                        </p>
                        <p className="text-xs text-gray-400">
                          {selectedFeedback.recording.language.name} • {selectedFeedback.recording.durationSec.toFixed(1)}s
                        </p>
                      </div>
                      {selectedFeedback.kind !== "reviewQueue" ? (
                        <Link
                          href={`/${locale}/transcriber/v2/task/${selectedFeedback.recording.id}`}
                          className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 whitespace-nowrap"
                        >
                          {t('transcriber.fixAndResubmit')}
                        </Link>
                      ) : (
                        <Link
                          href={`/${locale}/transcriber/pipeline`}
                          className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 whitespace-nowrap"
                        >
                          {t('transcriber.fixAndResubmit')}
                        </Link>
                      )}
                    </div>

                    {/* Audio */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        {t('transcriber.listenToRecording')}
                      </p>
                      {feedbackAudioUrl ? (
                        <audio controls className="w-full" src={feedbackAudioUrl} key={feedbackAudioUrl} />
                      ) : (
                        <div className="flex items-center justify-center h-10 bg-gray-200 rounded-lg">
                          <span className="text-xs text-gray-500">
                            {feedbackAudioLoading ? t('transcriber.loadingAudio') : t('transcriber.loadingAudio')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Notes from language lead */}
                    <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs font-semibold text-orange-800 mb-1 uppercase tracking-wide">
                        {t('transcriber.languageLeadFeedback')}
                      </p>
                      <p className="text-sm text-orange-900">
                        {selectedFeedback.reviewNotes || t('transcriber.noFeedbackProvided')}
                      </p>
                    </div>

                    {/* Your previous submission */}
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        {t('transcriber.previousSubmission')}
                      </p>
                      <p className="text-sm text-gray-700 italic">“{selectedFeedback.text}”</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    {t('transcriber.selectFeedbackPrompt')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Active Assignments */}
        {activeAssignments.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('transcriber.activeAssignment')}
              </h2>
              <p className="text-sm text-gray-500">
                {t('transcriber.completeBefore')}
              </p>
            </div>
            <div className="p-6">
              {activeAssignments.map((item) => (
                <div
                  key={item.assignment.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.recording?.prompt.englishText}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.recording?.language.name} •{" "}
                      {item.recording?.durationSec.toFixed(1)}s
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-orange-600">
                      {t('transcriber.minRemaining', { minutes: item.minutesRemaining })}
                    </span>
                    <button
                      onClick={() => releaseAssignment(item.recording?.id)}
                      disabled={releasingId !== null}
                      className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      {releasingId === item.recording?.id ? t('transcriber.releasing') : t('transcriber.release')}
                    </button>
                    <Link
                      href={`/${locale}/transcriber/v2/task/${item.recording?.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {t('transcriber.continue')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other work queues live on their own pages: loading them here made a
            dashboard visit fetch them whether or not anyone used them. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Link
            href={`/${locale}/transcriber/english`}
            className="group bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow border-l-4 border-emerald-500"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  🌉 English Translation
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Clips with Krio written down but no English yet.
                </p>
              </div>
              {queueCounts && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-sm font-semibold shrink-0">
                  {queueCounts.english}
                </span>
              )}
            </div>
            <span className="inline-block mt-3 text-sm text-emerald-700 font-medium group-hover:underline">
              Open →
            </span>
          </Link>

          <Link
            href={`/${locale}/transcriber/pipeline`}
            className="group bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow border-l-4 border-purple-500"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  🎧 Pipeline Review
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Correct machine transcripts from real calls.
                </p>
              </div>
              {queueCounts && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm font-semibold shrink-0">
                  {queueCounts.pipeline}
                </span>
              )}
            </div>
            <span className="inline-block mt-3 text-sm text-purple-700 font-medium group-hover:underline">
              Open →
            </span>
          </Link>
        </div>

        {/* Available Recordings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('transcriber.availableRecordings')}
              </h2>
              <p className="text-sm text-gray-500">
                {t('transcriber.claimToStart')}
              </p>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('transcriber.filterByLanguage')}
              </label>
              <select
                value={languageFilter}
                onChange={(e) => {
                  setLanguageFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="">{t('transcriber.allLanguages')}</option>
                {languages.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name} ({lang.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {availableRecordings.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {t('transcriber.noRecordingsAvailable')}
              </div>
            ) : (
              availableRecordings.map((recording) => (
                <div
                  key={recording.id}
                  className="p-6 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {recording.prompt.category.replace(/_/g, " ")}
                      </span>
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                        {recording.language.name}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">
                      {recording.prompt.englishText}
                    </p>
                    <p className="text-sm text-gray-500">
                      {recording.durationSec.toFixed(1)}s ({(recording.durationSec / 60).toFixed(2)} min) •{" "}
                      Le{((recording.estimatedCents ?? 0) / 100).toFixed(2)} {t('transcriber.est')}
                    </p>
                  </div>
                  <button
                    onClick={() => claimRecording(recording.id)}
                    disabled={claimingId !== null || activeAssignments.length > 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {claimingId === recording.id ? (
                      <>
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                        {t('transcriber.claiming')}
                      </>
                    ) : (
                      t('transcriber.claim')
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalAvailable > limit && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {t('common.showing')} {((page - 1) * limit) + 1} - {Math.min(page * limit, totalAvailable)} {t('common.of')} {totalAvailable} {t('common.recordings')}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.previous')}
                </button>
                <span className="px-4 py-2 text-sm">
                  {t('common.page')} {page} {t('common.of')} {Math.ceil(totalAvailable / limit)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalAvailable / limit)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

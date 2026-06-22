"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/infra/client/client";
import { useTranslations } from "next-intl";

interface Recording {
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
}

interface ReviewItem {
  id: string;
  source: string;
  priorityTier: number;
  status: string;
  asrTranscript: string | null;
  correctedTranscript: string | null;
  secondTranscript: string | null;
  audioPath: string;
  extractedFields: any;
  disagreementFlag: boolean;
  audioSession: {
    audioDurationS: number;
    timestamp: string;
    detectedIntent: string | null;
    outcome: string | null;
  } | null;
  createdAt: string;
}

const TIER_LABELS: Record<number, string> = { 1: "Critical", 2: "Standard", 3: "Sample", 4: "Disagreement" };
const TIER_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-800", 2: "bg-yellow-100 text-yellow-800",
  3: "bg-gray-100 text-gray-600", 4: "bg-purple-100 text-purple-800",
};
const SOURCE_LABELS: Record<string, string> = {
  pilot: "Flot",
  kaccp_recording: "KACCP",
};
const SOURCE_COLORS: Record<string, string> = {
  pilot: "bg-green-100 text-green-700",
  kaccp_recording: "bg-blue-100 text-blue-700",
};

export default function TranscriberV2DashboardClient({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [user, setUser] = useState<any>(null);
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [availableRecordings, setAvailableRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const limit = 10;

  const [pipelineItems, setPipelineItems] = useState<ReviewItem[]>([]);
  const [pipelineSelected, setPipelineSelected] = useState<ReviewItem | null>(null);
  const [pipelineEditedText, setPipelineEditedText] = useState("");
  const [pipelineSubmitting, setPipelineSubmitting] = useState(false);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [pipelineFilterSource, setPipelineFilterSource] = useState("");
  const [pipelineSignedAudioUrl, setPipelineSignedAudioUrl] = useState<string | null>(null);
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null);
  const [pipelineExpanded, setPipelineExpanded] = useState(true);

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
      });

    fetch(`/api/v2/transcriber/available?limit=${limit}&offset=${(page - 1) * limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setAvailableRecordings(data.recordings || []);
        setTotalAvailable(data.totalAvailable || 0);
        setLoading(false);
      });
  };

  const loadPipelineData = () => {
    if (!token) return;
    const params = new URLSearchParams({ status: "pending", limit: "50" });
    if (pipelineFilterSource) params.set("source", pipelineFilterSource);
    fetch(`/api/v2/pipeline/review-queue?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        setPipelineItems(d.items || []);
        setPipelineLoading(false);
      })
      .catch(() => setPipelineLoading(false));
  };

  useEffect(() => {
    loadData();
    loadPipelineData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, pipelineFilterSource]);

  useEffect(() => {
    if (!pipelineSelected || !token || !pipelineSelected.audioPath) return;
    setPipelineSignedAudioUrl(null);
    fetch(`/api/v2/pipeline/audio?path=${encodeURIComponent(pipelineSelected.audioPath)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.signedUrl) setPipelineSignedAudioUrl(d.signedUrl); })
      .catch(() => {});
  }, [pipelineSelected, token]);

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

  const selectPipelineItem = (item: ReviewItem) => {
    setPipelineSelected(item);
    setPipelineEditedText(item.correctedTranscript || item.asrTranscript || "");
    setPipelineMessage(null);
  };

  const submitPipelineCorrection = async () => {
    if (!pipelineSelected || !pipelineEditedText.trim()) return;
    setPipelineSubmitting(true);
    setPipelineMessage(null);
    const isSecondPass = pipelineSelected.correctedTranscript !== null && pipelineSelected.secondTranscript === null;
    try {
      const res = await fetch(`/api/v2/pipeline/review-queue/${pipelineSelected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ correctedTranscript: pipelineEditedText.trim() }),
      });
      const data = await res.json();
      if (data.error) { setPipelineMessage(`Error: ${data.error}`); return; }
      const newList = pipelineItems.filter(i => i.id !== pipelineSelected.id);
      setPipelineItems(newList);
      setPipelineSelected(newList[0] || null);
      setPipelineEditedText(newList[0]?.correctedTranscript || newList[0]?.asrTranscript || "");
      setPipelineMessage(isSecondPass ? "Double verification submitted" : "Correction submitted");
    } catch { setPipelineMessage("Failed to submit"); }
    finally { setPipelineSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
              <h1 className="text-2xl font-bold text-gray-900">
                {t('transcriber.dashboard')}
              </h1>
              <p className="text-sm text-gray-500">
                {t('transcriber.welcomeBack')} {user?.displayName || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
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
        {/* Earnings Card */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 mb-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-medium text-blue-100">{t('transcriber.totalEarnings')}</h3>
              <p className="text-4xl font-bold mt-1">
                Le{((user?.totalEarningsCents || 0) / 100).toFixed(2)}
              </p>
              <p className="text-sm text-blue-100 mt-2">
                {t('transcriber.fromApproved', { count: stats?.byStatus.find((s) => s.status === "APPROVED")?._count || 0 })}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <p className="text-xs text-blue-100">{t('transcriber.pendingReview')}</p>
                <p className="text-lg font-semibold">
                  {stats?.byStatus.find((s) => s.status === "PENDING_REVIEW")?._count || 0}
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
              {stats?.total || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('transcriber.approved')}</h3>
            <p className="text-3xl font-bold text-green-600">
              {stats?.byStatus.find((s) => s.status === "APPROVED")?._count || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('transcriber.pendingReview')}</h3>
            <p className="text-3xl font-bold text-yellow-600">
              {stats?.byStatus.find((s) => s.status === "PENDING_REVIEW")?._count || 0}
            </p>
          </div>
        </div>

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

        {/* Pipeline Review Section */}
        <div className="bg-white rounded-lg shadow mb-8">
          <button
            onClick={() => setPipelineExpanded(!pipelineExpanded)}
            className="w-full px-6 py-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Pipeline Review</h2>
              {!pipelineLoading && (
                <span className={`px-2 py-0.5 text-xs rounded font-medium ${pipelineItems.length > 0 ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                  {pipelineItems.length} pending
                </span>
              )}
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${pipelineExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {pipelineExpanded && (
            <div className="p-6">
              {/* Filter */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">Correct ASR transcripts from voice interactions</p>
                <select
                  value={pipelineFilterSource}
                  onChange={e => setPipelineFilterSource(e.target.value)}
                  className="px-3 py-1.5 border rounded-md text-sm"
                >
                  <option value="">All Sources</option>
                  <option value="pilot">Flot</option>
                  <option value="kaccp_recording">KACCP</option>
                </select>
              </div>

              {pipelineMessage && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">{pipelineMessage}</div>
              )}

              {pipelineLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : pipelineItems.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-12 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h3 className="text-lg font-bold mb-1">All caught up</h3>
                  <p className="text-sm text-gray-500">No pending pipeline review items.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Queue List */}
                  <div className="lg:col-span-1 bg-gray-50 rounded-lg border overflow-hidden">
                    <div className="px-4 py-3 bg-gray-100 border-b">
                      <h3 className="font-semibold text-sm">Review Queue</h3>
                    </div>
                    <div className="divide-y max-h-80 overflow-y-auto">
                      {pipelineItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => selectPipelineItem(item)}
                          className={`w-full text-left p-3 hover:bg-gray-100 transition-colors ${pipelineSelected?.id === item.id ? "bg-blue-50" : ""}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${TIER_COLORS[item.priorityTier]}`}>T{item.priorityTier}</span>
                            <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${SOURCE_COLORS[item.source] || "bg-gray-100 text-gray-600"}`}>
                              {SOURCE_LABELS[item.source] || item.source}
                            </span>
                            {item.audioSession?.detectedIntent && (
                              <span className="text-xs text-gray-500 truncate">{item.audioSession.detectedIntent}</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-900 truncate">{item.asrTranscript || "(no transcript)"}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {item.audioSession?.audioDurationS.toFixed(1)}s
                            {item.audioSession?.outcome && ` • ${item.audioSession.outcome}`}
                            {item.disagreementFlag && " • ⚠️ Disagreement"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Review Panel */}
                  <div className="lg:col-span-2">
                    {pipelineSelected ? (
                      <div className="bg-white rounded-lg border">
                        <div className="p-4 border-b">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs rounded font-medium ${TIER_COLORS[pipelineSelected.priorityTier]}`}>
                              Tier {pipelineSelected.priorityTier} — {TIER_LABELS[pipelineSelected.priorityTier]}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded font-medium ${SOURCE_COLORS[pipelineSelected.source] || "bg-gray-100"}`}>
                              Source: {SOURCE_LABELS[pipelineSelected.source] || pipelineSelected.source}
                            </span>
                            {pipelineSelected.audioSession?.detectedIntent && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">{pipelineSelected.audioSession.detectedIntent}</span>
                            )}
                          </div>
                          {pipelineSelected.extractedFields && (
                            <div className="text-xs text-gray-500">
                              {Object.entries(pipelineSelected.extractedFields).map(([k, v]) => (
                                <span key={k} className="mr-3">{k}: {String(v)}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="p-4 border-b bg-gray-50">
                          <label className="block text-sm font-medium mb-2">Audio ({pipelineSelected.audioSession?.audioDurationS.toFixed(1)}s)</label>
                          {pipelineSignedAudioUrl ? (
                            <audio ref={audioRef} controls className="w-full" src={pipelineSignedAudioUrl} key={pipelineSignedAudioUrl} />
                          ) : (
                            <div className="flex items-center justify-center h-12 bg-gray-200 rounded-lg">
                              <span className="text-sm text-gray-500">Loading audio...</span>
                            </div>
                          )}
                        </div>

                        <div className="p-4 border-b">
                          {pipelineSelected.asrTranscript && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                              <div className="text-xs font-medium text-gray-500 mb-1">ASR Transcript (auto-generated)</div>
                              <div className="text-sm text-gray-900">{pipelineSelected.asrTranscript}</div>
                            </div>
                          )}

                          <label className="block text-sm font-medium mb-2">
                            {!pipelineSelected.correctedTranscript ? "Correction (first pass)" : "Verification (second pass)"}
                          </label>
                          <textarea
                            value={pipelineEditedText}
                            onChange={e => setPipelineEditedText(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Type corrected transcript..."
                          />
                          {pipelineSelected.correctedTranscript && !pipelineSelected.secondTranscript && (
                            <p className="text-xs text-orange-600 mt-1">
                              First correction exists. Your submission will be the second pass (double verification).
                            </p>
                          )}
                        </div>

                        <div className="p-4 flex justify-end gap-3">
                          <button
                            onClick={submitPipelineCorrection}
                            disabled={pipelineSubmitting || !pipelineEditedText.trim()}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                          >
                            {pipelineSubmitting ? "Submitting..." : !pipelineSelected.correctedTranscript ? "Submit Correction" : "Submit Verification"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg border p-12 text-center">
                        <p className="text-gray-500">Select an item from the queue to review</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Available Recordings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('transcriber.availableRecordings')}
            </h2>
            <p className="text-sm text-gray-500">
              {t('transcriber.claimToStart')}
            </p>
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
                      {recording.durationSec.toFixed(1)}s •{" "}
                      Le{(recording.language.transcriberRatePerMin * (recording.durationSec / 60)).toFixed(2)} {t('transcriber.est')}
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken, apiFetch } from "@/lib/infra/client/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Language {
  id: string;
  code: string;
  name: string;
}

interface Recording {
  id: string;
  durationSec: number;
  status: string;
  prompt: {
    englishText: string;
    category: string;
    instruction?: string;
  };
  language: {
    id: string;
    code: string;
    name: string;
  };
  speaker: {
    id: string;
    displayName: string;
  };
}

interface Transcription {
  id: string;
  text: string;
  status: string;
  submittedAt: string;
  recording: {
    id: string;
    durationSec: number;
    prompt: {
      englishText: string;
      category: string;
    };
    language: {
      id: string;
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
  };
}

interface Pagination {
  page: number;
  total: number;
  totalPages: number;
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  confirming,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {confirming && (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            )}
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lazy Audio Player ────────────────────────────────────────────────────────

function LazyAudioPlayer({
  recordingId,
  audioUrls,
  onFetchUrl,
  onToggle,
}: {
  recordingId: string;
  audioUrls: Record<string, string>;
  onFetchUrl: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const url = audioUrls[recordingId];
  const isActive = url !== undefined;

  const handleClick = () => {
    if (!isActive) {
      onFetchUrl(recordingId);
    } else {
      onToggle(recordingId);
    }
  };

  return (
    <div className="mt-2">
      {!isActive ? (
        <button
          onClick={handleClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <span>&#9654;</span> Play
        </button>
      ) : url === "" ? (
        <div className="text-xs text-gray-400 italic">Loading audio...</div>
      ) : (
        <div className="flex items-center gap-2">
          <audio
            controls
            autoPlay
            src={url}
            key={url}
            className="h-8 w-full max-w-xs"
          />
          <button
            onClick={handleClick}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Hide
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Panel A — Recordings ─────────────────────────────────────────────────────

function RecordingsPanel({ languages }: { languages: Language[] }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [languageFilter, setLanguageFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 1 });
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const fetchRecordings = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (languageFilter) params.set("languageId", languageFilter);
      const data = await apiFetch<{
        recordings?: Recording[];
        pagination?: Pagination;
        error?: string;
      }>(`/api/v2/reviewer/recordings?${params}`);

      if (!data.error) {
        setRecordings(data.recordings ?? []);
        setPagination(data.pagination ?? { page: 1, total: 0, totalPages: 1 });
      }
    } finally {
      setLoading(false);
    }
  }, [page, languageFilter, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const fetchAudioUrl = useCallback(async (id: string) => {
    setAudioUrls((prev) => ({ ...prev, [id]: "" }));
    const token = getToken();
    if (!token) return;
    try {
      const data = await apiFetch<{ url?: string; signedUrl?: string }>(`/api/v2/audio/${id}`);
      const url = data.url ?? data.signedUrl ?? "";
      setAudioUrls((prev) => ({ ...prev, [id]: url }));
    } catch {
      setAudioUrls((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const toggleAudio = useCallback((id: string) => {
    setAudioUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleApprove = useCallback(async (id: string) => {
    const token = getToken();
    if (!token) return;
    setActionPending(id);
    try {
      await apiFetch(`/api/v2/reviewer/recordings/${id}/approve`, { method: "POST" });
      setRecordings((prev) => prev.filter((r) => r.id !== id));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } finally {
      setActionPending(null);
    }
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectTarget) return;
    const token = getToken();
    if (!token) return;
    setConfirming(true);
    try {
      await apiFetch(`/api/v2/reviewer/recordings/${rejectTarget}/reject`, { method: "POST" });
      setRecordings((prev) => prev.filter((r) => r.id !== rejectTarget));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      setRejectTarget(null);
    } finally {
      setConfirming(false);
    }
  }, [rejectTarget]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={languageFilter}
          onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <button
          onClick={() => { setPage(1); setRefreshKey((k) => k + 1); }}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="animate-spin h-8 w-8 border-b-2 border-purple-600 rounded-full" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No recordings pending review.
        </div>
      ) : (
        <div className="space-y-4">
          {recordings.map((rec) => (
            <div key={rec.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                      {rec.language.name}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                      {rec.prompt.category.replace(/_/g, " ")}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {rec.durationSec?.toFixed(1)}s
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">{rec.prompt.englishText}</p>
                  {rec.prompt.instruction && (
                    <p className="text-xs text-gray-500 italic mb-1">Instruction: {rec.prompt.instruction}</p>
                  )}
                  <p className="text-xs text-gray-400">Speaker: {rec.speaker?.displayName || "Anonymous"}</p>
                  <LazyAudioPlayer
                    recordingId={rec.id}
                    audioUrls={audioUrls}
                    onFetchUrl={fetchAudioUrl}
                    onToggle={toggleAudio}
                  />
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(rec.id)}
                    disabled={actionPending === rec.id}
                    className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionPending === rec.id ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={() => setRejectTarget(rec.id)}
                    disabled={actionPending === rec.id}
                    className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {rejectTarget && (
        <ConfirmModal
          title="Reject Recording?"
          message="This recording will be marked as rejected and removed from the review queue. The speaker will not receive credit for this recording."
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          confirming={confirming}
        />
      )}
    </div>
  );
}

// ─── Panel B — Transcriptions ─────────────────────────────────────────────────

function TranscriptionsPanel({ languages }: { languages: Language[] }) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(false);
  const [languageFilter, setLanguageFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 1 });
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const fetchTranscriptions = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "PENDING_REVIEW", page: String(page) });
      if (languageFilter) params.set("languageId", languageFilter);
      const data = await apiFetch<{
        transcriptions?: Transcription[];
        pagination?: Pagination;
        error?: string;
      }>(`/api/v2/admin/review?${params}`);

      if (!data.error) {
        setTranscriptions(data.transcriptions ?? []);
        setPagination(data.pagination ?? { page: 1, total: 0, totalPages: 1 });
      }
    } finally {
      setLoading(false);
    }
  }, [page, languageFilter, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchTranscriptions();
  }, [fetchTranscriptions]);

  const fetchAudioUrl = useCallback(async (id: string) => {
    setAudioUrls((prev) => ({ ...prev, [id]: "" }));
    const token = getToken();
    if (!token) return;
    try {
      const data = await apiFetch<{ url?: string; signedUrl?: string }>(`/api/v2/audio/${id}`);
      const url = data.url ?? data.signedUrl ?? "";
      setAudioUrls((prev) => ({ ...prev, [id]: url }));
    } catch {
      setAudioUrls((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const toggleAudio = useCallback((id: string) => {
    setAudioUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleDecision = useCallback(async (transcriptionId: string, decision: "APPROVED" | "REJECTED") => {
    const token = getToken();
    if (!token) return;
    setActionPending(transcriptionId);
    try {
      await apiFetch("/api/v2/admin/review", {
        method: "POST",
        body: JSON.stringify({ transcriptionId, decision }),
      });
      setTranscriptions((prev) => prev.filter((t) => t.id !== transcriptionId));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } finally {
      setActionPending(null);
      if (decision === "REJECTED") setRejectTarget(null);
    }
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectTarget) return;
    setConfirming(true);
    try {
      await handleDecision(rejectTarget, "REJECTED");
    } finally {
      setConfirming(false);
    }
  }, [rejectTarget, handleDecision]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={languageFilter}
          onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <button
          onClick={() => { setPage(1); setRefreshKey((k) => k + 1); }}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="animate-spin h-8 w-8 border-b-2 border-purple-600 rounded-full" />
        </div>
      ) : transcriptions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No transcriptions pending review.
        </div>
      ) : (
        <div className="space-y-4">
          {transcriptions.map((txn) => (
            <div key={txn.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                      {txn.recording.language.name}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                      {txn.recording.prompt.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">{txn.recording.prompt.englishText}</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-2 mb-2 italic">
                    &ldquo;{txn.text}&rdquo;
                  </p>
                  <p className="text-xs text-gray-400">
                    Speaker: {txn.recording.speaker?.displayName || "Anonymous"} &bull;
                    Transcriber: {txn.transcriber?.displayName || "Anonymous"}
                  </p>
                  <LazyAudioPlayer
                    recordingId={txn.recording.id}
                    audioUrls={audioUrls}
                    onFetchUrl={fetchAudioUrl}
                    onToggle={toggleAudio}
                  />
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleDecision(txn.id, "APPROVED")}
                    disabled={actionPending === txn.id}
                    className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionPending === txn.id ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={() => setRejectTarget(txn.id)}
                    disabled={actionPending === txn.id}
                    className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {rejectTarget && (
        <ConfirmModal
          title="Reject Transcription?"
          message="This transcription will be marked as rejected. The transcriber will not receive credit and the recording will return to the transcription queue."
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          confirming={confirming}
        />
      )}
    </div>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────

export default function ReviewerV2Page({ params }: { params: { locale: string } }) {
  const router = useRouter();
  const { locale } = params;

  const [activeTab, setActiveTab] = useState<"recordings" | "transcriptions">("recordings");
  const [languages, setLanguages] = useState<Language[]>([]);
  const [recordingCount, setRecordingCount] = useState<number>(0);
  const [transcriptionCount, setTranscriptionCount] = useState<number>(0);
  const [authChecked, setAuthChecked] = useState(false);

  // Auth check
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push(`/${locale}/reviewer/login`);
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error || !data.user) {
          router.push(`/${locale}/reviewer/login`);
          return;
        }
        const roles: string[] = data.user.roles ?? [data.user.role];
        if (!roles.includes("ADMIN") && !roles.includes("REVIEWER")) {
          router.push(`/${locale}/`);
          return;
        }
        setAuthChecked(true);
      });
  }, [locale, router]);

  // Fetch languages
  useEffect(() => {
    if (!authChecked) return;
    const token = getToken();
    if (!token) return;
    apiFetch<{ languages?: Language[] }>("/api/v2/languages")
      .then((data) => setLanguages(data.languages ?? []))
      .catch(() => {});
  }, [authChecked]);

  // Fetch pending counts for tab badges
  useEffect(() => {
    if (!authChecked) return;
    const token = getToken();
    if (!token) return;

    apiFetch<{ pagination?: { total: number } }>("/api/v2/reviewer/recordings?page=1")
      .then((data) => setRecordingCount(data.pagination?.total ?? 0))
      .catch(() => {});

    apiFetch<{ pagination?: { total: number } }>("/api/v2/admin/review?status=PENDING_REVIEW&page=1")
      .then((data) => setTranscriptionCount(data.pagination?.total ?? 0))
      .catch(() => {});
  }, [authChecked]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Reviewer Dashboard V2</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
          <button
            onClick={() => setActiveTab("recordings")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeTab === "recordings"
                ? "bg-white text-purple-700 shadow"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Recordings
            {recordingCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 text-xs font-bold bg-purple-600 text-white rounded-full">
                {recordingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("transcriptions")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeTab === "transcriptions"
                ? "bg-white text-purple-700 shadow"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Transcriptions
            {transcriptionCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 text-xs font-bold bg-purple-600 text-white rounded-full">
                {transcriptionCount}
              </span>
            )}
          </button>
        </div>

        {/* Panels */}
        {activeTab === "recordings" ? (
          <RecordingsPanel languages={languages} />
        ) : (
          <TranscriptionsPanel languages={languages} />
        )}
      </main>
    </div>
  );
}

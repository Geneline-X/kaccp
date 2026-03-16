"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken, apiFetch } from "@/lib/infra/client/client";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Language {
  id: string;
  code: string;
  name: string;
}

interface Recording {
  id: string;
  durationSec: number;
  status: string;
  playbackUrl?: string; // pre-signed URL returned by the recordings list endpoint
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

interface PaginationData {
  page: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function categoryLabel(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Confirm Modal ──────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
  const isLoading = url === "";
  const isLoaded = url !== undefined && url !== "";

  if (isLoaded) {
    return (
      <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
        <audio controls autoPlay src={url} key={url} className="flex-1 h-9" />
        <button
          onClick={() => onToggle(recordingId)}
          title="Hide player"
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          ✕
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
          <span className="w-4 h-4 border-2 border-gray-500 border-t-purple-400 rounded-full animate-spin" />
        </div>
        <span className="text-sm text-gray-400">Loading audio…</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => onFetchUrl(recordingId)}
      className="group flex items-center gap-3 w-full bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-3 transition-colors"
    >
      <span className="w-8 h-8 rounded-full bg-purple-600 group-hover:bg-purple-500 flex items-center justify-center flex-shrink-0 transition-colors">
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
          <path d="M1 1L9 6L1 11V1Z" fill="white" />
        </svg>
      </span>
      <span className="text-sm font-medium text-gray-300">Click to play audio</span>
    </button>
  );
}

// ─── Recording Card ──────────────────────────────────────────────────────────

function RecordingCard({
  recording,
  audioUrls,
  onFetchUrl,
  onToggle,
  onApprove,
  onReject,
  actionPending,
}: {
  recording: Recording;
  audioUrls: Record<string, string>;
  onFetchUrl: (id: string) => void;
  onToggle: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  actionPending: string | null;
}) {
  const pending = actionPending === recording.id;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
            {recording.language.name}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            {categoryLabel(recording.prompt.category)}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded font-mono">
            {fmtDuration(recording.durationSec)}
          </span>
        </div>

        <p className="text-base font-semibold text-gray-900 mb-1">
          {recording.prompt.englishText}
        </p>
        {recording.prompt.instruction && (
          <p className="text-xs text-gray-500 italic mb-2">
            {recording.prompt.instruction}
          </p>
        )}
        <p className="text-xs text-gray-500 mb-4">
          Speaker: <span className="font-medium text-gray-700">{recording.speaker?.displayName || "Anonymous"}</span>
        </p>

        <LazyAudioPlayer
          recordingId={recording.id}
          audioUrls={audioUrls}
          onFetchUrl={onFetchUrl}
          onToggle={onToggle}
        />
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
        <button
          onClick={() => onReject(recording.id)}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => onApprove(recording.id)}
          disabled={pending}
          className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {pending && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Approve
        </button>
      </div>
    </div>
  );
}

// ─── Transcription Card ──────────────────────────────────────────────────────

function TranscriptionCard({
  transcription,
  audioUrls,
  onFetchUrl,
  onToggle,
  onApprove,
  onReject,
  actionPending,
}: {
  transcription: Transcription;
  audioUrls: Record<string, string>;
  onFetchUrl: (id: string) => void;
  onToggle: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  actionPending: string | null;
}) {
  const pending = actionPending === transcription.id;
  const rec = transcription.recording;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
            {rec.language.name}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            {categoryLabel(rec.prompt.category)}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded font-mono">
            {fmtDuration(rec.durationSec)}
          </span>
        </div>

        <p className="text-base font-semibold text-gray-900 mb-1">
          {rec.prompt.englishText}
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Speaker: <span className="font-medium text-gray-700">{rec.speaker?.displayName || "Anonymous"}</span>
          {" · "}
          Transcriber: <span className="font-medium text-gray-700">{transcription.transcriber?.displayName || "Anonymous"}</span>
        </p>

        <div className="mb-4">
          <LazyAudioPlayer
            recordingId={rec.id}
            audioUrls={audioUrls}
            onFetchUrl={onFetchUrl}
            onToggle={onToggle}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Transcription
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="font-mono text-sm text-gray-800 leading-relaxed">
              &ldquo;{transcription.text}&rdquo;
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
        <button
          onClick={() => onReject(transcription.id)}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => onApprove(transcription.id)}
          disabled={pending}
          className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {pending && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Approve
        </button>
      </div>
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function PaginationBar({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-sm text-gray-600">
        Page {page} of {Math.max(1, totalPages)}
      </span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

// ─── Recordings Panel ────────────────────────────────────────────────────────

function RecordingsPanel({
  languages,
  onCountChange,
}: {
  languages: Language[];
  onCountChange: (delta: number) => void;
}) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [languageFilter, setLanguageFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, total: 0, totalPages: 1 });
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
        pagination?: PaginationData;
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

  // Use playbackUrl pre-signed by the recordings list endpoint — no extra API call needed
  const fetchAudioUrl = useCallback(
    async (id: string) => {
      const rec = recordings.find((r) => r.id === id);
      if (rec?.playbackUrl) {
        setAudioUrls((prev) => ({ ...prev, [id]: rec.playbackUrl! }));
        return;
      }
      // Fallback: fetch signed URL from API (e.g. if playbackUrl expired or missing)
      setAudioUrls((prev) => ({ ...prev, [id]: "" }));
      try {
        const data = await apiFetch<{ url?: string; signedUrl?: string }>(`/api/v2/audio/${id}`);
        setAudioUrls((prev) => ({ ...prev, [id]: data.url ?? data.signedUrl ?? "" }));
      } catch {
        setAudioUrls((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [recordings]
  );

  const toggleAudio = useCallback((id: string) => {
    setAudioUrls((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleApprove = useCallback(async (id: string) => {
    setActionPending(id);
    try {
      await apiFetch(`/api/v2/reviewer/recordings/${id}/approve`, { method: "POST" });
      setRecordings((prev) => prev.filter((r) => r.id !== id));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      onCountChange(-1);
    } finally {
      setActionPending(null);
    }
  }, [onCountChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectTarget) return;
    setConfirming(true);
    try {
      await apiFetch(`/api/v2/reviewer/recordings/${rejectTarget}/reject`, { method: "POST" });
      setRecordings((prev) => prev.filter((r) => r.id !== rejectTarget));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      onCountChange(-1);
      setRejectTarget(null);
    } finally {
      setConfirming(false);
    }
  }, [rejectTarget, onCountChange]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={languageFilter}
          onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
        {pagination.total > 0 && (
          <span className="text-sm text-gray-500 ml-auto">{pagination.total} pending</span>
        )}
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
            <RecordingCard
              key={rec.id}
              recording={rec}
              audioUrls={audioUrls}
              onFetchUrl={fetchAudioUrl}
              onToggle={toggleAudio}
              onApprove={handleApprove}
              onReject={(id) => setRejectTarget(id)}
              actionPending={actionPending}
            />
          ))}
          {pagination.totalPages > 1 && (
            <PaginationBar
              page={page}
              totalPages={pagination.totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </div>
      )}

      {rejectTarget && (
        <ConfirmModal
          title="Reject Recording?"
          message="This recording will be rejected and returned to the prompt pool. The speaker will not receive credit."
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          confirming={confirming}
        />
      )}
    </div>
  );
}

// ─── Transcriptions Panel ────────────────────────────────────────────────────

function TranscriptionsPanel({
  languages,
  onCountChange,
}: {
  languages: Language[];
  onCountChange: (delta: number) => void;
}) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(false);
  const [languageFilter, setLanguageFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, total: 0, totalPages: 1 });
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
        pagination?: PaginationData;
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
    try {
      const data = await apiFetch<{ url?: string; signedUrl?: string }>(`/api/v2/audio/${id}`);
      setAudioUrls((prev) => ({ ...prev, [id]: data.url ?? data.signedUrl ?? "" }));
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

  const handleDecision = useCallback(
    async (transcriptionId: string, decision: "APPROVED" | "REJECTED") => {
      setActionPending(transcriptionId);
      try {
        await apiFetch("/api/v2/admin/review", {
          method: "POST",
          body: JSON.stringify({ transcriptionId, decision }),
        });
        setTranscriptions((prev) => prev.filter((t) => t.id !== transcriptionId));
        setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        onCountChange(-1);
      } finally {
        setActionPending(null);
        if (decision === "REJECTED") setRejectTarget(null);
      }
    },
    [onCountChange] // eslint-disable-line react-hooks/exhaustive-deps
  );

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
      <div className="flex items-center gap-3 mb-4">
        <select
          value={languageFilter}
          onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
        {pagination.total > 0 && (
          <span className="text-sm text-gray-500 ml-auto">{pagination.total} pending</span>
        )}
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
            <TranscriptionCard
              key={txn.id}
              transcription={txn}
              audioUrls={audioUrls}
              onFetchUrl={fetchAudioUrl}
              onToggle={toggleAudio}
              onApprove={(id) => handleDecision(id, "APPROVED")}
              onReject={(id) => setRejectTarget(id)}
              actionPending={actionPending}
            />
          ))}
          {pagination.totalPages > 1 && (
            <PaginationBar
              page={page}
              totalPages={pagination.totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </div>
      )}

      {rejectTarget && (
        <ConfirmModal
          title="Reject Transcription?"
          message="This transcription will be rejected. The transcriber will not receive credit and the recording returns to the transcription queue."
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          confirming={confirming}
        />
      )}
    </div>
  );
}

// ─── Root Client Component ────────────────────────────────────────────────────

export default function ReviewerV2Client({ locale }: { locale: string }) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"recordings" | "transcriptions">("recordings");
  const [languages, setLanguages] = useState<Language[]>([]);
  const [recordingCount, setRecordingCount] = useState<number>(0);
  const [transcriptionCount, setTranscriptionCount] = useState<number>(0);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push(`/${locale}/reviewer/login`);
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
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

  useEffect(() => {
    if (!authChecked) return;
    apiFetch<{ languages?: Language[] }>("/api/v2/languages")
      .then((data) => setLanguages(data.languages ?? []))
      .catch(() => {});
  }, [authChecked]);

  useEffect(() => {
    if (!authChecked) return;
    apiFetch<{ pagination?: { total: number } }>("/api/v2/reviewer/recordings?page=1")
      .then((data) => setRecordingCount(data.pagination?.total ?? 0))
      .catch(() => {});
    apiFetch<{ pagination?: { total: number } }>("/api/v2/admin/review?status=PENDING_REVIEW&page=1")
      .then((data) => setTranscriptionCount(data.pagination?.total ?? 0))
      .catch(() => {});
  }, [authChecked]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <span className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reviewer Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Audio &amp; transcription review</p>
          </div>
          <button
            onClick={() => {
              clearToken();
              router.push(`/${locale}/reviewer/login`);
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-200 p-1 rounded-lg mb-6 w-fit">
          <button
            onClick={() => setActiveTab("recordings")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeTab === "recordings"
                ? "bg-white text-purple-700 shadow"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Audio Recordings
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

        {activeTab === "recordings" ? (
          <RecordingsPanel
            languages={languages}
            onCountChange={(delta) => setRecordingCount((n) => Math.max(0, n + delta))}
          />
        ) : (
          <TranscriptionsPanel
            languages={languages}
            onCountChange={(delta) => setTranscriptionCount((n) => Math.max(0, n + delta))}
          />
        )}
      </main>
    </div>
  );
}

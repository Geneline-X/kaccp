"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken, apiFetch } from "@/lib/infra/client/client";

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

function langBadgeClass(code: string): string {
  const map: Record<string, string> = {
    kr: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    en: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    fr: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  };
  return map[code?.toLowerCase()] ?? "bg-stone-100 text-stone-600 ring-1 ring-stone-200";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        <div className="h-1 bg-red-500" />
        <div className="p-6">
          <h3 className="text-base font-semibold text-stone-900 mb-2">{title}</h3>
          <p className="text-sm text-stone-500 leading-relaxed mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              disabled={confirming}
              className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={confirming}
              className="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {confirming && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Confirm Reject
            </button>
          </div>
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
      <div className="flex items-center gap-2 rounded-lg bg-[#111110] px-3 py-2">
        <audio controls autoPlay src={url} key={url} className="flex-1 h-9" />
        <button
          onClick={() => onToggle(recordingId)}
          title="Hide player"
          className="w-7 h-7 rounded flex items-center justify-center text-stone-500 hover:text-stone-300 hover:bg-white/10 transition-colors flex-shrink-0 text-xs"
        >
          ✕
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-[#111110] px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0">
          <span className="w-4 h-4 border-2 border-stone-600 border-t-amber-400 rounded-full animate-spin" />
        </div>
        <span className="text-sm text-stone-400">Loading audio…</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => onFetchUrl(recordingId)}
      className="group flex items-center gap-3 w-full rounded-lg bg-[#111110] hover:bg-[#1a1a18] text-white px-4 py-3 transition-colors"
    >
      <span className="w-9 h-9 rounded-full bg-amber-400 group-hover:bg-amber-300 flex items-center justify-center flex-shrink-0 transition-colors">
        <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
          <path d="M1 1.5L10 6.5L1 11.5V1.5Z" fill="#111110" />
        </svg>
      </span>
      <span className="text-sm font-medium text-stone-300">Click to load audio</span>
      <span className="ml-auto flex items-end gap-[2px] opacity-30">
        {[5, 9, 14, 8, 12, 7, 10, 5].map((h, i) => (
          <span
            key={i}
            className="inline-block w-[2px] rounded-full bg-amber-400"
            style={{ height: `${h}px` }}
          />
        ))}
      </span>
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
    <div className="bg-white rounded-xl border border-stone-200 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-5">
        {/* Metadata */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${langBadgeClass(recording.language.code)}`}>
            {recording.language.name}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500">
            {categoryLabel(recording.prompt.category)}
          </span>
          <span className="ml-auto text-xs text-stone-400 font-mono tabular-nums">
            {fmtDuration(recording.durationSec)}
          </span>
        </div>

        {/* Prompt */}
        <p className="text-[15px] font-semibold text-stone-800 leading-snug mb-1">
          {recording.prompt.englishText}
        </p>
        {recording.prompt.instruction && (
          <p className="text-xs text-stone-400 italic mb-2">
            {recording.prompt.instruction}
          </p>
        )}
        <p className="text-xs text-stone-400 mb-4">
          Speaker ·{" "}
          <span className="text-stone-600 font-medium">
            {recording.speaker?.displayName || "Anonymous"}
          </span>
        </p>

        {/* Audio */}
        <LazyAudioPlayer
          recordingId={recording.id}
          audioUrls={audioUrls}
          onFetchUrl={onFetchUrl}
          onToggle={onToggle}
        />
      </div>

      {/* Action bar */}
      <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2">
        <button
          onClick={() => onReject(recording.id)}
          disabled={pending}
          className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-400 disabled:opacity-40 transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => onApprove(recording.id)}
          disabled={pending}
          className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-2 transition-colors"
        >
          {pending && (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
    <div className="bg-white rounded-xl border border-stone-200 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-5">
        {/* Metadata */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${langBadgeClass(rec.language.code)}`}>
            {rec.language.name}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500">
            {categoryLabel(rec.prompt.category)}
          </span>
          <span className="ml-auto text-xs text-stone-400 font-mono tabular-nums">
            {fmtDuration(rec.durationSec)}
          </span>
        </div>

        {/* Prompt */}
        <p className="text-[15px] font-semibold text-stone-800 leading-snug mb-1">
          {rec.prompt.englishText}
        </p>
        <p className="text-xs text-stone-400 mb-4">
          Speaker ·{" "}
          <span className="text-stone-600 font-medium">
            {rec.speaker?.displayName || "Anonymous"}
          </span>
        </p>

        {/* Audio */}
        <div className="mb-4">
          <LazyAudioPlayer
            recordingId={rec.id}
            audioUrls={audioUrls}
            onFetchUrl={onFetchUrl}
            onToggle={onToggle}
          />
        </div>

        {/* Transcription */}
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-stone-400 mb-1.5">
            Transcription
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="font-mono text-sm text-stone-800 leading-relaxed">
              &ldquo;{transcription.text}&rdquo;
            </p>
            <p className="text-xs text-stone-400 mt-2">
              —{" "}
              <span className="text-stone-600">
                {transcription.transcriber?.displayName || "Anonymous"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2">
        <button
          onClick={() => onReject(transcription.id)}
          disabled={pending}
          className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-400 disabled:opacity-40 transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => onApprove(transcription.id)}
          disabled={pending}
          className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-2 transition-colors"
        >
          {pending && (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          Approve
        </button>
      </div>
    </div>
  );
}

// ─── Pagination Control ──────────────────────────────────────────────────────

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
    <div className="flex items-center justify-center gap-4 pt-2">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-40 transition-colors"
      >
        ← Prev
      </button>
      <span className="text-sm text-stone-400 tabular-nums">
        {page} / {Math.max(1, totalPages)}
      </span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        className="px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-40 transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          className="text-stone-400"
        >
          <path
            d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-stone-500">All caught up</p>
      <p className="text-xs text-stone-400 mt-0.5">{message}</p>
    </div>
  );
}

// ─── Recordings Panel ────────────────────────────────────────────────────────

function RecordingsPanel({ languages }: { languages: Language[] }) {
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

  const fetchAudioUrl = useCallback(async (id: string) => {
    setAudioUrls((prev) => ({ ...prev, [id]: "" }));
    try {
      const data = await apiFetch<{ url?: string; signedUrl?: string }>(
        `/api/v2/audio/${id}`
      );
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

  const handleApprove = useCallback(async (id: string) => {
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
    setConfirming(true);
    try {
      await apiFetch(`/api/v2/reviewer/recordings/${rejectTarget}/reject`, {
        method: "POST",
      });
      setRecordings((prev) => prev.filter((r) => r.id !== rejectTarget));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      setRejectTarget(null);
    } finally {
      setConfirming(false);
    }
  }, [rejectTarget]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          value={languageFilter}
          onChange={(e) => {
            setLanguageFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        >
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setPage(1);
            setRefreshKey((k) => k + 1);
          }}
          className="px-3 py-2 text-sm bg-white border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
        >
          ↻ Refresh
        </button>
        {pagination.total > 0 && (
          <span className="text-sm text-stone-400 ml-auto">
            {pagination.total} pending
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-8 h-8 border-2 border-stone-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : recordings.length === 0 ? (
        <EmptyState message="No recordings pending review" />
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
          title="Reject this recording?"
          message="The recording will be rejected and returned to the prompt pool. The speaker will not receive credit for this recording."
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          confirming={confirming}
        />
      )}
    </div>
  );
}

// ─── Transcriptions Panel ────────────────────────────────────────────────────

function TranscriptionsPanel({ languages }: { languages: Language[] }) {
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
      const data = await apiFetch<{ url?: string; signedUrl?: string }>(
        `/api/v2/audio/${id}`
      );
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
      } finally {
        setActionPending(null);
        if (decision === "REJECTED") setRejectTarget(null);
      }
    },
    []
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
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          value={languageFilter}
          onChange={(e) => {
            setLanguageFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        >
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setPage(1);
            setRefreshKey((k) => k + 1);
          }}
          className="px-3 py-2 text-sm bg-white border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
        >
          ↻ Refresh
        </button>
        {pagination.total > 0 && (
          <span className="text-sm text-stone-400 ml-auto">
            {pagination.total} pending
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-8 h-8 border-2 border-stone-200 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : transcriptions.length === 0 ? (
        <EmptyState message="No transcriptions pending review" />
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
          title="Reject this transcription?"
          message="The transcription will be rejected. The transcriber will not receive credit and the recording returns to the transcription queue."
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

  // Auth check
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

  // Fetch languages
  useEffect(() => {
    if (!authChecked) return;
    apiFetch<{ languages?: Language[] }>("/api/v2/languages")
      .then((data) => setLanguages(data.languages ?? []))
      .catch(() => {});
  }, [authChecked]);

  // Fetch pending counts for tab badges
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
      <div className="min-h-screen bg-[#F2EDE4] flex items-center justify-center">
        <span className="w-10 h-10 border-2 border-stone-300 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        @keyframes waveDance {
          0%   { transform: scaleY(0.35); }
          100% { transform: scaleY(1); }
        }
      `}</style>

      <div className="min-h-screen bg-[#F2EDE4]">
        {/* Header */}
        <header className="bg-[#111110]">
          <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
            <div>
              <h1
                className="text-xl font-bold text-white leading-none"
                style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "-0.01em" }}
              >
                Review Queue
              </h1>
              <p className="text-xs text-stone-500 mt-0.5 tracking-wide">
                Krio Audio Corpus
              </p>
            </div>
            {/* Decorative waveform */}
            <div className="ml-auto flex items-end gap-[3px]" aria-hidden>
              {[6, 11, 17, 9, 15, 8, 13, 20, 11, 7, 15, 9, 5, 12].map((h, i) => (
                <span
                  key={i}
                  className="inline-block w-[3px] rounded-full bg-amber-400 opacity-40"
                  style={{
                    height: `${h}px`,
                    animation: `waveDance ${0.6 + (i % 5) * 0.12}s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.055}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          {/* Tab bar */}
          <div className="flex gap-1.5 p-1 bg-white border border-stone-200 rounded-xl w-fit mb-7 shadow-sm">
            <button
              onClick={() => setActiveTab("recordings")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "recordings"
                  ? "bg-[#111110] text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
              }`}
            >
              Audio
              {recordingCount > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                    activeTab === "recordings"
                      ? "bg-blue-400 text-[#111110]"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {recordingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("transcriptions")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "transcriptions"
                  ? "bg-[#111110] text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
              }`}
            >
              Transcriptions
              {transcriptionCount > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                    activeTab === "transcriptions"
                      ? "bg-amber-400 text-[#111110]"
                      : "bg-amber-500 text-white"
                  }`}
                >
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
    </>
  );
}

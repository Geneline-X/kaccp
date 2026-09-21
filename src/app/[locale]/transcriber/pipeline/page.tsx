"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/infra/client/client";

/* Pipeline (Flot) review queue, on its own page.
 *
 * Split out of the dashboard so a dashboard load no longer pays for it: each API
 * route is a serverless process with a pool of one connection, so every section
 * that fetches on mount holds a connection whether or not anyone looks at it.
 */

interface ReviewItem {
  id: string;
  source: string;
  priorityTier: number;
  status: string;
  asrTranscript: string | null;
  correctedTranscript: string | null;
  secondTranscript: string | null;
  audioPath: string;
  disagreementFlag: boolean;
  audioSession: {
    audioDurationS: number;
    detectedIntent: string | null;
    outcome: string | null;
  } | null;
}

const TIER_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-800",
  2: "bg-yellow-100 text-yellow-800",
  3: "bg-gray-100 text-gray-600",
  4: "bg-purple-100 text-purple-800",
};
const SOURCE_LABELS: Record<string, string> = { pilot: "Flot", kaccp_recording: "KACCP" };
const SOURCE_COLORS: Record<string, string> = {
  pilot: "bg-green-100 text-green-700",
  kaccp_recording: "bg-blue-100 text-blue-700",
};

const LIMIT = 50;

export default function PipelineReviewPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterSource, setFilterSource] = useState("");
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [draft, setDraft] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? getToken() : null;

  const load = () => {
    if (!token) return;
    const qs = new URLSearchParams({ status: "pending", limit: String(LIMIT), page: String(page) });
    if (filterSource) qs.set("source", filterSource);
    fetch(`/api/v2/pipeline/review-queue?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setTotal(d.pagination?.total ?? (d.items || []).length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) {
      router.push(`/${locale}/transcriber/login`);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, filterSource]);

  // A new filter re-pages from the start, or a stale page number lands past the end.
  useEffect(() => { setPage(1); }, [filterSource]);

  useEffect(() => {
    if (!selected || !token || !selected.audioPath) return;
    setAudioUrl(null);
    fetch(`/api/v2/pipeline/audio?path=${encodeURIComponent(selected.audioPath)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.signedUrl) setAudioUrl(d.signedUrl); })
      .catch(() => {});
  }, [selected, token]);

  const select = (item: ReviewItem) => {
    setSelected(item);
    setDraft(item.correctedTranscript || item.asrTranscript || "");
    setMessage(null);
  };

  const submit = async () => {
    if (!selected || !draft.trim()) return;
    setSubmitting(true);
    setMessage(null);
    const isSecondPass =
      selected.correctedTranscript !== null && selected.secondTranscript === null;
    try {
      const res = await fetch(`/api/v2/pipeline/review-queue/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ correctedTranscript: draft.trim() }),
      });
      const data = await res.json();
      if (data.error) { setMessage(`Error: ${data.error}`); return; }

      const remaining = items.filter((i) => i.id !== selected.id);
      const left = Math.max(0, total - 1);
      setItems(remaining);
      setTotal(left);
      setMessage(isSecondPass ? "Double verification submitted" : "Correction submitted");
      const next = remaining[0] || null;
      setSelected(next);
      setDraft(next?.correctedTranscript || next?.asrTranscript || "");
      if (remaining.length === 0 && left > 0) {
        const lastPage = Math.max(1, Math.ceil(left / LIMIT));
        if (page > lastPage) setPage(lastPage);
        else load();
      }
    } catch {
      setMessage("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-purple-600 to-fuchsia-600">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <Link href={`/${locale}/transcriber/v2`} className="text-white/80 hover:text-white text-sm">
            ← Back to dashboard
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-3xl font-bold text-white">🎧 Pipeline Review</h1>
            <span className="px-2 py-0.5 bg-white/20 rounded text-sm text-white font-medium">
              {total} pending
            </span>
          </div>
          <p className="text-white/80 text-sm mt-1">
            Correct ASR transcripts from real voice interactions.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end mb-4">
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm bg-white"
          >
            <option value="">All sources</option>
            <option value="pilot">Flot</option>
            <option value="kaccp_recording">KACCP</option>
          </select>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="text-lg font-bold">All caught up</h3>
            <p className="text-sm text-gray-500 mt-1">No pending pipeline review items.</p>
            <Link
              href={`/${locale}/transcriber/v2`}
              className="inline-block mt-4 px-5 py-2 bg-purple-600 text-white rounded-lg"
            >
              Back to dashboard
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Queue */}
            <div className="lg:col-span-1 bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Review Queue</h3>
                <span className="text-xs text-gray-500">
                  {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                </span>
              </div>
              <div className="divide-y max-h-[28rem] overflow-y-auto">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => select(item)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                      selected?.id === item.id ? "bg-purple-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${TIER_COLORS[item.priorityTier]}`}>
                        T{item.priorityTier}
                      </span>
                      <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${SOURCE_COLORS[item.source] || "bg-gray-100 text-gray-600"}`}>
                        {SOURCE_LABELS[item.source] || item.source}
                      </span>
                    </div>
                    <div className="text-sm text-gray-900 truncate">
                      {item.asrTranscript || "(no transcript)"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {item.audioSession?.audioDurationS?.toFixed(1)}s
                      {item.disagreementFlag && " • ⚠️ Disagreement"}
                    </div>
                  </button>
                ))}
              </div>
              {total > LIMIT && (
                <div className="px-3 py-2 bg-gray-50 border-t flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 text-xs border rounded bg-white disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-600">
                    Page {page} of {Math.ceil(total / LIMIT)}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= Math.ceil(total / LIMIT)}
                    className="px-3 py-1 text-xs border rounded bg-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Editor */}
            <div className="lg:col-span-2">
              {!selected ? (
                <div className="bg-white rounded-lg border p-12 text-center text-sm text-gray-500">
                  Pick an item from the queue to start.
                </div>
              ) : (
                <div className="bg-white rounded-lg border p-5 space-y-4">
                  {audioUrl ? (
                    <audio controls src={audioUrl} className="w-full" />
                  ) : (
                    <div className="h-12 flex items-center text-sm text-gray-400">
                      Loading audio…
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                      Machine transcript
                    </label>
                    <div className="p-3 bg-gray-50 border rounded text-sm text-gray-700">
                      {selected.asrTranscript || "(none)"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                      Your correction
                    </label>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={5}
                      className="w-full p-3 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={submit}
                      disabled={submitting || !draft.trim()}
                      className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      {submitting ? "Submitting…" : "Submit correction"}
                    </button>
                    <button
                      onClick={() => {
                        const rest = items.filter((i) => i.id !== selected.id);
                        const next = rest[0] || null;
                        setSelected(next);
                        setDraft(next?.correctedTranscript || next?.asrTranscript || "");
                      }}
                      className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

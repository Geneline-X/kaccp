"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { getToken } from "@/lib/client";

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

export default function TranscriberPipelineReviewPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const audioRef = useRef<HTMLAudioElement>(null);

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [editedText, setEditedText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) { router.push(`/${locale}/transcriber/login`); return; }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        const myRoles = d.user?.roles || [d.user?.role].filter(Boolean);
        if (d.error || (!myRoles.includes("TRANSCRIBER") && !myRoles.includes("ADMIN") && !myRoles.includes("REVIEWER"))) {
          router.push(`/${locale}/transcriber/login`);
          return;
        }
        setToken(t);
      });
  }, [router, locale]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ status: "pending", page: String(pagination.page), limit: "50" });
    if (filterTier) params.set("tier", filterTier);
    if (filterSource) params.set("source", filterSource);
    fetch(`/api/v2/pipeline/review-queue?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) return;
        setItems(d.items || []);
        setPagination(d.pagination || { page: 1, total: 0, totalPages: 0 });
        setLoading(false);
      });
  }, [token, pagination.page, filterTier, filterSource]);

  useEffect(() => {
    if (!selected || !token || !selected.audioPath) return;
    fetch(`/api/v2/pipeline/audio?path=${encodeURIComponent(selected.audioPath)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.signedUrl) setSignedAudioUrl(d.signedUrl); })
      .catch(() => {});
  }, [selected, token]);

  const selectItem = (item: ReviewItem) => {
    setSelected(item);
    setEditedText(item.correctedTranscript || item.asrTranscript || "");
    setMessage(null);
  };

  const handleSubmit = async () => {
    if (!selected || !editedText.trim()) return;
    setSubmitting(true);
    setMessage(null);
    const isSecondPass = selected.correctedTranscript !== null && selected.secondTranscript === null;
    try {
      const res = await fetch(`/api/v2/pipeline/review-queue/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ correctedTranscript: editedText.trim() }),
      });
      const data = await res.json();
      if (data.error) { setMessage(`Error: ${data.error}`); return; }
      const newList = items.filter(i => i.id !== selected.id);
      setItems(newList);
      setSelected(newList[0] || null);
      setEditedText(newList[0]?.correctedTranscript || newList[0]?.asrTranscript || "");
      setMessage(isSecondPass ? "Double verification submitted" : "Correction submitted");
    } catch { setMessage("Failed to submit"); }
    finally { setSubmitting(false); }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Review</h1>
          <p className="text-sm text-gray-500 mt-1">Correct ASR transcripts from voice interactions</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="px-3 py-1.5 border rounded-md text-sm">
            <option value="">All Sources</option>
            <option value="pilot">Flot</option>
            <option value="kaccp_recording">KACCP</option>
          </select>
          <select value={filterTier} onChange={e => { setFilterTier(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="px-3 py-1.5 border rounded-md text-sm">
            <option value="">All Tiers</option>
            <option value="1">Tier 1 — Critical</option>
            <option value="2">Tier 2 — Standard</option>
            <option value="3">Tier 3 — Sample</option>
            <option value="4">Tier 4 — Disagreement</option>
          </select>
          <span className="text-sm text-gray-500">{pagination.total} pending</span>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">{message}</div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-bold mb-2">All caught up</h3>
          <p className="text-gray-500">No pending pipeline review items.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue List */}
          <div className="lg:col-span-1 bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="font-semibold text-sm">Review Queue</h3>
            </div>
            <div className="divide-y max-h-[70vh] overflow-y-auto">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selected?.id === item.id ? "bg-blue-50" : ""}`}
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
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t flex items-center justify-between text-sm">
                <button disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} className="px-3 py-1 border rounded disabled:opacity-30">Previous</button>
                <span className="text-gray-500">{pagination.page} / {pagination.totalPages}</span>
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} className="px-3 py-1 border rounded disabled:opacity-30">Next</button>
              </div>
            )}
          </div>

          {/* Review Panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="bg-white rounded-lg border">
                <div className="p-6 border-b">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${TIER_COLORS[selected.priorityTier]}`}>
                      Tier {selected.priorityTier} — {TIER_LABELS[selected.priorityTier]}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${SOURCE_COLORS[selected.source] || "bg-gray-100"}`}>
                      Source: {SOURCE_LABELS[selected.source] || selected.source}
                    </span>
                    {selected.audioSession?.detectedIntent && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">{selected.audioSession.detectedIntent}</span>
                    )}
                  </div>
                  {selected.extractedFields && (
                    <div className="text-xs text-gray-500">
                      {Object.entries(selected.extractedFields).map(([k, v]) => (
                        <span key={k} className="mr-3">{k}: {String(v)}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-6 border-b bg-gray-50">
                  <label className="block text-sm font-medium mb-2">Audio ({selected.audioSession?.audioDurationS.toFixed(1)}s)</label>
                  {signedAudioUrl ? (
                    <audio ref={audioRef} controls className="w-full" src={signedAudioUrl} key={signedAudioUrl} />
                  ) : (
                    <div className="flex items-center justify-center h-12 bg-gray-200 rounded-lg">
                      <span className="text-sm text-gray-500">Loading audio...</span>
                    </div>
                  )}
                </div>

                <div className="p-6 border-b">
                  {selected.asrTranscript && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                      <div className="text-xs font-medium text-gray-500 mb-1">ASR Transcript (auto-generated)</div>
                      <div className="text-sm text-gray-900">{selected.asrTranscript}</div>
                    </div>
                  )}

                  <label className="block text-sm font-medium mb-2">
                    {!selected.correctedTranscript ? "Correction (first pass)" : "Verification (second pass)"}
                  </label>
                  <textarea
                    value={editedText}
                    onChange={e => setEditedText(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Type corrected transcript..."
                  />
                  {selected.correctedTranscript && !selected.secondTranscript && (
                    <p className="text-xs text-orange-600 mt-1">
                      First correction exists. Your submission will be the second pass (double verification).
                    </p>
                  )}
                </div>

                <div className="p-6 flex justify-end gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !editedText.trim()}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {submitting ? "Submitting..." : !selected.correctedTranscript ? "Submit Correction" : "Submit Verification"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border p-12 text-center">
                <p className="text-gray-500">Select an item from the queue to review</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

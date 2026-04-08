"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";

const STATUSES = [
  "PENDING_REVIEW",
  "PENDING_TRANSCRIPTION",
  "TRANSCRIBED",
  "APPROVED",
  "REJECTED",
  "FLAGGED",
];

interface Speaker {
  id: string;
  displayName: string | null;
  email: string;
}

interface AnalyzeResult {
  id: string;
  audioUrl: string;
  speakerId: string;
  speakerName: string;
  promptText: string;
  result: "trimmed" | "unchanged" | "skipped" | "error";
  originalDurationSec?: number;
  newDurationSec?: number;
  removedSec?: number;
  reason?: string;
}

interface Language {
  id: string;
  name: string;
  code: string;
}

export default function TrimSilencePage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;

  // Filters
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [languageId, setLanguageId] = useState("");
  const [speakerId, setSpeakerId] = useState("");

  // Data
  const [languages, setLanguages] = useState<Language[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<AnalyzeResult[] | null>(null);
  const [summary, setSummary] = useState<{
    processed: number; trimmed: number; unchanged: number; skipped: number; errors: number;
  } | null>(null);
  const [applied, setApplied] = useState(false);

  // Load languages on mount
  useEffect(() => {
    if (!token) { router.push("/admin/login"); return; }
    fetch("/api/v2/languages", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setLanguages(d.languages || []));
  }, [token, router]);

  // Refresh speakers + count when status/language changes
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams({ status });
    if (languageId) params.set("languageId", languageId);
    fetch(`/api/v2/admin/recordings/trim-silence?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setSpeakers(d.speakers || []);
        setTotalCount(d.total ?? null);
        // Reset speaker selection if current speaker no longer in list
        if (speakerId && !(d.speakers || []).find((s: Speaker) => s.id === speakerId)) {
          setSpeakerId("");
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, languageId, token]);

  const handleAnalyze = async () => {
    if (!token) return;
    setAnalyzing(true);
    setResults(null);
    setSummary(null);
    setApplied(false);

    try {
      const allResults: AnalyzeResult[] = [];
      let totalProcessed = 0, totalTrimmed = 0, totalUnchanged = 0, totalSkipped = 0, totalErrors = 0;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const body: any = { status, dryRun: true, batchSize: 20, offset };
        if (languageId) body.languageId = languageId;
        if (speakerId) body.speakerId = speakerId;

        const res = await fetch("/api/v2/admin/recordings/trim-silence", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text.slice(0, 200) || `Request failed (${res.status})`);
        }

        const data = await res.json();

        allResults.push(...data.results);
        totalProcessed += data.processed;
        totalTrimmed += data.trimmed;
        totalUnchanged += data.unchanged;
        totalSkipped += data.skipped;
        totalErrors += data.errors;
        hasMore = data.hasMore;
        offset += data.processed;

        // Update UI progressively
        setResults([...allResults]);
        setSummary({
          processed: totalProcessed,
          trimmed: totalTrimmed,
          unchanged: totalUnchanged,
          skipped: totalSkipped,
          errors: totalErrors,
        });
      }
    } catch (err: any) {
      alert(`Error: ${err?.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async () => {
    if (!token || !results) return;
    const toTrim = results.filter((r) => r.result === "trimmed");
    if (!confirm(`Apply silence trimming to ${toTrim.length} recording(s)? Audio files in GCS will be overwritten.`)) return;

    setApplying(true);
    try {
      let totalProcessed = 0, totalTrimmed = 0, totalUnchanged = 0, totalSkipped = 0, totalErrors = 0;
      const ids = toTrim.map((r) => r.id);

      // Process in batches of 20 to avoid timeouts
      for (let i = 0; i < ids.length; i += 20) {
        const batch = ids.slice(i, i + 20);
        const res = await fetch("/api/v2/admin/recordings/trim-silence", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ recordingIds: batch, dryRun: false }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text.slice(0, 200) || `Request failed (${res.status})`);
        }

        const data = await res.json();

        totalProcessed += data.processed;
        totalTrimmed += data.trimmed;
        totalUnchanged += data.unchanged;
        totalSkipped += data.skipped;
        totalErrors += data.errors;

        setSummary({
          processed: totalProcessed,
          trimmed: totalTrimmed,
          unchanged: totalUnchanged,
          skipped: totalSkipped,
          errors: totalErrors,
        });
      }

      setApplied(true);
    } catch (err: any) {
      alert(`Error: ${err?.message}`);
    } finally {
      setApplying(false);
    }
  };

  const trimmedResults = results?.filter((r) => r.result === "trimmed") ?? [];
  const previewResults = trimmedResults.slice(0, 5);
  const totalRemovedSec = trimmedResults.reduce((s, r) => s + (r.removedSec ?? 0), 0);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/admin/v2/recordings" className="text-blue-600 hover:underline text-sm">
            ← All Recordings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Trim Trailing Silence</h1>
          <p className="text-sm text-gray-500 mt-1">
            Detect and remove trailing silence from WAV recordings in GCS.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Filter Recordings</h2>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setResults(null); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[180px]"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                value={languageId}
                onChange={(e) => { setLanguageId(e.target.value); setSpeakerId(""); setResults(null); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[180px]"
              >
                <option value="">All languages</option>
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Speaker</label>
              <select
                value={speakerId}
                onChange={(e) => { setSpeakerId(e.target.value); setResults(null); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[220px]"
              >
                <option value="">All speakers</option>
                {speakers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName || s.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {totalCount !== null && (
            <p className="mt-3 text-sm text-gray-500">
              {totalCount} recording{totalCount !== 1 ? "s" : ""} match this filter.
            </p>
          )}

          <div className="mt-5">
            <button
              onClick={handleAnalyze}
              disabled={analyzing || applying}
              className="px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {analyzing ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className={`rounded-lg shadow p-5 ${applied ? "bg-green-50 border border-green-200" : "bg-white"}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-2">
                  {applied ? "Applied" : "Dry Run"} Results
                </h2>
                <div className="flex gap-6 text-sm flex-wrap">
                  <Stat label="Analyzed" value={summary.processed} />
                  <Stat label="To trim" value={summary.trimmed} highlight />
                  <Stat label="Unchanged" value={summary.unchanged} />
                  <Stat label="Skipped (non-WAV)" value={summary.skipped} />
                  {summary.errors > 0 && <Stat label="Errors" value={summary.errors} error />}
                  {!applied && summary.trimmed > 0 && (
                    <div className="text-sm">
                      <span className="text-gray-500">Total silence</span>
                      <div className="font-semibold text-purple-700">{totalRemovedSec.toFixed(1)}s</div>
                    </div>
                  )}
                </div>
              </div>

              {!applied && summary.trimmed > 0 && (
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {applying ? "Applying..." : `Apply to ${summary.trimmed} Recording${summary.trimmed !== 1 ? "s" : ""}`}
                </button>
              )}
              {applied && (
                <span className="text-green-700 font-medium text-sm">Changes saved to GCS</span>
              )}
            </div>
          </div>
        )}

        {/* Preview (first 5 trimmed) */}
        {previewResults.length > 0 && !applied && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              Preview — {previewResults.length} of {trimmedResults.length} recordings to trim
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Listen to the original and trimmed versions before applying.
            </p>
            <div className="space-y-5">
              {previewResults.map((r) => (
                <PreviewRow key={r.id} result={r} token={token!} />
              ))}
            </div>
          </div>
        )}

        {/* Unchanged / skipped / errors table */}
        {results && results.filter((r) => r.result !== "trimmed").length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Other Results</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Speaker</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prompt</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.filter((r) => r.result !== "trimmed").map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{r.speakerName}</td>
                    <td className="px-4 py-2 text-gray-500 truncate max-w-[280px]">{r.promptText}</td>
                    <td className="px-4 py-2">
                      <ResultBadge result={r.result} />
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {r.result === "unchanged" && r.originalDurationSec
                        ? `${r.originalDurationSec.toFixed(1)}s — no silence`
                        : r.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Sub-components ---

function Stat({ label, value, highlight, error }: { label: string; value: number; highlight?: boolean; error?: boolean }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div className={`font-semibold ${highlight ? "text-purple-700" : error ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, string> = {
    trimmed: "bg-purple-100 text-purple-700",
    unchanged: "bg-gray-100 text-gray-600",
    skipped: "bg-yellow-100 text-yellow-700",
    error: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[result] || "bg-gray-100"}`}>
      {result}
    </span>
  );
}

function PreviewRow({ result, token }: { result: AnalyzeResult; token: string }) {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [trimmedUrl, setTrimmedUrl] = useState<string | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [loadingTrimmed, setLoadingTrimmed] = useState(false);

  const loadOriginal = async () => {
    if (originalUrl || loadingOriginal) return;
    setLoadingOriginal(true);
    try {
      const res = await fetch(`/api/v2/audio/${result.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setOriginalUrl(data.signedUrl || data.url);
    } finally {
      setLoadingOriginal(false);
    }
  };

  const loadTrimmed = async () => {
    if (trimmedUrl || loadingTrimmed) return;
    setLoadingTrimmed(true);
    try {
      const res = await fetch(`/api/v2/admin/recordings/${result.id}/preview-trim`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      setTrimmedUrl(URL.createObjectURL(blob));
    } finally {
      setLoadingTrimmed(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-sm font-medium text-gray-800">{result.promptText}</div>
          <div className="text-xs text-gray-500 mt-0.5">{result.speakerName}</div>
        </div>
        <div className="text-right text-sm shrink-0">
          <span className="text-gray-500">{result.originalDurationSec?.toFixed(1)}s</span>
          <span className="mx-1 text-gray-400">→</span>
          <span className="font-medium text-purple-700">{result.newDurationSec?.toFixed(1)}s</span>
          <div className="text-xs text-gray-400">−{result.removedSec?.toFixed(1)}s silence</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">Original ({result.originalDurationSec?.toFixed(1)}s)</div>
          {originalUrl ? (
            <audio controls src={originalUrl} className="w-full h-8" />
          ) : (
            <button
              onClick={loadOriginal}
              disabled={loadingOriginal}
              className="w-full h-8 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
            >
              {loadingOriginal ? "Loading..." : "▶ Load Original"}
            </button>
          )}
        </div>
        <div>
          <div className="text-xs font-medium text-purple-600 mb-1">Trimmed ({result.newDurationSec?.toFixed(1)}s)</div>
          {trimmedUrl ? (
            <audio controls src={trimmedUrl} className="w-full h-8" />
          ) : (
            <button
              onClick={loadTrimmed}
              disabled={loadingTrimmed}
              className="w-full h-8 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 rounded disabled:opacity-50"
            >
              {loadingTrimmed ? "Loading..." : "▶ Load Preview"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

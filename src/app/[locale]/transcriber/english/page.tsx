"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/infra/client/client";

/* English translation queue, on its own page.
 *
 * Split out of the dashboard so a dashboard load no longer pays for it: each API
 * route is a serverless process with a pool of one connection, so every section
 * that fetches on mount is a connection held whether or not anyone looks at it.
 */

interface EnglishTask {
  id: string;
  audioUrl: string;
  durationSec: number;
  krioText: string;
  englishTranslation: string | null;
  promptInstruction: string;
  language: { code: string; name: string } | null;
}

const LIMIT = 25;

export default function EnglishTranslationPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const [items, setItems] = useState<EnglishTask[]>([]);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<EnglishTask | null>(null);
  const [draft, setDraft] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? getToken() : null;

  const load = () => {
    if (!token) return;
    fetch(`/api/v2/transcriber/english?limit=${LIMIT}&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setTotal(d.total || 0);
        setMine(d.myTranslations || 0);
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
  }, [token, page]);

  useEffect(() => {
    if (!selected || !token) return;
    setAudioUrl(null);
    fetch(`/api/v2/audio/${selected.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.signedUrl || d.url) setAudioUrl(d.signedUrl || d.url); })
      .catch(() => {});
  }, [selected, token]);

  const select = (task: EnglishTask) => {
    setSelected(task);
    setDraft(task.englishTranslation || "");
    setMessage(null);
  };

  const submit = async () => {
    if (!selected || !draft.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v2/transcriber/english", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recordingId: selected.id, englishText: draft.trim() }),
      });
      const data = await res.json();
      if (data.error) { setMessage(`Error: ${data.error}`); return; }

      const remaining = items.filter((i) => i.id !== selected.id);
      const left = Math.max(0, total - 1);
      setItems(remaining);
      setTotal(left);
      setMine((m) => m + 1);
      setMessage("Saved");
      const next = remaining[0] || null;
      setSelected(next);
      setDraft(next?.englishTranslation || "");
      // An emptied page must pull the next one rather than look finished.
      if (remaining.length === 0 && left > 0) {
        const lastPage = Math.max(1, Math.ceil(left / LIMIT));
        if (page > lastPage) setPage(lastPage);
        else load();
      }
    } catch {
      setMessage("Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <Link href={`/${locale}/transcriber/v2`} className="text-white/80 hover:text-white text-sm">
            ← Back to dashboard
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-3xl font-bold text-white">🌉 English Translation</h1>
            <span className="px-2 py-0.5 bg-white/20 rounded text-sm text-white font-medium">
              {total} waiting
            </span>
            {mine > 0 && (
              <span className="px-2 py-0.5 bg-white/20 rounded text-sm text-white font-medium">
                {mine} done by you
              </span>
            )}
          </div>
          <p className="text-white/80 text-sm mt-1">
            These clips already have their Krio written down. Listen, read the Krio, and write
            what it means in English.
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="text-lg font-bold">All caught up</h3>
            <p className="text-sm text-gray-500 mt-1">
              No clips are waiting for an English translation.
            </p>
            <Link
              href={`/${locale}/transcriber/v2`}
              className="inline-block mt-4 px-5 py-2 bg-emerald-600 text-white rounded-lg"
            >
              Back to dashboard
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Queue */}
            <div className="lg:col-span-1 bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Queue</h3>
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
                      selected?.id === item.id ? "bg-emerald-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 text-xs rounded font-medium bg-emerald-100 text-emerald-700">
                        {item.language?.code || "?"}
                      </span>
                      <span className="text-xs text-gray-400">{item.durationSec?.toFixed(1)}s</span>
                    </div>
                    <div className="text-sm text-gray-900 line-clamp-2">
                      {item.krioText || "(no text)"}
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
                  Pick a clip from the queue to start.
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
                      What was said (Krio)
                    </label>
                    <div className="p-3 bg-gray-50 border rounded text-sm text-gray-900">
                      {selected.krioText || "(no transcript)"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                      English translation
                    </label>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={5}
                      placeholder="Write what the speaker said, in English…"
                      className="w-full p-3 border rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  {selected.promptInstruction && (
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer select-none">
                        Topic they were asked to talk about (context only — do not copy)
                      </summary>
                      <p className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
                        {selected.promptInstruction}
                      </p>
                    </details>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={submit}
                      disabled={submitting || !draft.trim()}
                      className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {submitting ? "Saving…" : "Save translation"}
                    </button>
                    <button
                      onClick={() => {
                        const rest = items.filter((i) => i.id !== selected.id);
                        const next = rest[0] || null;
                        setSelected(next);
                        setDraft(next?.englishTranslation || "");
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

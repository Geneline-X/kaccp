"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  languageLeadNotes: string | null;
  reviewerId: string | null;
  secondReviewerId: string | null;
  audioSession: {
    audioDurationS: number;
    timestamp: string;
    detectedIntent: string | null;
    outcome: string | null;
  } | null;
  reviewer: { id: string; displayName: string } | null;
  secondReviewer: { id: string; displayName: string } | null;
  languageLead: { id: string; displayName: string } | null;
  createdAt: string;
}

export default function LanguageLeadPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"corrected" | "approved" | "rejected">("corrected");
  const limit = 20;

  const token = typeof window !== "undefined" ? getToken() : null;

  const loadItems = () => {
    if (!token) {
      router.push("/admin/login");
      return;
    }

    setLoading(true);
    fetch(`/api/v2/pipeline/language-lead?status=${selectedTab}&page=${page}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          router.push("/admin/login");
          return;
        }
        setItems(d.items || []);
        setTotal(d.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, [token, selectedTab, page]);

  const handleAction = async (id: string, action: "approve" | "reject", notes?: string) => {
    const res = await fetch(`/api/v2/pipeline/language-lead/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, notes }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    loadItems();
  };

  const formatDuration = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Language Lead Review</h1>
          <p className="text-sm text-muted-foreground">
            Final verification of corrected pipeline transcripts
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {total} item{total !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {(["corrected", "approved", "rejected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setSelectedTab(tab);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "corrected" && "Awaiting Review"}
            {tab === "approved" && "Approved"}
            {tab === "rejected" && "Rejected"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {selectedTab === "corrected"
            ? "No items awaiting language lead review."
            : selectedTab === "approved"
            ? "No approved items."
            : "No rejected items."}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg p-4 bg-card"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                      item.priorityTier === 1
                        ? "bg-red-100 text-red-700"
                        : item.priorityTier === 2
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      Tier {item.priorityTier}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.source}
                    </span>
                    {item.disagreementFlag && (
                      <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded font-medium">
                        Disagreement
                      </span>
                    )}
                    {item.audioSession?.outcome && (
                      <span className="text-xs text-muted-foreground">
                        {item.audioSession.outcome}
                      </span>
                    )}
                  </div>
                  {item.audioSession?.detectedIntent && (
                    <p className="text-xs text-muted-foreground mb-1">
                      Intent: {item.audioSession.detectedIntent}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0 text-right">
                  <div>{formatDate(item.createdAt)}</div>
                  {item.audioSession && (
                    <div>{item.audioSession.audioDurationS ? formatDuration(item.audioSession.audioDurationS) : ""}</div>
                  )}
                </div>
              </div>

              {/* Transcripts */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">ASR Transcript</p>
                  <p className="text-sm bg-muted rounded p-2">{item.asrTranscript || "(none)"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Corrected Transcript
                    {item.reviewer && (
                      <span className="ml-1">by {item.reviewer.displayName}</span>
                    )}
                  </p>
                  <p className="text-sm bg-green-50 rounded p-2 border border-green-200">
                    {item.correctedTranscript || "(none)"}
                  </p>
                </div>
              </div>

              {item.secondTranscript && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Second Correction
                    {item.secondReviewer && (
                      <span className="ml-1">by {item.secondReviewer.displayName}</span>
                    )}
                  </p>
                  <p className="text-sm bg-blue-50 rounded p-2 border border-blue-200">
                    {item.secondTranscript}
                  </p>
                </div>
              )}

              {/* Action buttons for awaiting review */}
              {selectedTab === "corrected" && (
                <div className="flex items-center gap-3 pt-3 border-t">
                  <input
                    type="text"
                    placeholder="Notes (optional)..."
                    id={`notes-${item.id}`}
                    className="flex-1 text-sm border rounded px-3 py-1.5 bg-background"
                  />
                  <button
                    onClick={() => {
                      const notes = (document.getElementById(`notes-${item.id}`) as HTMLInputElement)?.value;
                      handleAction(item.id, "approve", notes || undefined);
                    }}
                    className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      const notes = (document.getElementById(`notes-${item.id}`) as HTMLInputElement)?.value;
                      handleAction(item.id, "reject", notes || undefined);
                    }}
                    className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}

              {/* Show outcome + lead info for approved/rejected */}
              {selectedTab !== "corrected" && item.languageLead && (
                <div className="pt-3 border-t text-xs text-muted-foreground">
                  Reviewed by {item.languageLead.displayName}
                  {item.languageLeadNotes && (
                    <span className="ml-2">· Notes: {item.languageLeadNotes}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / limit)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / limit)}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/client";

interface DatasetVersion {
  id: string;
  versionId: string;
  description: string | null;
  totalHours: number;
  totalSessions: number;
  pilotHours: number;
  kaccpHours: number;
  evalWer: number | null;
  modelArtifactPath: string | null;
  exportPath: string | null;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  training: "bg-yellow-100 text-yellow-800",
  evaluated: "bg-blue-100 text-blue-800",
  promoted: "bg-green-100 text-green-800",
  archived: "bg-red-100 text-red-800",
};

export default function DatasetsPage() {
  const router = useRouter();
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>("ljspeech");

  const token = typeof window !== "undefined" ? getToken() : null;

  useEffect(() => {
    if (!token) { router.push("/admin/login"); return; }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error || d.user?.role !== "ADMIN") { router.push("/admin/login"); return; }
        setUser(d.user);
      });
  }, [token, router]);

  const fetchVersions = () => {
    if (!token) return;
    setLoading(true);
    fetch("/api/v2/pipeline/datasets", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        setVersions(d.versions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    fetchVersions();
  }, [user]);

  const handleMerge = async () => {
    setBusy(true); setActionErr(null); setActionMsg(null);
    try {
      const res = await fetch("/api/v2/pipeline/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: `Weekly merge ${new Date().toISOString().split("T")[0]}` }),
      });
      const d = await res.json();
      if (d.error) { setActionErr(d.error); return; }
      setActionMsg(`Created ${d.version.versionId} — ${d.version.totalSessions} sessions, ${d.version.totalHours}h`);
      fetchVersions();
    } catch { setActionErr("Merge failed"); }
    finally { setBusy(false); }
  };

  const handleExport = async (version: DatasetVersion) => {
    setBusy(true); setActionErr(null); setActionMsg(null);
    try {
      const res = await fetch(`/api/v2/pipeline/datasets/${version.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ format: selectedFormat }),
      });
      const d = await res.json();
      if (d.error) { setActionErr(d.error); return; }
      setActionMsg(`Exported to ${d.exportPath}`);
      fetchVersions();
    } catch { setActionErr("Export failed"); }
    finally { setBusy(false); }
  };

  const handlePromote = async (version: DatasetVersion, status: string) => {
    setBusy(true); setActionErr(null); setActionMsg(null);
    try {
      const res = await fetch(`/api/v2/pipeline/datasets/${version.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (d.error) { setActionErr(d.error); return; }
      setActionMsg(`Version ${version.versionId} → ${status}`);
      fetchVersions();
    } catch { setActionErr("Update failed"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Dataset Versions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Versioned training snapshots with lineage tracking
          </p>
        </div>
        <button
          onClick={handleMerge}
          disabled={busy}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {busy ? "Working..." : "Merge Approved Reviews → New Version"}
        </button>
      </div>

      {(actionMsg || actionErr) && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${actionErr ? "bg-red-50 border border-red-200 text-red-800" : "bg-green-50 border border-green-200 text-green-800"}`}>
          {actionErr || actionMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : versions.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-xl font-bold mb-2">No versions yet</h3>
          <p className="text-gray-500">Merge approved reviews to create the first dataset version.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {versions.map(v => (
            <div key={v.id} className="bg-white rounded-lg border p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{v.versionId}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${STATUS_COLORS[v.status] || "bg-gray-100"}`}>
                      {v.status}
                    </span>
                  </div>
                  {v.description && (
                    <p className="text-sm text-gray-500 mt-1">{v.description}</p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500">
                  {new Date(v.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-500">Total Hours</div>
                  <div className="text-lg font-semibold">{v.totalHours.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Sessions</div>
                  <div className="text-lg font-semibold">{v.totalSessions}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Pilot Hours</div>
                  <div className="text-lg font-semibold">{v.pilotHours.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">KACCP Hours</div>
                  <div className="text-lg font-semibold">{v.kaccpHours.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Eval WER</div>
                  <div className="text-lg font-semibold">{v.evalWer !== null ? `${(v.evalWer * 100).toFixed(1)}%` : "—"}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t">
                <select
                  value={selectedFormat}
                  onChange={e => setSelectedFormat(e.target.value)}
                  className="px-2 py-1.5 border rounded text-sm"
                >
                  <option value="ljspeech">LJSpeech CSV</option>
                  <option value="json">JSON</option>
                </select>
                <button
                  onClick={() => handleExport(v)}
                  disabled={busy}
                  className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Export to GCS
                </button>
                {v.status === "draft" && (
                  <button
                    onClick={() => handlePromote(v, "training")}
                    disabled={busy}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    Mark Training
                  </button>
                )}
                {v.status === "evaluated" && (
                  <button
                    onClick={() => handlePromote(v, "promoted")}
                    disabled={busy}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Promote to Production
                  </button>
                )}
                {v.exportPath && (
                  <span className="text-xs text-gray-400 ml-auto truncate max-w-[300px]" title={v.exportPath}>
                    {v.exportPath}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

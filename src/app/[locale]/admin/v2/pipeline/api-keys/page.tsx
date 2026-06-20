"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/client";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const fetchKeys = () => {
    if (!token) return;
    setLoading(true);
    fetch("/api/v2/pipeline/api-keys", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setKeys(d.keys || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    fetchKeys();
  }, [user]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setBusy(true);
    setNewKeyResult(null);
    try {
      const res = await fetch("/api/v2/pipeline/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const d = await res.json();
      if (d.error) { setNewKeyResult(`Error: ${d.error}`); return; }
      setNewKeyResult(`Key created! Copy it now — it won't be shown again:\n\n${d.key}`);
      setNewKeyName("");
      fetchKeys();
    } catch {
      setNewKeyResult("Failed to create key");
    } finally { setBusy(false); }
  };

  const handleToggle = async (keyId: string, isActive: boolean) => {
    setBusy(true);
    try {
      await fetch(`/api/v2/pipeline/api-keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive }),
      });
      fetchKeys();
    } catch {}
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">API Keys</h2>
          <p className="text-sm text-gray-500 mt-1">
            Service-to-service authentication for Flot and other pipeline consumers
          </p>
        </div>
      </div>

      {/* Create Key */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h3 className="font-semibold mb-3">Create New API Key</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="e.g. flot-prod"
            className="flex-1 px-4 py-2 border rounded-lg text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={busy || !newKeyName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {busy ? "Creating..." : "Generate Key"}
          </button>
        </div>
        {newKeyResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm whitespace-pre-wrap font-mono ${newKeyResult.startsWith("Error") ? "bg-red-50 text-red-800 border border-red-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
            {newKeyResult}
          </div>
        )}
      </div>

      {/* Key List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : keys.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <div className="text-5xl mb-4">🔑</div>
          <h3 className="text-xl font-bold mb-2">No API keys</h3>
          <p className="text-gray-500">Create your first key above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Prefix</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Last Used</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Created</th>
                <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map(k => (
                <tr key={k.id}>
                  <td className="px-4 py-3 text-sm font-medium">{k.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{k.prefix}...</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${k.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {k.isActive ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button
                      onClick={() => handleToggle(k.id, !k.isActive)}
                      disabled={busy}
                      className={`px-3 py-1 rounded text-xs font-medium ${k.isActive ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"} disabled:opacity-50`}
                    >
                      {k.isActive ? "Revoke" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/client";

interface AnnotationRule {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  examples: any;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AnnotationRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<AnnotationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);

  const token = typeof window !== "undefined" ? getToken() : null;

  useEffect(() => {
    if (!token) { router.push("/admin/login"); return; }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.push("/admin/login"); return; }
        setUser(d.user);
      });
  }, [token, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    if (!showInactive) params.set("activeOnly", "true");
    fetch(`/api/v2/pipeline/annotation-rules?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        setRules(d.rules || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, filterCategory, showInactive, token]);

  const categories = [...new Set(rules.map(r => r.category).filter(Boolean))];

  const renderExamples = (examples: any) => {
    if (!examples) return null;
    const pairs = Object.entries(examples);
    return (
      <div className="mt-3 space-y-2">
        {pairs.map(([key, value]) => (
          <div key={key}>
            <div className="text-xs font-medium text-gray-500 mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
            {Array.isArray(value) ? (
              <div className="space-y-1">
                {(value as any[]).map((item, i) => (
                  <div key={i} className="text-sm font-mono bg-gray-50 p-1.5 rounded">
                    {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                  </div>
                ))}
              </div>
            ) : typeof value === 'object' ? (
              <div className="space-y-1">
                {Object.entries(value as Record<string, string>).map(([k, v]) => (
                  <div key={k} className="text-sm">
                    <span className="font-medium">{k}: </span>
                    <span className="font-mono">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm font-mono bg-gray-50 p-1.5 rounded">{String(value)}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Annotation Rules</h2>
          <p className="text-sm text-gray-500 mt-1">
            Krio Speech Annotation Standard v1.0 — living reference for all reviewers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c!}>{c}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.map(rule => (
            <div key={rule.id} className={`bg-white rounded-lg border ${!rule.isActive ? "opacity-60" : ""}`}>
              <button
                onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                className="w-full text-left p-4 flex items-start justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{rule.title}</h3>
                      {rule.category && (
                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                          {rule.category}
                        </span>
                      )}
                      {!rule.isActive && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-800 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{rule.description}</p>
                  </div>
                </div>
                <span className="text-gray-400 ml-4 shrink-0">{expandedId === rule.id ? "▲" : "▼"}</span>
              </button>
              {expandedId === rule.id && (
                <div className="px-4 pb-4 border-t pt-3">
                  <div className="text-sm text-gray-700 mb-3">{rule.description}</div>
                  {renderExamples(rule.examples)}
                  <div className="mt-3 text-xs text-gray-400">
                    Rule ID: {rule.ruleId} · Updated {new Date(rule.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";

interface Country {
  id: string;
  code: string;
  name: string;
}

interface Language {
  id: string;
  code: string;
  name: string;
  nativeName?: string;
  isActive: boolean;
  targetMinutes: number;
  collectedMinutes: number;
  approvedMinutes: number;
  speakerRatePerMinute: number;
  transcriberRatePerMin: number;
  country: Country;
  _count: {
    prompts: number;
    recordings: number;
  };
}

export default function AdminLanguagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterCountryId = searchParams.get("countryId");

  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLanguage, setNewLanguage] = useState({
    code: "",
    name: "",
    nativeName: "",
    countryId: "",
    targetMinutes: 12000,
    speakerRatePerMinute: 0.05,
    transcriberRatePerMin: 0.03,
  });
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? getToken() : null;

  // Fetch countries
  useEffect(() => {
    if (!token) {
      router.push("/admin/login");
      return;
    }

    fetch("/api/v2/countries", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setCountries(data.countries || []);
        if (data.countries?.length > 0 && !newLanguage.countryId) {
          setNewLanguage((prev) => ({
            ...prev,
            countryId: filterCountryId || data.countries[0].id,
          }));
        }
      });
  }, [token, router, filterCountryId]);

  // Fetch languages
  useEffect(() => {
    if (!token) return;

    const params = new URLSearchParams({ activeOnly: "false" });
    if (filterCountryId) {
      params.set("countryId", filterCountryId);
    }

    fetch(`/api/v2/languages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setLanguages(data.languages || []);
        setLoading(false);
      });
  }, [token, filterCountryId]);

  const handleCreateLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/v2/languages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newLanguage),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      setLanguages([...languages, { ...data.language, _count: { prompts: 0, recordings: 0 } }]);
      setShowNewForm(false);
      setNewLanguage({
        code: "",
        name: "",
        nativeName: "",
        countryId: filterCountryId || countries[0]?.id || "",
        targetMinutes: 12000,
        speakerRatePerMinute: 0.05,
        transcriberRatePerMin: 0.03,
      });
    } catch (err) {
      setError("Failed to create language");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/admin/v2" className="text-blue-600 hover:underline text-sm">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                Language Management
              </h1>
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Language
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Filter by country */}
        {countries.length > 1 && (
          <div className="mb-6">
            <select
              value={filterCountryId || ""}
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  router.push(`/admin/v2/languages?countryId=${value}`);
                } else {
                  router.push("/admin/v2/languages");
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Countries</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {languages.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">No languages configured yet.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Your First Language
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Language
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Prompts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Recordings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {languages.map((lang) => {
                  const progress = lang.targetMinutes > 0
                    ? Math.round((lang.approvedMinutes / lang.targetMinutes) * 100)
                    : 0;
                  return (
                    <tr key={lang.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{lang.name}</div>
                        <div className="text-sm text-gray-500">
                          {lang.code.toUpperCase()}
                          {lang.nativeName && ` • ${lang.nativeName}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {lang.country.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500">{progress}%</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {Math.round(lang.approvedMinutes / 60)}h / {Math.round(lang.targetMinutes / 60)}h
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {lang._count.prompts}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {lang._count.recordings}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            lang.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {lang.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/v2/prompts?languageId=${lang.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Manage Prompts
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* New Language Modal */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-xl font-bold mb-4">Add New Language</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateLanguage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  value={newLanguage.countryId}
                  onChange={(e) =>
                    setNewLanguage({ ...newLanguage, countryId: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Country</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language Code (ISO 639-3)
                  </label>
                  <input
                    type="text"
                    value={newLanguage.code}
                    onChange={(e) =>
                      setNewLanguage({ ...newLanguage, code: e.target.value.toLowerCase() })
                    }
                    required
                    maxLength={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg lowercase"
                    placeholder="kri"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language Name
                  </label>
                  <input
                    type="text"
                    value={newLanguage.name}
                    onChange={(e) =>
                      setNewLanguage({ ...newLanguage, name: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Krio"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Native Name (optional)
                </label>
                <input
                  type="text"
                  value={newLanguage.nativeName}
                  onChange={(e) =>
                    setNewLanguage({ ...newLanguage, nativeName: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="How it's called in the language"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Hours
                </label>
                <input
                  type="number"
                  value={newLanguage.targetMinutes / 60}
                  onChange={(e) =>
                    setNewLanguage({
                      ...newLanguage,
                      targetMinutes: parseInt(e.target.value) * 60,
                    })
                  }
                  min={1}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Speaker Rate ($/min)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newLanguage.speakerRatePerMinute}
                    onChange={(e) =>
                      setNewLanguage({
                        ...newLanguage,
                        speakerRatePerMinute: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transcriber Rate ($/min)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newLanguage.transcriberRatePerMin}
                    onChange={(e) =>
                      setNewLanguage({
                        ...newLanguage,
                        transcriberRatePerMin: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewForm(false);
                    setError("");
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Language
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

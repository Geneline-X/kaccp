"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";

interface Language {
  id: string;
  code: string;
  name: string;
  targetMinutes: number;
  collectedMinutes: number;
  approvedMinutes: number;
}

interface Country {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  languages: Language[];
}

export default function AdminCountriesPage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCountry, setNewCountry] = useState({ code: "", name: "" });
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? getToken() : null;

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
        setLoading(false);
      })
      .catch(() => {
        router.push("/admin/login");
      });
  }, [token, router]);

  const handleCreateCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/v2/countries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newCountry),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      setCountries([...countries, { ...data.country, languages: [] }]);
      setShowNewForm(false);
      setNewCountry({ code: "", name: "" });
    } catch {
      setError("Failed to create country");
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
                Country Management
              </h1>
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Country
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {countries.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">No countries configured yet.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Your First Country
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {countries.map((country) => (
              <div key={country.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{country.name}</h3>
                      <span className="text-sm text-gray-500">{country.code}</span>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded ${country.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                        }`}
                    >
                      {country.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Languages ({country.languages.length})
                    </h4>
                    {country.languages.length === 0 ? (
                      <p className="text-sm text-gray-500">No languages yet</p>
                    ) : (
                      <div className="space-y-2">
                        {country.languages.map((lang) => {
                          const progress = lang.targetMinutes > 0
                            ? Math.round((lang.approvedMinutes / lang.targetMinutes) * 100)
                            : 0;
                          return (
                            <div key={lang.id} className="text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium">{lang.name}</span>
                                <span className="text-gray-500">{progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2">
                  <Link
                    href={`/admin/v2/languages?countryId=${country.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Manage Languages
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Country Modal */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Add New Country</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCountry} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country Code (ISO 3166-1 alpha-2)
                </label>
                <input
                  type="text"
                  value={newCountry.code}
                  onChange={(e) =>
                    setNewCountry({ ...newCountry, code: e.target.value.toUpperCase() })
                  }
                  required
                  maxLength={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg uppercase"
                  placeholder="SL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country Name
                </label>
                <input
                  type="text"
                  value={newCountry.name}
                  onChange={(e) =>
                    setNewCountry({ ...newCountry, name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Sierra Leone"
                />
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
                  Add Country
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

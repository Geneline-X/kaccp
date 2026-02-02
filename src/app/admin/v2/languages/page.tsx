"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";

import { useTranslations } from "next-intl";

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
  includeUniversalPrompts: boolean;
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
  const t = useTranslations();
  const searchParams = useSearchParams();
  const filterCountryId = searchParams.get("countryId");

  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);
  const [newLanguage, setNewLanguage] = useState({
    code: "",
    name: "",
    nativeName: "",
    countryId: "",
    targetMinutes: 12000,
    speakerRatePerMinute: 0.05,
    transcriberRatePerMin: 0.03,
    includeUniversalPrompts: true,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
        includeUniversalPrompts: true,
      });
    } catch {
      setError(t('common.error'));
    }
  };

  // Update existing language
  const handleUpdateLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLanguage) return;

    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/v2/languages/${editingLanguage.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editingLanguage.name,
          nativeName: editingLanguage.nativeName,
          targetMinutes: editingLanguage.targetMinutes,
          speakerRatePerMinute: editingLanguage.speakerRatePerMinute,
          transcriberRatePerMin: editingLanguage.transcriberRatePerMin,
          isActive: editingLanguage.isActive,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      // Update in list
      setLanguages(languages.map(l => l.id === editingLanguage.id ? { ...l, ...data.language } : l));
      setEditingLanguage(null);
    } catch {
      setError(t('common.error'));
    } finally {
      setSaving(false);
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
                {t('admin.backToDashboard')}
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                {t('admin.languagesPage.title')}
              </h1>
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('admin.languagesPage.addLanguage')}
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
              <option value="">{t('admin.languagesPage.allCountries')}</option>
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
            <p className="text-gray-500 mb-4">{t('admin.languagesPage.noLanguagesYet')}</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('admin.languagesPage.addFirstLanguage')}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.languagesPage.language')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.languagesPage.country')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.languagesPage.progress')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.languagesPage.rates')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.prompts')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('common.recordings')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.userDetailPage.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.languagesPage.actions')}
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
                      <td className="px-6 py-4 text-sm">
                        <div className="text-blue-600">{t('admin.usersPage.speaker')}: ${lang.speakerRatePerMinute?.toFixed(2)}</div>
                        <div className="text-green-600">{t('admin.usersPage.transcriber')}: ${lang.transcriberRatePerMin?.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {lang._count.prompts}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {lang._count.recordings}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded ${lang.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                            }`}
                        >
                          {lang.isActive ? t('admin.active') : t('admin.inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => setEditingLanguage(lang)}
                            className="text-sm text-blue-600 hover:underline text-left"
                          >
                            {t('admin.languagesPage.editRates')}
                          </button>
                          <Link
                            href={`/admin/v2/prompts?languageId=${lang.id}`}
                            className="text-sm text-gray-600 hover:underline"
                          >
                            {t('admin.languagesPage.managePrompts')}
                          </Link>
                        </div>
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
            <h2 className="text-xl font-bold mb-4">{t('admin.languagesPage.addNewLanguage')}</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateLanguage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.languagesPage.country')}
                </label>
                <select
                  value={newLanguage.countryId}
                  onChange={(e) =>
                    setNewLanguage({ ...newLanguage, countryId: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">{t('admin.languagesPage.selectCountry')}</option>
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
                    {t('admin.languagesPage.languageCode')}
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
                    {t('admin.languagesPage.languageName')}
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
                  {t('admin.languagesPage.nativeName')}
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
                  {t('admin.languagesPage.targetHours')}
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
                    {t('admin.languagesPage.speakerRate')}
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
                    {t('admin.languagesPage.transcriberRate')}
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeUniversalPrompts"
                  checked={newLanguage.includeUniversalPrompts}
                  onChange={(e) =>
                    setNewLanguage({ ...newLanguage, includeUniversalPrompts: e.target.checked })
                  }
                  className="rounded"
                />
                <label htmlFor="includeUniversalPrompts" className="text-sm text-gray-700">
                  {t('admin.languagesPage.includeUniversalPrompts')}
                </label>
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('admin.languagesPage.addLanguage')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Language Modal */}
      {
        editingLanguage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
              <h2 className="text-xl font-bold mb-4">
                {t('admin.languagesPage.editLanguageRates', { name: editingLanguage.name })}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleUpdateLanguage} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.languagesPage.languageName')}
                    </label>
                    <input
                      type="text"
                      value={editingLanguage.name}
                      onChange={(e) =>
                        setEditingLanguage({ ...editingLanguage, name: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.languagesPage.nativeName')}
                    </label>
                    <input
                      type="text"
                      value={editingLanguage.nativeName || ""}
                      onChange={(e) =>
                        setEditingLanguage({ ...editingLanguage, nativeName: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.languagesPage.targetHours')}
                  </label>
                  <input
                    type="number"
                    value={Math.round(editingLanguage.targetMinutes / 60)}
                    onChange={(e) =>
                      setEditingLanguage({
                        ...editingLanguage,
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
                      {t('admin.languagesPage.speakerRate')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingLanguage.speakerRatePerMinute}
                      onChange={(e) =>
                        setEditingLanguage({
                          ...editingLanguage,
                          speakerRatePerMinute: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.languagesPage.current')} ${editingLanguage.speakerRatePerMinute?.toFixed(2)}/min
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.languagesPage.transcriberRate')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingLanguage.transcriberRatePerMin}
                      onChange={(e) =>
                        setEditingLanguage({
                          ...editingLanguage,
                          transcriberRatePerMin: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.languagesPage.current')} ${editingLanguage.transcriberRatePerMin?.toFixed(2)}/min
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={editingLanguage.isActive}
                      onChange={(e) =>
                        setEditingLanguage({ ...editingLanguage, isActive: e.target.checked })
                      }
                      className="rounded"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">
                      {t('admin.languagesPage.languageIsActive')}
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="editIncludeUniversal"
                      checked={editingLanguage.includeUniversalPrompts}
                      onChange={(e) =>
                        setEditingLanguage({ ...editingLanguage, includeUniversalPrompts: e.target.checked })
                      }
                      className="rounded"
                    />
                    <label htmlFor="editIncludeUniversal" className="text-sm text-gray-700">
                      {t('admin.languagesPage.includeUniversalPrompts')}
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLanguage(null);
                      setError("");
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? t('admin.userDetailPage.saving') : t('admin.userDetailPage.saveChanges')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
}

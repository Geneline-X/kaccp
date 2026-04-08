"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";
import { useTranslations } from "next-intl";

interface Language {
  id: string;
  code: string;
  name: string;
  approvedMinutes: number;
  reviewedHours: number;
  country: {
    name: string;
  };
  _count: {
    recordings: number;
  };
}

interface Speaker {
  id: string;
  displayName: string | null;
}

interface ExportData {
  language: {
    code: string;
    name: string;
    country: string;
  };
  stats: {
    totalRecordings: number;
    totalDurationSec: number;
    totalDurationHours: number;
    uniqueSpeakers: number;
  };
  speakers: Speaker[];
  data: Array<{
    id: string;
    audio_file: string;
    transcription?: string;
    duration_sec: number;
    speaker_id: string;
    speaker_name: string;
    category: string;
  }>;
  exportedAt: string;
}

export default function AdminExportPage() {
  const t = useTranslations();
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  const [includeTranscriptions, setIncludeTranscriptions] = useState(true);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? getToken() : null;

  useEffect(() => {
    if (!token) {
      router.push("/admin/login");
      return;
    }

    fetch("/api/v2/languages?activeOnly=false", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(async (data) => {
        const langs: Language[] = data.languages || [];
        // Fetch reviewed hours per language from export stats
        const withStats = await Promise.all(
          langs.map(async (lang) => {
            try {
              const res = await fetch(
                `/api/v2/admin/export?languageId=${lang.id}&format=json&preview=true&includeTranscriptions=false`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              const d = await res.json();
              return { ...lang, reviewedHours: d.stats?.totalDurationHours || 0 };
            } catch {
              return { ...lang, reviewedHours: 0 };
            }
          })
        );
        setLanguages(withStats);
        if (withStats.length > 0) {
          setSelectedLanguage(withStats[0].id);
        }
        setLoading(false);
      });
  }, [token, router]);

  // Fetch speakers for the selected language
  useEffect(() => {
    if (!token || !selectedLanguage) return;
    fetch(`/api/v2/admin/export?languageId=${selectedLanguage}&format=json&preview=true&includeTranscriptions=false`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.speakers) setSpeakers(data.speakers);
      })
      .catch(() => {});
  }, [token, selectedLanguage]);

  const buildParams = (format: string, { preview = false } = {}) => {
    const params = new URLSearchParams({ languageId: selectedLanguage, format });
    if (selectedSpeaker) params.set("speakerId", selectedSpeaker);
    if (!includeTranscriptions) params.set("includeTranscriptions", "false");
    if (preview) params.set("preview", "true");
    return params.toString();
  };

  const handlePreview = async () => {
    if (!selectedLanguage) return;

    setExporting(true);
    setError("");
    setExportData(null);

    try {
      const res = await fetch(
        `/api/v2/admin/export?${buildParams("json", { preview: true })}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      setExportData(data);
      if (data.speakers) setSpeakers(data.speakers);
    } catch {
      setError("Failed to fetch export data");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (!selectedLanguage) return;
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`/api/v2/admin/export?${buildParams("csv")}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("Failed to download CSV");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      a.download = disposition?.match(/filename=(.+)/)?.[1] || "export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download CSV");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadJSON = async () => {
    if (!selectedLanguage) return;
    setExporting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/v2/admin/export?${buildParams("json")}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.language.code}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download JSON");
    } finally {
      setExporting(false);
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
                {t('admin.exportPage.title')}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Export Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('admin.exportPage.selectLanguageToExport')}
          </h2>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.exportPage.language')}
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  setSelectedSpeaker("");
                  setSpeakers([]);
                  setExportData(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                {languages.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name} ({lang.code}) - {lang.reviewedHours}h reviewed
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Speaker
              </label>
              <select
                value={selectedSpeaker}
                onChange={(e) => {
                  setSelectedSpeaker(e.target.value);
                  setExportData(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All speakers</option>
                {speakers.map((s) => (
                  <option key={s.id} value={s.id}>{s.displayName || s.id}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pb-1">
              <input
                type="checkbox"
                id="includeTranscriptions"
                checked={includeTranscriptions}
                onChange={(e) => {
                  setIncludeTranscriptions(e.target.checked);
                  setExportData(null);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="includeTranscriptions" className="text-sm text-gray-700">
                Include transcriptions
              </label>
            </div>

            <button
              onClick={handlePreview}
              disabled={exporting || !selectedLanguage}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting ? t('admin.exportPage.loading') : t('admin.exportPage.previewExport')}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Export Preview */}
        {exportData && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('admin.exportPage.exportPreview')} {exportData.language.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {exportData.language.country}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {t('admin.exportPage.downloadCSV')}
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {t('admin.exportPage.downloadJSON')}
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t('admin.exportPage.totalRecordings')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {exportData.stats.totalRecordings}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('admin.exportPage.totalDuration')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {exportData.stats.totalDurationHours}h
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('admin.exportPage.uniqueSpeakers')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {exportData.stats.uniqueSpeakers}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('admin.exportPage.exportedAt')}</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(exportData.exportedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Sample Data */}
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                {t('admin.exportPage.sampleData')}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('admin.exportPage.id')}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('admin.exportPage.audioPath')}
                      </th>
                      {includeTranscriptions && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {t('admin.recordingsPage.transcription')}
                        </th>
                      )}
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('admin.exportPage.duration')}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Speaker
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('admin.promptsPage.category')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {exportData.data.slice(0, 10).map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">
                          {row.id}
                        </td>
                        <td className="px-4 py-2 text-xs font-mono text-gray-500 max-w-[200px] truncate" title={row.audio_file}>
                          {row.audio_file?.split('/').slice(-2).join('/')}
                        </td>
                        {includeTranscriptions && (
                          <td className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate">
                            {row.transcription}
                          </td>
                        )}
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {row.duration_sec?.toFixed(1)}s
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {row.speaker_name}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {row.category}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CSV Format Info */}
            <div className="p-6 bg-blue-50 border-t border-blue-100">
              <h3 className="font-semibold text-blue-900 mb-2">
                {t('admin.exportPage.csvExportFormat')}
              </h3>
              <p className="text-sm text-blue-800 mb-2">
                {t('admin.exportPage.csvDescription')}
              </p>
              <code className="block bg-blue-100 p-3 rounded text-sm text-blue-900 overflow-x-auto">
                {includeTranscriptions
                  ? "id|audio_path|transcription"
                  : "id|audio_path|english_prompt|duration_sec|speaker_id|speaker_name|category"}
              </code>
              <div className="mt-4 text-sm text-blue-700">
                <p className="font-medium mb-1">{t('admin.exportPage.audioPathFormat')}</p>
                <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                  gs://bucket/{'{country}'}/{'{language}'}/recordings/{'{speaker_id}'}/{'{timestamp}'}_{'{random}'}.wav
                </code>
              </div>
              <p className="text-sm text-blue-700 mt-3">
                Use <code className="bg-blue-100 px-1 rounded">gsutil -m cp gs://bucket/country/language/recordings/* ./wavs/</code> to download all audio files.
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!exportData && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('admin.exportPage.exportInstructions')}
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>{t('admin.exportPage.instruction1')}</li>
              <li>{t('admin.exportPage.instruction2')}</li>
              <li>{t('admin.exportPage.instruction3')}</li>
              <li>{t('admin.exportPage.instruction4')}</li>
            </ol>

            <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">
                {t('admin.exportPage.noteOnAudioFiles')}
              </h3>
              <p className="text-sm text-yellow-700">
                {t('admin.exportPage.audioFilesNote')}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

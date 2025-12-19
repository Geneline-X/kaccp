"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";

interface Language {
  id: string;
  code: string;
  name: string;
  approvedMinutes: number;
  country: {
    name: string;
  };
  _count: {
    recordings: number;
  };
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
  data: any[];
  exportedAt: string;
}

export default function AdminExportPage() {
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
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
      .then((data) => {
        setLanguages(data.languages || []);
        if (data.languages?.length > 0) {
          setSelectedLanguage(data.languages[0].id);
        }
        setLoading(false);
      });
  }, [token, router]);

  const handlePreview = async () => {
    if (!selectedLanguage) return;

    setExporting(true);
    setError("");
    setExportData(null);

    try {
      const res = await fetch(
        `/api/v2/admin/export?languageId=${selectedLanguage}&format=json`,
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
    } catch (err) {
      setError("Failed to fetch export data");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!selectedLanguage) return;
    window.open(
      `/api/v2/admin/export?languageId=${selectedLanguage}&format=csv`,
      "_blank"
    );
  };

  const handleDownloadJSON = () => {
    if (!exportData) return;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportData.language.code}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
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
                Export Data for TTS
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Export Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Select Language to Export
          </h2>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  setExportData(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                {languages.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name} ({lang.code}) - {Math.round(lang.approvedMinutes / 60)}h approved
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handlePreview}
              disabled={exporting || !selectedLanguage}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting ? "Loading..." : "Preview Export"}
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
                    Export Preview: {exportData.language.name}
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
                    Download CSV (LJSpeech)
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Download JSON
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Recordings</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {exportData.stats.totalRecordings}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Duration</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {exportData.stats.totalDurationHours}h
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Unique Speakers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {exportData.stats.uniqueSpeakers}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Exported At</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(exportData.exportedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Sample Data */}
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Sample Data (first 10 records)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        ID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Audio Path
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Transcription
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Duration
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Category
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {exportData.data.slice(0, 10).map((row: any) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">
                          {row.id}
                        </td>
                        <td className="px-4 py-2 text-xs font-mono text-gray-500 max-w-[200px] truncate" title={row.audio_file}>
                          {row.audio_file?.split('/').slice(-2).join('/')}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate">
                          {row.transcription}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {row.duration_sec?.toFixed(1)}s
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
                CSV Export Format
              </h3>
              <p className="text-sm text-blue-800 mb-2">
                The CSV export uses pipe-separated values with the following columns:
              </p>
              <code className="block bg-blue-100 p-3 rounded text-sm text-blue-900 overflow-x-auto">
                id|audio_path|transcription|english_prompt|duration_sec|speaker_id|category
              </code>
              <div className="mt-4 text-sm text-blue-700">
                <p className="font-medium mb-1">Audio Path Format:</p>
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
              Export Instructions
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Select a language from the dropdown above</li>
              <li>Click "Preview Export" to see the data summary</li>
              <li>Download in CSV format (LJSpeech-compatible) or JSON format</li>
              <li>Use the audio file paths to download the corresponding WAV files from GCS</li>
            </ol>

            <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">
                Note on Audio Files
              </h3>
              <p className="text-sm text-yellow-700">
                Audio files are stored in Google Cloud Storage. The export contains
                the GCS paths. You'll need to use gsutil or the GCS console to
                download the actual audio files for TTS training.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

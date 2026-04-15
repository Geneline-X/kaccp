"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/infra/client/client";

import { useTranslations } from "next-intl";

import PromptsGrid from "@/components/admin/prompts/prompts-grid";

interface Language {
  id: string;
  code: string;
  name: string;
}

interface Prompt {
  id: string;
  englishText: string;
  category: string;
  emotion: string;
  instruction?: string;
  isFreeForm?: boolean;
  isActive: boolean;
  timesRecorded: number;
  language: Language;
  // Extras
  targetDurationSec?: number;
}

const CATEGORIES = [
  "GREETINGS",
  "NUMBERS_MONEY",
  "QUESTIONS",
  "COMMANDS_REQUESTS",
  "EMOTIONS_HAPPY",
  "EMOTIONS_SAD",
  "DAILY_LIFE",
  "MARKET_SHOPPING",
  "DIRECTIONS_PLACES",
  "FAMILY_PEOPLE",
  "HEALTH",
  "WEATHER_TIME",
  "LOCAL_SCENARIOS",
  "PHONETIC_COVERAGE",
  "CONVERSATIONS",
  "SHORT_PHRASES",
  "PLACE_NAMES",
  "PROVERBS",
  "PASTORAL_LIFE",
  "RELIGION_FAITH",
  "FUNCTIONAL_PHRASES",
];

const EMOTIONS = [
  "NEUTRAL",
  "HAPPY",
  "SAD",
  "ANGRY",
  "QUESTION",
  "EXCITED",
  "SURPRISED",
  "WHISPER",
  "URGENT",
];

export default function AdminPromptsPage() {
  const router = useRouter();
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [languages, setLanguages] = useState<Language[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [isGridView, setIsGridView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // New prompt form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    englishText: "",
    category: "GREETINGS",
    emotion: "NEUTRAL",
    instruction: "",
    languageId: "",
    isFreeForm: false,
  });

  // Generate Topics modal
  const [showGenerateTopics, setShowGenerateTopics] = useState(false);
  const [generateCategories, setGenerateCategories] = useState<string[]>(["DAILY_LIFE"]);
  const [generateCount, setGenerateCount] = useState(20);
  const [generateLanguageId, setGenerateLanguageId] = useState("");
  const [generatedTopics, setGeneratedTopics] = useState<{ text: string; category: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingTopics, setSavingTopics] = useState(false);

  // Separate state for bulk import language (so it doesn't mutate the main filter)
  const [importLanguageId, setImportLanguageId] = useState("ALL");

  // Bulk import
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const token = typeof window !== "undefined" ? getToken() : null;

  // Fetch languages
  useEffect(() => {
    if (!token) {
      router.push("/admin/login");
      return;
    }

    fetch("/api/v2/languages", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setLanguages(data.languages || []);
      });
  }, [token, router]);

  // Fetch prompts when filters change
  useEffect(() => {
    if (!token) return;

    setLoading(true);

    // In Grid View, we fetch ALL prompts (limit=-1) to allow full scrolling
    // In List View, we use pagination (limit 50)
    const limit = isGridView ? "-1" : "50";

    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit,
      activeOnly: "false",
    });

    // Only send languageId when a specific filter is chosen
    if (selectedLanguage) params.set("languageId", selectedLanguage);
    if (selectedCategory) params.set("category", selectedCategory);
    if (searchQuery) params.set("search", searchQuery);

    const timer = setTimeout(() => {
      fetch(`/api/v2/prompts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setPrompts(data.prompts || []);
          setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
          setLoading(false);
          setSelectedPromptIds(new Set());
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedLanguage, selectedCategory, pagination.page, isGridView, searchQuery, token, refreshKey]);

  // Create new prompt
  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/v2/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          languageId: newPrompt.languageId || "ALL",
          englishText: newPrompt.englishText,
          category: newPrompt.category,
          emotion: newPrompt.emotion,
          instruction: newPrompt.instruction,
          isFreeForm: newPrompt.isFreeForm,
        }),
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      setPrompts([data.prompt, ...prompts]);
      setShowNewForm(false);
      setNewPrompt({
        englishText: "",
        category: "GREETINGS",
        emotion: "NEUTRAL",
        instruction: "",
        languageId: "",
        isFreeForm: false,
      });
    } catch {
      alert("Failed to create prompt");
    }
  };

  // Parse CSV file - handles quoted values with commas inside
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target?.result as string;
      // Remove BOM if present
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }

      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length === 0) {
        alert("File is empty");
        return;
      }

      // Parse header row
      const originalHeaders = parseCSVLine(lines[0]).map((h) =>
        h.replace(/^"|"$/g, "").trim()
      );

      // Normalize headers to match expected keys
      const headers = originalHeaders.map(h => h.toLowerCase().replace(/\s+/g, '_'));

      console.log("Parsed headers:", headers); // Debug log

      const requiredField = "english_text";
      if (!headers.includes(requiredField)) {
        alert(`Missing required column: ${requiredField}. Found: ${headers.join(", ")}`);
        return;
      }

      // Parse data rows
      const data = lines.slice(1).map((line) => {
        const values = parseCSVLine(line);
        const obj: any = {};
        headers.forEach((header, i) => {
          // Remove surrounding quotes and trim
          const value = values[i]?.replace(/^"|"$/g, "").trim() || "";
          obj[header] = value;
        });
        return obj;
      }).filter((row) => row.english_text); // Filter out empty rows

      if (data.length === 0) {
        alert("No valid rows found. Check that the 'english_text' column is not empty.");
      }

      setCsvData(data);
    };
    reader.readAsText(file);
  };

  // Bulk import prompts
  const handleBulkImport = async () => {
    if (!importLanguageId || csvData.length === 0) return;

    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch("/api/v2/prompts/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          languageId: importLanguageId,
          prompts: csvData,
        }),
      });

      const data = await res.json();
      setImportResult(data);

      if (data.success) {
        // Refresh prompts list
        setPagination({ ...pagination, page: 1 });
        // Clear data on success to prevent re-import
        setTimeout(() => {
          alert(`Successfully imported ${data.imported} prompts!`);
          setShowBulkImport(false);
          setCsvData([]);
          setImportResult(null);
        }, 500);
      }
    } catch {
      setImportResult({ error: "Failed to import prompts" });
    } finally {
      setImporting(false);
    }
  };

  // Delete prompt
  const handleDeletePrompt = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prompt? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/v2/prompts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setPrompts(prompts.filter((p) => p.id !== id));
        setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete prompt");
      }
    } catch {
      alert("Failed to delete prompt");
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedPromptIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedPromptIds.size} prompts?`)) {
      return;
    }

    try {
      const res = await fetch("/api/v2/prompts/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ promptIds: Array.from(selectedPromptIds) }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        // Remove deleted from UI
        setPrompts(prompts.filter(p => !selectedPromptIds.has(p.id)));
        setPagination(prev => ({ ...prev, total: prev.total - data.deleted }));
        setSelectedPromptIds(new Set());

        // If we deleted everything on this page, reload to fetch next page
        if (data.deleted === prompts.length) {
          setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }));
        }

        // Re-fetch to be safe if failed > 0
        if (data.failed > 0) {
          // Optional: trigger a re-fetch logic if you extracted it to a function
        }
      } else {
        alert(data.error || data.message || "Failed to bulk delete");
      }
    } catch {
      alert("Failed to execute bulk delete");
    }
  };

  const toggleSelectAll = () => {
    if (selectedPromptIds.size === prompts.length && prompts.length > 0) {
      setSelectedPromptIds(new Set());
    } else {
      setSelectedPromptIds(new Set(prompts.map(p => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedPromptIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPromptIds(newSet);
  };

  // Download CSV template
  const downloadTemplate = () => {
    window.open("/api/v2/prompts/bulk", "_blank");
  };

  // Export current prompts to CSV
  const handleExportCSV = async () => {
    if (!selectedLanguage || !token) return;

    setExporting(true);
    try {
      // Use current search and category filters
      const params = new URLSearchParams({
        languageId: selectedLanguage,
        limit: "-1", // Fetch all matching current filters
        activeOnly: "false",
      });
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/v2/prompts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const exportPrompts = data.prompts || [];

      if (exportPrompts.length === 0) {
        alert("No prompts to export matching current filters");
        return;
      }

      // CSV Header
      const csvHeaders = ["english_text", "category", "emotion", "instruction", "target_duration_sec", "isActive", "timesRecorded"];

      // Helper to escape CSV values
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return "";
        let str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      // Map to rows
      const csvRows = exportPrompts.map((p: any) => [
        p.englishText,
        p.category,
        p.emotion,
        p.instruction || "",
        p.targetDurationSec || 5,
        p.isActive,
        p.timesRecorded
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row: any[]) => row.map(escapeCSV).join(","))
      ].join("\n");

      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const langName = languages.find(l => l.id === selectedLanguage)?.name || "prompts";
      link.setAttribute("href", url);
      link.setAttribute("download", `${langName.toLowerCase().replace(/\s+/g, "_")}_prompts_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert("Failed to export prompts");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/admin/v2" className="text-blue-600 hover:underline text-sm">
                {t('admin.backToDashboard')}
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                {t('admin.promptsPage.title')}
              </h1>
            </div>
            <div className="flex gap-2">
              {selectedPromptIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {t('admin.promptsPage.deleteSelected', { count: selectedPromptIds.size })}
                </button>
              )}
              <button
                onClick={() => {
                  // Initialize import language from current filter (default to universal)
                  setImportLanguageId(
                    (selectedLanguage && selectedLanguage !== "UNIVERSAL") ? selectedLanguage : "ALL"
                  );
                  setShowBulkImport(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {t('admin.promptsPage.bulkImportCSV')}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting || prompts.length === 0}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('admin.exporting')}
                  </>
                ) : (
                  t('admin.export') + " CSV"
                )}
              </button>
              <button
                onClick={() => {
                  setGenerateLanguageId(
                    (selectedLanguage && selectedLanguage !== "UNIVERSAL") ? selectedLanguage : ""
                  );
                  setGenerateCategories(["DAILY_LIFE"]);
                  setGenerateCount(20);
                  setGeneratedTopics([]);
                  setShowGenerateTopics(true);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Generate Topics
              </button>
              <button
                onClick={() => {
                  setNewPrompt({
                    englishText: "",
                    category: "GREETINGS",
                    emotion: "NEUTRAL",
                    instruction: "",
                    // Pre-fill from current filter, but only if it's a real language ID
                    languageId: (selectedLanguage && selectedLanguage !== "UNIVERSAL") ? selectedLanguage : "",
                    isFreeForm: false,
                  });
                  setShowNewForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('admin.promptsPage.newPrompt')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters and Toggle */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.languages')}
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => { setSelectedLanguage(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">{t('admin.promptsPage.allLanguages')}</option>
                  <option value="UNIVERSAL">{t('admin.promptsPage.universal')}</option>
                  {languages.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name} ({lang.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.promptsPage.search')}
                </label>
                <input
                  type="text"
                  placeholder={t('admin.promptsPage.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.category')}
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">{t('admin.promptsPage.allCategories')}</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{t('admin.promptsPage.view')}:</span>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setIsGridView(false)}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${!isGridView ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t('admin.promptsPage.list')}
                </button>
                <button
                  onClick={() => setIsGridView(true)}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${isGridView ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t('admin.promptsPage.grid')}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
            <span>{pagination.total} {t('admin.promptsPage.promptsFound')}</span>
            {isGridView && <span>{t('admin.promptsPage.localEditsWarning')}</span>}
          </div>
        </div>

        {/* Prompts Content */}
        {
          isGridView ? (
            <PromptsGrid
              initialPrompts={prompts}
              languageId={selectedLanguage}
              onSave={() => setRefreshKey(k => k + 1)}
            />
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 w-10">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={prompts.length > 0 && selectedPromptIds.size === prompts.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('admin.promptsPage.englishText')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('admin.category')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('admin.promptsPage.emotion')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('admin.languagesPage.recordings')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('admin.userDetailPage.status')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t('admin.languagesPage.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        {t('admin.loading')}
                      </td>
                    </tr>
                  ) : prompts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        {t('admin.promptsPage.noPromptsFound')}
                      </td>
                    </tr>
                  ) : (
                    prompts.map((prompt) => (
                      <tr key={prompt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={selectedPromptIds.has(prompt.id)}
                            onChange={() => toggleSelectOne(prompt.id)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-gray-900 max-w-md truncate">
                              {prompt.englishText}
                            </div>
                            {prompt.isFreeForm && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded-full whitespace-nowrap flex-shrink-0">
                                Free Speech
                              </span>
                            )}
                          </div>
                          {prompt.instruction && (
                            <div className="text-xs text-gray-500 italic">
                              {prompt.instruction}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {prompt.category.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                            {prompt.emotion}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {prompt.timesRecorded}x
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded ${prompt.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {prompt.isActive ? t('admin.active') : t('admin.inactive')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeletePrompt(prompt.id)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            {t('admin.usersPage.delete')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                  >
                    {t('admin.promptsPage.previous')}
                  </button>
                  <span className="text-sm text-gray-500">
                    {t('admin.recordingsPage.page')} {pagination.page} {t('admin.recordingsPage.of')} {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                  >
                    {t('admin.promptsPage.next')}
                  </button>
                </div>
              )}
            </div>
          )
        }
      </main >

      {/* New Prompt Modal */}
      {
        showNewForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
              <h2 className="text-xl font-bold mb-4">{t('admin.promptsPage.createHeader')}</h2>
              <form onSubmit={handleCreatePrompt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.languages')}
                  </label>
                  <select
                    value={newPrompt.languageId}
                    onChange={(e) => setNewPrompt({ ...newPrompt, languageId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">{t('admin.promptsPage.universal')}</option>
                    {languages.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name} ({lang.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.promptsPage.englishText')}
                  </label>
                  <textarea
                    value={newPrompt.englishText}
                    onChange={(e) =>
                      setNewPrompt({ ...newPrompt, englishText: e.target.value })
                    }
                    required
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder={t('admin.promptsPage.englishTextPlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.category')}
                    </label>
                    <select
                      value={newPrompt.category}
                      onChange={(e) =>
                        setNewPrompt({ ...newPrompt, category: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.promptsPage.emotion')}
                    </label>
                    <select
                      value={newPrompt.emotion}
                      onChange={(e) =>
                        setNewPrompt({ ...newPrompt, emotion: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      {EMOTIONS.map((em) => (
                        <option key={em} value={em}>
                          {em}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.promptsPage.instruction')}
                  </label>
                  <input
                    type="text"
                    value={newPrompt.instruction}
                    onChange={(e) =>
                      setNewPrompt({ ...newPrompt, instruction: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder={t('admin.promptsPage.instructionPlaceholder')}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPrompt.isFreeForm}
                      onChange={(e) =>
                        setNewPrompt({ ...newPrompt, isFreeForm: e.target.checked })
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Free Speech (topic-based, no exact text to read)
                    </span>
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {t('admin.promptsPage.createButton')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Bulk Import Modal */}
      {
        showBulkImport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">{t('admin.promptsPage.bulkImportHeader')}</h2>

              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">{t('admin.promptsPage.csvRequirementsHeader')}</h3>
                <p className="text-sm text-blue-800 mb-2">
                  {t('admin.promptsPage.csvRequirementsDesc')}
                </p>
                <ul className="text-sm text-blue-700 list-disc pl-5 space-y-1 mb-3">
                  <li><strong>english_text</strong> ({t('admin.required')}) - {t('admin.promptsPage.englishTextDesc')}</li>
                  <li><strong>category</strong> ({t('admin.required')}) - {t('admin.promptsPage.categoryDesc')}</li>
                  <li><strong>emotion</strong> ({t('admin.optional')}) - NEUTRAL, HAPPY, SAD, ANGRY...</li>
                  <li><strong>instruction</strong> ({t('admin.optional')}) - {t('admin.promptsPage.instructionDesc')}</li>
                  <li><strong>target_duration_sec</strong> ({t('admin.optional')}) - {t('admin.promptsPage.durationDesc')}</li>
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={downloadTemplate}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t('admin.promptsPage.downloadTemplate')}
                  </button>
                  <span className="text-blue-400">|</span>
                  <a
                    href="/sample_prompts.csv"
                    download
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t('admin.promptsPage.downloadSample')}
                  </a>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.promptsPage.targetLanguage')}
                </label>
                <select
                  value={importLanguageId}
                  onChange={(e) => setImportLanguageId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="ALL">{t('admin.promptsPage.universal')}</option>
                  {languages.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name} ({lang.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.promptsPage.csvFile')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {csvData.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-green-600 mb-2">
                    ✓ {t('admin.promptsPage.promptsParsed', { count: csvData.length })}
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                    {csvData.slice(0, 5).map((row, i) => (
                      <div key={i} className="text-xs text-gray-600 truncate">
                        {row.english_text} ({row.category})
                      </div>
                    ))}
                    {csvData.length > 5 && (
                      <div className="text-xs text-gray-400">
                        {t('admin.promptsPage.andMore', { count: csvData.length - 5 })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {importResult && (
                <div
                  className={`mb-4 p-3 rounded-lg ${importResult.success
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                    }`}
                >
                  {importResult.success ? (
                    <>
                      <p>✓ Imported {importResult.imported} prompts</p>
                      {importResult.errorCount > 0 && (
                        <p className="text-sm">
                          {t('admin.promptsPage.rowsWithErrors', { count: importResult.errorCount })}
                        </p>
                      )}
                    </>
                  ) : (
                    <p>{importResult.error}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkImport(false);
                    setCsvData([]);
                    setImportResult(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  {t('common.close')}
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={!importLanguageId || csvData.length === 0 || importing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? t('admin.importing') : t('admin.promptsPage.importButton', { count: csvData.length })}
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Generate Topics Modal */}
      {showGenerateTopics && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Generate Free Speech Topics</h2>
            <p className="text-sm text-gray-500 mb-4">
              Use AI to generate narrow, specific scenario prompts that speakers can talk about in 5-10 seconds.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select
                  value={generateLanguageId}
                  onChange={(e) => setGenerateLanguageId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Universal</option>
                  {languages.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name} ({lang.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Count per category</label>
                <input
                  type="number"
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min={1}
                  max={200}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categories ({generateCategories.length} selected)
                <button
                  type="button"
                  onClick={() => setGenerateCategories(generateCategories.length === CATEGORIES.length ? [] : [...CATEGORIES])}
                  className="ml-2 text-xs text-purple-600 hover:text-purple-800"
                >
                  {generateCategories.length === CATEGORIES.length ? "Deselect all" : "Select all"}
                </button>
              </label>
              <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={generateCategories.includes(cat)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setGenerateCategories([...generateCategories, cat]);
                        } else {
                          setGenerateCategories(generateCategories.filter((c) => c !== cat));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="truncate">{cat.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={async () => {
                if (generateCategories.length === 0) {
                  alert("Select at least one category");
                  return;
                }
                setGenerating(true);
                setGeneratedTopics([]);
                try {
                  const allTopics: { text: string; category: string }[] = [];
                  let totalDupsRemoved = 0;
                  for (const cat of generateCategories) {
                    const res = await fetch("/api/v2/prompts/generate", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ category: cat, count: generateCount }),
                    });
                    const data = await res.json();
                    if (data.topics) {
                      allTopics.push(...data.topics.map((t: string) => ({ text: t, category: cat })));
                    }
                    if (data.duplicatesRemoved) {
                      totalDupsRemoved += data.duplicatesRemoved;
                    }
                  }
                  if (allTopics.length > 0) {
                    setGeneratedTopics(allTopics);
                    if (totalDupsRemoved > 0) {
                      alert(`${totalDupsRemoved} duplicate topics (already in DB) were removed.`);
                    }
                  } else {
                    alert(totalDupsRemoved > 0 ? `All generated topics already exist in the database (${totalDupsRemoved} duplicates removed).` : "Failed to generate topics");
                  }
                } catch {
                  alert("Failed to generate topics");
                } finally {
                  setGenerating(false);
                }
              }}
              disabled={generating || generateCategories.length === 0}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 mb-4"
            >
              {generating ? `Generating (${generateCategories.length} categories)...` : `Generate Topics (${generateCategories.length} × ${generateCount})`}
            </button>

            {generatedTopics.length > 0 && (
              <>
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {generatedTopics.length} topics generated — review and edit before saving:
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {generatedTopics.map((topic, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-6 flex-shrink-0">{i + 1}.</span>
                        <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded flex-shrink-0">
                          {topic.category.replace(/_/g, " ")}
                        </span>
                        <input
                          type="text"
                          value={topic.text}
                          onChange={(e) => {
                            const updated = [...generatedTopics];
                            updated[i] = { ...updated[i], text: e.target.value };
                            setGeneratedTopics(updated);
                          }}
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded"
                        />
                        <button
                          onClick={() => setGeneratedTopics(generatedTopics.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-600 text-xs flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setSavingTopics(true);
                    try {
                      const res = await fetch("/api/v2/prompts/bulk", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          languageId: generateLanguageId || "ALL",
                          prompts: generatedTopics.filter(t => t.text.trim()).map((topic) => ({
                            english_text: topic.text,
                            category: topic.category,
                            emotion: "NEUTRAL",
                            is_free_form: "true",
                          })),
                        }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        alert(`Saved ${data.imported} free speech topics!`);
                        setShowGenerateTopics(false);
                        setGeneratedTopics([]);
                        setRefreshKey((k) => k + 1);
                      } else {
                        alert(data.error || "Failed to save topics");
                      }
                    } catch {
                      alert("Failed to save topics");
                    } finally {
                      setSavingTopics(false);
                    }
                  }}
                  disabled={savingTopics || generatedTopics.length === 0}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {savingTopics ? "Saving..." : `Save ${generatedTopics.length} Topics as Free Speech Prompts`}
                </button>
              </>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowGenerateTopics(false);
                  setGeneratedTopics([]);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";

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

  // New prompt form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    englishText: "",
    category: "GREETINGS",
    emotion: "NEUTRAL",
    instruction: "",
  });

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
        // Default to ALL (Universal)
        setSelectedLanguage("ALL");
      });
  }, [token, router]);

  // Fetch prompts when filters change
  useEffect(() => {
    if (!selectedLanguage || !token) return;

    setLoading(true);

    // In Grid View, we fetch ALL prompts (limit=-1) to allow full scrolling
    // In List View, we use pagination (limit 50)
    const limit = isGridView ? "-1" : "50";

    const params = new URLSearchParams({
      languageId: selectedLanguage,
      page: pagination.page.toString(),
      limit,
      activeOnly: "false",
    });

    if (selectedCategory) {
      params.set("category", selectedCategory);
    }

    if (searchQuery) {
      params.set("search", searchQuery);
    }

    // Debounce search if needed, but for now direct effect is okay (or separate search effect)
    const timer = setTimeout(() => {
      fetch(`/api/v2/prompts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setPrompts(data.prompts || []);
          setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
          setLoading(false);
          // Don't reset selection here to allow actions across pages if sophisticated, 
          // but for safety/simplicity we usually reset. 
          // However, in Grid View "All" mode, we might want to keep selection? 
          // For now, consistent behavior:
          setSelectedPromptIds(new Set());
        });
    }, 300); // 300ms debounce for search

    return () => clearTimeout(timer);
  }, [selectedLanguage, selectedCategory, pagination.page, isGridView, searchQuery, token]);

  // Create new prompt
  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLanguage) return;

    try {
      const res = await fetch("/api/v2/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          languageId: selectedLanguage,
          ...newPrompt,
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
    if (!selectedLanguage || csvData.length === 0) return;

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
          languageId: selectedLanguage,
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
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                Prompt Management
              </h1>
            </div>
            <div className="flex gap-2">
              {selectedPromptIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Selected ({selectedPromptIds.size})
                </button>
              )}
              <button
                onClick={() => setShowBulkImport(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Bulk Import CSV
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting || prompts.length === 0}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Exporting...
                  </>
                ) : (
                  "Export CSV"
                )}
              </button>
              <button
                onClick={() => setShowNewForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + New Prompt
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
                  Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="ALL">All Languages (Universal)</option>
                  {languages.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name} ({lang.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setIsGridView(false)}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${!isGridView ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  List
                </button>
                <button
                  onClick={() => setIsGridView(true)}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${isGridView ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Grid (Excel-like)
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
            <span>{pagination.total} prompts found</span>
            {isGridView && <span>All edits are local until saved</span>}
          </div>
        </div>

        {/* Prompts Content */}
        {
          isGridView ? (
            <PromptsGrid
              initialPrompts={prompts}
              languageId={selectedLanguage}
              onSave={() => {
                // Trigger re-fetch
                const currentLang = selectedLanguage;
                setSelectedLanguage(""); // Force reset to trigger effect
                setTimeout(() => setSelectedLanguage(currentLang), 0);
              }}
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
                      English Text
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Emotion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Recorded
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : prompts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        No prompts found. Create one or import from CSV.
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
                          <div className="text-sm text-gray-900 max-w-md truncate">
                            {prompt.englishText}
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
                            {prompt.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeletePrompt(prompt.id)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            Delete
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
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                  >
                    Next
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
              <h2 className="text-xl font-bold mb-4">Create New Prompt</h2>
              <form onSubmit={handleCreatePrompt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    English Text
                  </label>
                  <textarea
                    value={newPrompt.englishText}
                    onChange={(e) =>
                      setNewPrompt({ ...newPrompt, englishText: e.target.value })
                    }
                    required
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Enter the English text speakers will translate..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
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
                      Emotion
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
                    Instruction (optional)
                  </label>
                  <input
                    type="text"
                    value={newPrompt.instruction}
                    onChange={(e) =>
                      setNewPrompt({ ...newPrompt, instruction: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Say with excitement"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Prompt
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
              <h2 className="text-xl font-bold mb-4">Bulk Import Prompts</h2>

              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">CSV Format Requirements</h3>
                <p className="text-sm text-blue-800 mb-2">
                  Your CSV must have these columns (in the header row):
                </p>
                <ul className="text-sm text-blue-700 list-disc pl-5 space-y-1 mb-3">
                  <li><strong>english_text</strong> (required) - The English prompt text</li>
                  <li><strong>category</strong> (required) - One of: GREETINGS, NUMBERS_MONEY, QUESTIONS, COMMANDS_REQUESTS, EMOTIONS_HAPPY, EMOTIONS_SAD, DAILY_LIFE, MARKET_SHOPPING, DIRECTIONS_PLACES, FAMILY_PEOPLE, HEALTH, WEATHER_TIME, LOCAL_SCENARIOS, PHONETIC_COVERAGE, CONVERSATIONS</li>
                  <li><strong>emotion</strong> (optional) - One of: NEUTRAL, HAPPY, SAD, ANGRY, QUESTION, EXCITED, SURPRISED, WHISPER, URGENT</li>
                  <li><strong>instruction</strong> (optional) - Extra guidance for speakers</li>
                  <li><strong>target_duration_sec</strong> (optional) - Expected duration (default: 5)</li>
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={downloadTemplate}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Download CSV Template
                  </button>
                  <span className="text-blue-400">|</span>
                  <a
                    href="/sample_prompts.csv"
                    download
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Download Sample (50 prompts)
                  </a>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="ALL">Universal (All Languages)</option>
                  {languages.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name} ({lang.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSV File
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
                    ✓ {csvData.length} prompts parsed from CSV
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                    {csvData.slice(0, 5).map((row, i) => (
                      <div key={i} className="text-xs text-gray-600 truncate">
                        {row.english_text} ({row.category})
                      </div>
                    ))}
                    {csvData.length > 5 && (
                      <div className="text-xs text-gray-400">
                        ...and {csvData.length - 5} more
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
                          {importResult.errorCount} rows had errors
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
                  Close
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={!selectedLanguage || csvData.length === 0 || importing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? "Importing..." : `Import ${csvData.length} Prompts`}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

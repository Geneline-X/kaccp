"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/infra/client/client";
import { useTranslations } from "next-intl";

interface Language {
  id: string;
  code: string;
  name: string;
}

interface WordEntry {
  id: string;
  word: string;
  category: string | null;
  createdAt: string;
}

export default function AdminWordBankPage() {
  const router = useRouter();
  const t = useTranslations();

  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [wordCount, setWordCount] = useState(0);

  // Add word modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [singleWord, setSingleWord] = useState("");
  const [bulkWords, setBulkWords] = useState("");
  const [wordCategory, setWordCategory] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Fetch words when language or search changes
  const fetchWords = useCallback(() => {
    if (!token || !selectedLanguage) {
      setWords([]);
      setWordCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({ languageId: selectedLanguage, admin: "true" });
    if (searchQuery) params.set("q", searchQuery);

    fetch(`/api/v2/word-bank?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setWords(data.words || []);
        setWordCount(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, selectedLanguage, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(fetchWords, 300);
    return () => clearTimeout(timer);
  }, [fetchWords]);

  // Add words
  const handleAddWords = async () => {
    if (!selectedLanguage) return;

    const wordsToAdd =
      addMode === "single"
        ? [singleWord]
        : bulkWords.split(/\n/).map((w) => w.trim()).filter(Boolean);

    if (wordsToAdd.length === 0) return;

    setAdding(true);
    setAddResult(null);

    try {
      const res = await fetch("/api/v2/word-bank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          languageId: selectedLanguage,
          words: wordsToAdd,
          category: wordCategory || null,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setAddResult(`Error: ${data.error}`);
      } else {
        setAddResult(
          `Added ${data.added} of ${data.total} words${
            data.added < data.total
              ? ` (${data.total - data.added} already existed)`
              : ""
          }`
        );
        setSingleWord("");
        setBulkWords("");
        setWordCategory("");
        fetchWords();
      }
    } catch {
      setAddResult("Failed to add words");
    } finally {
      setAdding(false);
    }
  };

  // Delete word
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v2/word-bank/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        fetchWords();
      }
    } catch {
      alert("Failed to delete word");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Word Bank</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage standardized word lists for transcriber autocomplete
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddModal(true);
            setAddResult(null);
          }}
          disabled={!selectedLanguage}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          + Add Words
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background text-sm"
        >
          <option value="">Select Language</option>
          {languages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.name} ({lang.code})
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search words..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background text-sm flex-1 max-w-xs"
        />

        {selectedLanguage && (
          <div className="flex items-center text-sm text-muted-foreground">
            {loading ? "Loading..." : `${wordCount} words`}
          </div>
        )}
      </div>

      {/* Words Table */}
      {selectedLanguage && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Word</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">
                  Added
                </th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : words.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    {searchQuery
                      ? "No words match your search"
                      : "No words in the bank yet. Click 'Add Words' to get started."}
                  </td>
                </tr>
              ) : (
                words.map((word) => (
                  <tr key={word.id} className="border-t hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{word.word}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {word.category || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {new Date(word.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deleteId === word.id ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(word.id)}
                            disabled={deleting}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            {deleting ? "Deleting..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setDeleteId(null)}
                            className="text-muted-foreground hover:text-foreground text-xs"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteId(word.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* No language selected state */}
      {!selectedLanguage && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">Select a language to manage its word bank</p>
          <p className="text-sm">
            Words added here will appear as suggestions when transcribers type
          </p>
        </div>
      )}

      {/* Add Words Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Words to Word Bank</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Language:{" "}
              <span className="font-medium">
                {languages.find((l) => l.id === selectedLanguage)?.name}
              </span>
            </p>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setAddMode("single")}
                className={`px-3 py-2 rounded-md text-sm ${
                  addMode === "single"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Single Word
              </button>
              <button
                onClick={() => setAddMode("bulk")}
                className={`px-3 py-2 rounded-md text-sm ${
                  addMode === "bulk"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Bulk Paste
              </button>
            </div>

            {/* Single word input */}
            {addMode === "single" && (
              <input
                type="text"
                value={singleWord}
                onChange={(e) => setSingleWord(e.target.value)}
                placeholder="Type a word..."
                className="w-full px-3 py-2 border rounded-md bg-background text-sm mb-4"
                autoFocus
              />
            )}

            {/* Bulk paste textarea */}
            {addMode === "bulk" && (
              <textarea
                value={bulkWords}
                onChange={(e) => setBulkWords(e.target.value)}
                placeholder={"Paste words here, one per line:\nhello\ngoodbye\nthank you"}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm mb-2 min-h-[150px]"
                autoFocus
              />
            )}

            {/* Category (optional) */}
            <input
              type="text"
              value={wordCategory}
              onChange={(e) => setWordCategory(e.target.value)}
              placeholder="Category (optional, e.g., greetings, numbers)"
              className="w-full px-3 py-2 border rounded-md bg-background text-sm mb-4"
            />

            {/* Result message */}
            {addResult && (
              <div
                className={`p-3 rounded-md text-sm mb-4 ${
                  addResult.startsWith("Error")
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-green-50 text-green-800 border border-green-200"
                }`}
              >
                {addResult}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddResult(null);
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
              <button
                onClick={handleAddWords}
                disabled={
                  adding ||
                  (addMode === "single" ? !singleWord.trim() : !bulkWords.trim())
                }
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {adding
                  ? "Adding..."
                  : addMode === "single"
                  ? "Add Word"
                  : "Add Words"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

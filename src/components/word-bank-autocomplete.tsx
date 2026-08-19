"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getToken } from "@/lib/infra/client/client";

interface WordSuggestion {
  id: string;
  word: string;
  category: string | null;
}

interface WordBankAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  languageId: string;
  placeholder?: string;
  className?: string;
  minChars?: number;
  maxSuggestions?: number;
}

export function WordBankAutocomplete({
  value,
  onChange,
  languageId,
  placeholder,
  className = "",
  minChars = 2,
  maxSuggestions = 10,
}: WordBankAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<WordSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [currentWord, setCurrentWord] = useState("");
  const [loading, setLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorPosRef = useRef<number>(0);

  // Extract the current word being typed (from last space/newline to cursor)
  const extractCurrentWord = useCallback(
    (text: string, cursorPosition: number): string => {
      const beforeCursor = text.slice(0, cursorPosition);
      const lastSpaceIndex = Math.max(
        beforeCursor.lastIndexOf(" "),
        beforeCursor.lastIndexOf("\n"),
        beforeCursor.lastIndexOf("\t")
      );
      return beforeCursor.slice(lastSpaceIndex + 1);
    },
    []
  );

  // Get cursor position in textarea
  const getCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return 0;
    return textarea.selectionStart || 0;
  }, []);

  // Fetch suggestions from API
  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!languageId || query.length < minChars) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      const token = getToken();
      if (!token) return;

      setLoading(true);
      try {
        const params = new URLSearchParams({
          languageId,
          q: query.toLowerCase(),
        });
        const res = await fetch(`/api/v2/word-bank?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        // Filter out the current word if it exactly matches
        const filtered = (data.words || []).filter(
          (w: WordSuggestion) => w.word.toLowerCase() !== query.toLowerCase()
        );

        setSuggestions(filtered.slice(0, maxSuggestions));
        setShowDropdown(filtered.length > 0);
        setHighlightedIndex(-1);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    },
    [languageId, minChars, maxSuggestions]
  );

  // Handle text change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart || 0;
      cursorPosRef.current = cursorPos;

      onChange(newValue);

      // Extract current word and fetch suggestions
      const word = extractCurrentWord(newValue, cursorPos);
      setCurrentWord(word);

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce API call
      if (word.length >= minChars) {
        debounceRef.current = setTimeout(() => {
          fetchSuggestions(word);
        }, 300);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    },
    [onChange, extractCurrentWord, minChars, fetchSuggestions]
  );

  // Insert selected word
  const insertWord = useCallback(
    (selectedWord: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = cursorPosRef.current;
      const beforeCursor = value.slice(0, cursorPos);
      const afterCursor = value.slice(cursorPos);

      // Find the start of the current word
      const lastSpaceIndex = Math.max(
        beforeCursor.lastIndexOf(" "),
        beforeCursor.lastIndexOf("\n"),
        beforeCursor.lastIndexOf("\t")
      );
      const wordStart = lastSpaceIndex + 1;

      // Replace the partial word with the selected word
      const newValue =
        beforeCursor.slice(0, wordStart) + selectedWord + " " + afterCursor;
      const newCursorPos = wordStart + selectedWord.length + 1;

      onChange(newValue);
      setShowDropdown(false);
      setCurrentWord("");
      setSuggestions([]);

      // Restore focus and cursor position
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [value, onChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showDropdown || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case "Enter":
          if (highlightedIndex >= 0) {
            e.preventDefault();
            insertWord(suggestions[highlightedIndex].word);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowDropdown(false);
          setHighlightedIndex(-1);
          break;
        case "Tab":
          if (suggestions.length > 0) {
            e.preventDefault();
            const wordToInsert =
              highlightedIndex >= 0
                ? suggestions[highlightedIndex].word
                : suggestions[0].word;
            insertWord(wordToInsert);
          }
          break;
      }
    },
    [showDropdown, suggestions, highlightedIndex, insertWord]
  );

  // Handle blur with delay to allow tap on suggestion
  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }, 200);
  }, []);

  // Handle focus
  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    // Re-check for suggestions if there's a current word
    if (currentWord.length >= minChars) {
      fetchSuggestions(currentWord);
    }
  }, [currentWord, minChars, fetchSuggestions]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={className}
        style={{ fontSize: "16px" }} // Prevent iOS zoom
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />

      {/* Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto"
          style={{
            // Position above textarea on mobile, below on desktop
            bottom: "100%",
            marginBottom: "4px",
          }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                insertWord(suggestion.word);
              }}
              className={`w-full text-left px-4 py-3 min-h-[44px] flex items-center justify-between gap-2 transition-colors ${
                index === highlightedIndex
                  ? "bg-blue-50 text-blue-900"
                  : "hover:bg-gray-50 text-gray-900"
              }`}
            >
              <span className="font-medium text-sm">{suggestion.word}</span>
              {suggestion.category && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {suggestion.category}
                </span>
              )}
            </button>
          ))}

          {loading && (
            <div className="px-4 py-2 text-xs text-gray-500 text-center">
              Loading...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

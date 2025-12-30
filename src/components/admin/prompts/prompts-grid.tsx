"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { DataGrid, RenderEditCellProps } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import { getToken } from "@/lib/client";

interface Prompt {
    id: string; // "new-..." for new rows
    englishText: string;
    category: string;
    emotion: string;
    instruction?: string;
    targetDurationSec?: number;
    isActive: boolean;
    isNew?: boolean;
    isModified?: boolean;
}

interface PromptsGridProps {
    initialPrompts: Prompt[];
    languageId: string;
    onSave: () => void;
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

export default function PromptsGrid({ initialPrompts, languageId, onSave }: PromptsGridProps) {
    const [rows, setRows] = useState<Prompt[]>(initialPrompts);
    const [similarityWarnings, setSimilarityWarnings] = useState<{ id: string; matches: any[] }[]>([]);
    const [saving, setSaving] = useState(false);

    // Sync with initial prompts when they change (e.g. page change), but discard unsaved changes??
    // Better to just init once or handle carefully. For now, reset.
    useEffect(() => {
        setRows(initialPrompts);
        setSimilarityWarnings([]);
    }, [initialPrompts]);

    const columns = useMemo(() => [
        {
            key: "englishText",
            name: "English Text",
            editable: true,
            resizable: true,
            width: "max-content",
            minWidth: 400,
            maxWidth: 800,
            renderEditCell: (props: RenderEditCellProps<Prompt>) => (
                <input
                    autoFocus
                    className="w-full h-full p-2"
                    value={props.row.englishText}
                    onChange={(e) => props.onRowChange({ ...props.row, englishText: e.target.value })}
                />
            ),
        },
        {
            key: "category",
            name: "Category",
            editor: (p: RenderEditCellProps<Prompt>) => (
                <select
                    autoFocus
                    className="w-full h-full p-2 bg-white"
                    value={p.row.category}
                    onChange={(e) => p.onRowChange({ ...p.row, category: e.target.value }, true)}
                >
                    {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            ),
            editable: true,
            resizable: true,
            width: 150,
        },
        {
            key: "emotion",
            name: "Emotion",
            editor: (p: RenderEditCellProps<Prompt>) => (
                <select
                    autoFocus
                    className="w-full h-full p-2 bg-white"
                    value={p.row.emotion}
                    onChange={(e) => p.onRowChange({ ...p.row, emotion: e.target.value }, true)}
                >
                    {EMOTIONS.map((e) => (
                        <option key={e} value={e}>{e}</option>
                    ))}
                </select>
            ),
            editable: true,
            resizable: true,
            width: 120,
        },
        {
            key: "instruction",
            name: "Instruction",
            editable: true,
            resizable: true,
            width: 200,
            renderEditCell: (props: RenderEditCellProps<Prompt>) => (
                <input
                    autoFocus
                    className="w-full h-full p-2"
                    value={props.row.instruction || ""}
                    onChange={(e) => props.onRowChange({ ...props.row, instruction: e.target.value })}
                />
            ),
        },
        {
            key: "targetDurationSec",
            name: "Secs",
            editable: true,
            width: 60,
            renderEditCell: (props: RenderEditCellProps<Prompt>) => (
                <input
                    autoFocus
                    type="number"
                    className="w-full h-full p-2"
                    value={props.row.targetDurationSec}
                    onChange={(e) => props.onRowChange({ ...props.row, targetDurationSec: Number(e.target.value) })}
                />
            ),
        },
    ], []);

    // Handle row updates
    const handleRowsChange = async (newRows: Prompt[], { indexes }: { indexes: number[] }) => {
        const updatedRows = [...newRows];

        // Mark modified
        indexes.forEach((index) => {
            const row = updatedRows[index];
            if (!row.isNew) {
                updatedRows[index] = { ...row, isModified: true };
            }

            // Check similarity if text changed
            if (row.englishText && row.englishText.length > 3) {
                checkSimilarity(row.id, row.englishText);
            }
        });

        setRows(updatedRows);
    };

    const checkSimilarity = useCallback(async (rowId: string, text: string) => {
        try {
            const token = getToken();
            if (!token) return;

            const res = await fetch("/api/v2/prompts/similarity", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ languageId, text }),
            });
            const data = await res.json();

            if (data.hasMatches) {
                // Filter out self if editing existing
                const matches = data.matches.filter((m: any) => m.id !== rowId);
                if (matches.length > 0) {
                    setSimilarityWarnings((prev) => {
                        const others = prev.filter(w => w.id !== rowId);
                        return [...others, { id: rowId, matches }];
                    });
                    return;
                }
            }
            // Clear warning if no matches
            setSimilarityWarnings((prev) => prev.filter(w => w.id !== rowId));
        } catch (e) {
            console.error("Similarity check failed", e);
        }
    }, [languageId]);

    const handleAddRow = () => {
        const newId = `new-${Date.now()}`;
        const newRow: Prompt = {
            id: newId,
            englishText: "",
            category: "GREETINGS",
            emotion: "NEUTRAL",
            instruction: "",
            targetDurationSec: 5,
            isActive: true,
            isNew: true,
        };
        setRows([newRow, ...rows]);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. New rows
            const newRows = rows.filter((r) => r.isNew && r.englishText.trim());
            // 2. Modified rows
            const modifiedRows = rows.filter((r) => r.isModified && !r.isNew);

            if (newRows.length === 0 && modifiedRows.length === 0) {
                alert("No changes to save");
                setSaving(false);
                return;
            }

            const errors = [];

            const token = getToken();
            if (!token) return;

            // Create new rows one by one (or implementation bulk create endpoint later)
            // Usage promise.all for better perf
            if (newRows.length > 0) {
                await Promise.all(newRows.map(async (row) => {
                    const res = await fetch("/api/v2/prompts", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            languageId,
                            englishText: row.englishText,
                            category: row.category,
                            emotion: row.emotion,
                            instruction: row.instruction,
                            targetDurationSec: Number(row.targetDurationSec),
                        }),
                    });
                    if (!res.ok) errors.push(`Failed to create: ${row.englishText}`);
                }));
            }

            // Bulk update existing
            if (modifiedRows.length > 0) {
                const updates = modifiedRows.map(row => ({
                    id: row.id,
                    englishText: row.englishText,
                    category: row.category,
                    emotion: row.emotion,
                    instruction: row.instruction,
                    targetDurationSec: Number(row.targetDurationSec),
                }));

                const res = await fetch("/api/v2/prompts/bulk", {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ updates }),
                });
                if (!res.ok) errors.push("Failed to update prompts");
            }

            if (errors.length > 0) {
                alert(`Errors:\n${errors.join("\n")}`);
            } else {
                alert("Saved successfully!");
                onSave(); // Refresh parent
            }

        } catch (e) {
            alert("Save failed");
        } finally {
            setSaving(false);
        }
    };

    // Row class for styling
    const rowClass = (row: Prompt) => {
        if (row.isNew) return "bg-blue-50";
        if (row.isModified) return "bg-yellow-50";
        return undefined;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleAddRow}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                    >
                        + Add Row
                    </button>

                    <div className="text-sm text-gray-500">
                        {rows.filter(r => r.isNew).length} new • {rows.filter(r => r.isModified).length} modified
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium disabled:opacity-50"
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            {similarityWarnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800">
                    <strong>Possible Duplicates Found:</strong>
                    <ul className="list-disc pl-5 mt-1">
                        {similarityWarnings.map(w => {
                            const row = rows.find(r => r.id === w.id);
                            return (
                                <li key={w.id}>
                                    "{row?.englishText}" is similar to:
                                    {w.matches.map((m: any) => ` "${m.text}"`).join(", ")}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Grid Container */}
            <div
                className="h-[calc(100vh-250px)] min-h-[500px] border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm resize-y"
                style={{
                    // Force light theme variables for React Data Grid
                    // @ts-ignore
                    "--rdg-color": "#374151",
                    "--rdg-border-color": "#e5e7eb",
                    "--rdg-summary-border-color": "#e5e7eb",
                    "--rdg-background-color": "#ffffff",
                    "--rdg-header-background-color": "#f9fafb",
                    "--rdg-row-hover-background-color": "#f3f4f6",
                    "--rdg-row-selected-background-color": "#eff6ff",
                    "--rdg-selection-color": "#3b82f6",
                    "--rdg-font-size": "14px",
                } as React.CSSProperties}
            >
                <DataGrid
                    columns={columns}
                    rows={rows}
                    onRowsChange={handleRowsChange}
                    rowClass={rowClass}
                    className="h-full rdg-light"
                />
            </div>
        </div>
    );
}

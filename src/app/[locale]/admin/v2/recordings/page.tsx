"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";
import { useTranslations } from "next-intl";

interface Recording {
    id: string;
    audioUrl: string;
    durationSec: number;
    status: string;
    createdAt: string;
    transcript?: string | null;
    transcriptConfidence?: number | null;
    autoTranscriptionStatus: "PENDING" | "COMPLETED" | "FAILED" | "SKIPPED";
    language: { id: string; name: string; code: string };
    prompt: { id: string; englishText: string; category: string };
    speaker: { id: string; email: string; displayName: string | null };
    transcription: { id: string; text: string; status: string } | null;
}

interface Language {
    id: string;
    code: string;
    name: string;
}

const RECORDING_STATUSES = [
    "PENDING_REVIEW",
    "PENDING_TRANSCRIPTION",
    "TRANSCRIBED",
    "APPROVED",
    "REJECTED",
    "FLAGGED"
];

export default function AdminRecordingsPage() {
    const router = useRouter();
    const t = useTranslations();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [languages, setLanguages] = useState<Language[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

    // Filters
    const [selectedLanguage, setSelectedLanguage] = useState<string>("");
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [limit, setLimit] = useState(50);
    const [playedRecordings, setPlayedRecordings] = useState<Set<string>>(new Set());
    const [transcribingRecordings, setTranscribingRecordings] = useState<Set<string>>(new Set());
    const [refreshKey, setRefreshKey] = useState(0);

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

    // Fetch recordings
    useEffect(() => {
        if (!token) return;

        setLoading(true);
        const params = new URLSearchParams({
            page: pagination.page.toString(),
            limit: limit.toString(),
        });

        if (selectedLanguage) params.set("languageId", selectedLanguage);
        if (selectedStatus) params.set("status", selectedStatus);
        if (searchQuery) params.set("search", searchQuery);

        fetch(`/api/v2/admin/recordings?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setRecordings(data.recordings || []);
                setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [pagination.page, selectedLanguage, selectedStatus, searchQuery, limit, token, refreshKey]);

    const handleAudioPlayed = (recordingId: string) => {
        setPlayedRecordings(prev => new Set(prev).add(recordingId));
    };

    const handleTranscribeWithKayX = async (recordingId: string) => {
        if (!confirm("Trigger Kay X transcription for this recording?")) return;

        setTranscribingRecordings(prev => new Set(prev).add(recordingId));
        try {
            const res = await fetch(`/api/v2/admin/recordings/${recordingId}/transcribe`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            if (res.ok) {
                const confidenceText = data.confidence
                    ? `\nConfidence: ${(data.confidence * 100).toFixed(0)}%`
                    : '';
                alert(`Transcription successful!\nKrio: ${data.transcript}${confidenceText}`);
                // Refresh to show new transcript
                setRefreshKey(k => k + 1);
            } else {
                alert(`Transcription failed: ${data.message || data.error}`);
            }
        } catch (err) {
            alert("Error triggering transcription");
        } finally {
            setTranscribingRecordings(prev => {
                const newSet = new Set(prev);
                newSet.delete(recordingId);
                return newSet;
            });
        }
    };

    // Sort recordings: unplayed first, then played
    const sortedRecordings = [...recordings].sort((a, b) => {
        const aPlayed = playedRecordings.has(a.id);
        const bPlayed = playedRecordings.has(b.id);
        if (aPlayed === bPlayed) return 0;
        return aPlayed ? 1 : -1;
    });

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
                                {t('admin.allRecordings')}
                            </h1>
                        </div>
                        <Link
                            href="/admin/v2/recordings/trim-silence"
                            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                        >
                            ✂ Trim Silence
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex-1 min-w-[250px]">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('admin.promptsPage.searchPlaceholder')}
                            </label>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                placeholder={t('admin.promptsPage.searchPlaceholder')}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('admin.languages')}
                            </label>
                            <select
                                value={selectedLanguage}
                                onChange={(e) => {
                                    setSelectedLanguage(e.target.value);
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg min-w-[180px]"
                            >
                                <option value="">{t('admin.promptsPage.allLanguages')}</option>
                                {languages.map((lang) => (
                                    <option key={lang.id} value={lang.id}>
                                        {lang.name} ({lang.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('admin.userDetailPage.status')}
                            </label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => {
                                    setSelectedStatus(e.target.value);
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg min-w-[180px]"
                            >
                                <option value="">{t('admin.recordingsPage.allStatuses')}</option>
                                {RECORDING_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status.replace("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('admin.recordingsPage.perPage')}
                            </label>
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="20">20</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Read-only notice */}
                <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Audio approval is handled by Reviewers. This view is for monitoring only.
                </div>

                {/* List */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.recordingsPage.audio')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.recordingsPage.promptEnglish')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.recordingsPage.kayXKrio')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.recordingsPage.speaker')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.userDetailPage.status')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.userDetailPage.transcription')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.userDetailPage.date')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.languagesPage.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-4 text-center text-gray-500">{t('admin.loading')}</td>
                                    </tr>
                                ) : recordings.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-4 text-center text-gray-500">{t('admin.recordingsPage.noRecordingsFound')}</td>
                                    </tr>
                                ) : (
                                    sortedRecordings.map((rec) => (
                                        <tr key={rec.id} className={`hover:bg-gray-50 ${playedRecordings.has(rec.id) ? 'opacity-60' : ''}`}>
                                            <td className="px-6 py-4">
                                                <AudioPlayer recordingId={rec.id} onPlayed={() => handleAudioPlayed(rec.id)} />
                                                <div className="text-xs text-gray-500 mt-1">{rec.durationSec.toFixed(1)}s • {rec.language.code}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 font-medium">
                                                    {rec.prompt.englishText}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">{rec.prompt.category}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {rec.autoTranscriptionStatus === "COMPLETED" && rec.transcript ? (
                                                    <div>
                                                        <div className="text-sm text-gray-900">
                                                            {rec.transcript}
                                                        </div>
                                                        {rec.transcriptConfidence && (
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <div className="flex-1 max-w-[100px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${rec.transcriptConfidence >= 0.8
                                                                            ? "bg-green-500"
                                                                            : rec.transcriptConfidence >= 0.6
                                                                                ? "bg-yellow-500"
                                                                                : "bg-red-500"
                                                                            }`}
                                                                        style={{ width: `${rec.transcriptConfidence * 100}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-gray-500">
                                                                    {(rec.transcriptConfidence * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : rec.autoTranscriptionStatus === "PENDING" ? (
                                                    <span className="text-xs text-gray-400 italic">{t('admin.recordingsPage.processing')}</span>
                                                ) : rec.autoTranscriptionStatus === "FAILED" ? (
                                                    <span className="text-xs text-red-400 italic">{t('admin.recordingsPage.failed')}</span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">{t('admin.recordingsPage.na')}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">{rec.speaker.displayName || t('admin.reviewPage.unknown')}</div>
                                                <div className="text-xs text-gray-500 truncate max-w-[150px]">{rec.speaker.email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={rec.status} />
                                            </td>
                                            <td className="px-6 py-4">
                                                {rec.transcription ? (
                                                    <div>
                                                        <div className="text-sm text-gray-900">
                                                            {rec.transcription.text}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {rec.transcription.status}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400 italic">{t('admin.usersPage.none')}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(rec.createdAt).toLocaleDateString()}
                                                <div className="text-xs">{new Date(rec.createdAt).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2 flex-wrap">
                                                    {/* Kay X Transcribe Button */}
                                                    {rec.language.code.toLowerCase() === 'kri' && rec.autoTranscriptionStatus !== 'COMPLETED' && (
                                                        <button
                                                            onClick={() => handleTranscribeWithKayX(rec.id)}
                                                            disabled={transcribingRecordings.has(rec.id)}
                                                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                                                            title="Transcribe with Kay X"
                                                        >
                                                            {transcribingRecordings.has(rec.id) ? '⏳ Kay X...' : '🤖 Kay X'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

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
                                {t('admin.recordingsPage.page')} {pagination.page} {t('admin.recordingsPage.of')} {pagination.totalPages} ({pagination.total} {t('admin.recordingsPage.total')})
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
            </main>
        </div>
    );
}

function AudioPlayer({ recordingId, onPlayed }: { recordingId: string; onPlayed?: () => void }) {
    const t = useTranslations();
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const handlePlay = async () => {
        if (audioUrl || loading) return;
        setLoading(true);
        setError(false);
        try {
            const token = getToken();
            const res = await fetch(`/api/v2/audio/${recordingId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to fetch audio");
            const data = await res.json();
            setAudioUrl(data.signedUrl || data.url);
        } catch (err) {
            console.error("Error fetching audio:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return <div className="text-xs text-red-500">{t('admin.recordingsPage.failedToLoadAudio')}</div>;
    }

    if (audioUrl) {
        return (
            <audio
                controls
                src={audioUrl}
                className="h-8 w-40"
                onEnded={onPlayed}
                autoPlay
            />
        );
    }

    return (
        <button
            onClick={handlePlay}
            disabled={loading}
            className="h-8 w-40 flex items-center justify-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
        >
            {loading ? (
                <span className="text-gray-500">{t('admin.loading')}</span>
            ) : (
                <>▶ {t('admin.recordingsPage.audio')}</>
            )}
        </button>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: any = {
        PENDING_REVIEW: "bg-amber-100 text-amber-700",
        PENDING_TRANSCRIPTION: "bg-gray-100 text-gray-800",
        TRANSCRIBED: "bg-blue-100 text-blue-800",
        APPROVED: "bg-green-100 text-green-800",
        REJECTED: "bg-red-100 text-red-800",
        FLAGGED: "bg-yellow-100 text-yellow-800",
    };
    return (
        <span className={`px-2 py-1 text-xs rounded-full font-medium ${colors[status] || "bg-gray-100"}`}>
            {status.replace("_", " ")}
        </span>
    );
}

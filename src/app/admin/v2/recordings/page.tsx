"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";

interface Recording {
    id: string;
    audioUrl: string;
    durationSec: number;
    status: string;
    createdAt: string;
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
    "PENDING_TRANSCRIPTION",
    "TRANSCRIBED",
    "APPROVED",
    "REJECTED",
    "FLAGGED"
];

export default function AdminRecordingsPage() {
    const router = useRouter();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [languages, setLanguages] = useState<Language[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

    // Filters
    const [selectedLanguage, setSelectedLanguage] = useState<string>("");
    const [selectedStatus, setSelectedStatus] = useState<string>("");

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
            limit: "20",
        });

        if (selectedLanguage) params.set("languageId", selectedLanguage);
        if (selectedStatus) params.set("status", selectedStatus);

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
    }, [pagination.page, selectedLanguage, selectedStatus, token]);

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
                                All Recordings
                            </h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Language
                            </label>
                            <select
                                value={selectedLanguage}
                                onChange={(e) => {
                                    setSelectedLanguage(e.target.value);
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg min-w-[200px]"
                            >
                                <option value="">All Languages</option>
                                {languages.map((lang) => (
                                    <option key={lang.id} value={lang.id}>
                                        {lang.name} ({lang.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => {
                                    setSelectedStatus(e.target.value);
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg min-w-[200px]"
                            >
                                <option value="">All Statuses</option>
                                {RECORDING_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status.replace("_", " ")}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Audio</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prompt</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Speaker</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transcription</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading...</td>
                                    </tr>
                                ) : recordings.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No recordings found matching filters.</td>
                                    </tr>
                                ) : (
                                    recordings.map((rec) => (
                                        <tr key={rec.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <AudioPlayer recordingId={rec.id} />
                                                <div className="text-xs text-gray-500 mt-1">{rec.durationSec.toFixed(1)}s • {rec.language.code}</div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs">
                                                <div className="text-sm text-gray-900 font-medium truncate" title={rec.prompt.englishText}>
                                                    {rec.prompt.englishText}
                                                </div>
                                                <div className="text-xs text-gray-500">{rec.prompt.category}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">{rec.speaker.displayName || "Unknown"}</div>
                                                <div className="text-xs text-gray-500 truncate max-w-[150px]">{rec.speaker.email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={rec.status} />
                                            </td>
                                            <td className="px-6 py-4 max-w-xs">
                                                {rec.transcription ? (
                                                    <div>
                                                        <div className="text-sm text-gray-900 truncate" title={rec.transcription.text}>
                                                            {rec.transcription.text}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {rec.transcription.status}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400 italic">None</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(rec.createdAt).toLocaleDateString()}
                                                <div className="text-xs">{new Date(rec.createdAt).toLocaleTimeString()}</div>
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
                                Previous
                            </button>
                            <span className="text-sm text-gray-500">
                                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
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
            </main>
        </div>
    );
}

function AudioPlayer({ recordingId }: { recordingId: string }) {
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const fetchAudioUrl = async () => {
        if (audioUrl) return; // Already fetched

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
        return <div className="text-xs text-red-500">Failed to load audio</div>;
    }

    if (loading) {
        return <div className="text-xs text-gray-500">Loading...</div>;
    }

    return (
        <audio
            controls
            src={audioUrl || undefined}
            className="h-8 w-40"
            onPlay={fetchAudioUrl}
        />
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: any = {
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

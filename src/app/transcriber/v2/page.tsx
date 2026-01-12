"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/client";

interface Recording {
  id: string;
  audioUrl: string;
  durationSec: number;
  prompt: {
    englishText: string;
    category: string;
    emotion: string;
  };
  language: {
    code: string;
    name: string;
    transcriberRatePerMin: number;
  };
  speaker: {
    displayName: string;
  };
}

interface Assignment {
  assignment: {
    id: string;
    expiresAt: string;
  };
  recording: Recording;
  minutesRemaining: number;
}

interface Stats {
  total: number;
  byStatus: { status: string; _count: number }[];
}

export default function TranscriberV2Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [availableRecordings, setAvailableRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const limit = 10;

  const token = typeof window !== "undefined" ? getToken() : null;

  const loadData = () => {
    if (!token) {
      router.push("/transcriber/login");
      return;
    }

    // Fetch user
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push("/transcriber/login");
          return;
        }
        setUser(data.user);
      });

    // Fetch my work (active assignments + stats)
    fetch("/api/v2/transcriber/my-work", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setActiveAssignments(data.activeAssignments || []);
        setStats(data.stats || null);
      });

    // Fetch available recordings with pagination
    fetch(`/api/v2/transcriber/available?limit=${limit}&offset=${(page - 1) * limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setAvailableRecordings(data.recordings || []);
        setTotalAvailable(data.totalAvailable || 0);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page]);

  // Release an assignment
  const releaseAssignment = async (recordingId: string) => {
    setReleasingId(recordingId);
    try {
      const res = await fetch("/api/v2/transcriber/release", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recordingId }),
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      // Reload data
      loadData();
    } catch {
      alert("Failed to release assignment");
    } finally {
      setReleasingId(null);
    }
  };

  // Claim a recording
  const claimRecording = async (recordingId: string) => {
    setClaimingId(recordingId);
    try {
      const res = await fetch("/api/v2/transcriber/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recordingId }),
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      // Navigate to transcription page
      router.push(`/transcriber/v2/task/${recordingId}`);
    } catch {
      alert("Failed to claim recording");
    } finally {
      setClaimingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Transcriber Dashboard
              </h1>
              <p className="text-sm text-gray-500">
                Welcome back, {user?.displayName || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Role Switcher - Show if user has SPEAKER role */}
              {user?.roles?.includes("SPEAKER") && (
                <Link
                  href="/speaker"
                  className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  Switch to Speaker →
                </Link>
              )}
              <button
                onClick={() => {
                  clearToken();
                  router.push("/transcriber/v2");
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Earnings Card */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 mb-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-medium text-blue-100">Total Earnings</h3>
              <p className="text-4xl font-bold mt-1">
                Le{((user?.totalEarningsCents || 0) / 100).toFixed(2)}
              </p>
              <p className="text-sm text-blue-100 mt-2">
                From {stats?.byStatus.find((s) => s.status === "APPROVED")?._count || 0} approved transcriptions
              </p>
            </div>
            <div className="text-right">
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <p className="text-xs text-blue-100">Pending Review</p>
                <p className="text-lg font-semibold">
                  {stats?.byStatus.find((s) => s.status === "PENDING_REVIEW")?._count || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">
              Total Transcriptions
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {stats?.total || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Approved</h3>
            <p className="text-3xl font-bold text-green-600">
              {stats?.byStatus.find((s) => s.status === "APPROVED")?._count || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Pending Review</h3>
            <p className="text-3xl font-bold text-yellow-600">
              {stats?.byStatus.find((s) => s.status === "PENDING_REVIEW")?._count || 0}
            </p>
          </div>
        </div>

        {/* Active Assignments */}
        {activeAssignments.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
              <h2 className="text-lg font-semibold text-gray-900">
                ⏰ Active Assignment
              </h2>
              <p className="text-sm text-gray-500">
                Complete this before claiming a new one
              </p>
            </div>
            <div className="p-6">
              {activeAssignments.map((item) => (
                <div
                  key={item.assignment.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.recording?.prompt.englishText}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.recording?.language.name} •{" "}
                      {item.recording?.durationSec.toFixed(1)}s
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-orange-600">
                      {item.minutesRemaining} min remaining
                    </span>
                    <button
                      onClick={() => releaseAssignment(item.recording?.id)}
                      disabled={releasingId !== null}
                      className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      {releasingId === item.recording?.id ? "Releasing..." : "Release"}
                    </button>
                    <Link
                      href={`/transcriber/v2/task/${item.recording?.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Continue
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Recordings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Available Recordings
            </h2>
            <p className="text-sm text-gray-500">
              Claim a recording to start transcribing
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {availableRecordings.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No recordings available right now. Check back later!
              </div>
            ) : (
              availableRecordings.map((recording) => (
                <div
                  key={recording.id}
                  className="p-6 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {recording.prompt.category.replace(/_/g, " ")}
                      </span>
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                        {recording.language.name}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">
                      {recording.prompt.englishText}
                    </p>
                    <p className="text-sm text-gray-500">
                      {recording.durationSec.toFixed(1)}s •{" "}
                      Le{(recording.language.transcriberRatePerMin * (recording.durationSec / 60)).toFixed(2)} est.
                    </p>
                  </div>
                  <button
                    onClick={() => claimRecording(recording.id)}
                    disabled={claimingId !== null || activeAssignments.length > 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {claimingId === recording.id ? (
                      <>
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                        Claiming...
                      </>
                    ) : (
                      "Claim"
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalAvailable > limit && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, totalAvailable)} of {totalAvailable} recordings
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm">
                  Page {page} of {Math.ceil(totalAvailable / limit)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalAvailable / limit)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

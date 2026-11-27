"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/infra/client/client";
import { useTranslations } from "next-intl";
import { formatDuration } from "@/lib/utils/format";

interface Language {
  id: string;
  code: string;
  name: string;
  nativeName?: string;
  targetMinutes: number;
  collectedMinutes: number;
  approvedMinutes: number;
  speakerRatePerMinute: number;
}

interface WeeklyProgress {
  weekStart: string;
  weekEnd: string;
  approvedDurationSec: number;
  submittedDurationSec: number;
  estimatedPayoutLe: number;
  estimatedTotalLe: number;
  isPaid: boolean;
  paidAmountLe: number | null;
  daysLeft: number;
}

interface Recording {
  id: string;
  status: string;
  durationSec: number;
  createdAt: string;
  prompt: { englishText: string; category?: string } | null;
  language: { code: string; name: string } | null;
}

interface Stats {
  totalRecordings: number;
  totalDurationSec: number;
  approvedDurationSec: number;
  estimatedEarnings: number;
  weeklyProgress: WeeklyProgress | null;
  byStatus: { status: string; _count: number; _sum?: { durationSec: number } }[];
}

export default function SpeakerDashboardClient({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations();
  const [user, setUser] = useState<any>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRecordings, setRecentRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordMode, setRecordMode] = useState<"prompts" | "topics">("prompts");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push(`/${locale}/speaker/login`);
      return;
    }

    // Fetch user info
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push(`/${locale}/speaker/login`);
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.push("/speaker/login"));

    // Fetch available languages
    fetch("/api/v2/languages", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setLanguages(data.languages || []);
      });

    // Fetch speaker stats + recent recordings
    fetch("/api/v2/speaker/recordings?limit=10", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.stats) {
          const totalDuration = data.stats
            .filter((s: any) => s.status !== "REJECTED")
            .reduce((sum: number, s: any) => sum + (s._sum?.durationSec || 0), 0);
          const approvedStatuses = ["PENDING_TRANSCRIPTION", "TRANSCRIBED", "APPROVED"];
          const approvedDuration = data.stats
            .filter((s: any) => approvedStatuses.includes(s.status))
            .reduce((sum: number, s: any) => sum + (s._sum?.durationSec || 0), 0);
          setStats({
            totalRecordings: data.pagination?.total || 0,
            totalDurationSec: totalDuration,
            approvedDurationSec: approvedDuration,
            estimatedEarnings: data.estimatedEarnings || 0,
            weeklyProgress: data.weeklyProgress
              ? {
                  ...data.weeklyProgress,
                  daysLeft: Math.max(
                    0,
                    Math.ceil((new Date(data.weeklyProgress.weekEnd + "T23:59:59Z").getTime() - Date.now()) / 86_400_000)
                  ),
                }
              : null,
            byStatus: data.stats,
          });
        }
        setRecentRecordings(data.recordings || []);
        setLoading(false);
      });
  }, [router]);

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
              <h1 className="text-2xl font-bold text-gray-900">{t('speaker.dashboard')}</h1>
              <p className="text-sm text-gray-500">
                {t('speaker.welcomeBack')} {user?.displayName || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Role Switcher - Show if user has TRANSCRIBER role */}
              {user?.roles?.includes("TRANSCRIBER") && (
                <Link
                  href={`/${locale}/transcriber/v2`}
                  className="px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                >
                  {t('speaker.switchToTranscriber')}
                </Link>
              )}
              <button
                onClick={() => {
                  clearToken();
                  router.push("/speaker/login");
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t('common.logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {(() => {
          const wp = stats?.weeklyProgress;
          const submittedSec = wp?.submittedDurationSec || 0;
          const approvedSec = wp?.approvedDurationSec || 0;
          return (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 mb-8 text-white">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-green-100">{t('speaker.thisWeeksEarnings')}</h3>
                    {wp && (
                      <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        {wp.isPaid ? t('speaker.paid') : t('speaker.unpaid')}
                      </span>
                    )}
                  </div>
                  {wp && (
                    <p className="text-xs text-green-100">
                      {wp.weekStart} – {wp.weekEnd} · {t('speaker.endsInDays', { count: wp.daysLeft })}
                    </p>
                  )}
                  <p className="text-4xl font-bold pt-1">
                    Le{(wp?.isPaid ? (wp.paidAmountLe ?? wp.estimatedPayoutLe) : (wp?.estimatedPayoutLe ?? 0)).toFixed(2)}
                  </p>
                  <p className="text-sm text-green-100 pt-1">
                    {t('speaker.basedOnApproved', { duration: formatDuration(approvedSec) })}
                  </p>
                  <p className="text-xs text-green-100">
                    {t('speaker.totalAllTime')}: Le{(stats?.estimatedEarnings || 0).toFixed(2)}
                  </p>
                  <Link
                    href={`/${locale}/speaker/earnings`}
                    className="inline-block pt-1 text-xs text-green-100 underline hover:text-white"
                  >
                    {t('speaker.viewEarningsHistory')}
                  </Link>
                </div>
                <div className="text-right space-y-2">
                  <div className="bg-white/20 rounded-lg px-4 py-2">
                    <p className="text-xs text-green-100">{t('speaker.thisWeekRecorded')}</p>
                    <p className="text-lg font-semibold">{formatDuration(submittedSec)}</p>
                  </div>
                  <div className="bg-white/20 rounded-lg px-4 py-2">
                    <p className="text-xs text-green-100">{t('speaker.pendingReview')}</p>
                    <p className="text-lg font-semibold">{formatDuration(Math.max(0, submittedSec - approvedSec))}</p>
                  </div>
                  <div className="bg-white/20 rounded-lg px-4 py-2">
                    <p className="text-xs text-green-100">{t('speaker.estimatedEarnings')}</p>
                    <p className="text-lg font-semibold">Le{(wp?.estimatedTotalLe ?? 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Mode Toggle + My Languages */}
        {(() => {
          const userCodes = user?.speaksLanguages || [];
          const myLanguages = languages.filter((l) => userCodes.includes(l.code));
          return myLanguages.length > 0 ? (
            <>
              {/* Prompts / Topics toggle */}
              <div className="flex items-center gap-1 mb-4 bg-gray-200 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setRecordMode("prompts")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    recordMode === "prompts"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  {t('speaker.modePrompts')}
                </button>
                <button
                  onClick={() => setRecordMode("topics")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    recordMode === "topics"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  {t('speaker.modeTopics')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {myLanguages.map((lang) => (
                  <div key={lang.id} className="bg-white rounded-lg shadow p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{lang.name}</h3>
                      {lang.nativeName && (
                        <p className="text-sm text-gray-500">{lang.nativeName}</p>
                      )}
                      <p className="text-xs text-green-600 mt-1">
                        Le{lang.speakerRatePerMinute?.toFixed(2) || "0.00"}/{t('common.min')}
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/speaker/record?languageId=${lang.id}${recordMode === "topics" ? "&mode=freeform" : ""}`}
                      className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                        recordMode === "topics"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {t('speaker.startRecording')}
                    </Link>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 mb-8 text-center text-gray-500">
              {t('speaker.noLanguagesAssigned')}
            </div>
          );
        })()}

        {/* Recent Recordings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">{t('speaker.recentRecordings')}</h2>
              <span className="text-sm text-gray-500">
                {t('speaker.recordingCount', { count: stats?.totalRecordings || 0 })}
              </span>
            </div>
          </div>
          {recentRecordings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t('speaker.noRecordingsYet')}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {recentRecordings.map((rec) => {
                const statusConfig: Record<string, { label: string; color: string }> = {
                  PENDING_REVIEW: { label: t('speaker.statusPendingReview'), color: 'bg-yellow-100 text-yellow-800' },
                  PENDING_TRANSCRIPTION: { label: t('speaker.statusApproved'), color: 'bg-green-100 text-green-800' },
                  TRANSCRIBED: { label: t('speaker.statusApproved'), color: 'bg-green-100 text-green-800' },
                  APPROVED: { label: t('speaker.statusApproved'), color: 'bg-green-100 text-green-800' },
                  REJECTED: { label: t('speaker.statusRejected'), color: 'bg-red-100 text-red-800' },
                };
                const st = statusConfig[rec.status] || { label: rec.status, color: 'bg-gray-100 text-gray-800' };
                return (
                  <li key={rec.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {rec.prompt?.englishText || t('speaker.untitledPrompt')}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">
                          {rec.language?.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {rec.durationSec}s
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(rec.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${st.color}`}>
                      {st.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

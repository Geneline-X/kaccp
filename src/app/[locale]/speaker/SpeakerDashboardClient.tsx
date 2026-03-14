"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/infra/client/client";
import { useTranslations } from "next-intl";

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
  milestoneTargetSec: number;
  milestoneHit: boolean;
  estimatedPayoutLe: number;
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
          const totalDuration = data.stats.reduce(
            (sum: number, s: any) => sum + (s._sum?.durationSec || 0),
            0
          );
          const approvedStatuses = ["PENDING_TRANSCRIPTION", "TRANSCRIBED", "APPROVED"];
          const approvedDuration = data.stats
            .filter((s: any) => approvedStatuses.includes(s.status))
            .reduce((sum: number, s: any) => sum + (s._sum?.durationSec || 0), 0);
          setStats({
            totalRecordings: data.pagination?.total || 0,
            totalDurationSec: totalDuration,
            approvedDurationSec: approvedDuration,
            estimatedEarnings: data.estimatedEarnings || 0,
            weeklyProgress: data.weeklyProgress || null,
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
        {/* Earnings Card */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 mb-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-medium text-green-100">{t('speaker.estimatedEarnings')}</h3>
              <p className="text-4xl font-bold mt-1">
                Le{(stats?.estimatedEarnings || 0).toFixed(2)}
              </p>
              <p className="text-sm text-green-100 mt-2">
                {t('speaker.basedOnApproved', { minutes: ((stats?.approvedDurationSec || 0) / 60).toFixed(1) })}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <p className="text-xs text-green-100">{t('speaker.pending')}</p>
                <p className="text-lg font-semibold">
                  {(((stats?.totalDurationSec || 0) - (stats?.approvedDurationSec || 0)) / 60).toFixed(1)} {t('common.min')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Progress Card */}
        {stats?.weeklyProgress && (() => {
          const wp = stats.weeklyProgress;
          const approvedHours = wp.approvedDurationSec / 3600;
          const targetHours = wp.milestoneTargetSec / 3600;
          const progressPct = Math.min(100, Math.round((approvedHours / targetHours) * 100));
          const hoursLeft = Math.max(0, targetHours - approvedHours);
          const perMinuteEarnings = (wp.approvedDurationSec / 60) * 2.5;
          const showNudge = progressPct >= 50 && progressPct < 100;

          // Calculate days until Friday
          const now = new Date();
          const endDate = new Date(wp.weekEnd + "T23:59:59Z");
          const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

          return (
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 mb-8 text-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-medium text-purple-100">{t('speaker.weeklyProgress')}</h3>
                  <p className="text-xs text-purple-200 mt-1">
                    {wp.weekStart} – {wp.weekEnd}
                  </p>
                </div>
                <div className="text-right">
                  <div className="bg-white/20 rounded-lg px-3 py-1">
                    <p className="text-xs text-purple-100">{t('speaker.endsIn')}</p>
                    <p className="text-sm font-semibold">{daysLeft} {t('speaker.days')}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end mb-2">
                <p className="text-2xl font-bold">
                  {approvedHours.toFixed(1)} / {targetHours.toFixed(1)} {t('speaker.hours')}
                </p>
                <p className="text-lg font-semibold">
                  Le{wp.estimatedPayoutLe.toFixed(2)}
                </p>
              </div>

              <div className="w-full bg-white/20 rounded-full h-3 mb-3">
                <div
                  className={`h-3 rounded-full transition-all ${wp.milestoneHit ? 'bg-yellow-400' : 'bg-white'}`}
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>

              {wp.milestoneHit ? (
                <p className="text-sm text-yellow-200 font-medium">
                  {t('speaker.milestoneReached')}
                </p>
              ) : showNudge ? (
                <p className="text-sm text-purple-200">
                  {t('speaker.milestoneNudge', {
                    hours: hoursLeft.toFixed(1),
                    milestone: '1,000',
                    current: perMinuteEarnings.toFixed(0),
                  })}
                </p>
              ) : (
                <p className="text-sm text-purple-200">
                  {t('speaker.milestoneTarget', { hours: targetHours.toFixed(0) })}
                </p>
              )}
            </div>
          );
        })()}

        {/* My Languages */}
        {(() => {
          const userCodes = user?.speaksLanguages || [];
          const myLanguages = languages.filter((l) => userCodes.includes(l.code));
          return myLanguages.length > 0 ? (
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
                    href={`/${locale}/speaker/record?languageId=${lang.id}`}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {t('speaker.startRecording')}
                  </Link>
                </div>
              ))}
            </div>
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
                {stats?.totalRecordings || 0} {t('speaker.totalRecordings').toLowerCase()}
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

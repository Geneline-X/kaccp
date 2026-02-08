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

interface Stats {
  totalRecordings: number;
  totalDurationSec: number;
  approvedDurationSec: number;
  byStatus: { status: string; _count: number; _sum?: { durationSec: number } }[];
}

export default function SpeakerDashboardClient({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations();
  const [user, setUser] = useState<any>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
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

    // Fetch speaker stats
    fetch("/api/v2/speaker/recordings?limit=1", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.stats) {
          const totalDuration = data.stats.reduce(
            (sum: number, s: any) => sum + (s._sum?.durationSec || 0),
            0
          );
          const approvedStat = data.stats.find((s: any) => s.status === "APPROVED");
          const approvedDuration = approvedStat?._sum?.durationSec || 0;
          setStats({
            totalRecordings: data.pagination?.total || 0,
            totalDurationSec: totalDuration,
            approvedDurationSec: approvedDuration,
            byStatus: data.stats,
          });
        }
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
                Le{((user?.totalEarningsCents || 0) / 100).toFixed(2)}
              </p>
              <p className="text-sm text-green-100 mt-2">
                {t('speaker.basedOnApproved', { minutes: Math.round((stats?.approvedDurationSec || 0) / 60) })}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <p className="text-xs text-green-100">{t('speaker.pending')}</p>
                <p className="text-lg font-semibold">
                  {Math.round(((stats?.totalDurationSec || 0) - (stats?.approvedDurationSec || 0)) / 60)} {t('common.min')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('speaker.totalRecordings')}</h3>
            <p className="text-3xl font-bold text-gray-900">
              {stats?.totalRecordings || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('speaker.totalDuration')}</h3>
            <p className="text-3xl font-bold text-gray-900">
              {Math.round((stats?.totalDurationSec || 0) / 60)} {t('common.min')}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('speaker.approved')}</h3>
            <p className="text-3xl font-bold text-green-600">
              {Math.round((stats?.approvedDurationSec || 0) / 60)} {t('common.min')}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">{t('speaker.languages')}</h3>
            <p className="text-3xl font-bold text-gray-900">
              {user?.speaksLanguages?.length || 0}
            </p>
          </div>
        </div>

        {/* Select Language to Record */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('speaker.selectLanguageToRecord')}
            </h2>
            <p className="text-sm text-gray-500">
              {t('speaker.chooseLanguage')}
            </p>
          </div>
          <div className="p-6">
            {languages.length === 0 ? (
              <p className="text-gray-500">{t('speaker.noLanguagesAvailable')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {languages.map((lang) => {
                  const progress = lang.targetMinutes > 0
                    ? Math.round((lang.approvedMinutes / lang.targetMinutes) * 100)
                    : 0;

                  return (
                    <Link
                      key={lang.id}
                      href={`/${locale}/speaker/record?languageId=${lang.id}`}
                      className="block p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{lang.name}</h3>
                          {lang.nativeName && (
                            <p className="text-sm text-gray-500">{lang.nativeName}</p>
                          )}
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {lang.code.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{t('speaker.progress')}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-xs text-gray-500">
                            {Math.round(lang.approvedMinutes / 60)}h / {Math.round(lang.targetMinutes / 60)}h
                          </p>
                          <span className="text-xs font-medium text-green-600">
                            Le{lang.speakerRatePerMinute?.toFixed(2) || "0.00"}/{t('common.min')}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('speaker.quickActions')}</h2>
          </div>
          <div className="p-6 flex flex-wrap gap-4">
            <Link
              href={`/${locale}/speaker/history`}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {t('speaker.viewRecordingHistory')}
            </Link>
            <Link
              href={`/${locale}/speaker/profile`}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {t('speaker.editProfile')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

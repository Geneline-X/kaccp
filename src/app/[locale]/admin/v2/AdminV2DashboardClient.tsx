"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/infra/client/client";
import { useTranslations } from "next-intl";

interface Stats {
  overview: {
    countries: number;
    languages: number;
    prompts: number;
    recordings: number;
    transcriptions: number;
    users: number;
    totalCollectedHours: number;
    totalApprovedHours: number;
  };
  languageProgress: {
    id: string;
    code: string;
    name: string;
    progressPercent: number;
    collectedHours: number;
    approvedHours: number;
    targetHours: number;
    _count: {
      prompts: number;
      recordings: number;
    };
  }[];
  recordingsByStatus: { status: string; _count: number }[];
  transcriptionsByStatus: { status: string; _count: number }[];
}

interface PipelineStats {
  pendingReviews: number;
  totalSessions: number;
  latestVersion: string | null;
  latestVersionHours: number | null;
  datasetCount: number;
}

export default function AdminV2DashboardClient({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push(`/${locale}/admin/login`);
      return;
    }

    Promise.all([
      fetch("/api/v2/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      fetch("/api/v2/pipeline/review-queue?status=pending&limit=1", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      fetch("/api/v2/pipeline/datasets?limit=5", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      fetch("/api/v2/pipeline/sessions?limit=1", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    ])
      .then(([statsData, reviewData, datasetsData, sessionsData]) => {
        if (statsData.error) {
          if (statsData.error === "Unauthorized") {
            router.push(`/${locale}/admin/login`);
          }
          return;
        }
        setStats(statsData);
        const versions = datasetsData.versions || [];
        const latest = versions.length > 0 ? versions[0] : null;
        setPipelineStats({
          pendingReviews: reviewData.pagination?.total || 0,
          totalSessions: sessionsData.pagination?.total || 0,
          latestVersion: latest?.versionId || null,
          latestVersionHours: latest?.totalHours || null,
          datasetCount: versions.length,
        });
        setLoading(false);
      })
      .catch(() => {
        router.push(`/${locale}/admin/login`);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('admin.v2Dashboard')}
              </h1>
              <p className="text-sm text-gray-500">
                {t('admin.speechSynthesisPlatform')}
              </p>
            </div>
            <button
              onClick={() => {
                clearToken();
                router.push(`/${locale}/`);
              }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title={t('admin.countries')}
            value={stats?.overview.countries || 0}
            color="blue"
          />
          <StatCard
            title={t('admin.languages')}
            value={stats?.overview.languages || 0}
            color="green"
          />
          <StatCard
            title={t('admin.prompts')}
            value={stats?.overview.prompts || 0}
            color="purple"
          />
          <StatCard
            title={t('admin.users')}
            value={stats?.overview.users || 0}
            color="orange"
          />
        </div>

        {/* Hours Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('admin.totalCollected')}
            </h3>
            <p className="text-4xl font-bold text-blue-600">
              {stats?.overview.totalCollectedHours || 0}h
            </p>
            <p className="text-sm text-gray-500">{t('admin.hoursRecorded')}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('admin.totalApproved')}
            </h3>
            <p className="text-4xl font-bold text-green-600">
              {stats?.overview.totalApprovedHours || 0}h
            </p>
            <p className="text-sm text-gray-500">{t('admin.hoursForTTS')}</p>
          </div>
        </div>

        {/* Pipeline Stats */}
        {pipelineStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Pipeline Reviews</h3>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-gray-900">{pipelineStats.pendingReviews}</p>
                <Link href="/admin/v2/pipeline/review" className="text-xs text-blue-600 hover:underline">Review →</Link>
              </div>
              <p className="text-xs text-gray-400 mt-1">Pending correction</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Flot Sessions</h3>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-gray-900">{pipelineStats.totalSessions}</p>
              </div>
              <p className="text-xs text-gray-400 mt-1">Total captured</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Dataset Versions</h3>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-gray-900">{pipelineStats.datasetCount}</p>
                <Link href="/admin/v2/pipeline/datasets" className="text-xs text-blue-600 hover:underline">View →</Link>
              </div>
              <p className="text-xs text-gray-400 mt-1">{pipelineStats.latestVersion || "No versions yet"}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Latest Dataset</h3>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-gray-900">
                  {pipelineStats.latestVersionHours ? `${pipelineStats.latestVersionHours.toFixed(1)}h` : "—"}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-1">{pipelineStats.latestVersionHours ? `${pipelineStats.latestVersionHours.toFixed(1)} hours of labeled audio` : "Merge reviews to create"}</p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('admin.quickActions')}</h2>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href={`/${locale}/admin/v2/countries`}
              className="p-4 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors"
            >
              <div className="text-2xl mb-2">🌍</div>
              <div className="font-medium text-gray-900">{t('admin.manageCountries')}</div>
            </Link>
            <Link
              href="/admin/v2/languages"
              className="p-4 bg-green-50 rounded-lg text-center hover:bg-green-100 transition-colors"
            >
              <div className="text-2xl mb-2">🗣️</div>
              <div className="font-medium text-gray-900">{t('admin.manageLanguages')}</div>
            </Link>
            <Link
              href="/admin/v2/prompts"
              className="p-4 bg-purple-50 rounded-lg text-center hover:bg-purple-100 transition-colors"
            >
              <div className="text-2xl mb-2">📝</div>
              <div className="font-medium text-gray-900">{t('admin.managePrompts')}</div>
            </Link>
            <Link
              href="/admin/v2/review"
              className="p-4 bg-orange-50 rounded-lg text-center hover:bg-orange-100 transition-colors"
            >
              <div className="text-2xl mb-2">✅</div>
              <div className="font-medium text-gray-900">{t('admin.reviewTranscriptions')}</div>
            </Link>
            <Link
              href="/admin/v2/export"
              className="p-4 bg-yellow-50 rounded-lg text-center hover:bg-yellow-100 transition-colors"
            >
              <div className="text-2xl mb-2">📦</div>
              <div className="font-medium text-gray-900">{t('admin.exportForTTS')}</div>
            </Link>
            <Link
              href="/admin/v2/recordings"
              className="p-4 bg-red-50 rounded-lg text-center hover:bg-red-100 transition-colors"
            >
              <div className="text-2xl mb-2">🎤</div>
              <div className="font-medium text-gray-900">{t('admin.allRecordings')}</div>
            </Link>
            <Link
              href="/admin/v2/pipeline/review"
              className="p-4 bg-indigo-50 rounded-lg text-center hover:bg-indigo-100 transition-colors"
            >
              <div className="text-2xl mb-2">🔊</div>
              <div className="font-medium text-gray-900">Pipeline Review</div>
            </Link>
            <Link
              href="/admin/v2/pipeline/datasets"
              className="p-4 bg-teal-50 rounded-lg text-center hover:bg-teal-100 transition-colors"
            >
              <div className="text-2xl mb-2">📊</div>
              <div className="font-medium text-gray-900">Datasets</div>
            </Link>
          </div>
        </div>

        {/* Language Progress */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('admin.languageProgress')}
            </h2>
          </div>
          <div className="p-6">
            {stats?.languageProgress.length === 0 ? (
              <p className="text-gray-500">{t('admin.noLanguagesConfigured')}</p>
            ) : (
              <div className="space-y-4">
                {stats?.languageProgress.map((lang) => (
                  <div key={lang.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{lang.name}</h3>
                        <p className="text-sm text-gray-500">
                          {lang._count.prompts} {t('admin.prompts').toLowerCase()} • {lang._count.recordings} {t('common.recordings')}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-blue-600">
                        {lang.progressPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full"
                        style={{ width: `${Math.min(lang.progressPercent, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{lang.approvedHours}h {t('admin.approved')}</span>
                      <span>{lang.collectedHours}h {t('admin.collected')}</span>
                      <span>{lang.targetHours}h {t('admin.target')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recording Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('admin.recordingsByStatus')}
              </h2>
            </div>
            <div className="p-6">
              {stats?.recordingsByStatus.map((item) => (
                <div
                  key={item.status}
                  className="flex justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-gray-600">
                    {item.status.replace(/_/g, " ")}
                  </span>
                  <span className="font-semibold">{item._count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('admin.transcriptionsByStatus')}
              </h2>
            </div>
            <div className="p-6">
              {stats?.transcriptionsByStatus.length === 0 ? (
                <p className="text-gray-500">{t('admin.noTranscriptionsYet')}</p>
              ) : (
                stats?.transcriptionsByStatus.map((item) => (
                  <div
                    key={item.status}
                    className="flex justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-gray-600">
                      {item.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-semibold">{item._count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: "blue" | "green" | "purple" | "orange";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className={`rounded-lg p-6 ${colors[color]}`}>
      <h3 className="text-sm font-medium opacity-80">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

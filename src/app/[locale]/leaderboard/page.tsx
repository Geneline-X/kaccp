"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface LeaderboardEntry {
  rank: number;
  id: string;
  displayName: string;
  languages: string[];
  recordingsCount?: number;
  transcriptionsCount?: number;
  totalMinutes: number;
  qualityScore?: number;
}

interface LeaderboardData {
  speakers: LeaderboardEntry[];
  transcribers: LeaderboardEntry[];
  stats: {
    totalSpeakers: number;
    totalTranscribers: number;
    totalRecordings: number;
    totalTranscriptions: number;
    totalHours: number;
  };
}

export default function LeaderboardPage() {
  const t = useTranslations();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"speakers" | "transcribers">("speakers");

  useEffect(() => {
    fetch("/api/v2/leaderboard?limit=20")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return null;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1: return "bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/50";
      case 2: return "bg-gradient-to-r from-gray-300/20 to-gray-400/10 border-gray-400/50";
      case 3: return "bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/50";
      default: return "bg-blue-900/30 border-blue-700/30";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-blue-900">
      {/* Header */}
      <header className="border-b border-blue-800/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/kaccp-logo.jpg" alt="KACCP" width={40} height={40} className="rounded-lg" />
            <span className="text-xl font-bold text-white">KACCP</span>
          </Link>
          <div className="flex gap-3">
            <Link
              href="/speaker/login"
              className="px-4 py-2 text-blue-200 hover:text-white transition"
            >
              {t('home.speaker.loginBtn')}
            </Link>
            <Link
              href="/transcriber/login"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition"
            >
              {t('home.transcriber.loginBtn')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          {t('leaderboard.title')}
        </h1>
        <p className="text-xl text-blue-200 mb-8">
          {t('leaderboard.subtitle')}
        </p>

        {/* Stats */}
        {data?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
            <div className="bg-blue-800/30 rounded-xl p-4 border border-blue-700/30">
              <p className="text-3xl font-bold text-white">{data.stats.totalSpeakers}</p>
              <p className="text-sm text-blue-300">{t('leaderboard.speakers')}</p>
            </div>
            <div className="bg-blue-800/30 rounded-xl p-4 border border-blue-700/30">
              <p className="text-3xl font-bold text-white">{data.stats.totalTranscribers}</p>
              <p className="text-sm text-blue-300">{t('leaderboard.transcribers')}</p>
            </div>
            <div className="bg-blue-800/30 rounded-xl p-4 border border-blue-700/30">
              <p className="text-3xl font-bold text-white">{data.stats.totalRecordings}</p>
              <p className="text-sm text-blue-300">{t('common.recordings')}</p>
            </div>
            <div className="bg-blue-800/30 rounded-xl p-4 border border-blue-700/30">
              <p className="text-3xl font-bold text-white">{data.stats.totalTranscriptions}</p>
              <p className="text-sm text-blue-300">{t('common.transcriptions')}</p>
            </div>
            <div className="bg-blue-800/30 rounded-xl p-4 border border-blue-700/30">
              <p className="text-3xl font-bold text-white">{data.stats.totalHours}h</p>
              <p className="text-sm text-blue-300">{t('leaderboard.audioCollected')}</p>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveTab("speakers")}
            className={`px-6 py-3 rounded-xl font-semibold transition ${activeTab === "speakers"
                ? "bg-blue-600 text-white"
                : "bg-blue-800/30 text-blue-300 hover:bg-blue-800/50"
              }`}
          >
            {t('leaderboard.topSpeakers')}
          </button>
          <button
            onClick={() => setActiveTab("transcribers")}
            className={`px-6 py-3 rounded-xl font-semibold transition ${activeTab === "transcribers"
                ? "bg-green-600 text-white"
                : "bg-blue-800/30 text-blue-300 hover:bg-blue-800/50"
              }`}
          >
            {t('leaderboard.topTranscribers')}
          </button>
        </div>
      </div>

      {/* Leaderboard Content */}
      <main className="max-w-4xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top 3 Podium */}
            {activeTab === "speakers" && data?.speakers?.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className={`rounded-xl p-5 border ${getRankBg(entry.rank)} backdrop-blur-sm`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{getRankEmoji(entry.rank)}</div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{entry.displayName}</h3>
                      <div className="flex gap-2 mt-1">
                        {entry.languages.slice(0, 3).map((lang) => (
                          <span key={lang} className="px-2 py-0.5 bg-blue-800/50 text-blue-200 rounded text-xs">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{entry.totalMinutes} {t('common.min')}</p>
                    <p className="text-sm text-blue-300">{entry.recordingsCount} {t('common.recordings')}</p>
                  </div>
                </div>
              </div>
            ))}

            {activeTab === "transcribers" && data?.transcribers?.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className={`rounded-xl p-5 border ${getRankBg(entry.rank)} backdrop-blur-sm`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{getRankEmoji(entry.rank)}</div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{entry.displayName}</h3>
                      <div className="flex gap-2 mt-1">
                        {entry.languages.slice(0, 3).map((lang) => (
                          <span key={lang} className="px-2 py-0.5 bg-green-800/50 text-green-200 rounded text-xs">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{entry.transcriptionsCount}</p>
                    <p className="text-sm text-blue-300">{t('common.transcriptions')}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Rest of the list */}
            <div className="mt-6 bg-blue-900/30 rounded-xl border border-blue-700/30 overflow-hidden">
              <table className="w-full">
                <thead className="bg-blue-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300">{t('leaderboard.rank')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300">{t('leaderboard.name')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300">{t('admin.languages')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-blue-300">
                      {activeTab === "speakers" ? t('leaderboard.minutes') : t('common.transcriptions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-800/30">
                  {activeTab === "speakers" && data?.speakers?.slice(3).map((entry) => (
                    <tr key={entry.id} className="hover:bg-blue-800/20 transition">
                      <td className="px-4 py-3 text-white font-medium">#{entry.rank}</td>
                      <td className="px-4 py-3 text-white">{entry.displayName}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {entry.languages.slice(0, 2).map((lang) => (
                            <span key={lang} className="px-2 py-0.5 bg-blue-800/50 text-blue-200 rounded text-xs">
                              {lang}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-white">{entry.totalMinutes} {t('common.min')}</td>
                    </tr>
                  ))}
                  {activeTab === "transcribers" && data?.transcribers?.slice(3).map((entry) => (
                    <tr key={entry.id} className="hover:bg-blue-800/20 transition">
                      <td className="px-4 py-3 text-white font-medium">#{entry.rank}</td>
                      <td className="px-4 py-3 text-white">{entry.displayName}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {entry.languages.slice(0, 2).map((lang) => (
                            <span key={lang} className="px-2 py-0.5 bg-green-800/50 text-green-200 rounded text-xs">
                              {lang}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-white">{entry.transcriptionsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Empty state */}
              {((activeTab === "speakers" && (!data?.speakers || data.speakers.length === 0)) ||
                (activeTab === "transcribers" && (!data?.transcribers || data.transcribers.length === 0))) && (
                  <div className="p-8 text-center text-blue-300">
                    {t('common.noDataYet')}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-blue-200 mb-4">{t('leaderboard.wantToSee')}</p>
          <div className="flex justify-center gap-4">
            <Link
              href="/speaker/register"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition"
            >
              {t('leaderboard.becomeSpeaker')}
            </Link>
            <Link
              href="/transcriber/v2/register"
              className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-500 transition"
            >
              {t('leaderboard.becomeTranscriber')}
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-blue-800/50 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-blue-400 text-sm">
          {t('leaderboard.builtBy')}{" "}
          <Link href="https://geneline-x.net" className="text-blue-300 hover:text-white underline" target="_blank">
            Geneline-X
          </Link>{" "}
          • {t('leaderboard.preserving')}
        </div>
      </footer>
    </div>
  );
}

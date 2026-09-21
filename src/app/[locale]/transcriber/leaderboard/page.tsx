"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/client";
import { Avatar, RankBadge } from "@/components/gamification/Avatar";
import type { AvatarSpec } from "@/lib/domain/gamification";

interface Entry {
  userId: string;
  name: string;
  avatar: AvatarSpec;
  rank: number;
  points: number;
  approved: number;
  rejected: number;
  english: number;
  pipeline: number;
  minutes: number;
  accuracy: number | null;
  activeDays: number;
}

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

export default function LeaderboardPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const [period, setPeriod] = useState("week");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [me, setMe] = useState<(Entry & { rival: { name: string; gap: number } | null }) | null>(null);
  const [totals, setTotals] = useState<{ participants: number; approved: number; points: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? getToken() : null;

  useEffect(() => {
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }
    setLoading(true);
    fetch(`/api/v2/leaderboard?period=${period}&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries || []);
        setMe(d.me || null);
        setTotals(d.totals || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, period, router, locale]);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <Link href={`/${locale}/transcriber/v2`} className="text-white/80 hover:text-white text-sm">
            ← Back to dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mt-2">🏆 Leaderboard</h1>
          <p className="text-white/80 text-sm mt-1">
            Points come from approved work. A rejected item costs you {Math.abs(-5)} points, so
            careful work beats fast work.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Period switcher */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p.id
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600 border hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {totals && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Competing</p>
              <p className="text-2xl font-bold text-gray-900">{totals.participants}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Items approved</p>
              <p className="text-2xl font-bold text-gray-900">{totals.approved.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Points earned</p>
              <p className="text-2xl font-bold text-gray-900">{totals.points.toLocaleString()}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-lg animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm">
            <div className="text-5xl mb-3">🌱</div>
            <h3 className="text-lg font-bold text-gray-900">Nobody on the board yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Approved work in this period will show up here. Be the first.
            </p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {podium.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {podium.map((e) => (
                  <div
                    key={e.userId}
                    className={`rounded-xl p-5 text-center shadow-sm ${
                      e.rank === 1
                        ? "bg-gradient-to-br from-amber-300 to-yellow-500 sm:-mt-3"
                        : e.rank === 2
                          ? "bg-gradient-to-br from-slate-200 to-slate-400"
                          : "bg-gradient-to-br from-orange-200 to-amber-600"
                    } ${e.userId === me?.userId ? "ring-4 ring-indigo-400" : ""}`}
                  >
                    <div className="text-3xl mb-1">
                      {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : "🥉"}
                    </div>
                    <div className="flex justify-center mb-2">
                      <Avatar spec={e.avatar} size="lg" ring />
                    </div>
                    <p className="font-bold text-gray-900 truncate">{e.name}</p>
                    <p className="text-2xl font-extrabold text-gray-900">{e.points}</p>
                    <p className="text-xs text-gray-700">
                      {e.approved} approved
                      {e.accuracy !== null && ` · ${e.accuracy}%`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* The rest */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {rest.map((e) => (
                <div
                  key={e.userId}
                  className={`flex items-center gap-4 px-4 py-3 border-b last:border-b-0 ${
                    e.userId === me?.userId ? "bg-indigo-50" : "hover:bg-gray-50"
                  }`}
                >
                  <RankBadge rank={e.rank} />
                  <Avatar spec={e.avatar} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {e.name}
                      {e.userId === me?.userId && (
                        <span className="ml-2 text-xs text-indigo-600 font-semibold">you</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {e.approved} approved
                      {e.english > 0 && ` · ${e.english} translated`}
                      {e.minutes > 0 && ` · ${e.minutes} min`}
                    </p>
                  </div>
                  {e.accuracy !== null && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        e.accuracy >= 95
                          ? "bg-emerald-100 text-emerald-700"
                          : e.accuracy >= 80
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                      title="Share of reviewed work that was approved"
                    >
                      {e.accuracy}%
                    </span>
                  )}
                  <span className="font-bold text-gray-900 w-16 text-right">{e.points}</span>
                </div>
              ))}
            </div>

            {/* Sticky self-position when you're off-screen down the list */}
            {me && me.rank > 3 && (
              <div className="sticky bottom-4 mt-4">
                <div className="bg-indigo-600 text-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
                  <span className="font-bold w-6 text-center">{me.rank}</span>
                  <Avatar spec={me.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">You · {me.points} pts</p>
                    {me.rival && (
                      <p className="text-xs text-white/80">
                        {me.rival.gap} behind {me.rival.name}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/${locale}/transcriber/v2`}
                    className="px-3 py-1.5 bg-white text-indigo-700 rounded text-xs font-semibold shrink-0"
                  >
                    Start working
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

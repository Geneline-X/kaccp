"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar, RankBadge } from "./Avatar";
import { CelebrationModal, type Celebration } from "./CelebrationModal";
import { AvatarPicker } from "./AvatarPicker";
import { CelebrationToast, type ToastData } from "./Toast";
import { BadgeCard } from "./BadgeCard";
import {
  DAILY_MILESTONES,
  milestonesCrossed,
  avatarsUnlockedAt,
  type AvatarSpec,
  type LevelProgress,
  type Badge,
  type Milestone,
} from "@/lib/domain/gamification";

interface Profile {
  user: { id: string; name: string; avatar: AvatarSpec; avatarId: string | null };
  level: LevelProgress;
  streak: number;
  dailyGoal: number;
  doneToday: number;
  bestDay: number;
  stats: {
    approved: number;
    rejected: number;
    pending: number;
    english: number;
    minutes: number;
    accuracy: number | null;
    activeDays: number;
  };
  history: { day: string; count: number }[];
  badges: Badge[];
  milestone: { reached: Milestone | null; next: Milestone | null; toNext: number | null };
  pace: { projected: number; onTrack: boolean };
  leaderboard: { me: Me | null; top: LeaderEntry[] };
}

interface LeaderEntry {
  userId: string;
  name: string;
  avatar: AvatarSpec;
  rank: number;
  points: number;
  approved: number;
  accuracy: number | null;
}

interface Me extends LeaderEntry {
  rival: { name: string; points: number; gap: number } | null;
}

/** Segmented ring: each milestone is a visible notch, so progress reads as a
 *  series of checkpoints rather than one long grind toward 500. */
function GoalRing({
  done,
  goal,
  onClick,
}: {
  done: number;
  goal: number;
  onClick?: () => void;
}) {
  const pct = Math.min(100, (done / Math.max(1, goal)) * 100);
  const r = 40;
  const circ = 2 * Math.PI * r;
  const complete = done >= goal;

  return (
    <button
      onClick={onClick}
      className="relative w-28 h-28 shrink-0 group"
      title="Today's milestones"
      type="button"
    >
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} className="stroke-white/20" strokeWidth="9" fill="none" />
        <circle
          cx="48"
          cy="48"
          r={r}
          className={complete ? "stroke-emerald-300" : "stroke-white"}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (pct / 100) * circ}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.4,0,0.2,1)" }}
        />
        {/* Milestone notches around the ring */}
        {DAILY_MILESTONES.filter((m) => m.at <= goal).map((m) => {
          const angle = (m.at / goal) * 2 * Math.PI;
          const x = 48 + r * Math.cos(angle);
          const y = 48 + r * Math.sin(angle);
          return (
            <circle
              key={m.at}
              cx={x}
              cy={y}
              r={done >= m.at ? 3.5 : 2.5}
              className={done >= m.at ? "fill-amber-300" : "fill-white/40"}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        {complete ? (
          <span className="text-3xl">👑</span>
        ) : (
          <>
            <span className="text-2xl font-extrabold leading-none">{done}</span>
            <span className="text-[10px] opacity-75">of {goal}</span>
          </>
        )}
      </div>
    </button>
  );
}

function Sparkline({ history }: { history: { day: string; count: number }[] }) {
  const max = Math.max(1, ...history.map((h) => h.count));
  return (
    <div className="flex items-end gap-[3px] h-9">
      {history.map((h) => (
        <div
          key={h.day}
          className={`flex-1 rounded-sm ${h.count > 0 ? "bg-white/80" : "bg-white/20"}`}
          style={{ height: `${Math.max(10, (h.count / max) * 100)}%` }}
          title={`${h.day}: ${h.count}`}
        />
      ))}
    </div>
  );
}

export function ProgressPanel({
  token,
  locale,
  refreshSignal = 0,
  onQueues,
}: {
  token: string | null;
  locale: string;
  /** Bump to refetch after a submission, so celebrations fire promptly. */
  refreshSignal?: number;
  /** Queue depths ride along on the profile payload, saving the parent a request. */
  onQueues?: (q: { english: number; pipeline: number }) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [top, setTop] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [queue, setQueue] = useState<Celebration[]>([]);
  // Small wins go here instead of the modal, so they never block the next item.
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // Previous snapshot, used to detect what was newly crossed. Starts undefined so
  // the first load never fires a burst of celebrations for pre-existing progress.
  const prev = useRef<{ done: number; level: number; badges: Set<string> } | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    // One request, not two: the profile endpoint carries the leaderboard summary.
    fetch("/api/v2/transcriber/profile", { headers })
      .then((r) => r.json())
      .then((p) => {
        if (!p.error) {
          const earned = new Set<string>(
            (p.badges as Badge[]).filter((b) => b.earned).map((b) => b.id)
          );
          const before = prev.current;
          if (before) {
            const events: Celebration[] = [];

            const light: ToastData[] = [];
            for (const m of milestonesCrossed(before.done, p.doneToday)) {
              const next = DAILY_MILESTONES.find((x) => x.at > m.at);
              if (m.weight === "toast") {
                light.push({ emoji: m.emoji, title: m.title, blurb: m.blurb, gradient: m.gradient });
                continue;
              }
              events.push({
                kind: "milestone",
                emoji: m.emoji,
                title: m.title,
                blurb: m.blurb,
                gradient: m.gradient,
                footnote: next ? `Next: ${next.title} at ${next.at}` : "You've cleared them all.",
              });
            }

            if (p.level.level > before.level) {
              const unlocked = avatarsUnlockedAt(p.level.level);
              events.push({
                kind: "levelup",
                emoji: "🎖️",
                title: `Level ${p.level.level}`,
                blurb: `You're now a ${p.level.title}.`,
                gradient: "from-indigo-500 to-purple-600",
                unlocked: unlocked.map((u) => ({ emoji: u.emoji, name: u.name })),
                footnote: unlocked.length ? "Tap your avatar to switch." : undefined,
              });
            }

            for (const b of p.badges as Badge[]) {
              if (b.earned && !before.badges.has(b.id)) {
                // Platinum and gold are rare enough to earn a full moment; the
                // rest arrive as a toast so a badge never blocks the next item.
                if (b.tier === "platinum" || b.tier === "gold") {
                  events.push({
                    kind: "badge",
                    emoji: b.emoji,
                    title: b.label,
                    blurb: b.description,
                    gradient: "from-amber-400 to-yellow-600",
                  });
                } else {
                  light.push({
                    emoji: b.emoji,
                    title: b.label,
                    blurb: b.description,
                    gradient: "from-amber-400 to-yellow-600",
                  });
                }
              }
            }

            if (events.length) setQueue((q) => [...q, ...events]);
            if (light.length) setToasts((t) => [...t, ...light]);
          }
          prev.current = { done: p.doneToday, level: p.level.level, badges: earned };
          setProfile(p);
          setMe(p.leaderboard?.me || null);
          setTop(p.leaderboard?.top || []);
          if (p.queues) onQueues?.(p.queues);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  if (loading || !profile) {
    return <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl h-52 mb-8 animate-pulse" />;
  }

  const { level, streak, dailyGoal, doneToday, stats, badges, history, milestone, pace } = profile;
  const earned = badges.filter((b) => b.earned);
  const nextBadge = badges
    .filter((b) => !b.earned && (b.progress ?? 0) > 0)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];

  return (
    <>
      <CelebrationModal
        celebration={queue[0] || null}
        onClose={() => setQueue((q) => q.slice(1))}
      />

      <CelebrationToast
        toast={toasts[0] || null}
        onClose={() => setToasts((t) => t.slice(1))}
      />

      {showPicker && (
        <AvatarPicker
          currentId={profile.user.avatarId}
          level={level.level}
          token={token}
          onPicked={() => load()}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div className="bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 rounded-2xl shadow-lg mb-8 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Identity + level */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button
                onClick={() => setShowPicker(true)}
                className="relative group shrink-0"
                title="Change your avatar"
                type="button"
              >
                <Avatar spec={profile.user.avatar} size="xl" ring />
                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white text-sm grid place-items-center shadow group-hover:scale-110 transition-transform">
                  ✏️
                </span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white truncate">{profile.user.name}</h2>
                  <span className="px-2 py-0.5 bg-white/20 backdrop-blur rounded-full text-xs font-semibold text-white">
                    Lv {level.level} · {level.title}
                  </span>
                </div>

                <div className="mt-2 w-full max-w-xs">
                  <div className="h-2 bg-white/25 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-700"
                      style={{ width: `${level.percentToNext}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-white/80 mt-1">
                    {level.xpIntoLevel} / {level.xpForNextLevel} XP to Level {level.level + 1}
                  </p>
                </div>

                <div className="flex items-center gap-3 mt-3 text-white/90 text-sm flex-wrap">
                  <span title="Consecutive active days">🔥 <strong>{streak}</strong> day streak</span>
                  {me && (
                    <span title="Rank this week" className="flex items-center gap-1">
                      <RankBadge rank={me.rank} /> this week
                    </span>
                  )}
                  {stats.accuracy !== null && (
                    <span title="Share of your reviewed work that was approved">
                      🎯 {stats.accuracy}% approved
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Today */}
            <div className="flex items-center gap-4">
              <GoalRing done={doneToday} goal={dailyGoal} onClick={() => setShowBadges((s) => !s)} />
              <div className="text-white">
                <p className="text-xs uppercase tracking-wide text-white/70">Today</p>
                {milestone.next ? (
                  <p className="text-sm font-medium">
                    {milestone.toNext} to {milestone.next.emoji} {milestone.next.title}
                  </p>
                ) : (
                  <p className="text-sm font-medium">Every milestone cleared 🏆</p>
                )}
                {doneToday > 0 && (
                  <p
                    className={`text-[11px] mt-1 ${pace.onTrack ? "text-emerald-200" : "text-white/70"}`}
                    title="Projected total at your current pace"
                  >
                    {pace.onTrack ? "✅ on track for" : "pace:"} ~{pace.projected} today
                  </p>
                )}
                <p className="text-[11px] text-white/70">Best day: {profile.bestDay}</p>
                <div className="mt-2 w-32">
                  <Sparkline history={history} />
                </div>
              </div>
            </div>
          </div>

          {/* Milestone track — the day as a sequence of wins */}
          <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-1">
            {DAILY_MILESTONES.filter((m) => m.at <= dailyGoal).map((m) => {
              const hit = doneToday >= m.at;
              return (
                <div
                  key={m.at}
                  title={`${m.title} — ${m.at} items`}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs shrink-0 transition-all ${
                    hit
                      ? "bg-white text-purple-700 font-semibold shadow-sm"
                      : "bg-white/15 text-white/60"
                  }`}
                >
                  <span className={hit ? "" : "grayscale opacity-60"}>{m.emoji}</span>
                  <span>{m.at}</span>
                </div>
              );
            })}
          </div>

          {/* The closable gap — a concrete target beats an abstract total. */}
          {me?.rival && (
            <div className="mt-4 p-3 bg-white/15 backdrop-blur rounded-xl flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-white">
                <strong>{me.rival.gap}</strong> point{me.rival.gap === 1 ? "" : "s"} behind{" "}
                <strong>{me.rival.name}</strong> — about {Math.max(1, Math.ceil(me.rival.gap / 10))}{" "}
                more item{Math.ceil(me.rival.gap / 10) === 1 ? "" : "s"} to overtake.
              </p>
              <Link
                href={`/${locale}/transcriber/leaderboard`}
                className="px-3 py-1.5 bg-white text-purple-700 rounded-lg text-xs font-semibold hover:bg-white/90 shrink-0"
              >
                Leaderboard
              </Link>
            </div>
          )}
          {me && !me.rival && me.rank === 1 && (
            <div className="mt-4 p-3 bg-white/15 backdrop-blur rounded-xl flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-white">👑 You&apos;re #1 this week. Hold the crown.</p>
              <Link
                href={`/${locale}/transcriber/leaderboard`}
                className="px-3 py-1.5 bg-white text-purple-700 rounded-lg text-xs font-semibold hover:bg-white/90 shrink-0"
              >
                Leaderboard
              </Link>
            </div>
          )}

          {/* Badges */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {earned.slice(0, 7).map((b) => (
              <span
                key={b.id}
                title={`${b.label} — ${b.description}`}
                className="px-2 py-1 bg-white/20 backdrop-blur rounded-lg text-xs text-white font-medium"
              >
                {b.emoji} {b.label}
              </span>
            ))}
            {nextBadge && (
              <span
                title={nextBadge.description}
                className="px-2 py-1 border border-white/30 rounded-lg text-xs text-white/70"
              >
                {nextBadge.emoji} {nextBadge.label} · {nextBadge.progress}%
              </span>
            )}
            <button
              onClick={() => setShowBadges((s) => !s)}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
              type="button"
            >
              {showBadges ? "Hide all" : `All badges (${earned.length}/${badges.length})`}
            </button>
          </div>

          {showBadges && (
            <div className="mt-4 p-4 bg-white/95 rounded-xl">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {[...earned, ...badges.filter((b) => !b.earned).sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))].map(
                  (b) => (
                    <BadgeCard key={b.id} badge={b} />
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Top 3 this week */}
        {top.length > 0 && (
          <div className="bg-black/15 px-6 py-3 flex items-center gap-4 overflow-x-auto">
            <span className="text-xs uppercase tracking-wide text-white/60 shrink-0">
              Top this week
            </span>
            {top.map((e) => (
              <div key={e.userId} className="flex items-center gap-2 shrink-0">
                <RankBadge rank={e.rank} />
                <Avatar spec={e.avatar} size="sm" />
                <span className="text-sm text-white font-medium">{e.name}</span>
                <span className="text-xs text-white/70">{e.points} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

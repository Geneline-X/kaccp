"use client";

import { useEffect, useState } from "react";
import { avatarFor, type AvatarSpec } from "@/lib/domain/gamification";

/* A short dancing-avatar celebration, fired every few submissions.
 *
 * Deliberately brief and non-blocking. The reward for finishing a clip has to be
 * smaller than the work itself, or at 500 a day the celebration becomes the
 * bottleneck — so this is ~2s, dismissable, and never waits for a network call.
 */

export interface DanceTier {
  every: number;
  emoji: string[];
  title: (n: number) => string;
  blurb: string;
  gradient: string;
  durationMs: number;
}

// Escalating rewards: the every-5 beat keeps a rhythm, the rarer ones stay
// special because they are rare.
export const DANCE_TIERS: DanceTier[] = [
  {
    every: 100,
    emoji: ["🏆", "🎆", "👑", "🌟", "💥"],
    title: (n) => `${n} today!`,
    blurb: "Absolutely unstoppable.",
    gradient: "from-yellow-300 via-amber-400 to-orange-500",
    durationMs: 3600,
  },
  {
    every: 25,
    emoji: ["🔥", "⚡", "🎉", "✨"],
    title: (n) => `${n} in the bag`,
    blurb: "You are on a serious run.",
    gradient: "from-fuchsia-500 via-purple-500 to-indigo-500",
    durationMs: 2800,
  },
  {
    every: 5,
    emoji: ["🎵", "✨", "🎶", "💫"],
    title: (n) => `${n} done!`,
    blurb: "Keep the rhythm going.",
    gradient: "from-emerald-400 via-teal-400 to-cyan-500",
    durationMs: 2200,
  },
];

/** The biggest tier this count qualifies for, or null. */
export function tierFor(count: number): DanceTier | null {
  return DANCE_TIERS.find((t) => count > 0 && count % t.every === 0) || null;
}

/** Today's submission count, kept per day so the rhythm resets each morning. */
const KEY = "transcriber_submitted_today";

export function recordSubmission(): number {
  if (typeof window === "undefined") return 0;
  const today = new Date().toISOString().slice(0, 10);
  let stored: { day: string; n: number } = { day: today, n: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    // corrupt value: start over rather than crash the submit flow
  }
  const n = stored.day === today ? stored.n + 1 : 1;
  localStorage.setItem(KEY, JSON.stringify({ day: today, n }));
  return n;
}

export function submittedToday(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const stored = JSON.parse(raw);
    return stored.day === new Date().toISOString().slice(0, 10) ? stored.n : 0;
  } catch {
    return 0;
  }
}

/* The avatar is cached by ProgressPanel so this can render the person's real
 * character without the editor making a profile request of its own. */
const AVATAR_KEY = "transcriber_avatar";

export function cacheAvatar(spec: AvatarSpec): void {
  try {
    localStorage.setItem(AVATAR_KEY, JSON.stringify(spec));
  } catch {
    // storage full or blocked — the fallback avatar is fine
  }
}

function readAvatar(): AvatarSpec {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through
  }
  return avatarFor("anon");
}

export function DanceBreak({
  count,
  tier,
  onDone,
}: {
  count: number;
  tier: DanceTier | null;
  onDone: () => void;
}) {
  const [avatar, setAvatar] = useState<AvatarSpec | null>(null);

  useEffect(() => {
    if (!tier) return;
    setAvatar(readAvatar());
    const timer = setTimeout(onDone, tier.durationMs);
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, [tier, onDone]);

  if (!tier || !avatar) return null;

  const isBig = tier.every >= 25;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
      onClick={onDone}
      role="status"
      aria-live="polite"
      aria-label={tier.title(count)}
    >
      <div className="relative flex flex-col items-center">
        {/* Floating emoji orbiting the dancer */}
        {tier.emoji.map((e, i) => (
          <span
            key={i}
            className="absolute text-3xl pointer-events-none select-none"
            style={{
              animation: `floatUp ${1.4 + i * 0.22}s ease-out ${i * 0.16}s infinite`,
              left: `${(i - (tier.emoji.length - 1) / 2) * 62}px`,
              top: "10px",
            }}
          >
            {e}
          </span>
        ))}

        {/* The dancer */}
        <div
          className={`${isBig ? "w-40 h-40 text-8xl" : "w-32 h-32 text-7xl"} rounded-full bg-gradient-to-br ${
            avatar.gradient
          } flex items-center justify-center shadow-2xl ring-4 ring-white/40`}
          style={{ animation: "dance 0.62s ease-in-out infinite" }}
        >
          <span style={{ animation: "headBob 0.62s ease-in-out infinite" }}>{avatar.emoji}</span>
        </div>

        {/* Shadow that squashes in time with the bounce */}
        <div
          className="mt-3 h-2 w-20 rounded-full bg-black/40 blur-sm"
          style={{ animation: "shadowPulse 0.62s ease-in-out infinite" }}
        />

        <h2
          className={`mt-5 font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${tier.gradient} ${
            isBig ? "text-5xl" : "text-4xl"
          }`}
          style={{ animation: "popText 420ms cubic-bezier(0.34,1.56,0.64,1)" }}
        >
          {tier.title(count)}
        </h2>
        <p className="text-white/85 text-sm mt-1">{tier.blurb}</p>
        <p className="text-white/40 text-[11px] mt-4">tap or press any key to continue</p>
      </div>

      <style jsx global>{`
        @keyframes dance {
          0%   { transform: translateY(0) rotate(-9deg) scale(1); }
          25%  { transform: translateY(-18px) rotate(9deg) scale(1.06); }
          50%  { transform: translateY(0) rotate(-9deg) scale(1); }
          75%  { transform: translateY(-12px) rotate(6deg) scale(1.04); }
          100% { transform: translateY(0) rotate(-9deg) scale(1); }
        }
        @keyframes headBob {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50%      { transform: rotate(14deg) scale(1.12); }
        }
        @keyframes shadowPulse {
          0%, 100% { transform: scaleX(1); opacity: 0.4; }
          25%      { transform: scaleX(0.6); opacity: 0.2; }
        }
        @keyframes floatUp {
          0%   { transform: translateY(40px) scale(0.5); opacity: 0; }
          35%  { opacity: 1; }
          100% { transform: translateY(-110px) scale(1.25); opacity: 0; }
        }
        @keyframes popText {
          0%   { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="dance"], [style*="headBob"], [style*="floatUp"],
          [style*="shadowPulse"], [style*="popText"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

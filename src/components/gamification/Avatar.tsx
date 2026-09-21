"use client";

import { avatarFor, type AvatarSpec } from "@/lib/domain/gamification";

const SIZES = {
  sm: "w-8 h-8 text-base",
  md: "w-11 h-11 text-xl",
  lg: "w-16 h-16 text-3xl",
  xl: "w-24 h-24 text-5xl",
} as const;

export function Avatar({
  seed,
  spec,
  size = "md",
  ring = false,
  className = "",
}: {
  /** User id. Ignored when `spec` is supplied. */
  seed?: string;
  /** Pre-computed spec from the API, so server and client never disagree. */
  spec?: AvatarSpec;
  size?: keyof typeof SIZES;
  ring?: boolean;
  className?: string;
}) {
  const a = spec || avatarFor(seed || "anon");
  return (
    <div
      className={`${SIZES[size]} rounded-full bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-sm select-none ${
        ring ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : ""
      } ${className}`}
      aria-hidden="true"
    >
      <span className="drop-shadow-sm">{a.emoji}</span>
    </div>
  );
}

/** Rank badge: gold/silver/bronze for the top three, plain number after. */
export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl" title="1st">🥇</span>;
  if (rank === 2) return <span className="text-xl" title="2nd">🥈</span>;
  if (rank === 3) return <span className="text-xl" title="3rd">🥉</span>;
  return <span className="text-sm font-semibold text-gray-400 w-6 text-center">{rank}</span>;
}

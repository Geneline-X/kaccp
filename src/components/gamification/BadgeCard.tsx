"use client";

import { TIER_STYLES, type Badge } from "@/lib/domain/gamification";

/* Earned badges are bright, metallic and tier-coloured. Unearned ones stay
 * desaturated with a visible progress bar — the gap is the motivator, so a locked
 * badge must look like something you are partway to, not something absent. */
export function BadgeCard({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" }) {
  const tier = TIER_STYLES[badge.tier];
  const compact = size === "sm";

  if (!badge.earned) {
    return (
      <div
        className="relative rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-center overflow-hidden"
        title={badge.description}
      >
        <div className={`${compact ? "text-2xl" : "text-3xl"} grayscale opacity-40`}>
          {badge.emoji}
        </div>
        <p className="text-xs font-semibold text-gray-500 mt-1 truncate">{badge.label}</p>
        <p className="text-[10px] text-gray-400 truncate">{badge.progressLabel}</p>
        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-400 rounded-full transition-all duration-700"
            style={{ width: `${badge.progress ?? 0}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl bg-gradient-to-br ${tier.bg} p-3 text-center ring-2 ${tier.ring} shadow-sm overflow-hidden group`}
      title={badge.description}
    >
      {/* Sheen sweep on hover — cheap way to make a badge feel like an object. */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
      <div className={`${compact ? "text-2xl" : "text-3xl"} drop-shadow-sm`}>{badge.emoji}</div>
      <p className={`text-xs font-bold ${tier.text} mt-1 truncate`}>{badge.label}</p>
      <p className={`text-[10px] ${tier.text} opacity-70`}>{tier.label}</p>
    </div>
  );
}

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);
  const ordered = [...earned, ...locked.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Badges</h3>
        <span className="text-sm text-gray-500">
          {earned.length} of {badges.length}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {ordered.map((b) => (
          <BadgeCard key={b.id} badge={b} />
        ))}
      </div>
    </div>
  );
}

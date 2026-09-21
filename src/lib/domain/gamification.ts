/* Gamification rules, shared by the API and the UI so both agree on every number.
 *
 * Design rule that drives everything here: points come from APPROVED work, never
 * from raw submissions. Ranking on volume alone would reward whoever types fastest
 * regardless of correctness, and the dataset — the actual product — would rot. A
 * rejected item costs points, so racing carelessly is worse than working steadily.
 */

export const POINTS = {
  transcription: 10, // approved Krio transcription
  pipeline: 10, // approved pipeline correction
  english: 15, // English translation (harder: requires both languages)
  rejectionPenalty: -5, // discourages spray-and-pray
} as const;

export const DEFAULT_DAILY_GOAL = 500;

// ---------------------------------------------------------------------------
// Daily milestones
// ---------------------------------------------------------------------------
// 500 in a day is a long haul, and one far-off target is demotivating: for most
// of the day you are "losing". Checkpoints convert it into a sequence of wins,
// each close enough to chase, with the reward escalating toward the goal.

export interface Milestone {
  at: number;
  emoji: string;
  title: string;
  blurb: string;
  /** Tailwind gradient for the celebration card. */
  gradient: string;
  /**
   * How loudly to celebrate. A full-screen modal for every checkpoint would be a
   * tax on someone doing 500 a day, so early wins are a corner toast and only the
   * big ones stop the screen.
   */
  weight: "toast" | "modal";
}

export const DAILY_MILESTONES: Milestone[] = [
  { at: 10, emoji: "🌱", title: "Warmed up", blurb: "Ten down. The hard part is starting.", gradient: "from-emerald-400 to-teal-500", weight: "toast" },
  { at: 50, emoji: "⚡", title: "In the zone", blurb: "Fifty done. You're moving.", gradient: "from-cyan-400 to-blue-500", weight: "toast" },
  { at: 100, emoji: "💯", title: "Century", blurb: "One hundred. A fifth of the way.", gradient: "from-blue-500 to-indigo-600", weight: "modal" },
  { at: 200, emoji: "🔥", title: "On fire", blurb: "Two hundred. Most people stop here.", gradient: "from-orange-400 to-red-500", weight: "toast" },
  { at: 350, emoji: "🚀", title: "Flying", blurb: "Three fifty. The goal is in sight.", gradient: "from-violet-500 to-purple-600", weight: "toast" },
  { at: 500, emoji: "👑", title: "Goal smashed", blurb: "Five hundred in a day. Elite.", gradient: "from-amber-400 to-yellow-500", weight: "modal" },
  { at: 750, emoji: "🌟", title: "Unreal", blurb: "Seven fifty. Who does this?", gradient: "from-fuchsia-500 to-pink-600", weight: "toast" },
  { at: 1000, emoji: "🏆", title: "Legendary", blurb: "One thousand in a single day.", gradient: "from-yellow-300 to-amber-600", weight: "modal" },
];

/** The highest milestone crossed at `count`, or null below the first one. */
export function milestoneFor(count: number): Milestone | null {
  let hit: Milestone | null = null;
  for (const m of DAILY_MILESTONES) if (count >= m.at) hit = m;
  return hit;
}

/** The next checkpoint to chase — what the UI counts down to. */
export function nextMilestone(count: number): Milestone | null {
  return DAILY_MILESTONES.find((m) => m.at > count) || null;
}

/**
 * Milestones newly crossed moving from `before` to `after`. Returns all of them
 * so a burst of submissions cannot skip a celebration.
 */
export function milestonesCrossed(before: number, after: number): Milestone[] {
  return DAILY_MILESTONES.filter((m) => m.at > before && m.at <= after);
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------
// Quadratic curve: each level costs a little more than the last, so early levels
// arrive fast (momentum) while later ones stay meaningful. Level N starts at
// 100*(N-1)^2 XP — L2 at 100, L5 at 1,600, L10 at 8,100.

const LEVEL_TITLES = [
  "Newcomer",
  "Apprentice",
  "Scribe",
  "Wordsmith",
  "Interpreter",
  "Linguist",
  "Sage",
  "Luminary",
  "Grandmaster",
  "Legend",
];

export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return 100 * Math.pow(Math.max(0, level - 1), 2);
}

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] || "Legend";
}

export interface LevelProgress {
  level: number;
  title: string;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  percentToNext: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const span = Math.max(1, ceiling - floor);
  const into = Math.max(0, xp - floor);
  return {
    level,
    title: levelTitle(level),
    xp,
    xpIntoLevel: into,
    xpForNextLevel: span,
    percentToNext: Math.min(100, Math.round((into / span) * 100)),
  };
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------
// Chosen, not inferred. Guessing gender or appearance from a name is wrong often
// enough that it would misrepresent real people on a public leaderboard — and a
// pickable avatar is better for engagement anyway, because locking the good ones
// behind levels gives another reason to keep going.

export interface AvatarOption {
  id: string;
  emoji: string;
  name: string;
  gradient: string;
  /** Level at which this becomes selectable. */
  unlocksAt: number;
}

export const AVATAR_CATALOG: AvatarOption[] = [
  // Level 1 — everyone starts here
  { id: "lion", emoji: "🦁", name: "Lion", gradient: "from-amber-400 to-orange-500", unlocksAt: 1 },
  { id: "tiger", emoji: "🐯", name: "Tiger", gradient: "from-orange-400 to-red-500", unlocksAt: 1 },
  { id: "fox", emoji: "🦊", name: "Fox", gradient: "from-orange-300 to-amber-500", unlocksAt: 1 },
  { id: "panda", emoji: "🐼", name: "Panda", gradient: "from-slate-300 to-slate-500", unlocksAt: 1 },
  { id: "owl", emoji: "🦉", name: "Owl", gradient: "from-amber-600 to-yellow-700", unlocksAt: 1 },
  { id: "frog", emoji: "🐸", name: "Frog", gradient: "from-lime-400 to-green-500", unlocksAt: 1 },
  { id: "penguin", emoji: "🐧", name: "Penguin", gradient: "from-slate-400 to-blue-600", unlocksAt: 1 },
  { id: "bee", emoji: "🐝", name: "Bee", gradient: "from-yellow-400 to-amber-500", unlocksAt: 1 },

  // Level 2
  { id: "dolphin", emoji: "🐬", name: "Dolphin", gradient: "from-sky-400 to-blue-500", unlocksAt: 2 },
  { id: "butterfly", emoji: "🦋", name: "Butterfly", gradient: "from-cyan-300 to-violet-500", unlocksAt: 2 },
  { id: "parrot", emoji: "🦜", name: "Parrot", gradient: "from-red-400 to-emerald-500", unlocksAt: 2 },
  { id: "turtle", emoji: "🐢", name: "Turtle", gradient: "from-emerald-400 to-green-600", unlocksAt: 2 },

  // Level 3
  { id: "eagle", emoji: "🦅", name: "Eagle", gradient: "from-stone-400 to-amber-700", unlocksAt: 3 },
  { id: "flamingo", emoji: "🦩", name: "Flamingo", gradient: "from-pink-300 to-rose-500", unlocksAt: 3 },
  { id: "octopus", emoji: "🐙", name: "Octopus", gradient: "from-purple-400 to-fuchsia-600", unlocksAt: 3 },
  { id: "giraffe", emoji: "🦒", name: "Giraffe", gradient: "from-yellow-300 to-amber-600", unlocksAt: 3 },

  // Level 4
  { id: "shark", emoji: "🦈", name: "Shark", gradient: "from-slate-400 to-cyan-700", unlocksAt: 4 },
  { id: "elephant", emoji: "🐘", name: "Elephant", gradient: "from-gray-400 to-slate-600", unlocksAt: 4 },
  { id: "peacock", emoji: "🦚", name: "Peacock", gradient: "from-teal-400 to-indigo-600", unlocksAt: 4 },

  // Level 5 — elemental tier
  { id: "fire", emoji: "🔥", name: "Blaze", gradient: "from-orange-500 to-red-600", unlocksAt: 5 },
  { id: "wave", emoji: "🌊", name: "Tide", gradient: "from-cyan-400 to-blue-700", unlocksAt: 5 },
  { id: "bolt", emoji: "⚡", name: "Bolt", gradient: "from-yellow-300 to-amber-500", unlocksAt: 5 },
  { id: "clover", emoji: "🍀", name: "Clover", gradient: "from-green-400 to-emerald-600", unlocksAt: 5 },

  // Level 6
  { id: "rocket", emoji: "🚀", name: "Rocket", gradient: "from-indigo-400 to-purple-600", unlocksAt: 6 },
  { id: "comet", emoji: "☄️", name: "Comet", gradient: "from-orange-400 to-purple-600", unlocksAt: 6 },
  { id: "rainbow", emoji: "🌈", name: "Rainbow", gradient: "from-red-400 via-yellow-400 to-blue-500", unlocksAt: 6 },

  // Level 7
  { id: "diamond", emoji: "💎", name: "Diamond", gradient: "from-cyan-300 to-blue-500", unlocksAt: 7 },
  { id: "star", emoji: "🌟", name: "Star", gradient: "from-yellow-300 to-orange-500", unlocksAt: 7 },

  // Level 8
  { id: "dragon", emoji: "🐉", name: "Dragon", gradient: "from-emerald-500 to-teal-700", unlocksAt: 8 },
  { id: "unicorn", emoji: "🦄", name: "Unicorn", gradient: "from-pink-400 via-purple-400 to-indigo-500", unlocksAt: 8 },

  // Level 9
  { id: "phoenix", emoji: "🔆", name: "Phoenix", gradient: "from-amber-400 via-orange-500 to-red-600", unlocksAt: 9 },
  { id: "galaxy", emoji: "🌌", name: "Galaxy", gradient: "from-indigo-600 to-purple-900", unlocksAt: 9 },

  // Level 10 — the crown
  { id: "crown", emoji: "👑", name: "Sovereign", gradient: "from-yellow-300 via-amber-400 to-yellow-600", unlocksAt: 10 },
  { id: "trophy", emoji: "🏆", name: "Champion", gradient: "from-amber-300 to-yellow-600", unlocksAt: 10 },
];

export interface AvatarSpec {
  emoji: string;
  gradient: string;
  id?: string;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Stable starter avatar for someone who hasn't picked one yet. */
export function defaultAvatarId(seed: string): string {
  const starters = AVATAR_CATALOG.filter((a) => a.unlocksAt === 1);
  return starters[hash(seed || "anon") % starters.length].id;
}

export function avatarFor(seed: string, chosenId?: string | null): AvatarSpec {
  const chosen = chosenId ? AVATAR_CATALOG.find((a) => a.id === chosenId) : undefined;
  const option =
    chosen || AVATAR_CATALOG.find((a) => a.id === defaultAvatarId(seed)) || AVATAR_CATALOG[0];
  return { emoji: option.emoji, gradient: option.gradient, id: option.id };
}

export function avatarsUnlockedAt(level: number): AvatarOption[] {
  return AVATAR_CATALOG.filter((a) => a.unlocksAt === level);
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export interface Badge {
  id: string;
  label: string;
  emoji: string;
  description: string;
  tier: BadgeTier;
  earned: boolean;
  progress?: number; // 0-100 toward earning it
  /** Human-readable "7 / 30 days" style progress, for the badge card. */
  progressLabel?: string;
}

export interface BadgeInput {
  approvedTotal: number;
  streakDays: number;
  bestDay: number;
  accuracy: number; // 0-1, approved / reviewed
  reviewedTotal: number;
  englishTotal: number;
}

export function computeBadges(s: BadgeInput): Badge[] {
  const pct = (value: number, target: number) =>
    Math.min(100, Math.round((value / target) * 100));
  const label = (value: number, target: number, unit = "") =>
    `${Math.min(value, target).toLocaleString()} / ${target.toLocaleString()}${unit}`;

  return [
    {
      id: "first_steps",
      label: "First Steps",
      emoji: "🌱",
      description: "Complete your first approved item",
      tier: "bronze",
      earned: s.approvedTotal >= 1,
      progress: pct(s.approvedTotal, 1),
      progressLabel: label(s.approvedTotal, 1),
    },
    {
      id: "century",
      label: "Century",
      emoji: "💯",
      description: "100 approved items",
      tier: "bronze",
      earned: s.approvedTotal >= 100,
      progress: pct(s.approvedTotal, 100),
      progressLabel: label(s.approvedTotal, 100),
    },
    {
      id: "five_hundred",
      label: "High Five",
      emoji: "🖐️",
      description: "500 approved items",
      tier: "silver",
      earned: s.approvedTotal >= 500,
      progress: pct(s.approvedTotal, 500),
      progressLabel: label(s.approvedTotal, 500),
    },
    {
      id: "thousand",
      label: "Four Digits",
      emoji: "🏆",
      description: "1,000 approved items",
      tier: "gold",
      earned: s.approvedTotal >= 1000,
      progress: pct(s.approvedTotal, 1000),
      progressLabel: label(s.approvedTotal, 1000),
    },
    {
      id: "five_thousand",
      label: "Titan",
      emoji: "🗿",
      description: "5,000 approved items",
      tier: "platinum",
      earned: s.approvedTotal >= 5000,
      progress: pct(s.approvedTotal, 5000),
      progressLabel: label(s.approvedTotal, 5000),
    },
    {
      id: "streak_3",
      label: "On a Roll",
      emoji: "🔥",
      description: "3 days in a row",
      tier: "bronze",
      earned: s.streakDays >= 3,
      progress: pct(s.streakDays, 3),
      progressLabel: label(s.streakDays, 3, " days"),
    },
    {
      id: "streak_7",
      label: "Unstoppable",
      emoji: "⚡",
      description: "7 days in a row",
      tier: "silver",
      earned: s.streakDays >= 7,
      progress: pct(s.streakDays, 7),
      progressLabel: label(s.streakDays, 7, " days"),
    },
    {
      id: "streak_30",
      label: "Iron Will",
      emoji: "🛡️",
      description: "30 days in a row",
      tier: "gold",
      earned: s.streakDays >= 30,
      progress: pct(s.streakDays, 30),
      progressLabel: label(s.streakDays, 30, " days"),
    },
    {
      id: "day_100",
      label: "Marathon",
      emoji: "🏃",
      description: "100 items in a single day",
      tier: "silver",
      earned: s.bestDay >= 100,
      progress: pct(s.bestDay, 100),
      progressLabel: label(s.bestDay, 100),
    },
    {
      id: "day_500",
      label: "Daily Legend",
      emoji: "👑",
      description: "500 items in a single day",
      tier: "platinum",
      earned: s.bestDay >= 500,
      progress: pct(s.bestDay, 500),
      progressLabel: label(s.bestDay, 500),
    },
    {
      id: "sharpshooter",
      label: "Sharpshooter",
      emoji: "🎯",
      // Gated on volume so a single lucky item cannot earn it.
      description: "95% approval over 50+ reviewed items",
      tier: "gold",
      earned: s.reviewedTotal >= 50 && s.accuracy >= 0.95,
      progress: s.reviewedTotal >= 50 ? pct(s.accuracy * 100, 95) : pct(s.reviewedTotal, 50),
      progressLabel:
        s.reviewedTotal >= 50
          ? `${Math.round(s.accuracy * 100)}% / 95%`
          : label(s.reviewedTotal, 50, " reviewed"),
    },
    {
      id: "bridge_builder",
      label: "Bridge Builder",
      emoji: "🌉",
      description: "50 English translations",
      tier: "silver",
      earned: s.englishTotal >= 50,
      progress: pct(s.englishTotal, 50),
      progressLabel: label(s.englishTotal, 50),
    },
  ];
}

export const TIER_STYLES: Record<BadgeTier, { ring: string; bg: string; text: string; label: string }> = {
  bronze: {
    ring: "ring-amber-600/40",
    bg: "from-amber-200 to-amber-500",
    text: "text-amber-900",
    label: "Bronze",
  },
  silver: {
    ring: "ring-slate-400/50",
    bg: "from-slate-200 to-slate-400",
    text: "text-slate-800",
    label: "Silver",
  },
  gold: {
    ring: "ring-yellow-500/50",
    bg: "from-yellow-200 to-amber-500",
    text: "text-amber-900",
    label: "Gold",
  },
  platinum: {
    ring: "ring-cyan-400/50",
    bg: "from-cyan-200 via-violet-200 to-fuchsia-300",
    text: "text-indigo-900",
    label: "Platinum",
  },
};

// ---------------------------------------------------------------------------
// Streaks and periods
// ---------------------------------------------------------------------------

/** UTC day key, so streaks are stable regardless of where the server runs. */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive active days ending today or yesterday. Yesterday still counts so a
 * streak doesn't appear broken to someone who simply hasn't started yet today.
 */
export function streakFromDays(days: Iterable<string>, today = new Date()): number {
  const set = new Set(days);
  if (set.size === 0) return 0;

  const cursor = new Date(today);
  if (!set.has(dayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!set.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (set.has(dayKey(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Start of the requested window, in UTC. */
export function periodStart(period: string, now = new Date()): Date | null {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  if (period === "today") return d;
  if (period === "week") {
    d.setUTCDate(d.getUTCDate() - 6); // rolling 7 days including today
    return d;
  }
  if (period === "month") {
    d.setUTCDate(d.getUTCDate() - 29);
    return d;
  }
  return null; // all time
}

/**
 * Projected end-of-day total at the current pace. Shown as "on track for N" —
 * a pace signal makes a 500 target feel measurable instead of arbitrary.
 */
export function projectedDailyTotal(doneToday: number, now = new Date()): number {
  const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
  // Assume a working day starts around 08:00 local-ish; avoid wild early spikes.
  const elapsed = Math.max(1, hours - 7);
  const remaining = Math.max(0, 22 - hours);
  if (doneToday === 0) return 0;
  return Math.round(doneToday + (doneToday / elapsed) * remaining);
}

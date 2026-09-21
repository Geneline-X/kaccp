"use client";

import { useEffect } from "react";
import { Confetti } from "./Confetti";

export type CelebrationKind = "milestone" | "levelup" | "badge" | "streak";

export interface Celebration {
  kind: CelebrationKind;
  emoji: string;
  title: string;
  blurb: string;
  gradient: string;
  /** Optional footer line, e.g. "Next: 200 — 47 to go". */
  footnote?: string;
  /** Avatars unlocked by this event, shown as a reward strip. */
  unlocked?: { emoji: string; name: string }[];
}

/* One celebration at a time, auto-dismissing. The popup is deliberately cheap to
 * dismiss (click anywhere, Escape, or wait): a modal that interrupts someone mid-
 * flow is punishing at 500 items a day, so it must feel like a pat on the back,
 * not a roadblock. */
export function CelebrationModal({
  celebration,
  onClose,
  autoCloseMs = 4200,
}: {
  celebration: Celebration | null;
  onClose: () => void;
  autoCloseMs?: number;
}) {
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(onClose, autoCloseMs);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [celebration, onClose, autoCloseMs]);

  if (!celebration) return null;

  return (
    <>
      <Confetti active />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        role="dialog"
        aria-live="assertive"
        aria-label={celebration.title}
      >
        <div
          className={`relative w-full max-w-sm rounded-2xl bg-gradient-to-br ${celebration.gradient} p-[2px] shadow-2xl animate-[popIn_260ms_cubic-bezier(0.34,1.56,0.64,1)]`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl bg-white/95 backdrop-blur px-6 py-7 text-center">
            <div className="text-6xl mb-3 animate-[bounceIn_500ms_ease-out]">
              {celebration.emoji}
            </div>

            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-1">
              {celebration.kind === "levelup"
                ? "Level up"
                : celebration.kind === "badge"
                  ? "Badge earned"
                  : celebration.kind === "streak"
                    ? "Streak"
                    : "Milestone"}
            </p>

            <h2
              className={`text-2xl font-extrabold bg-gradient-to-r ${celebration.gradient} bg-clip-text text-transparent`}
            >
              {celebration.title}
            </h2>
            <p className="text-sm text-gray-600 mt-2">{celebration.blurb}</p>

            {celebration.unlocked && celebration.unlocked.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                  Avatars unlocked
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {celebration.unlocked.map((u) => (
                    <div key={u.name} className="flex flex-col items-center">
                      <span className="text-3xl">{u.emoji}</span>
                      <span className="text-[10px] text-gray-500">{u.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {celebration.footnote && (
              <p className="text-xs text-gray-500 mt-4">{celebration.footnote}</p>
            )}

            <button
              onClick={onClose}
              className={`mt-5 w-full py-2.5 rounded-xl text-white font-semibold bg-gradient-to-r ${celebration.gradient} hover:opacity-90 transition-opacity`}
            >
              Keep going
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes popIn {
          0% { transform: scale(0.85) translateY(12px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); }
          55% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[popIn_260ms_cubic-bezier\\(0\\.34\\,1\\.56\\,0\\.64\\,1\\)\\],
          .animate-\\[bounceIn_500ms_ease-out\\],
          .animate-\\[fadeIn_150ms_ease-out\\] {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}

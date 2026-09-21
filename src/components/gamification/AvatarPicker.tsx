"use client";

import { useState } from "react";
import { AVATAR_CATALOG, type AvatarOption } from "@/lib/domain/gamification";

/* Avatars are chosen, never inferred. Guessing someone's gender or appearance from
 * their name is wrong often enough that it would misrepresent real people on a
 * public board — and letting them pick is better for engagement anyway, since
 * locking the good ones behind levels gives another reason to keep working. */
export function AvatarPicker({
  currentId,
  level,
  token,
  onPicked,
  onClose,
}: {
  currentId?: string | null;
  level: number;
  token: string | null;
  onPicked: (id: string) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byTier = AVATAR_CATALOG.reduce<Record<number, AvatarOption[]>>((acc, a) => {
    (acc[a.unlocksAt] ||= []).push(a);
    return acc;
  }, {});
  const tiers = Object.keys(byTier)
    .map(Number)
    .sort((a, b) => a - b);

  const choose = async (option: AvatarOption) => {
    if (option.unlocksAt > level || saving) return;
    setSaving(option.id);
    setError(null);
    try {
      const res = await fetch("/api/v2/transcriber/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarId: option.id }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      onPicked(option.id);
      onClose();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const unlockedCount = AVATAR_CATALOG.filter((a) => a.unlocksAt <= level).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
      role="dialog"
      aria-label="Choose your avatar"
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Choose your avatar</h2>
            <p className="text-xs text-gray-500">
              {unlockedCount} of {AVATAR_CATALOG.length} unlocked · level up for more
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="p-6 space-y-5">
          {tiers.map((tierLevel) => {
            const unlocked = tierLevel <= level;
            return (
              <div key={tierLevel}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {tierLevel === 1 ? "Starters" : `Level ${tierLevel}`}
                  </span>
                  {!unlocked && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      🔒 reach level {tierLevel}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {byTier[tierLevel].map((a) => {
                    const isCurrent = a.id === currentId;
                    return (
                      <button
                        key={a.id}
                        onClick={() => choose(a)}
                        disabled={!unlocked || saving !== null}
                        title={unlocked ? a.name : `Unlocks at level ${a.unlocksAt}`}
                        className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                          isCurrent ? "ring-2 ring-indigo-500 bg-indigo-50" : "hover:bg-gray-50"
                        } ${!unlocked ? "opacity-35 cursor-not-allowed" : "cursor-pointer hover:scale-105"}`}
                      >
                        <span
                          className={`w-11 h-11 rounded-full bg-gradient-to-br ${a.gradient} flex items-center justify-center text-xl shadow-sm ${
                            !unlocked ? "grayscale" : ""
                          }`}
                        >
                          {a.emoji}
                        </span>
                        <span className="text-[10px] text-gray-600 truncate w-full text-center">
                          {a.name}
                        </span>
                        {saving === a.id && (
                          <span className="absolute inset-0 grid place-items-center bg-white/60 rounded-xl text-xs">
                            …
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

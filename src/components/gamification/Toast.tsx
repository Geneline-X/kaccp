"use client";

import { useEffect } from "react";

/* Non-blocking celebration. Small wins land here instead of in a modal: at 500
 * items a day, anything that covers the screen and demands a dismiss becomes a
 * tax on the very behaviour we're trying to encourage. */
export interface ToastData {
  emoji: string;
  title: string;
  blurb?: string;
  gradient: string;
}

export function CelebrationToast({
  toast,
  onClose,
  autoCloseMs = 3000,
}: {
  toast: ToastData | null;
  onClose: () => void;
  autoCloseMs?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(timer);
  }, [toast, onClose, autoCloseMs]);

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[55] animate-[slideUp_260ms_cubic-bezier(0.34,1.56,0.64,1)]"
      role="status"
      aria-live="polite"
    >
      <div className={`rounded-xl bg-gradient-to-br ${toast.gradient} p-[2px] shadow-xl`}>
        <div className="rounded-xl bg-white/95 backdrop-blur px-4 py-3 flex items-center gap-3 min-w-[240px]">
          <span className="text-3xl shrink-0">{toast.emoji}</span>
          <div className="min-w-0">
            <p
              className={`font-bold text-sm bg-gradient-to-r ${toast.gradient} bg-clip-text text-transparent`}
            >
              {toast.title}
            </p>
            {toast.blurb && <p className="text-xs text-gray-500 truncate">{toast.blurb}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-gray-300 hover:text-gray-500 text-lg leading-none shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[slideUp_260ms_cubic-bezier\\(0\\.34\\,1\\.56\\,0\\.64\\,1\\)\\] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

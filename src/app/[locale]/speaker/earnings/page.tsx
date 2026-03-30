"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/infra/client/client";
import { useTranslations } from "next-intl";
import { formatDuration } from "@/lib/utils/format";

interface WeekEarning {
  weekStart: string;
  weekEnd: string;
  approvedDurationSec: number;
  pendingDurationSec: number;
  totalRecordings: number;
  milestoneHit: boolean;
  payoutLe: number;
  estimatedPayoutLe: number;
  isPaid: boolean;
  paidAmountLe: number | null;
}

export default function EarningsHistoryPage() {
  const router = useRouter();
  const t = useTranslations();
  const [weeks, setWeeks] = useState<WeekEarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/speaker/login");
      return;
    }

    fetch("/api/v2/speaker/earnings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        setWeeks(data.weeks || []);
        setLoading(false);
      })
      .catch(() => {
        clearToken();
        router.push("/speaker/login");
      });
  }, [router]);

  const totalEarnings = weeks.reduce((sum, w) => sum + w.payoutLe, 0);
  const totalPaid = weeks
    .filter((w) => w.isPaid)
    .reduce((sum, w) => sum + (w.paidAmountLe ?? w.payoutLe), 0);
  const totalPending = weeks
    .filter((w) => !w.isPaid)
    .reduce((sum, w) => sum + w.payoutLe, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t("speaker.earningsHistory")}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {t("speaker.earningsHistoryDesc")}
              </p>
            </div>
            <Link
              href="/speaker"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              &larr; {t("speaker.backToDashboard")}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">{t("speaker.totalEarned")}</p>
            <p className="text-2xl font-bold text-green-600">
              Le{totalEarnings.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">{t("speaker.totalPaid")}</p>
            <p className="text-2xl font-bold text-blue-600">
              Le{totalPaid.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">{t("speaker.awaitingPayment")}</p>
            <p className="text-2xl font-bold text-orange-600">
              Le{totalPending.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Weekly breakdown */}
        {weeks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            {t("speaker.noEarningsYet")}
          </div>
        ) : (
          <div className="space-y-4">
            {weeks.map((w) => (
              <div
                key={w.weekStart}
                className={`bg-white rounded-lg shadow p-5 ${
                  w.isPaid ? "border-l-4 border-green-500" : ""
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {w.weekStart} &ndash; {w.weekEnd}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                      <span>
                        {t("speaker.approved")}: {formatDuration(w.approvedDurationSec)}
                      </span>
                      {w.pendingDurationSec > 0 && (
                        <span className="text-orange-600">
                          {t("speaker.pendingReview")}: {formatDuration(w.pendingDurationSec)}
                        </span>
                      )}
                      <span className="text-gray-400">
                        {w.totalRecordings} {t("speaker.recordings")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {w.milestoneHit && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          {t("speaker.milestonePayout")}
                        </span>
                      )}
                      {w.isPaid ? (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          {t("speaker.paid")}
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                          {t("speaker.unpaid")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">
                      Le{(w.isPaid ? (w.paidAmountLe ?? w.payoutLe) : w.payoutLe).toFixed(2)}
                    </p>
                    {w.estimatedPayoutLe > w.payoutLe && (
                      <p className="text-xs text-blue-600 mt-1">
                        ~Le{w.estimatedPayoutLe.toFixed(2)} {t("speaker.ifAllApproved")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

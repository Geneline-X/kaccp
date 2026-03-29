"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/infra/client/client";
import { useTranslations } from "next-intl";

interface Speaker {
  id: string;
  displayName: string | null;
  email: string;
  approvedDurationSec: number;
  approvedMinutes: number;
  pendingDurationSec: number;
  milestoneHit: boolean;
  payoutLe: number;
  estimatedPayoutLe: number;
  paid: boolean;
  paymentId?: string;
}

interface Summary {
  totalSpeakers: number;
  milestoneSpeakers: number;
  totalPayoutLe: number;
  paidCount: number;
}

interface WeekData {
  week: { start: string; end: string };
  speakers: Speaker[];
  summary: Summary;
}

function fmtHours(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

/** Generate all Monday dates from fromWeek to toWeek inclusive (stepping by 7 days). */
function weeksBetween(fromWeek: string, toWeek: string): string[] {
  const weeks: string[] = [];
  let cur = new Date(fromWeek + "T00:00:00Z");
  const end = new Date(toWeek + "T00:00:00Z");
  while (cur <= end) {
    weeks.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return weeks;
}

export default function WeeklyPayoutsPage() {
  const t = useTranslations();
  const [weekStart, setWeekStart] = useState<string>("");
  const [data, setData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState<string>("");
  const [exportTo, setExportTo] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async (ws?: string) => {
    setLoading(true);
    try {
      const params = ws ? `?weekStart=${ws}` : "";
      const res = await apiFetch<WeekData>(
        `/api/v2/admin/payouts/weekly${params}`
      );
      setData(res);
      if (!ws) {
        setWeekStart(res.week.start);
        setExportFrom(res.week.start);
        setExportTo(res.week.start);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePay = async (speakerId: string) => {
    if (!data) return;
    setPaying(speakerId);
    try {
      await apiFetch("/api/v2/admin/payouts/weekly", {
        method: "POST",
        body: JSON.stringify({
          weekStart: data.week.start,
          speakerIds: [speakerId],
        }),
      });
      await fetchData(data.week.start);
    } finally {
      setPaying(null);
    }
  };

  const handlePayAll = async () => {
    if (!data) return;
    setPaying("all");
    try {
      await apiFetch("/api/v2/admin/payouts/weekly", {
        method: "POST",
        body: JSON.stringify({
          weekStart: data.week.start,
          payAll: true,
        }),
      });
      await fetchData(data.week.start);
    } finally {
      setPaying(null);
    }
  };

  const navigateWeek = (delta: number) => {
    const next = shiftWeek(weekStart, delta);
    setWeekStart(next);
    fetchData(next);
  };

  const unpaidCount = data
    ? data.speakers.filter((s) => !s.paid).length
    : 0;

  const exportCsv = async () => {
    if (!exportFrom || !exportTo) return;
    setExporting(true);
    try {
      const weeks = weeksBetween(exportFrom, exportTo);
      const allRows: string[][] = [];
      const headers = [
        "Week", "Name", "Email", "Approved Hours", "Pending Hours",
        "Milestone", "Payout (Le)", "Estimated (Le)", "Status",
      ];

      for (const ws of weeks) {
        const res = await apiFetch<WeekData>(
          `/api/v2/admin/payouts/weekly?weekStart=${ws}`
        );
        for (const s of res.speakers) {
          allRows.push([
            `${res.week.start} – ${res.week.end}`,
            s.displayName || "",
            s.email,
            fmtHours(s.approvedDurationSec),
            fmtHours(s.pendingDurationSec),
            s.milestoneHit ? "Yes" : "No",
            s.payoutLe.toFixed(2),
            s.estimatedPayoutLe.toFixed(2),
            s.paid ? "Paid" : "Unpaid",
          ]);
        }
      }

      const csv = [headers, ...allRows]
        .map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payouts-${exportFrom}-to-${exportTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("admin.weeklyPayouts")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("admin.weeklyPayoutsDesc")}
        </p>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigateWeek(-1)}
          className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          &larr;
        </button>
        <div className="text-center">
          <p className="text-lg font-semibold">
            {data
              ? `${data.week.start} – ${data.week.end}`
              : "Loading..."}
          </p>
        </div>
        <button
          onClick={() => navigateWeek(1)}
          className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          &rarr;
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-purple-600 rounded-full" />
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{t("admin.totalSpeakers")}</p>
              <p className="text-2xl font-bold">{data.summary.totalSpeakers}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{t("admin.milestoneHit")}</p>
              <p className="text-2xl font-bold text-yellow-600">
                {data.summary.milestoneSpeakers}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{t("admin.totalPayout")}</p>
              <p className="text-2xl font-bold text-green-600">
                Le{data.summary.totalPayoutLe.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{t("admin.paidSpeakers")}</p>
              <p className="text-2xl font-bold">
                {data.summary.paidCount} / {data.summary.totalSpeakers}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-end justify-between gap-4 flex-wrap">
            {/* Export with week range */}
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From week</label>
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To week</label>
                <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <button
                onClick={exportCsv}
                disabled={exporting || !exportFrom || !exportTo}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>

            {/* Pay All */}
            {unpaidCount > 0 && (
              <button
                onClick={handlePayAll}
                disabled={paying !== null}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {paying === "all"
                  ? t("admin.processing")
                  : t("admin.payAllUnpaid", { count: unpaidCount })}
              </button>
            )}
          </div>

          {/* Speaker Table */}
          {data.speakers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              {t("admin.noRecordingsThisWeek")}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("admin.speaker")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("admin.approvedHours")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pending Review
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("admin.milestone")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("admin.payout")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estimated
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("admin.status")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("admin.action")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.speakers.map((speaker) => (
                    <tr
                      key={speaker.id}
                      className={speaker.paid ? "bg-gray-50" : ""}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {speaker.displayName || speaker.email}
                          </p>
                          <p className="text-xs text-gray-500">
                            {speaker.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {fmtHours(speaker.approvedDurationSec)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {speaker.pendingDurationSec > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {fmtHours(speaker.pendingDurationSec)}
                          </span>
                        ) : (
                          <span className="text-gray-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {speaker.milestoneHit ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            {t("admin.milestoneHit")}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        Le{speaker.payoutLe.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {speaker.estimatedPayoutLe > speaker.payoutLe ? (
                          <span className="text-blue-600 font-medium">
                            ~Le{speaker.estimatedPayoutLe.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {speaker.paid ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            {t("admin.paid")}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                            {t("admin.unpaid")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!speaker.paid && (
                          <button
                            onClick={() => handlePay(speaker.id)}
                            disabled={paying !== null}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {paying === speaker.id
                              ? t("admin.processing")
                              : t("admin.pay")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

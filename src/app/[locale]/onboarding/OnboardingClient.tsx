"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { clearToken, getToken } from "@/lib/infra/client/client";
import { safeNextPath } from "@/lib/infra/client/onboarding";
import { MIN_PASSWORD_LENGTH, TERMS_VERSION, type OnboardingStep } from "@/lib/domain/users/onboarding";

/* First-login onboarding: (1) replace the admin-set password, (2) contributors
 * accept the current Terms. The server refuses everything else until both are done. */

function homeFor(locale: string, role: string | undefined): string {
  switch (role) {
    case "SPEAKER": return `/${locale}/speaker`;
    case "TRANSCRIBER": return `/${locale}/transcriber/v2`;
    case "REVIEWER": return `/${locale}/reviewer`;
    case "ADMIN": return `/${locale}/admin/v2`;
    default: return `/${locale}`;
  }
}

export default function OnboardingClient({ locale }: { locale: string }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [steps, setSteps] = useState<OnboardingStep[] | null>(null);
  const [role, setRole] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);

  const finish = useCallback(
    (r: string | undefined) => router.replace(safeNextPath(searchParams.get("next"), homeFor(locale, r))),
    [router, searchParams, locale]
  );

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace(`/${locale}`);
      return;
    }
    const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      clearToken();
      router.replace(`/${locale}`);
      return;
    }
    const data = await res.json();
    const pending: OnboardingStep[] = Array.isArray(data.onboarding) ? data.onboarding : [];
    setRole(data.user?.role);
    if (pending.length === 0) {
      finish(data.user?.role);
      return;
    }
    setSteps(pending);
  }, [router, locale, finish]);

  useEffect(() => {
    load().catch(() => setError(t("genericError")));
  }, [load, t]);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t("genericError"));
  };

  const advance = () => {
    const rest = (steps ?? []).slice(1);
    if (rest.length === 0) finish(role);
    else setSteps(rest);
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < MIN_PASSWORD_LENGTH) return setError(t("passwordTooShort", { min: MIN_PASSWORD_LENGTH }));
    if (newPassword !== confirmPassword) return setError(t("passwordsDoNotMatch"));
    setBusy(true);
    try {
      await post("/api/auth/onboarding/change-password", { currentPassword, newPassword });
      advance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!accepted) return setError(t("mustAccept"));
    setBusy(true);
    try {
      await post("/api/auth/onboarding/accept-terms", { accepted: true, version: TERMS_VERSION });
      advance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    clearToken();
    router.replace(`/${locale}`);
  };

  const step = steps?.[0];
  const inputClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {!step && !error && <p className="text-center text-gray-600">{t("loading")}</p>}

        {steps && steps.length > 1 && (
          <p className="text-xs text-gray-500 mb-2">{t("stepCounter", { total: steps.length })}</p>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">{error}</div>
        )}

        {step === "CHANGE_PASSWORD" && (
          <form onSubmit={submitPassword} className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">{t("changePasswordTitle")}</h2>
            <p className="text-gray-600 text-sm">{t("changePasswordIntro")}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("currentPassword")}</label>
              <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} autoComplete="current-password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("newPassword")}</label>
              <input type="password" required minLength={MIN_PASSWORD_LENGTH} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("confirmPassword")}</label>
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
            </div>
            <button type="submit" disabled={busy} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
              {busy ? t("saving") : t("savePassword")}
            </button>
          </form>
        )}

        {step === "ACCEPT_TERMS" && (
          <form onSubmit={submitTerms} className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">{t("termsTitle")}</h2>
            <p className="text-gray-600 text-sm">{t("termsIntro")}</p>
            <Link href={`/${locale}/legal/terms`} target="_blank" className="text-blue-600 hover:underline text-sm">
              {t("readTerms")}
            </Link>
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 rounded border-gray-300" />
              <span>{t("acceptLabel")}</span>
            </label>
            <button type="submit" disabled={busy || !accepted} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
              {busy ? t("saving") : t("acceptButton")}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button onClick={signOut} className="text-sm text-gray-500 hover:text-gray-700">{t("signOut")}</button>
        </div>
      </div>
    </div>
  );
}

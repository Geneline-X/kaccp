"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setToken } from "@/lib/client";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function TranscriberLoginPage() {
  const router = useRouter();
  const t = useTranslations();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        email: emailOrPhone,
        emailOrPhone,
        password,
        requestedRole: "TRANSCRIBER"
      };
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('auth.loginFailed'));
      if (!data.token) throw new Error(t('auth.noToken'));

      setToken(data.token);
      toast.success(t('auth.welcomeBack'));
      router.replace("/transcriber/v2");
    } catch (e: any) {
      toast.error(e.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('home.title')}</h1>
          <p className="text-blue-200">{t('home.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{t('auth.transcriberLogin')}</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.emailOrPhone')}
              </label>
              <input
                type="text"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="email@example.com or +232..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label={t('auth.togglePassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? t('auth.hide') : t('auth.show')}
                </button>
              </div>
              <div className="mt-1 text-right">
                <Link href="/speaker/login/forgot" className="text-xs text-blue-600 hover:underline">
                  {t('common.forgotPassword')}
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          <div className="mt-6 text-center space-y-4">
            <p className="text-gray-600">
              {t('auth.dontHaveAccount')}{" "}
              <button
                onClick={() => router.push("/transcriber/v2/register")}
                className="text-blue-600 hover:underline font-medium"
              >
                {t('auth.registerHere')}
              </button>
            </p>

            <div className="pt-2 border-t border-gray-100">
              <Link href="/speaker/login" className="text-sm text-gray-500 hover:text-gray-700">
                {t('auth.areYouSpeaker')}
              </Link>
            </div>

            <div className="text-xs text-gray-400 pt-2">
              {t('footer.builtBy')} <Link href="https://geneline-x.net" className="underline" target="_blank">Geneline-X</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

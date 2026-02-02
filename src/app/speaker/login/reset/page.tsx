"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

function ResetPasswordForm() {
    const router = useRouter();
    const t = useTranslations();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!token) {
            setError(t('auth.invalidResetToken'));
            return;
        }

        if (password !== confirmPassword) {
            setError(t('auth.passwordsNoMatch'));
            return;
        }

        if (password.length < 6) {
            setError(t('auth.passwordMinLength'));
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || t('auth.resetFailed'));
                return;
            }

            setSuccess(true);
            setTimeout(() => {
                router.push("/speaker/login");
            }, 3000);
        } catch {
            setError(t('auth.errorOccurred'));
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="text-center">
                <p className="text-red-600 font-medium mb-4">{t('auth.invalidResetLink')}</p>
                <Link href="/speaker/login/forgot" className="text-blue-600 hover:underline">
                    {t('auth.requestNewLink')}
                </Link>
            </div>
        );
    }

    if (success) {
        return (
            <div className="text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('auth.passwordReset')}</h3>
                <p className="text-gray-600">{t('auth.redirectingToLogin')}</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('auth.newPassword')}
                </label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="••••••••"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('auth.confirmNewPassword')}
                </label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="••••••••"
                />
            </div>

            {error && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
                {loading ? t('auth.updating') : t('auth.resetPassword')}
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    const t = useTranslations();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">{t('home.title')}</h1>
                    <p className="text-blue-200">{t('home.subtitle')}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('auth.createNewPassword')}</h2>

                    <Suspense fallback={<div className="text-center p-4">{t('common.loading')}...</div>}>
                        <ResetPasswordForm />
                    </Suspense>

                    <div className="mt-6 text-center">
                        <Link href="/speaker/login" className="text-sm text-gray-500 hover:text-gray-700">
                            {t('auth.cancelAndGoBack')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

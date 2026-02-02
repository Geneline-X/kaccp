"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setToken } from "@/lib/client";
import { useTranslations } from "next-intl";

interface Language {
  id: string;
  code: string;
  name: string;
  country: {
    name: string;
  };
}

export default function SpeakerRegister() {
  const router = useRouter();
  const t = useTranslations();
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Fetch available languages
  useEffect(() => {
    fetch("/api/v2/languages")
      .then((res) => res.json())
      .then((data) => {
        setLanguages(data.languages || []);
      })
      .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleLanguage = (langCode: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(langCode)
        ? prev.filter((l) => l !== langCode)
        : [...prev, langCode]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      return;
    }

    if (selectedLanguages.length === 0) {
      setError(t('auth.selectOneLanguage'));
      return;
    }

    if (!agreedToTerms) {
      setError(t('auth.agreeToTerms'));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formData.displayName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: "SPEAKER",
          speaksLanguages: selectedLanguages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('auth.registrationFailed'));
        return;
      }

      setToken(data.token);
      router.push("/speaker");
    } catch {
      setError(t('auth.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('home.title')}</h1>
          <p className="text-blue-200">{t('home.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('auth.registerAsSpeaker')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('auth.helpPreserve')}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.displayName')}
                </label>
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={t('auth.yourName')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.phoneNumber')}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+232 XX XXX XXXX"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.email')}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('common.password')}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('common.confirmPassword')}
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.languagesYouSpeak')}
              </label>
              <p className="text-sm text-gray-500 mb-3">
                {t('auth.selectLanguagesFlluent')}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
                    className={`p-3 rounded-lg border text-left transition-all ${selectedLanguages.includes(lang.code)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="font-medium">{lang.name}</div>
                    <div className="text-xs text-gray-500">{lang.country.name}</div>
                  </button>
                ))}
              </div>
              {languages.length === 0 && (
                <p className="text-gray-500 text-sm">{t('auth.loadingLanguages')}</p>
              )}
            </div>

            {/* Consent */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  {t('auth.consentText')}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {t('auth.alreadyHaveAccount')}{" "}
              <Link href="/speaker/login" className="text-blue-600 hover:underline">
                {t('auth.signInHere')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

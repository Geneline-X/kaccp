"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { apiFetch, setToken } from '@/lib/infra/client/client'
import { useTranslations } from 'next-intl'

export default function AdminLoginPage() {
  const router = useRouter()
  const t = useTranslations()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ user: any; token: string }>("/api/auth/login", {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })
      if ((res.user?.role || '').toUpperCase() !== 'ADMIN') {
        setError(t('auth.noAdminAccess'))
        return
      }
      setToken(res.token)
      router.replace('/admin/v2')
    } catch (err: any) {
      setError(err.message || t('auth.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('home.title')}</h1>
          <p className="text-blue-200">{t('admin.controlCenter')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Image src="/kaccp-logo.jpg" alt="KACCP" width={40} height={40} className="rounded-md" />
            <h2 className="text-2xl font-bold text-gray-900">{t('auth.adminLogin')}</h2>
          </div>

          <p className="text-sm text-gray-500 text-center mb-6">{t('auth.signInToManagement')}</p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                {t('common.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                {t('common.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
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

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <Link href="/speaker/login" className="text-sm text-gray-500 hover:text-gray-700">
              {t('auth.backToPlatformLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

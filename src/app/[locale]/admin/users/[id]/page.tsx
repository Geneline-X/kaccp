"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetch } from '@/lib/client'
import { useTranslations } from 'next-intl'

export default function AdminUserDetailPage() {
  const t = useTranslations()
  const params = useParams<{ id: string }>()
  const userId = params?.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any | null>(null)
  const [showEditLanguages, setShowEditLanguages] = useState(false)
  const [showEditRoles, setShowEditRoles] = useState(false)
  const [availableLanguages, setAvailableLanguages] = useState<any[]>([])
  const [editingSpeaks, setEditingSpeaks] = useState<string[]>([])
  const [editingWrites, setEditingWrites] = useState<string[]>([])
  const [editingRoles, setEditingRoles] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ user: any; stats: any; recent: any }>(`/api/admin/users/${userId}`)
      setData(res)
      setEditingSpeaks(res.user.speaksLanguages || [])
      setEditingWrites(res.user.writesLanguages || [])
      setEditingRoles(res.user.roles || [res.user.role])
    } catch (e: any) {
      setError(e?.message || 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  const loadLanguages = async () => {
    try {
      const res = await apiFetch<{ languages: any[] }>('/api/v2/languages')
      setAvailableLanguages(res.languages || [])
    } catch (e) {
      console.error('Failed to load languages', e)
    }
  }

  useEffect(() => {
    if (userId) {
      load()
      loadLanguages()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const saveLanguages = async () => {
    setSaving(true)
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          speaksLanguages: editingSpeaks,
          writesLanguages: editingWrites,
        }),
      })
      await load()
      setShowEditLanguages(false)
    } catch (e: any) {
      alert(e?.message || 'Failed to save languages')
    } finally {
      setSaving(false)
    }
  }

  const toggleSpeaksLanguage = (code: string) => {
    setEditingSpeaks(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  const toggleWritesLanguage = (code: string) => {
    setEditingWrites(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  const saveRoles = async () => {
    setSaving(true)
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          roles: editingRoles,
          role: editingRoles[0] || 'SPEAKER', // Set primary role to first in array
        }),
      })
      await load()
      setShowEditRoles(false)
    } catch (e: any) {
      alert(e?.message || 'Failed to save roles')
    } finally {
      setSaving(false)
    }
  }

  const toggleRole = (role: string) => {
    setEditingRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  if (!userId) return null

  return (
    <div className="space-y-6">
      <AdminHeader
        title={data?.user?.displayName || data?.user?.email || t('admin.userDetailPage.userDetails')}
        description={data?.user?.email}
      />

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="text-destructive p-4 rounded-md bg-destructive/10">{error}</div>
      ) : data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.userDetailPage.profile')}</CardTitle>
              <CardDescription>{t('admin.userDetailPage.profileDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">{t('admin.userDetailPage.email')}</div>
                <div>{data.user.email}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('admin.userDetailPage.phone')}</div>
                <div>{data.user.phone || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('admin.userDetailPage.role')}</div>
                <div>{data.user.role}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('admin.userDetailPage.joined')}</div>
                <div>{new Date(data.user.createdAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('admin.userDetailPage.lastLogin')}</div>
                <div>{data.user.lastLoginAt ? new Date(data.user.lastLoginAt).toLocaleString() : '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('admin.userDetailPage.qualityScore')}</div>
                <div>{(data.user.qualityScore ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('admin.userDetailPage.earnings')}</div>
                <div>{((data.user.totalEarningsCents ?? 0) / 100).toFixed(2)} SLE</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.userDetailPage.languages')}</CardTitle>
              <CardDescription>{t('admin.userDetailPage.languagesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">{t('admin.userDetailPage.speaksLanguages')}</div>
                <div className="flex flex-wrap gap-2">
                  {data.user.speaksLanguages && data.user.speaksLanguages.length > 0 ? (
                    data.user.speaksLanguages.map((lang: string) => (
                      <span key={lang} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        {lang}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">{t('admin.userDetailPage.noLanguagesSet')}</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">{t('admin.userDetailPage.writesLanguages')}</div>
                <div className="flex flex-wrap gap-2">
                  {data.user.writesLanguages && data.user.writesLanguages.length > 0 ? (
                    data.user.writesLanguages.map((lang: string) => (
                      <span key={lang} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {lang}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">{t('admin.userDetailPage.noLanguagesSet')}</span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditLanguages(true)}
              >
                {t('admin.userDetailPage.editLanguages')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.userDetailPage.roles')}</CardTitle>
              <CardDescription>{t('admin.userDetailPage.rolesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">{t('admin.userDetailPage.currentRoles')}</div>
                <div className="flex flex-wrap gap-2">
                  {data.user.roles && data.user.roles.length > 0 ? (
                    data.user.roles.map((role: string) => (
                      <span key={role} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">{t('admin.userDetailPage.noRolesAssigned')}</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {t('admin.userDetailPage.primaryRole')} <span className="font-medium">{data.user.role}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditRoles(true)}
              >
                {t('admin.userDetailPage.editRoles')}
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.userDetailPage.recentPayments')}</CardTitle>
                <CardDescription>{t('admin.userDetailPage.last10Payouts')}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.recent?.payments?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('admin.paymentsPage.amount')}</TableHead>
                        <TableHead>{t('admin.userDetailPage.status')}</TableHead>
                        <TableHead>{t('admin.userDetailPage.date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent.payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{(p.amountCents / 100).toFixed(2)} {p.currency}</TableCell>
                          <TableCell className="text-sm">{p.status}</TableCell>
                          <TableCell className="text-sm">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-muted-foreground">{t('admin.userDetailPage.noRecentPayments')}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.userDetailPage.recentReviews')}</CardTitle>
                <CardDescription>{t('admin.userDetailPage.last10Reviews')}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.recent?.reviews?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('admin.userDetailPage.decision')}</TableHead>
                        <TableHead>{t('admin.userDetailPage.date')}</TableHead>
                        <TableHead>{t('admin.userDetailPage.transcription')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent.reviews.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{r.decision}</TableCell>
                          <TableCell className="text-sm">{new Date(r.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{r.transcriptionId}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-muted-foreground">{t('admin.userDetailPage.noRecentReviews')}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* Edit Languages Modal */}
      {showEditLanguages && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{t('admin.userDetailPage.editLanguages')}</h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">{t('admin.userDetailPage.speaksLanguages')}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {availableLanguages.map((lang) => (
                    <label key={lang.code} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingSpeaks.includes(lang.code)}
                        onChange={() => toggleSpeaksLanguage(lang.code)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{lang.name} ({lang.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">{t('admin.userDetailPage.writesLanguages')}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {availableLanguages.map((lang) => (
                    <label key={lang.code} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingWrites.includes(lang.code)}
                        onChange={() => toggleWritesLanguage(lang.code)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{lang.name} ({lang.code})</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditLanguages(false)
                  setEditingSpeaks(data?.user?.speaksLanguages || [])
                  setEditingWrites(data?.user?.writesLanguages || [])
                }}
                disabled={saving}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={saveLanguages}
                disabled={saving}
              >
                {saving ? t('admin.userDetailPage.saving') : t('admin.userDetailPage.saveChanges')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Roles Modal */}
      {showEditRoles && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">{t('admin.userDetailPage.editRoles')}</h2>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                {t('admin.userDetailPage.selectRolesDescription')}
              </p>

              {['SPEAKER', 'TRANSCRIBER', 'REVIEWER', 'ADMIN'].map((role) => (
                <label key={role} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded cursor-pointer border border-gray-200">
                  <input
                    type="checkbox"
                    checked={editingRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="rounded border-gray-300 w-5 h-5"
                  />
                  <div className="flex-1">
                    <span className="font-medium">{role}</span>
                    <p className="text-xs text-muted-foreground">
                      {role === 'SPEAKER' && t('admin.userDetailPage.speakerRole')}
                      {role === 'TRANSCRIBER' && t('admin.userDetailPage.transcriberRole')}
                      {role === 'REVIEWER' && t('admin.userDetailPage.reviewerRole')}
                      {role === 'ADMIN' && t('admin.userDetailPage.adminRole')}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditRoles(false)
                  setEditingRoles(data?.user?.roles || [data?.user?.role])
                }}
                disabled={saving}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={saveRoles}
                disabled={saving || editingRoles.length === 0}
              >
                {saving ? t('admin.userDetailPage.saving') : t('admin.userDetailPage.saveChanges')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

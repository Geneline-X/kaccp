"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useRequireTranscriberAuth } from '@/lib/useTranscriberAuth'
import { apiFetch } from '@/lib/client'
import AvatarUpload from '@/components/transcriber/AvatarUpload'
import { useTranslations } from 'next-intl'

export default function ProfilePage() {
  const ready = useRequireTranscriberAuth()
  const router = useRouter()
  const t = useTranslations()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [country, setCountry] = useState('')
  const [phone, setPhone] = useState('')
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const resp = await apiFetch<{ user: any }>(`/api/transcriber/profile`)
      const u = resp.user
      if (u) {
        setDisplayName(u.displayName || '')
        setBio(u.bio || '')
        setCountry(u.country || '')
        setPhone(u.phone || '')
        setShowOnLeaderboard(Boolean(u.showOnLeaderboard))
        setAvatarUrl(u.avatarUrl || null)
      }
    } catch (e: any) {
      toast.error(e.message || t('transcriber.failedToLoadProfile'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (ready) load() }, [ready])

  const onSave = async () => {
    try {
      setSaving(true)
      await apiFetch('/api/transcriber/profile', {
        method: 'POST',
        body: JSON.stringify({ displayName, bio, country, phone, showOnLeaderboard, avatarUrl: avatarUrl || undefined })
      })
      toast.success(t('transcriber.profileUpdated'))
      router.replace('/transcriber')
    } catch (e: any) {
      let msg = e?.message || t('transcriber.failedToSaveProfile')
      try {
        const parsed = JSON.parse(msg)
        if (String(parsed?.error || '').toLowerCase().includes('phone')) {
          msg = parsed.error
        }
      } catch { }
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!ready) return null

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('transcriber.profile')}</CardTitle>
          <CardDescription>{t('transcriber.profileDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-muted">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">{t('transcriber.noPhoto')}</div>
              )}
            </div>
            <AvatarUpload onUploaded={(url) => setAvatarUrl(url)} />
            {avatarUrl && (
              <Button variant="secondary" onClick={() => setAvatarUrl(null)}>{t('common.remove')}</Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="displayName">{t('transcriber.displayName')}</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="country">{t('transcriber.country')}</Label>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">{t('transcriber.phoneForPayouts')}</Label>
              <Input id="phone" placeholder="e.g. +232 76 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <div className="text-xs text-muted-foreground">{t('transcriber.phoneDescription')}</div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bio">{t('transcriber.bio')}</Label>
            <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <input id="leaderboard" type="checkbox" checked={showOnLeaderboard} onChange={(e) => setShowOnLeaderboard(e.target.checked)} />
            <Label htmlFor="leaderboard">{t('transcriber.showOnLeaderboard')}</Label>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onSave} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
            <Button variant="secondary" onClick={() => router.push('/transcriber')}>{t('common.back')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

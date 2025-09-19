"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { setToken } from '@/lib/client'
import { toast } from 'sonner'
import Image from 'next/image'
import Link from 'next/link'

export default function TranscriberRegisterPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (!accepted) {
        toast.error('You must accept the Terms to continue')
        return
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, password, displayName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Register failed: ${res.status}`)
      if (!data.token) throw new Error('No token returned')
      setToken(data.token)
      toast.success('Account created!')
      router.replace('/transcriber')
    } catch (e: any) {
      toast.error(e.message || 'Register failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-1">
            <Image src="/kaccp-logo.jpg" alt="KACCP" width={32} height={32} className="rounded-sm" />
            <CardTitle>Transcriber Registration</CardTitle>
          </div>
          <CardDescription>
            Create your account to start transcribing. By continuing you agree to our{' '}
            <Link href="/legal/terms" className="underline" target="_blank">Terms of Service</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input id="accept" type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              <Label htmlFor="accept">I have read and accept the <Link href="/legal/terms" className="underline" target="_blank">Terms of Service</Link></Label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Account'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/transcriber/login')}>Have an account? Sign in</Button>
            </div>
            <div className="text-xs text-muted-foreground">Built by <Link href="https://geneline-x.net" className="underline" target="_blank">Geneline-X</Link></div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

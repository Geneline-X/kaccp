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

export default function TranscriberLoginPage() {
  const router = useRouter()
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // backend login expects email; allow either email or phone by mapping
      const body = emailOrPhone.includes('@') ? { email: emailOrPhone, password } : { email: emailOrPhone, password }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Login failed: ${res.status}`)
      if (!data.token) throw new Error('No token returned')
      setToken(data.token)
      toast.success('Welcome back!')
      router.replace('/transcriber')
    } catch (e: any) {
      toast.error(e.message || 'Login failed')
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
            <CardTitle>Transcriber Login</CardTitle>
          </div>
          <CardDescription>
            Sign in to start transcribing. By continuing you agree to our{' '}
            <Link href="/legal/terms" className="underline" target="_blank">Terms of Service</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailOrPhone">Email or Phone</Label>
              <Input id="emailOrPhone" value={emailOrPhone} onChange={(e) => setEmailOrPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/transcriber/register')}>Register</Button>
            </div>
            <div className="text-xs text-muted-foreground">Built by <Link href="https://geneline-x.net" className="underline" target="_blank">Geneline-X</Link></div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

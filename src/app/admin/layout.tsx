"use client"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import AdminGuard from '@/components/admin/AdminGuard'
import { PropsWithChildren } from 'react'
import { Button } from '@/components/ui/button'
import { clearToken } from '@/lib/client'
import Image from 'next/image'

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/audios', label: 'Audios' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/export', label: 'Export' },
]

export default function AdminLayout({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const router = useRouter()
  
  // Show public login page without guard or sidebar
  if (pathname === '/admin/login') {
    return <div className="min-h-screen">{children}</div>
  }
  
  return (
    <AdminGuard>
      <div className="min-h-screen flex bg-background">
        {/* Sidebar */}
        <aside className="w-56 border-r p-4 space-y-2 bg-card">
          <div className="mb-6 flex items-center gap-2">
            <Image src="/kaccp-logo.jpg" alt="KACCP" width={28} height={28} className="rounded-sm" />
            <div className="font-bold text-lg text-primary">KACCP Admin</div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`text-sm px-3 py-2 rounded-md transition-colors ${pathname === item.href 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="pt-6">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => { 
                clearToken(); 
                router.replace('/admin/login') 
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" x2="9" y1="12" y2="12"/>
              </svg>
              Logout
            </Button>
          </div>
        </aside>
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="h-16 border-b flex items-center px-6 justify-between bg-card">
            <h1 className="text-lg font-semibold">
              {NAV.find(item => item.href === pathname)?.label || 'Dashboard'}
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </header>
          
          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  )
}

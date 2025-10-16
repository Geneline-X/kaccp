"use client"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import AdminGuard from '@/components/admin/AdminGuard'
import { PropsWithChildren, useState } from 'react'
import { Button } from '@/components/ui/button'
import { clearToken } from '@/lib/client'
import Image from 'next/image'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, LogOut } from 'lucide-react'

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/audios', label: 'Audios' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/export', label: 'Export' },
]

function SidebarContent({ pathname, router, onNavigate }: { pathname: string; router: any; onNavigate?: () => void }) {
  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        <Image src="/kaccp-logo.jpg" alt="KACCP" width={28} height={28} className="rounded-sm" />
        <div className="font-bold text-lg text-primary">KACCP Admin</div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link 
            key={item.href} 
            href={item.href}
            onClick={onNavigate}
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
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  )
}

export default function AdminLayout({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Show public login page without guard or sidebar
  if (pathname === '/admin/login') {
    return <div className="min-h-screen">{children}</div>
  }
  
  return (
    <AdminGuard>
      <div className="min-h-screen flex bg-background">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-56 border-r p-4 space-y-2 bg-card flex-col">
          <SidebarContent pathname={pathname} router={router} />
        </aside>
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="h-16 border-b flex items-center px-4 md:px-6 justify-between bg-card">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-4">
                  <SidebarContent 
                    pathname={pathname} 
                    router={router} 
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                </SheetContent>
              </Sheet>
              
              <h1 className="text-base md:text-lg font-semibold">
                {NAV.find(item => item.href === pathname)?.label || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <span className="hidden md:block text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </header>
          
          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  )
}
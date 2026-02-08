import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/infra/utils/utils'
import { useTranslations } from 'next-intl'

type Breadcrumb = {
  label: string
  href: string
  active?: boolean
}

type AdminHeaderProps = {
  title: string
  description?: string
  breadcrumbs?: Breadcrumb[]
  actions?: React.ReactNode
}

export function AdminHeader({ title, description, breadcrumbs = [], actions }: AdminHeaderProps) {
  const pathname = usePathname()
  const t = useTranslations()

  // Auto-generate breadcrumbs if not provided
  if (breadcrumbs.length === 0) {
    const paths = pathname.split('/').filter(Boolean).slice(1) // Remove empty strings and 'admin'

    breadcrumbs = paths.map((path, i) => {
      const href = `/${paths.slice(0, i + 1).join('/')}`
      return {
        label: path.charAt(0).toUpperCase() + path.slice(1),
        href: `/admin${href}`,
        active: i === paths.length - 1
      }
    })
  }

  return (
    <div className="flex flex-col space-y-2">
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-3">
          <li className="inline-flex items-center">
            <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              {t('admin.dashboard')}
            </Link>
          </li>
          {breadcrumbs.map((item, i) => (
            <li key={item.href}>
              <div className="flex items-center">
                <span className="mx-2 text-muted-foreground">/</span>
                <Link
                  href={item.href}
                  className={cn(
                    'text-sm font-medium',
                    item.active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.label}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center space-x-2">{actions}</div>}
      </div>
    </div>
  )
}

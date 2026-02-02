
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useTranslations } from 'next-intl'

export default function TermsPage() {
  const t = useTranslations('legal')

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-6 py-10 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <h3>{t('tos.title')}</h3>
            <ol>
              <li>
                <strong>{t('tos.sections.acceptance.title')}:</strong> {t('tos.sections.acceptance.content')}
              </li>
              <li>
                <strong>{t('tos.sections.userAccounts.title')}:</strong> {t('tos.sections.userAccounts.content')}
              </li>
              <li>
                <strong>{t('tos.sections.userConduct.title')}:</strong> {t('tos.sections.userConduct.content')}
              </li>
              <li>
                <strong>{t('tos.sections.ip.title')}:</strong>
                <ul>
                  <li>{t('tos.sections.ip.item1')}</li>
                  <li>{t('tos.sections.ip.item2')}</li>
                  <li>{t('tos.sections.ip.item3')}</li>
                </ul>
              </li>
              <li>
                <strong>{t('tos.sections.payment.title')}:</strong> {t('tos.sections.payment.content')}
              </li>
              <li>
                <strong>{t('tos.sections.disclaimer.title')}:</strong> {t('tos.sections.disclaimer.content')}
              </li>
              <li>
                <strong>{t('tos.sections.termination.title')}:</strong> {t('tos.sections.termination.content')}
              </li>
            </ol>

            <h3>{t('privacy.title')}</h3>
            <p>{t('privacy.intro')}</p>
            <ol>
              <li>
                <strong>{t('privacy.sections.collection.title')}:</strong> {t('privacy.sections.collection.intro')}
                <ul>
                  <li>
                    <strong>{t('privacy.sections.collection.item1.title')}:</strong> {t('privacy.sections.collection.item1.content')}
                  </li>
                  <li>
                    <strong>{t('privacy.sections.collection.item2.title')}:</strong> {t('privacy.sections.collection.item2.content')}
                  </li>
                  <li>
                    <strong>{t('privacy.sections.collection.item3.title')}:</strong> {t('privacy.sections.collection.item3.content')}
                  </li>
                </ul>
              </li>
              <li>
                <strong>{t('privacy.sections.usage.title')}:</strong>
                <ul>
                  <li>
                    <strong>{t('privacy.sections.usage.item1.title')}:</strong> {t('privacy.sections.usage.item1.content')}
                  </li>
                  <li>
                    <strong>{t('privacy.sections.usage.item2.title')}:</strong> {t('privacy.sections.usage.item2.content')}
                  </li>
                  <li>
                    <strong>{t('privacy.sections.usage.item3.title')}:</strong> {t('privacy.sections.usage.item3.content')}
                  </li>
                </ul>
              </li>
              <li>
                <strong>{t('privacy.sections.security.title')}:</strong> {t('privacy.sections.security.content')}
              </li>
              <li>
                <strong>{t('privacy.sections.anonymization.title')}:</strong> {t('privacy.sections.anonymization.content')}
              </li>
              <li>
                <strong>{t('privacy.sections.rights.title')}:</strong> {t('privacy.sections.rights.content')}
              </li>
            </ol>

            <p className="mt-6 text-sm">
              {t.rich('footer', {
                link: (chunks) => <Link href="https://geneline-x.net" className="underline" target="_blank">{chunks}</Link>
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

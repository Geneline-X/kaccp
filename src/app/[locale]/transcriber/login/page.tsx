import TranscriberLoginClient from './TranscriberLoginClient';

export default async function TranscriberLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <TranscriberLoginClient locale={locale} />;
}

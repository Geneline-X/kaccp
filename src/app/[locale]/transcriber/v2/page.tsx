import TranscriberV2DashboardClient from './TranscriberV2DashboardClient';

export default async function TranscriberV2Dashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <TranscriberV2DashboardClient locale={locale} />;
}

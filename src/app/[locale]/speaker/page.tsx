import SpeakerDashboardClient from './SpeakerDashboardClient';

export default async function SpeakerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <SpeakerDashboardClient locale={locale} />;
}

import ReviewerDashboardClient from './ReviewerDashboardClient';

export default async function ReviewerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <ReviewerDashboardClient locale={locale} />;
}

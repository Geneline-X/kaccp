import ReviewerV2Client from './v2/ReviewerV2Client';

export default async function ReviewerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <ReviewerV2Client locale={locale} />;
}

import ReviewerV2Client from "./ReviewerV2Client";

export default async function ReviewerV2Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ReviewerV2Client locale={locale} />;
}

import ReviewerLoginClient from './ReviewerLoginClient';

export default async function ReviewerLogin({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <ReviewerLoginClient locale={locale} />;
}

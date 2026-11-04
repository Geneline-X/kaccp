import { Suspense } from 'react';
import OnboardingClient from './OnboardingClient';

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // OnboardingClient reads ?next= via useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <OnboardingClient locale={locale} />
    </Suspense>
  );
}

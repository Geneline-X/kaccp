import SpeakerLoginClient from './SpeakerLoginClient';

export default async function SpeakerLogin({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <SpeakerLoginClient locale={locale} />;
}

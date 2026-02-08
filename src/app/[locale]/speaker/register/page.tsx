import SpeakerRegisterClient from './SpeakerRegisterClient';

export default async function SpeakerRegister({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <SpeakerRegisterClient locale={locale} />;
}

import SpeakerRecordClient from './SpeakerRecordClient';

export default async function RecordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <SpeakerRecordClient locale={locale} />;
}

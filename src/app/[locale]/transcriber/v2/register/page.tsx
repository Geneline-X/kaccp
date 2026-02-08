import TranscriberRegisterClient from './TranscriberRegisterClient';

export default async function TranscriberRegister({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <TranscriberRegisterClient locale={locale} />;
}

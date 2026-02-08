import AdminV2DashboardClient from './AdminV2DashboardClient';

export default async function AdminV2Dashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <AdminV2DashboardClient locale={locale} />;
}

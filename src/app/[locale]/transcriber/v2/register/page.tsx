import { redirect } from 'next/navigation';

// Self-registration was removed: accounts are created by an admin only.
// Old signup links and bookmarks land on the matching login page instead.
export default async function RegisterRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/transcriber/login`);
}

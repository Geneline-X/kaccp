import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/infra/auth/auth';
import { prisma } from '@/lib/infra/db/prisma';

// GET /api/v2/account/export — GDPR data portability: download all personal data as JSON
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = user.id;

  const [recordings, transcriptions, walletTxns, payments] = await Promise.all([
    prisma.recording.findMany({
      where: { speakerId: userId },
      select: {
        id: true,
        audioUrl: true,
        durationSec: true,
        status: true,
        consentGiven: true,
        deviceInfo: true,
        createdAt: true,
        prompt: { select: { englishText: true, category: true } },
        language: { select: { code: true, name: true } },
        transcription: {
          select: { text: true, status: true, submittedAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.transcription.findMany({
      where: { transcriberId: userId },
      select: {
        id: true,
        text: true,
        status: true,
        submittedAt: true,
        recording: {
          select: { id: true, language: { select: { code: true, name: true } } },
        },
      },
      orderBy: { submittedAt: 'asc' },
    }),
    prisma.walletTransaction.findMany({
      where: { userId },
      select: { id: true, deltaCents: true, description: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.payment.findMany({
      where: { userId },
      select: {
        id: true,
        amountCents: true,
        currency: true,
        status: true,
        reference: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      displayName: user.displayName,
      roles: (user as any).roles ?? [user.role],
      speakerLabel: (user as any).speakerLabel,
      speaksLanguages: (user as any).speaksLanguages,
      writesLanguages: (user as any).writesLanguages,
      qualityScore: (user as any).qualityScore,
      totalEarningsCents: (user as any).totalEarningsCents,
      totalRecordingsSec: (user as any).totalRecordingsSec,
      totalTranscriptions: (user as any).totalTranscriptions,
      createdAt: user.createdAt,
    },
    recordings,
    transcriptions,
    walletTransactions: walletTxns,
    payments,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="kaccp-data-export-${userId}.json"`,
    },
  });
}

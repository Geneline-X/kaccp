import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/infra/auth/auth';
import { prisma } from '@/lib/infra/db/prisma';
import { deleteObject } from '@/lib/infra/gcs';

// DELETE /api/v2/account — self-service account + data deletion (GDPR right to erasure)
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Collect all GCS audio URIs before deleting DB records
    const recordings = await prisma.recording.findMany({
      where: { speakerId: user.id },
      select: { id: true, audioUrl: true },
    });

    // Delete voice recordings from storage
    const deleteOps = recordings
      .filter(r => r.audioUrl?.startsWith('gs://') || r.audioUrl?.startsWith('local://'))
      .map(r => deleteObject(r.audioUrl!).catch(() => {}));
    await Promise.allSettled(deleteOps);

    // Delete all user data in dependency order
    const recordingIds = recordings.map(r => r.id);
    await prisma.$transaction([
      prisma.transcription.deleteMany({ where: { recordingId: { in: recordingIds } } }),
      prisma.transcriptionAssignment.deleteMany({ where: { userId: user.id } }),
      prisma.recording.deleteMany({ where: { speakerId: user.id } }),
      prisma.walletTransaction.deleteMany({ where: { userId: user.id } }),
      prisma.payment.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    return NextResponse.json({ message: 'Account and all personal data deleted.' });
  } catch (err: any) {
    console.error('Account deletion error', err);
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 });
  }
}

// GET /api/v2/account — return own profile
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  });
}

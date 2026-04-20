import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/infra/auth/auth';
import { prisma } from '@/lib/infra/db/prisma';
import { deleteObject } from '@/lib/infra/gcs';

// DELETE /api/v2/account — self-service account + data deletion (GDPR right to erasure)
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = user.id;

  try {
    // Collect all storage URIs before deleting DB records
    const recordings = await prisma.recording.findMany({
      where: { speakerId: userId },
      select: { id: true, audioUrl: true },
    });

    // Delete voice recordings from storage (non-blocking — don't fail the deletion if storage fails)
    await Promise.allSettled(
      recordings
        .filter(r => r.audioUrl && (r.audioUrl.startsWith('gs://') || r.audioUrl.startsWith('local://')))
        .map(r => deleteObject(r.audioUrl!).catch(() => {}))
    );

    const recordingIds = recordings.map(r => r.id);

    // Delete in FK-safe order within a single transaction.
    // User is referenced by: Session, Notification, SkippedPrompt,
    // TranscriptionAssignment, Transcription (transcriberId + reviewerId),
    // Recording, WalletTransaction, Payment.
    await prisma.$transaction([
      // No outbound FKs — safe to delete first
      prisma.session.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.skippedPrompt.deleteMany({ where: { userId } }),

      // Nullify nullable reviewer FK before user is gone
      prisma.transcription.updateMany({
        where: { reviewerId: userId },
        data: { reviewerId: null },
      }),

      // Transcriptions this user submitted as a transcriber (on OTHER speakers' recordings)
      prisma.transcription.deleteMany({ where: { transcriberId: userId } }),

      // Transcriptions on THIS user's own recordings (made by other transcribers)
      prisma.transcription.deleteMany({ where: { recordingId: { in: recordingIds } } }),

      // Assignments claimed by this user (TranscriptionAssignment has onDelete:Cascade
      // from Recording, but we still need this for the User FK)
      prisma.transcriptionAssignment.deleteMany({ where: { userId } }),

      // Recordings — ExportRecord + remaining TranscriptionAssignments cascade via onDelete:Cascade
      prisma.recording.deleteMany({ where: { speakerId: userId } }),

      prisma.walletTransaction.deleteMany({ where: { userId } }),
      prisma.payment.deleteMany({ where: { userId } }),

      prisma.user.delete({ where: { id: userId } }),
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

function isLanguageLead(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// PATCH /api/v2/pipeline/language-lead/[id] — Approve or reject a reviewed item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user || !isLanguageLead(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.reviewQueue.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Review item not found" }, { status: 404 });
    }
    if (existing.status !== "corrected") {
      return NextResponse.json({ error: "Item is not awaiting language lead review" }, { status: 400 });
    }

    const body = await req.json();
    const { action, notes } = body;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 });
    }

    const updateData: any = {
      languageLeadId: user.id,
      languageLeadNotes: notes || null,
    };

    if (action === "approve") {
      updateData.status = "approved";
      updateData.languageLeadApprovedAt = new Date();
    } else {
      // Reject: record feedback for the correcting transcriber, then requeue the
      // item back to "pending" (clearing the correction) so it can be redone.
      // The rejection entry is stored on rejectionFeedback so the original
      // corrector sees the lead's notes even after another transcriber redoes it.
      const existingFeedback = Array.isArray(existing.rejectionFeedback)
        ? existing.rejectionFeedback
        : [];
      const correctingTranscriberId = existing.reviewerId || existing.secondReviewerId || null;
      const correctedText = existing.correctedTranscript || existing.secondTranscript || null;
      updateData.status = "pending";
      updateData.correctedTranscript = null;
      updateData.secondTranscript = null;
      updateData.reviewerId = null;
      updateData.secondReviewerId = null;
      updateData.disagreementFlag = false;
      updateData.rejectionFeedback = [
        ...existingFeedback,
        {
          transcriberId: correctingTranscriberId,
          text: correctedText,
          reviewNotes: notes || null,
          reviewedAt: new Date().toISOString(),
          reviewerName: (user as any).displayName || null,
        },
      ];
    }

    const updated = await prisma.reviewQueue.update({
      where: { id },
      data: updateData,
      include: {
        audioSession: true,
        reviewer: { select: { id: true, displayName: true } },
        secondReviewer: { select: { id: true, displayName: true } },
        languageLead: { select: { id: true, displayName: true } },
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Error updating language lead review:", error);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}

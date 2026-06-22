import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

function isReviewer(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || roles.includes("REVIEWER") || roles.includes("TRANSCRIBER")
    || user.role === "ADMIN" || user.role === "REVIEWER" || user.role === "TRANSCRIBER";
}

// PATCH /api/v2/pipeline/review-queue/[id] — Update review (submit correction, double-verify)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user || !isReviewer(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.reviewQueue.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Review item not found" }, { status: 404 });
    }

    const body = await req.json();
    const { correctedTranscript, status } = body;

    const updateData: any = {};

    // First correction
    if (correctedTranscript && !existing.correctedTranscript) {
      updateData.correctedTranscript = correctedTranscript;
      updateData.reviewerId = user.id;
      updateData.status = status ?? "corrected";
    }
    // Second correction (double verification)
    else if (correctedTranscript && existing.correctedTranscript && !existing.secondTranscript) {
      updateData.secondTranscript = correctedTranscript;
      updateData.secondReviewerId = user.id;
      updateData.disagreementFlag = correctedTranscript !== existing.correctedTranscript;
      updateData.status = updateData.disagreementFlag ? "pending" : (status ?? "approved");
    }
    // Status-only update (admin override, language lead escalation)
    else if (status) {
      updateData.status = status;
    } else {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const updated = await prisma.reviewQueue.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Error updating review item:", error);
    return NextResponse.json({ error: "Failed to update review item" }, { status: 500 });
  }
}

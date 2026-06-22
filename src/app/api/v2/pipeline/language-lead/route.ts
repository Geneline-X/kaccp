import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

function isLanguageLead(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// GET /api/v2/pipeline/language-lead — List items waiting for language lead review
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !isLanguageLead(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "corrected";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;

    const where: any = {
      correctedTranscript: { not: null },
      status,
    };

    const [items, total] = await Promise.all([
      prisma.reviewQueue.findMany({
        where,
        include: {
          audioSession: true,
          reviewer: { select: { id: true, displayName: true } },
          secondReviewer: { select: { id: true, displayName: true } },
          languageLead: { select: { id: true, displayName: true } },
        },
        orderBy: [
          { priorityTier: "asc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.reviewQueue.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("Error listing language lead reviews:", error);
    return NextResponse.json({ error: "Failed to list reviews" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

// GET /api/v2/speaker/wallet - Get speaker's wallet balance and transaction history
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const [userData, transactions, total] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { totalEarningsCents: true, totalRecordingsSec: true },
      }),
      prisma.walletTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({
      balanceCents: userData?.totalEarningsCents ?? 0,
      balanceSLE: ((userData?.totalEarningsCents ?? 0) / 100).toFixed(2),
      totalRecordingSec: userData?.totalRecordingsSec ?? 0,
      transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 500 });
  }
}

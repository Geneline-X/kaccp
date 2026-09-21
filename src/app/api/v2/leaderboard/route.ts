import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { buildLeaderboard, standingFor } from "@/lib/domain/leaderboard";

export const dynamic = "force-dynamic";

// GET /api/v2/leaderboard?period=today|week|month|all&languageId=...
//
// Full board, used by the leaderboard page. The dashboard gets the same numbers
// folded into /api/v2/transcriber/profile so one page load makes one request
// instead of two — see lib/domain/leaderboard.ts for why they share the builder.
//
// Ranks on APPROVED work only. Ranking on raw submissions would pay out for
// speed regardless of correctness and quietly degrade the dataset, so a rejected
// item subtracts points instead of being ignored.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "week";
    const languageId = searchParams.get("languageId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    const entries = await buildLeaderboard(period, languageId);

    if (entries.length === 0) {
      return NextResponse.json({ period, entries: [], me: null, totals: null });
    }

    return NextResponse.json({
      period,
      entries: entries.slice(0, limit),
      me: standingFor(entries, user.id),
      totals: {
        participants: entries.length,
        approved: entries.reduce((s, e) => s + e.approved, 0),
        points: entries.reduce((s, e) => s + e.points, 0),
      },
    });
  } catch (error) {
    console.error("Error building leaderboard:", error);
    return NextResponse.json({ error: "Failed to build leaderboard" }, { status: 500 });
  }
}

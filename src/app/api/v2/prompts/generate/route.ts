import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { generateFreeFormTopics } from "@/lib/infra/ai/openai";

// POST /api/v2/prompts/generate - Generate free-form topic prompts via AI (Admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || (!((user as any).roles || []).includes("ADMIN") && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { category, count = 20 } = body;

    if (!category) {
      return NextResponse.json(
        { error: "category is required" },
        { status: 400 }
      );
    }

    const clampedCount = Math.min(Math.max(1, count), 200);
    const topics = await generateFreeFormTopics(category, clampedCount);

    if (topics.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate topics. Check OPENAI_API_KEY." },
        { status: 500 }
      );
    }

    return NextResponse.json({ topics });
  } catch (error) {
    console.error("Error generating topics:", error);
    return NextResponse.json(
      { error: "Failed to generate topics" },
      { status: 500 }
    );
  }
}

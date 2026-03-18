import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

// POST /api/v2/speaker/prompts/skip - Mark a prompt as skipped
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { promptId } = await req.json();
    if (!promptId) {
      return NextResponse.json({ error: "promptId is required" }, { status: 400 });
    }

    await prisma.skippedPrompt.upsert({
      where: { userId_promptId: { userId: user.id, promptId } },
      create: { userId: user.id, promptId },
      update: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error skipping prompt:", error);
    return NextResponse.json({ error: "Failed to skip prompt" }, { status: 500 });
  }
}

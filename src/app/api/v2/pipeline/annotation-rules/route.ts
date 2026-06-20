import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

function isAdminOrReviewer(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || roles.includes("REVIEWER") || user.role === "ADMIN" || user.role === "REVIEWER";
}

// GET /api/v2/pipeline/annotation-rules — List annotation rules
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isAdminOrReviewer(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const where: any = {};
    if (category) where.category = category;
    if (activeOnly) where.isActive = true;

    const rules = await prisma.annotationRule.findMany({
      where,
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error listing annotation rules:", error);
    return NextResponse.json({ error: "Failed to list rules" }, { status: 500 });
  }
}

// POST /api/v2/pipeline/annotation-rules — Create a new annotation rule
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isAdminOrReviewer(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ruleId, title, description, examples, category } = body;

    if (!ruleId || !title || !description) {
      return NextResponse.json(
        { error: "ruleId, title, and description are required" },
        { status: 400 },
      );
    }

    const rule = await prisma.annotationRule.create({
      data: {
        ruleId,
        title,
        description,
        examples: examples ?? null,
        category: category ?? null,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Error creating annotation rule:", error);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}

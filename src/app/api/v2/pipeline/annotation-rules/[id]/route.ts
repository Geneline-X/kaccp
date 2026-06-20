import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

function isAdminOrReviewer(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || roles.includes("REVIEWER") || user.role === "ADMIN" || user.role === "REVIEWER";
}

// PATCH /api/v2/pipeline/annotation-rules/[id] — Update an annotation rule
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!isAdminOrReviewer(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.annotationRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Annotation rule not found" }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, examples, category, isActive, ruleId } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (examples !== undefined) updateData.examples = examples;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (ruleId !== undefined) updateData.ruleId = ruleId;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const rule = await prisma.annotationRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Error updating annotation rule:", error);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

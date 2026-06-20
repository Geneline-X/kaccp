import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

function isAdmin(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// PATCH /api/v2/pipeline/api-keys/[id] — Revoke or reactivate an API key
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { isActive } = body;

    if (isActive === undefined) {
      return NextResponse.json({ error: "isActive field required" }, { status: 400 });
    }

    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    await prisma.apiKey.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({
      message: `API key "${existing.name}" ${isActive ? "reactivated" : "revoked"}`,
    });
  } catch (error) {
    console.error("Error updating API key:", error);
    return NextResponse.json({ error: "Failed to update API key" }, { status: 500 });
  }
}

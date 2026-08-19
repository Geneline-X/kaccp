import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

// DELETE /api/v2/word-bank/[id] - Delete a word (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles =
      user.roles && user.roles.length > 0 ? user.roles : [user.role];
    if (!userRoles.includes("ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized - ADMIN role required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.wordBank.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Word not found" },
        { status: 404 }
      );
    }

    await prisma.wordBank.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting word:", error);
    return NextResponse.json(
      { error: "Failed to delete word" },
      { status: 500 }
    );
  }
}

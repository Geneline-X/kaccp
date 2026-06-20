import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { exportDatasetToGcs } from "@/lib/domain/pipeline";

function isAdmin(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// POST /api/v2/pipeline/datasets/[id]/export — Export dataset version to GCS
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const version = await prisma.datasetVersion.findUnique({ where: { id } });
    if (!version) {
      return NextResponse.json({ error: "Dataset version not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const format = body.format ?? "ljspeech";

    const result = await exportDatasetToGcs(version.versionId, format as any);

    return NextResponse.json({
      message: "Dataset exported to GCS",
      exportPath: result.exportPath,
      totalSessions: result.totalSessions,
    });
  } catch (error: any) {
    console.error("Error exporting dataset:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to export dataset" },
      { status: 500 },
    );
  }
}

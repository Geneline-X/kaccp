import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

function isAdmin(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// PATCH /api/v2/pipeline/datasets/[id] — Update dataset version (status, eval, training metadata)
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
    const version = await prisma.datasetVersion.findUnique({ where: { id } });
    if (!version) {
      return NextResponse.json({ error: "Dataset version not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status, evalWer, evalDate, modelArtifactPath, trainingConfig, trainingStartedAt, trainingCompletedAt, exportPath } = body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (evalWer !== undefined) updateData.evalWer = evalWer;
    if (evalDate !== undefined) updateData.evalDate = new Date(evalDate);
    if (modelArtifactPath !== undefined) updateData.modelArtifactPath = modelArtifactPath;
    if (trainingConfig !== undefined) updateData.trainingConfig = trainingConfig;
    if (trainingStartedAt !== undefined) updateData.trainingStartedAt = new Date(trainingStartedAt);
    if (trainingCompletedAt !== undefined) updateData.trainingCompletedAt = new Date(trainingCompletedAt);
    if (exportPath !== undefined) updateData.exportPath = exportPath;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.datasetVersion.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ version: updated });
  } catch (error) {
    console.error("Error updating dataset version:", error);
    return NextResponse.json({ error: "Failed to update dataset version" }, { status: 500 });
  }
}

// GET /api/v2/pipeline/datasets/[id] — Get dataset version details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const version = await prisma.datasetVersion.findUnique({
      where: { id },
      include: {
        reviewQueueItems: {
          select: {
            id: true,
            source: true,
            priorityTier: true,
            status: true,
            asrTranscript: true,
            correctedTranscript: true,
            audioPath: true,
            createdAt: true,
            mergedAt: true,
            reviewer: { select: { id: true, displayName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!version) {
      return NextResponse.json({ error: "Dataset version not found" }, { status: 404 });
    }

    return NextResponse.json({ version });
  } catch (error) {
    console.error("Error fetching dataset version:", error);
    return NextResponse.json({ error: "Failed to fetch dataset version" }, { status: 500 });
  }
}

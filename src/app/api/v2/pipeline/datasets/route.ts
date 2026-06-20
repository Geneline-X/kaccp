import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { mergeApprovedReviews } from "@/lib/domain/pipeline";

function isAdmin(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// GET /api/v2/pipeline/datasets — List all dataset versions
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [versions, total] = await Promise.all([
      prisma.datasetVersion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.datasetVersion.count({ where }),
    ]);

    return NextResponse.json({
      versions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error listing datasets:", error);
    return NextResponse.json({ error: "Failed to list datasets" }, { status: 500 });
  }
}

// POST /api/v2/pipeline/datasets — Create a new dataset version (merge approved reviews)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const description = body.description;

    const result = await mergeApprovedReviews(description);

    return NextResponse.json({
      message: "Dataset version created",
      version: result,
    }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "No approved reviews to merge") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating dataset version:", error);
    return NextResponse.json({ error: "Failed to create dataset version" }, { status: 500 });
  }
}

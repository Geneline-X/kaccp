import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { generateApiKey } from "@/lib/infra/auth/api-keys";

function isAdmin(user: any) {
  if (!user) return false;
  const roles = (user as any).roles || [];
  return roles.includes("ADMIN") || user.role === "ADMIN";
}

// GET /api/v2/pipeline/api-keys — List all API keys (admin only)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("Error listing API keys:", error);
    return NextResponse.json({ error: "Failed to list API keys" }, { status: 500 });
  }
}

// POST /api/v2/pipeline/api-keys — Create a new API key (admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const existing = await prisma.apiKey.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: `API key "${name}" already exists` }, { status: 409 });
    }

    const { raw, hash, prefix } = generateApiKey(name);

    await prisma.apiKey.create({
      data: { name, keyHash: hash, prefix },
    });

    return NextResponse.json({
      message: `API key "${name}" created`,
      key: raw, // Only shown once on creation
      prefix,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}

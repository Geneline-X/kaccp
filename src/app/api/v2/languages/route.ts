import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/languages - List all languages (optionally filter by country)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const countryId = searchParams.get("countryId");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const languages = await prisma.language.findMany({
      where: {
        ...(countryId && { countryId }),
        ...(activeOnly && { isActive: true }),
      },
      include: {
        country: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            prompts: true,
            recordings: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ languages });
  } catch (error) {
    console.error("Error fetching languages:", error);
    return NextResponse.json(
      { error: "Failed to fetch languages" },
      { status: 500 }
    );
  }
}

// POST /api/v2/languages - Create a new language (Admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      code,
      name,
      nativeName,
      countryId,
      targetMinutes = 12000, // 200 hours default
      speakerRatePerMinute = 0.05,
      transcriberRatePerMin = 0.03,
    } = body;

    if (!code || !name || !countryId) {
      return NextResponse.json(
        { error: "Code, name, and countryId are required" },
        { status: 400 }
      );
    }

    // Check if country exists
    const country = await prisma.country.findUnique({
      where: { id: countryId },
    });

    if (!country) {
      return NextResponse.json(
        { error: "Country not found" },
        { status: 404 }
      );
    }

    // Check if language code already exists
    const existing = await prisma.language.findUnique({
      where: { code: code.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Language with this code already exists" },
        { status: 400 }
      );
    }

    const language = await prisma.language.create({
      data: {
        code: code.toLowerCase(),
        name,
        nativeName,
        countryId,
        targetMinutes,
        speakerRatePerMinute,
        transcriberRatePerMin,
      },
      include: {
        country: true,
      },
    });

    return NextResponse.json({ language }, { status: 201 });
  } catch (error) {
    console.error("Error creating language:", error);
    return NextResponse.json(
      { error: "Failed to create language" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/countries - List all countries
export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      include: {
        languages: {
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            nativeName: true,
            targetMinutes: true,
            collectedMinutes: true,
            approvedMinutes: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ countries });
  } catch (error) {
    console.error("Error fetching countries:", error);
    return NextResponse.json(
      { error: "Failed to fetch countries" },
      { status: 500 }
    );
  }
}

// POST /api/v2/countries - Create a new country (Admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Code and name are required" },
        { status: 400 }
      );
    }

    // Check if country already exists
    const existing = await prisma.country.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Country with this code already exists" },
        { status: 400 }
      );
    }

    const country = await prisma.country.create({
      data: {
        code: code.toUpperCase(),
        name,
      },
    });

    return NextResponse.json({ country }, { status: 201 });
  } catch (error) {
    console.error("Error creating country:", error);
    return NextResponse.json(
      { error: "Failed to create country" },
      { status: 500 }
    );
  }
}

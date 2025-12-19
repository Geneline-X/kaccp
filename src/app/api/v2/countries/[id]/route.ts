import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/v2/countries/[id] - Get a single country
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const country = await prisma.country.findUnique({
      where: { id: params.id },
      include: {
        languages: {
          orderBy: { name: "asc" },
        },
      },
    });

    if (!country) {
      return NextResponse.json({ error: "Country not found" }, { status: 404 });
    }

    return NextResponse.json({ country });
  } catch (error) {
    console.error("Error fetching country:", error);
    return NextResponse.json(
      { error: "Failed to fetch country" },
      { status: 500 }
    );
  }
}

// PATCH /api/v2/countries/[id] - Update a country (Admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, isActive } = body;

    const country = await prisma.country.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(typeof isActive === "boolean" && { isActive }),
      },
    });

    return NextResponse.json({ country });
  } catch (error) {
    console.error("Error updating country:", error);
    return NextResponse.json(
      { error: "Failed to update country" },
      { status: 500 }
    );
  }
}

// DELETE /api/v2/countries/[id] - Delete a country (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if country has languages
    const languageCount = await prisma.language.count({
      where: { countryId: params.id },
    });

    if (languageCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete country with languages. Remove languages first." },
        { status: 400 }
      );
    }

    await prisma.country.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting country:", error);
    return NextResponse.json(
      { error: "Failed to delete country" },
      { status: 500 }
    );
  }
}

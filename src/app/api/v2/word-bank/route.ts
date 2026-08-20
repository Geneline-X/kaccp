import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

// GET /api/v2/word-bank - Search words for autocomplete OR admin listing
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const languageId = searchParams.get("languageId");
    const q = searchParams.get("q") || "";
    const isAdmin = searchParams.get("admin") === "true";

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId is required" },
        { status: 400 }
      );
    }

    // Admin listing - all words for a language
    if (isAdmin) {
      const userRoles =
        user.roles && user.roles.length > 0 ? user.roles : [user.role];
      if (!userRoles.includes("ADMIN")) {
        return NextResponse.json(
          { error: "Unauthorized - ADMIN role required" },
          { status: 403 }
        );
      }

      const where: any = { languageId };
      if (q) {
        where.word = { contains: q, mode: "insensitive" };
      }

      const [words, total] = await Promise.all([
        prisma.wordBank.findMany({
          where,
          select: {
            id: true,
            word: true,
            category: true,
            createdAt: true,
          },
          orderBy: { word: "asc" },
          take: 500,
        }),
        prisma.wordBank.count({ where }),
      ]);

      return NextResponse.json({ words, total });
    }

    // Autocomplete search - prefix match
    if (q.length < 2) {
      return NextResponse.json({ words: [] });
    }

    const words = await prisma.wordBank.findMany({
      where: {
        languageId,
        word: {
          startsWith: q,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        word: true,
        category: true,
      },
      orderBy: { word: "asc" },
      take: 15,
    });

    return NextResponse.json({ words });
  } catch (error) {
    console.error("Error searching word bank:", error);
    return NextResponse.json(
      { error: "Failed to search word bank" },
      { status: 500 }
    );
  }
}

// POST /api/v2/word-bank - Add words (admin only, supports bulk)
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { languageId, words, category } = body;

    if (!languageId || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: "languageId and words array are required" },
        { status: 400 }
      );
    }

    // Clean and deduplicate words (preserve original casing for Krio phonetics)
    const cleanWords = [
      ...new Set(
        words
          .map((w: string) => w.trim())
          .filter((w: string) => w.length > 0)
      ),
    ];

    if (cleanWords.length === 0) {
      return NextResponse.json(
        { error: "No valid words provided" },
        { status: 400 }
      );
    }

    // Bulk insert with ignore on conflict (skip duplicates)
    const result = await prisma.wordBank.createMany({
      data: cleanWords.map((word) => ({
        languageId,
        word,
        category: category || null,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      added: result.count,
      total: cleanWords.length,
    });
  } catch (error) {
    console.error("Error adding words to bank:", error);
    return NextResponse.json(
      { error: "Failed to add words" },
      { status: 500 }
    );
  }
}

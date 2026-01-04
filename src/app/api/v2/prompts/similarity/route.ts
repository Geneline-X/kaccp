import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import levenshtein from "fast-levenshtein";

// POST /api/v2/prompts/similarity - Check for similar prompts
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        // Allow users to check similarity? Better restrict to Admin/Reviewer probably, 
        // but maybe Speakers need to know if they are suggesting? For now Admin only based on context.
        // Actually, prompt management is Admin only.
        if (!user || user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { text, languageId, threshold = 0.85 } = body;

        if (!text || !languageId) {
            return NextResponse.json(
                { error: "text and languageId are required" },
                { status: 400 }
            );
        }

        // Normalized comparison
        const normalizedInput = text.toLowerCase().trim();

        // Fetch existing prompts for this language
        // Optimization: In a huge DB, we might want to filter by length first (e.g. +/- 20%) to reduce Levenshtein calcs
        const prompts = await prisma.prompt.findMany({
            where: {
                languageId,
                isActive: true,
            },
            select: {
                id: true,
                englishText: true,
                category: true,
            },
        });

        const matches = [];

        for (const prompt of prompts) {
            const existingText = prompt.englishText.toLowerCase().trim();

            // Calculate Levenshtein distance
            const distance = levenshtein.get(normalizedInput, existingText);
            const maxLength = Math.max(normalizedInput.length, existingText.length);

            // Calculate similarity score (0 to 1)
            const similarity = 1 - distance / maxLength;

            if (similarity >= threshold) {
                matches.push({
                    id: prompt.id,
                    text: prompt.englishText,
                    category: prompt.category,
                    similarity,
                });
            }
        }

        // Sort by most similar
        matches.sort((a, b) => b.similarity - a.similarity);

        return NextResponse.json({
            matches: matches.slice(0, 5), // Return top 5
            hasMatches: matches.length > 0,
        });
    } catch (error) {
        console.error("Error checking similarity:", error);
        return NextResponse.json(
            { error: "Failed to check similarity" },
            { status: 500 }
        );
    }
}

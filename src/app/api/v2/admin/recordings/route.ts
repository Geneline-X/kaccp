import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";
import { RecordingStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user || (!((user as any).roles || []).includes("ADMIN") && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const languageId = searchParams.get("languageId");
        const status = searchParams.get("status") as RecordingStatus | null;
        const search = searchParams.get("search");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        const where: any = {
            ...(languageId && { languageId }),
            ...(status && { status }),
        };

        // Search in prompt text
        if (search) {
            where.prompt = {
                englishText: {
                    contains: search,
                    mode: "insensitive"
                }
            };
        }

        const [recordings, total] = await Promise.all([
            prisma.recording.findMany({
                where,
                select: {
                    id: true,
                    audioUrl: true,
                    durationSec: true,
                    status: true,
                    createdAt: true,
                    transcript: true,
                    transcriptConfidence: true,
                    autoTranscriptionStatus: true,
                    autoTranscribedAt: true,
                    language: {
                        select: { id: true, name: true, code: true },
                    },
                    prompt: {
                        select: { id: true, englishText: true, category: true },
                    },
                    speaker: {
                        select: { id: true, email: true, displayName: true },
                    },
                    transcription: {
                        select: { id: true, text: true, status: true },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.recording.count({ where }),
        ]);

        return NextResponse.json({
            recordings,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching recordings:", error);
        return NextResponse.json(
            { error: "Failed to fetch recordings" },
            { status: 500 }
        );
    }
}

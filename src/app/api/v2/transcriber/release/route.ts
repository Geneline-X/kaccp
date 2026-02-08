import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

// POST /api/v2/transcriber/release - Release/drop a claimed recording
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
        const hasAccess = userRoles.includes("TRANSCRIBER") || userRoles.includes("ADMIN");

        if (!hasAccess) {
            return NextResponse.json({ error: "Unauthorized - TRANSCRIBER role required" }, { status: 403 });
        }

        const body = await req.json();
        const { recordingId } = body;

        if (!recordingId) {
            return NextResponse.json(
                { error: "recordingId is required" },
                { status: 400 }
            );
        }

        // Find the active assignment for this recording and user
        const assignment = await prisma.transcriptionAssignment.findFirst({
            where: {
                recordingId,
                userId: user.id,
                releasedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        if (!assignment) {
            return NextResponse.json(
                { error: "No active assignment found for this recording" },
                { status: 404 }
            );
        }

        // Release the assignment
        await prisma.transcriptionAssignment.update({
            where: { id: assignment.id },
            data: { releasedAt: new Date() },
        });

        return NextResponse.json({
            message: "Assignment released successfully",
        });
    } catch (error) {
        console.error("Error releasing assignment:", error);
        return NextResponse.json(
            { error: "Failed to release assignment" },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ recordingId: string }> }
) {
    try {
        const user = await getAuthUser(req);
        if (!user || user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { recordingId } = await params;
        const { reason } = await req.json();

        if (!reason) {
            return NextResponse.json(
                { error: "Flag reason is required" },
                { status: 400 }
            );
        }

        // Update recording status to FLAGGED
        await prisma.recording.update({
            where: { id: recordingId },
            data: {
                status: "FLAGGED",
                isFlagged: true,
                flagReason: reason,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error flagging recording:", error);
        return NextResponse.json(
            { error: "Failed to flag recording" },
            { status: 500 }
        );
    }
}

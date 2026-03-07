import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ recordingId: string }> }
) {
    try {
        const user = await getAuthUser(req);
        if (!user || (!((user as any).roles || []).includes("ADMIN") && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { recordingId } = await params;

        const recording = await prisma.recording.findUnique({
            where: { id: recordingId },
            select: { status: true, languageId: true, durationSec: true },
        });

        if (!recording) {
            return NextResponse.json({ error: "Recording not found" }, { status: 404 });
        }

        const alreadyApproved = recording.status === "APPROVED";

        await prisma.recording.update({
            where: { id: recordingId },
            data: { status: "APPROVED" },
        });

        // Only increment approvedMinutes the first time a recording is approved
        if (!alreadyApproved) {
            await prisma.language.update({
                where: { id: recording.languageId },
                data: { approvedMinutes: { increment: recording.durationSec / 60 } },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error approving recording:", error);
        return NextResponse.json(
            { error: "Failed to approve recording" },
            { status: 500 }
        );
    }
}

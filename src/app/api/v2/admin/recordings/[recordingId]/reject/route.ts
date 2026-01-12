import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

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

        // Update recording status to REJECTED
        await prisma.recording.update({
            where: { id: recordingId },
            data: {
                status: "REJECTED",
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error rejecting recording:", error);
        return NextResponse.json(
            { error: "Failed to reject recording" },
            { status: 500 }
        );
    }
}

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

        // Update recording status to APPROVED
        await prisma.recording.update({
            where: { id: recordingId },
            data: {
                status: "APPROVED",
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error approving recording:", error);
        return NextResponse.json(
            { error: "Failed to approve recording" },
            { status: 500 }
        );
    }
}

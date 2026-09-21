import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

const ASSIGNMENT_MINUTES = parseInt(process.env.ASSIGNMENT_MINUTES || "15");

// POST /api/v2/transcriber/claim-next — pick the next available recording and
// claim it in one step.
//
// Exists so the editor can go straight from "submitted" to the next clip. Doing
// it client-side would mean list-then-claim, which races: two transcribers
// polling at the same moment both see the same top row and one wastes a trip.
// Selecting and claiming here keeps it to a single round trip and lets us retry
// past a row someone else just took.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    if (!userRoles.includes("TRANSCRIBER") && !userRoles.includes("ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized - TRANSCRIBER role required" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const languageId: string | undefined = body?.languageId;
    const excludeIds: string[] = Array.isArray(body?.excludeIds) ? body.excludeIds : [];

    const now = new Date();

    // Restrict to languages the transcriber can write, same rule as the queue.
    let languageFilter: any = {};
    if (languageId) {
      languageFilter = { languageId };
    } else if (user.writesLanguages.length > 0) {
      const languages = await prisma.language.findMany({
        where: {
          OR: [
            { code: { in: user.writesLanguages } },
            { id: { in: user.writesLanguages } },
          ],
        },
        select: { id: true },
      });
      languageFilter = { languageId: { in: languages.map((l) => l.id) } };
    }

    const recordingSelect = {
      id: true,
      audioUrl: true,
      durationSec: true,
      transcript: true,
      transcriptConfidence: true,
      autoTranscriptionStatus: true,
      status: true,
      prompt: {
        select: {
          englishText: true,
          category: true,
          emotion: true,
          isFreeForm: true,
          instruction: true,
        },
      },
      language: { select: { id: true, code: true, name: true, transcriberRatePerMin: true } },
      speaker: { select: { displayName: true } },
    } as const;

    // Walk down the queue: if someone claims a row between our read and our
    // write, the unique assignment check fails and we simply try the next one.
    const skip = new Set(excludeIds);
    for (let attempt = 0; attempt < 10; attempt++) {
      const assigned = await prisma.transcriptionAssignment.findMany({
        where: { expiresAt: { gt: now }, releasedAt: null },
        select: { recordingId: true },
      });
      const taken = new Set([...assigned.map((a) => a.recordingId), ...skip]);

      const candidate = await prisma.recording.findFirst({
        where: {
          status: "PENDING_TRANSCRIPTION",
          id: { notIn: [...taken] },
          ...languageFilter,
        },
        select: recordingSelect,
        orderBy: { createdAt: "asc" },
      });

      if (!candidate) {
        return NextResponse.json({ done: true, message: "No more recordings available" });
      }

      try {
        const expiresAt = new Date(now.getTime() + ASSIGNMENT_MINUTES * 60 * 1000);
        const assignment = await prisma.transcriptionAssignment.create({
          data: { recordingId: candidate.id, userId: user.id, expiresAt },
        });

        const previousTranscription = await prisma.transcription.findUnique({
          where: { recordingId: candidate.id },
          select: {
            id: true,
            status: true,
            text: true,
            reviewNotes: true,
            reviewedAt: true,
            reviewer: { select: { displayName: true } },
          },
        });

        return NextResponse.json({
          assignment,
          recording: candidate,
          expiresAt,
          minutesRemaining: ASSIGNMENT_MINUTES,
          previousTranscription:
            previousTranscription?.status === "REJECTED" ? previousTranscription : null,
        });
      } catch {
        // Lost the race for this row — skip it and take the next.
        skip.add(candidate.id);
      }
    }

    return NextResponse.json(
      { error: "Could not claim a recording, please try again" },
      { status: 409 }
    );
  } catch (error) {
    console.error("Error claiming next recording:", error);
    return NextResponse.json({ error: "Failed to claim next recording" }, { status: 500 });
  }
}

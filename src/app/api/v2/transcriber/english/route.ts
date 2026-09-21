import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/infra/db/prisma";
import { getAuthUser } from "@/lib/infra/auth/auth";

// English translation tasks.
//
// Free-form recordings have a Krio transcript but no usable English: their
// Prompt.englishText is an instruction ("Describe how to prepare yams"), not a
// sentence the speaker translated. Without an English side they cannot be used
// for English-to-Krio training, so transcribers supply the translation here.
//
// The queue is deliberately derived rather than stored: any free-form recording
// that has Krio text and no translation yet shows up, so newly-transcribed clips
// join automatically.

function hasAccess(user: any) {
  if (!user) return false;
  const roles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
  return roles.includes("TRANSCRIBER") || roles.includes("ADMIN");
}

// A recording is translatable once someone has written down what was said in the
// target language — the translator works from the Krio text plus the audio.
function pendingWhere(languageIds?: string[]) {
  const where: any = {
    prompt: { isFreeForm: true },
    status: { notIn: ["REJECTED", "FLAGGED"] },
    englishTranslation: null,
    OR: [
      { transcription: { status: "APPROVED" } },
      { transcript: { not: null } },
    ],
  };
  if (languageIds && languageIds.length > 0) where.languageId = { in: languageIds };
  return where;
}

// GET /api/v2/transcriber/english — recordings awaiting an English translation
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!hasAccess(user)) {
      return NextResponse.json(
        { error: "Unauthorized - TRANSCRIBER role required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const languageId = searchParams.get("languageId");
    const mine = searchParams.get("mine") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
    const skip = (page - 1) * limit;

    // Restrict to languages the transcriber can write, same rule as the Krio queue.
    let languageIds: string[] | undefined;
    if (languageId) {
      languageIds = [languageId];
    } else if (user!.writesLanguages.length > 0) {
      const languages = await prisma.language.findMany({
        where: {
          OR: [
            { code: { in: user!.writesLanguages } },
            { id: { in: user!.writesLanguages } },
          ],
        },
        select: { id: true },
      });
      languageIds = languages.map((l) => l.id);
    }

    const where = mine
      ? { englishTranslatedById: user!.id }
      : pendingWhere(languageIds);

    // Sequential to keep one connection per request. See lib/infra/db/prisma.ts.
    const items = await prisma.recording.findMany({
        where,
        select: {
          id: true,
          audioUrl: true,
          durationSec: true,
          transcript: true,
          englishTranslation: true,
          englishTranslatedAt: true,
          englishTranslationStatus: true,
          englishReviewNotes: true,
          transcription: { select: { text: true, status: true } },
          prompt: { select: { englishText: true, category: true, instruction: true } },
          language: { select: { code: true, name: true } },
          speaker: { select: { displayName: true } },
        },
      orderBy: mine ? { englishTranslatedAt: "desc" } : { createdAt: "asc" },
      skip,
      take: limit,
    });
    const total = await prisma.recording.count({ where });
    const myCount = await prisma.recording.count({
      where: { englishTranslatedById: user!.id },
    });

    // The Krio text is what the translator renders into English; prefer the
    // reviewer-approved version over the imported one.
    const mapped = items.map((r) => ({
      id: r.id,
      audioUrl: r.audioUrl,
      durationSec: r.durationSec,
      krioText:
        (r.transcription?.status === "APPROVED" ? r.transcription.text : null) ||
        r.transcript ||
        "",
      krioSource:
        r.transcription?.status === "APPROVED" ? "reviewer_approved" : "imported",
      englishTranslation: r.englishTranslation,
      englishTranslatedAt: r.englishTranslatedAt,
      englishTranslationStatus: r.englishTranslationStatus,
      englishReviewNotes: r.englishReviewNotes,
      // The prompt text is the instruction the speaker was given. Shown as context
      // only — it is not the English of this clip and must not be copied in.
      promptInstruction: r.prompt?.englishText ?? "",
      category: r.prompt?.category ?? "",
      language: r.language,
      speaker: r.speaker,
    }));

    return NextResponse.json({
      items: mapped,
      total,
      myTranslations: myCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error listing English translation tasks:", error);
    return NextResponse.json({ error: "Failed to list tasks" }, { status: 500 });
  }
}

// POST /api/v2/transcriber/english — submit a translation
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!hasAccess(user)) {
      return NextResponse.json(
        { error: "Unauthorized - TRANSCRIBER role required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const recordingId: string | undefined = body?.recordingId;
    const englishText: string = (body?.englishText ?? "").trim();

    if (!recordingId) {
      return NextResponse.json({ error: "recordingId is required" }, { status: 400 });
    }
    if (!englishText) {
      return NextResponse.json({ error: "englishText cannot be empty" }, { status: 400 });
    }

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        id: true,
        englishTranslation: true,
        englishTranslatedById: true,
        prompt: { select: { englishText: true, isFreeForm: true } },
      },
    });

    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    // Guard against the instruction being pasted in as the translation — that is
    // exactly the confusion this queue exists to resolve.
    if (
      recording.prompt?.isFreeForm &&
      englishText.toLowerCase() === (recording.prompt.englishText || "").trim().toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            "That is the instruction the speaker was given, not a translation of what they said.",
        },
        { status: 400 }
      );
    }

    // Someone else already translated it: don't silently overwrite their work.
    const isOwn = recording.englishTranslatedById === user!.id;
    if (recording.englishTranslation && !isOwn) {
      return NextResponse.json(
        { error: "Already translated by another transcriber" },
        { status: 409 }
      );
    }

    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        englishTranslation: englishText,
        englishTranslatedById: user!.id,
        englishTranslatedAt: new Date(),
        englishTranslationStatus: "PENDING_REVIEW",
        englishReviewNotes: null,
      },
    });

    return NextResponse.json({ success: true, recordingId });
  } catch (error) {
    console.error("Error saving English translation:", error);
    return NextResponse.json({ error: "Failed to save translation" }, { status: 500 });
  }
}

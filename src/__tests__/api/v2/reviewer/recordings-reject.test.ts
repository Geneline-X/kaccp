import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockFindUnique,
  mockRecordingUpdate,
  mockLanguageUpdate,
  mockPromptUpdate,
  mockGetAuthUser,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockRecordingUpdate: vi.fn(),
  mockLanguageUpdate: vi.fn(),
  mockPromptUpdate: vi.fn(),
  mockGetAuthUser: vi.fn(),
}));

vi.mock("@/lib/infra/db/prisma", () => ({
  prisma: {
    recording: { findUnique: mockFindUnique, update: mockRecordingUpdate },
    language: { update: mockLanguageUpdate },
    prompt: { update: mockPromptUpdate },
  },
}));

vi.mock("@/lib/infra/auth/auth", () => ({ getAuthUser: mockGetAuthUser }));

// ─── Import handler after mocks ───────────────────────────────────────────────

import { POST } from "@/app/api/v2/reviewer/recordings/[recordingId]/reject/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(recordingId: string) {
  return {
    req: new NextRequest(
      `http://localhost/api/v2/reviewer/recordings/${recordingId}/reject`,
      { method: "POST" }
    ),
    ctx: { params: Promise.resolve({ recordingId }) },
  };
}

const reviewerUser = { id: "user-1", role: "REVIEWER", roles: ["REVIEWER"] };

const pendingRecording = {
  status: "PENDING_REVIEW",
  durationSec: 30, // 0.5 minutes
  languageId: "lang-1",
  promptId: "prompt-1",
  language: { collectedMinutes: 10 },
  prompt: { timesRecorded: 5 },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/v2/reviewer/recordings/[recordingId]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordingUpdate.mockResolvedValue({});
    mockLanguageUpdate.mockResolvedValue({});
    mockPromptUpdate.mockResolvedValue({});
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const { req, ctx } = makeRequest("rec-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent recording", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue(null);
    const { req, ctx } = makeRequest("missing");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 when recording is not PENDING_REVIEW", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue({ ...pendingRecording, status: "APPROVED" });
    const { req, ctx } = makeRequest("rec-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("sets recording status to REJECTED and clears isFlagged", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue(pendingRecording);
    const { req, ctx } = makeRequest("rec-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(mockRecordingUpdate).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: { status: "REJECTED", isFlagged: false },
    });
  });

  it("decrements language collectedMinutes by recording duration", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue(pendingRecording); // 30s = 0.5 minutes
    const { req, ctx } = makeRequest("rec-1");
    await POST(req, ctx);
    expect(mockLanguageUpdate).toHaveBeenCalledWith({
      where: { id: "lang-1" },
      data: { collectedMinutes: { decrement: 0.5 } },
    });
  });

  it("decrements prompt timesRecorded by 1", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue(pendingRecording);
    const { req, ctx } = makeRequest("rec-1");
    await POST(req, ctx);
    expect(mockPromptUpdate).toHaveBeenCalledWith({
      where: { id: "prompt-1" },
      data: { timesRecorded: { decrement: 1 } },
    });
  });

  it("does not decrement language minutes if already zero", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue({
      ...pendingRecording,
      language: { collectedMinutes: 0 },
    });
    const { req, ctx } = makeRequest("rec-1");
    await POST(req, ctx);
    expect(mockLanguageUpdate).not.toHaveBeenCalled();
  });

  it("does not decrement prompt timesRecorded if already zero", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue({
      ...pendingRecording,
      prompt: { timesRecorded: 0 },
    });
    const { req, ctx } = makeRequest("rec-1");
    await POST(req, ctx);
    expect(mockPromptUpdate).not.toHaveBeenCalled();
  });

  it("caps decrement so collectedMinutes never goes negative", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    // 30s = 0.5 min, but language only has 0.2 minutes left
    mockFindUnique.mockResolvedValue({
      ...pendingRecording,
      durationSec: 30,
      language: { collectedMinutes: 0.2 },
    });
    const { req, ctx } = makeRequest("rec-1");
    await POST(req, ctx);
    expect(mockLanguageUpdate).toHaveBeenCalledWith({
      where: { id: "lang-1" },
      data: { collectedMinutes: { decrement: 0.2 } },
    });
  });
});

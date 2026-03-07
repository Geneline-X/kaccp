import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockFindUnique,
  mockRecordingUpdate,
  mockTranscriptionCreate,
  mockUserFindFirst,
  mockGetAuthUser,
  mockGetSignedUrl,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockRecordingUpdate: vi.fn(),
  mockTranscriptionCreate: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockGetAuthUser: vi.fn(),
  mockGetSignedUrl: vi.fn(),
}));

vi.mock("@/lib/infra/db/prisma", () => ({
  prisma: {
    recording: { findUnique: mockFindUnique, update: mockRecordingUpdate },
    transcription: { create: mockTranscriptionCreate },
    user: { findFirst: mockUserFindFirst },
  },
}));

vi.mock("@/lib/infra/auth/auth", () => ({ getAuthUser: mockGetAuthUser }));
vi.mock("@/lib/infra/gcs", () => ({ getSignedUrl: mockGetSignedUrl }));
vi.mock("@/lib/infra/ai/kay-client", () => ({
  kayXClient: { isEnabled: () => false, transcribeUrl: vi.fn() },
}));

// ─── Import handler after mocks ───────────────────────────────────────────────

import { POST } from "@/app/api/v2/reviewer/recordings/[recordingId]/approve/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(recordingId: string) {
  return {
    req: new NextRequest(
      `http://localhost/api/v2/reviewer/recordings/${recordingId}/approve`,
      { method: "POST" }
    ),
    ctx: { params: Promise.resolve({ recordingId }) },
  };
}

const reviewerUser = { id: "user-1", role: "REVIEWER", roles: ["REVIEWER"] };
const speakerUser = { id: "spk-1", role: "SPEAKER", roles: ["SPEAKER"] };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/v2/reviewer/recordings/[recordingId]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const { req, ctx } = makeRequest("rec-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 401 for SPEAKER role", async () => {
    mockGetAuthUser.mockResolvedValue(speakerUser);
    const { req, ctx } = makeRequest("rec-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent recording", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue(null);
    const { req, ctx } = makeRequest("missing-id");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 when recording is not in PENDING_REVIEW status", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue({
      status: "PENDING_TRANSCRIPTION",
      audioUrl: "/uploads/test.wav",
      language: { code: "kri" },
    });
    const { req, ctx } = makeRequest("rec-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("PENDING_REVIEW");
  });

  it("transitions recording to PENDING_TRANSCRIPTION on approval", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue({
      status: "PENDING_REVIEW",
      audioUrl: "/uploads/test.wav",
      language: { code: "en" },
    });
    mockRecordingUpdate.mockResolvedValue({});
    const { req, ctx } = makeRequest("rec-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(mockRecordingUpdate).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: { status: "PENDING_TRANSCRIPTION" },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("allows ADMIN role to approve", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "a1", role: "ADMIN", roles: ["ADMIN"] });
    mockFindUnique.mockResolvedValue({
      status: "PENDING_REVIEW",
      audioUrl: "/uploads/test.wav",
      language: { code: "en" },
    });
    mockRecordingUpdate.mockResolvedValue({});
    const { req, ctx } = makeRequest("rec-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
  });

  it("does not call Kay X when disabled", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindUnique.mockResolvedValue({
      status: "PENDING_REVIEW",
      audioUrl: "/uploads/test.wav",
      language: { code: "kri" },
    });
    mockRecordingUpdate.mockResolvedValue({});
    const { req, ctx } = makeRequest("rec-1");
    await POST(req, ctx);
    // Kay X is mocked as disabled, so transcription.create should not be called
    expect(mockTranscriptionCreate).not.toHaveBeenCalled();
  });
});

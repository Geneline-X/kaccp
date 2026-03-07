import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks (vi.mock is hoisted before variable declarations) ──────────

const { mockFindMany, mockCount, mockGetAuthUser, mockGetSignedUrl } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockGetAuthUser: vi.fn(),
  mockGetSignedUrl: vi.fn(),
}));

vi.mock("@/lib/infra/db/prisma", () => ({
  prisma: {
    recording: { findMany: mockFindMany, count: mockCount },
  },
}));

vi.mock("@/lib/infra/auth/auth", () => ({ getAuthUser: mockGetAuthUser }));
vi.mock("@/lib/infra/gcs", () => ({ getSignedUrl: mockGetSignedUrl }));

// ─── Import handler after mocks ───────────────────────────────────────────────

import { GET } from "@/app/api/v2/reviewer/recordings/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(url = "http://localhost/api/v2/reviewer/recordings") {
  return new NextRequest(url);
}

const reviewerUser = { id: "user-1", role: "REVIEWER", roles: ["REVIEWER"] };
const adminUser = { id: "admin-1", role: "ADMIN", roles: ["ADMIN"] };
const speakerUser = { id: "speaker-1", role: "SPEAKER", roles: ["SPEAKER"] };

const sampleRecording = {
  id: "rec-1",
  audioUrl: "/uploads/test.wav",
  durationSec: 8.2,
  status: "PENDING_REVIEW",
  prompt: { englishText: "Go to the market", category: "CONVERSATION", emotion: null, instruction: null },
  language: { id: "lang-1", code: "kri", name: "Krio" },
  speaker: { id: "spk-1", displayName: "Alice" },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/v2/reviewer/recordings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 for SPEAKER role", async () => {
    mockGetAuthUser.mockResolvedValue(speakerUser);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("allows REVIEWER role", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindMany.mockResolvedValue([sampleRecording]);
    mockCount.mockResolvedValue(1);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recordings).toHaveLength(1);
    expect(body.recordings[0].id).toBe("rec-1");
  });

  it("allows ADMIN role", async () => {
    mockGetAuthUser.mockResolvedValue(adminUser);
    mockFindMany.mockResolvedValue([sampleRecording]);
    mockCount.mockResolvedValue(1);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it("returns pagination metadata", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindMany.mockResolvedValue([sampleRecording]);
    mockCount.mockResolvedValue(42);
    const res = await GET(
      makeRequest("http://localhost/api/v2/reviewer/recordings?page=2&limit=20")
    );
    const body = await res.json();
    expect(body.pagination.total).toBe(42);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.totalPages).toBe(3);
  });

  it("passes languageId filter to prisma query", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    await GET(makeRequest("http://localhost/api/v2/reviewer/recordings?languageId=lang-1"));
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.languageId).toBe("lang-1");
    expect(whereArg.status).toBe("PENDING_REVIEW");
  });

  it("only queries PENDING_REVIEW recordings", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    await GET(makeRequest());
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe("PENDING_REVIEW");
  });

  it("generates signed URLs for gs:// audio paths", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockGetSignedUrl.mockResolvedValue("https://signed.example.com/audio.wav");
    const gcsRecording = { ...sampleRecording, audioUrl: "gs://bucket/audio.wav" };
    mockFindMany.mockResolvedValue([gcsRecording]);
    mockCount.mockResolvedValue(1);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(mockGetSignedUrl).toHaveBeenCalledWith("gs://bucket/audio.wav", 3600);
    expect(body.recordings[0].playbackUrl).toBe("https://signed.example.com/audio.wav");
  });

  it("falls back to original url if signed URL generation fails", async () => {
    mockGetAuthUser.mockResolvedValue(reviewerUser);
    mockGetSignedUrl.mockRejectedValue(new Error("GCS error"));
    const gcsRecording = { ...sampleRecording, audioUrl: "gs://bucket/audio.wav" };
    mockFindMany.mockResolvedValue([gcsRecording]);
    mockCount.mockResolvedValue(1);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.recordings[0].playbackUrl).toBe("gs://bucket/audio.wav");
  });
});

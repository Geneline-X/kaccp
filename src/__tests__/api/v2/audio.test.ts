import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindUnique, mockGetAuthUser, mockGetSignedUrl } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockGetAuthUser: vi.fn(),
  mockGetSignedUrl: vi.fn(),
}));

vi.mock("@/lib/infra/db/prisma", () => ({
  prisma: {
    recording: { findUnique: mockFindUnique },
  },
}));

vi.mock("@/lib/infra/auth/auth", () => ({ getAuthUser: mockGetAuthUser }));
vi.mock("@/lib/infra/gcs", () => ({ getSignedUrl: mockGetSignedUrl }));

// ─── Import handler after mocks ───────────────────────────────────────────────

import { GET } from "@/app/api/v2/audio/[recordingId]/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(recordingId: string) {
  return {
    req: new NextRequest(`http://localhost/api/v2/audio/${recordingId}`),
    ctx: { params: Promise.resolve({ recordingId }) },
  };
}

const localRecording = { id: "rec-1", speakerId: "spk-1", audioUrl: "/uploads/test.wav" };
const gcsRecording = { id: "rec-1", speakerId: "spk-1", audioUrl: "gs://bucket/audio.wav" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/v2/audio/[recordingId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const { req, ctx } = makeRequest("rec-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent recording", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "u1", role: "REVIEWER", roles: ["REVIEWER"] });
    mockFindUnique.mockResolvedValue(null);
    const { req, ctx } = makeRequest("missing");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("allows REVIEWER to access any recording", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "rev-1", role: "REVIEWER", roles: ["REVIEWER"] });
    mockFindUnique.mockResolvedValue(localRecording);
    const { req, ctx } = makeRequest("rec-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("/uploads/test.wav");
  });

  it("allows TRANSCRIBER to access any recording", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "tr-1", role: "TRANSCRIBER", roles: ["TRANSCRIBER"] });
    mockFindUnique.mockResolvedValue(localRecording);
    const { req, ctx } = makeRequest("rec-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  it("allows ADMIN to access any recording", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "a1", role: "ADMIN", roles: ["ADMIN"] });
    mockFindUnique.mockResolvedValue(localRecording);
    const { req, ctx } = makeRequest("rec-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  it("allows SPEAKER to access their own recording", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "spk-1", role: "SPEAKER", roles: ["SPEAKER"] });
    mockFindUnique.mockResolvedValue(localRecording); // speakerId matches user id
    const { req, ctx } = makeRequest("rec-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  it("denies SPEAKER access to another speaker's recording", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "other-spk", role: "SPEAKER", roles: ["SPEAKER"] });
    mockFindUnique.mockResolvedValue(localRecording); // speakerId is "spk-1", not "other-spk"
    const { req, ctx } = makeRequest("rec-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
  });

  it("returns signed URL for gs:// recording", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "rev-1", role: "REVIEWER", roles: ["REVIEWER"] });
    mockFindUnique.mockResolvedValue(gcsRecording);
    mockGetSignedUrl.mockResolvedValue("https://signed.example.com/audio.wav");
    const { req, ctx } = makeRequest("rec-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://signed.example.com/audio.wav");
    expect(body.mode).toBe("gcs");
    expect(mockGetSignedUrl).toHaveBeenCalledWith("gs://bucket/audio.wav", 3600);
  });

  it("returns local URL without signing", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "rev-1", role: "REVIEWER", roles: ["REVIEWER"] });
    mockFindUnique.mockResolvedValue(localRecording);
    const { req, ctx } = makeRequest("rec-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("local");
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it("allows REVIEWER via legacy single-role field (empty roles array)", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "rev-2", role: "REVIEWER", roles: [] });
    mockFindUnique.mockResolvedValue(localRecording);
    const { req, ctx } = makeRequest("rec-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });
});

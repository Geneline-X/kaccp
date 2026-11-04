import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

vi.mock("@/lib/infra/db/prisma", () => {
  const prisma = { user: { findUnique: mockFindUnique } };
  return { default: prisma, prisma };
});
// No caching in tests: every lookup hits the (mocked) database.
vi.mock("@/lib/infra/cache", () => ({
  cached: (_k: string, _ttl: number, produce: () => Promise<unknown>) => produce(),
  invalidate: vi.fn(),
}));

process.env.JWT_SECRET = "test-secret";

import { getAuthUser, signJwt } from "@/lib/infra/auth/auth";
import { TERMS_VERSION } from "@/lib/domain/users/onboarding";

function req(path: string) {
  const token = signJwt({ sub: "u1", role: "SPEAKER" as any });
  return new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${token}` } });
}

const onboarded = { id: "u1", isActive: true, role: "SPEAKER", roles: ["SPEAKER"], mustChangePassword: false, termsVersion: TERMS_VERSION };
const pending = { ...onboarded, mustChangePassword: true, termsVersion: null };

describe("getAuthUser first-login gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets an onboarded user through anywhere", async () => {
    mockFindUnique.mockResolvedValue(onboarded);
    expect(await getAuthUser(req("/api/v2/speaker/prompts"))).toMatchObject({ id: "u1" });
  });

  it("refuses a user with pending onboarding on normal endpoints", async () => {
    mockFindUnique.mockResolvedValue(pending);
    expect(await getAuthUser(req("/api/v2/speaker/prompts"))).toBeNull();
  });

  it("allows a user with pending onboarding on onboarding endpoints", async () => {
    mockFindUnique.mockResolvedValue(pending);
    expect(await getAuthUser(req("/api/auth/onboarding/change-password"))).toMatchObject({ id: "u1" });
    expect(await getAuthUser(req("/api/auth/me"))).toMatchObject({ id: "u1" });
  });

  it("re-reads a stale cached row before refusing", async () => {
    mockFindUnique.mockResolvedValueOnce(pending).mockResolvedValueOnce(onboarded);
    expect(await getAuthUser(req("/api/v2/speaker/prompts"))).toMatchObject({ id: "u1" });
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });
});

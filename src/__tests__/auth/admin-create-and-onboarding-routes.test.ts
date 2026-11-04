import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  requireAdmin: vi.fn(),
  getAuthUser: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/infra/db/prisma", () => {
  const prisma = { user: { findUnique: m.findUnique, findFirst: m.findFirst, create: m.create, update: m.update } };
  return { default: prisma, prisma };
});
vi.mock("@/lib/infra/auth/auth", () => ({
  requireAdmin: m.requireAdmin,
  getAuthUser: m.getAuthUser,
  verifyPassword: m.verifyPassword,
  hashPassword: async (p: string) => `hashed:${p}`,
  invalidateAuthUser: vi.fn(),
}));
vi.mock("@/lib/infra/rate-limit", () => ({ rateLimit: () => null, RATE_LIMITS: { auth: {} } }));

import { POST as createUser } from "@/app/api/admin/users/route";
import { POST as changePassword } from "@/app/api/auth/onboarding/change-password/route";
import { POST as acceptTerms } from "@/app/api/auth/onboarding/accept-terms/route";
import { TERMS_VERSION } from "@/lib/domain/users/onboarding";

const post = (path: string, body: unknown) =>
  new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body) });

const admin = { id: "admin-1", role: "ADMIN" };
const base = { email: "a@b.c", password: "starting-pass", roles: ["SPEAKER"], speaksLanguages: ["kri"] };

describe("POST /api/admin/users (admin-only account creation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue(admin);
    m.findUnique.mockResolvedValue(null);
    m.findFirst.mockResolvedValue(null);
    m.create.mockImplementation(async ({ data }: any) => ({ id: "new", ...data }));
  });

  it("refuses non-admins", async () => {
    m.requireAdmin.mockResolvedValue(null);
    expect((await createUser(post("/api/admin/users", { ...base, ageVerified: true }))).status).toBe(403);
  });

  it("refuses a contributor account without the 18+ attestation", async () => {
    const res = await createUser(post("/api/admin/users", base));
    expect(res.status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("records the attestation, roles, languages and forces a password change", async () => {
    const res = await createUser(
      post("/api/admin/users", { ...base, roles: ["SPEAKER", "TRANSCRIBER"], writesLanguages: ["kri"], ageVerified: true })
    );
    expect(res.status).toBe(201);
    const data = m.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      role: "SPEAKER",
      roles: ["SPEAKER", "TRANSCRIBER"],
      speaksLanguages: ["kri"],
      writesLanguages: ["kri"],
      mustChangePassword: true,
      ageVerifiedById: "admin-1",
    });
    expect(data.ageVerifiedAt).toBeInstanceOf(Date);
  });

  it("creates a reviewer without an age attestation", async () => {
    const res = await createUser(post("/api/admin/users", { ...base, roles: ["REVIEWER"] }));
    expect(res.status).toBe(201);
    expect(m.create.mock.calls[0][0].data.ageVerifiedAt).toBeUndefined();
  });

  it("rejects a short starting password", async () => {
    const res = await createUser(post("/api/admin/users", { ...base, password: "short", ageVerified: true }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/onboarding/change-password", () => {
  const user = { id: "u1", passwordHash: "h", role: "SPEAKER", roles: ["SPEAKER"], mustChangePassword: true };
  beforeEach(() => {
    vi.clearAllMocks();
    m.getAuthUser.mockResolvedValue(user);
  });

  it("rejects a wrong current password", async () => {
    m.verifyPassword.mockResolvedValue(false);
    const res = await changePassword(post("/api/auth/onboarding/change-password", { currentPassword: "x", newPassword: "new-password-1" }));
    expect(res.status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("rejects reusing the admin-set password", async () => {
    m.verifyPassword.mockResolvedValue(true);
    const res = await changePassword(post("/api/auth/onboarding/change-password", { currentPassword: "same-pass", newPassword: "same-pass" }));
    expect(res.status).toBe(400);
  });

  it("stores the new password and clears mustChangePassword", async () => {
    m.verifyPassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await changePassword(post("/api/auth/onboarding/change-password", { currentPassword: "given", newPassword: "my-own-pass" }));
    expect(res.status).toBe(200);
    expect(m.update.mock.calls[0][0].data).toEqual({ passwordHash: "hashed:my-own-pass", mustChangePassword: false });
  });
});

describe("POST /api/auth/onboarding/accept-terms", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires the password step first", async () => {
    m.getAuthUser.mockResolvedValue({ id: "u1", role: "SPEAKER", roles: ["SPEAKER"], mustChangePassword: true });
    const res = await acceptTerms(post("/api/auth/onboarding/accept-terms", { accepted: true, version: TERMS_VERSION }));
    expect(res.status).toBe(409);
  });

  it("rejects a stale terms version", async () => {
    m.getAuthUser.mockResolvedValue({ id: "u1", role: "SPEAKER", roles: ["SPEAKER"], mustChangePassword: false });
    const res = await acceptTerms(post("/api/auth/onboarding/accept-terms", { accepted: true, version: "old" }));
    expect(res.status).toBe(409);
  });

  it("records when and which version was accepted", async () => {
    m.getAuthUser.mockResolvedValue({ id: "u1", role: "TRANSCRIBER", roles: ["TRANSCRIBER"], mustChangePassword: false });
    const res = await acceptTerms(post("/api/auth/onboarding/accept-terms", { accepted: true, version: TERMS_VERSION }));
    expect(res.status).toBe(200);
    const data = m.update.mock.calls[0][0].data;
    expect(data.termsVersion).toBe(TERMS_VERSION);
    expect(data.termsAcceptedAt).toBeInstanceOf(Date);
  });
});

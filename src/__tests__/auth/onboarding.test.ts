import { describe, it, expect } from "vitest";
import {
  TERMS_VERSION,
  pendingOnboardingSteps,
  isContributor,
  isOnboardingExemptPath,
} from "@/lib/domain/users/onboarding";

describe("pendingOnboardingSteps", () => {
  it("asks an admin-created speaker to change password, then accept terms", () => {
    expect(
      pendingOnboardingSteps({ role: "SPEAKER", roles: ["SPEAKER"], mustChangePassword: true, termsVersion: null })
    ).toEqual(["CHANGE_PASSWORD", "ACCEPT_TERMS"]);
  });

  it("asks an existing self-registered transcriber only to accept terms", () => {
    expect(
      pendingOnboardingSteps({ role: "TRANSCRIBER", roles: [], mustChangePassword: false, termsVersion: null })
    ).toEqual(["ACCEPT_TERMS"]);
  });

  it("asks admins and reviewers only to change password, never to accept terms", () => {
    expect(pendingOnboardingSteps({ role: "ADMIN", roles: ["ADMIN"], mustChangePassword: true })).toEqual([
      "CHANGE_PASSWORD",
    ]);
    expect(pendingOnboardingSteps({ role: "REVIEWER", roles: ["REVIEWER"], mustChangePassword: false })).toEqual([]);
  });

  it("treats a reviewer who is also a speaker as a contributor", () => {
    expect(isContributor({ role: "REVIEWER", roles: ["REVIEWER", "SPEAKER"] })).toBe(true);
  });

  it("is complete once the current terms version is accepted", () => {
    expect(
      pendingOnboardingSteps({ role: "SPEAKER", roles: ["SPEAKER"], mustChangePassword: false, termsVersion: TERMS_VERSION })
    ).toEqual([]);
  });

  it("asks again after the terms version is bumped", () => {
    expect(
      pendingOnboardingSteps({ role: "SPEAKER", roles: ["SPEAKER"], mustChangePassword: false, termsVersion: "2000-01-01" })
    ).toEqual(["ACCEPT_TERMS"]);
  });
});

describe("isOnboardingExemptPath", () => {
  it("allows auth and account-data endpoints only", () => {
    expect(isOnboardingExemptPath("/api/auth/me")).toBe(true);
    expect(isOnboardingExemptPath("/api/auth/onboarding/accept-terms")).toBe(true);
    expect(isOnboardingExemptPath("/api/v2/account/export")).toBe(true);
    expect(isOnboardingExemptPath("/api/v2/speaker/prompts")).toBe(false);
    expect(isOnboardingExemptPath("/api/admin/users")).toBe(false);
  });
});

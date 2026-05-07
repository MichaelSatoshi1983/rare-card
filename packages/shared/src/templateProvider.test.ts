import { describe, expect, it } from "vitest";
import { createEmptyProfile, createQrPayload, generateEmergencyCard } from ".";

describe("generateEmergencyCard", () => {
  it("generates a card from minimum structured data", () => {
    const profile = createEmptyProfile();
    profile.personal.name = "Test Patient";
    profile.personal.birthDate = "1990-01-02";
    profile.medical.primaryCondition = "罕见病示例";
    profile.emergencyInstructions.criticalWarnings = ["避免使用未确认药物"];

    const card = generateEmergencyCard(profile, { now: new Date("2026-01-01T00:00:00.000Z") });

    expect(card.patientName).toBe("Test Patient");
    expect(card.condition).toBe("罕见病示例");
    expect(card.criticalWarnings).toEqual(["避免使用未确认药物"]);
    expect(card.generatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("uses English labels without translating user-entered medical text", () => {
    const profile = createEmptyProfile();
    profile.cardPreferences.language = "en";
    profile.personal.name = "Alex";
    profile.medical.primaryCondition = "马凡综合征";
    profile.medical.primaryConditionEn = "";

    const card = generateEmergencyCard(profile);

    expect(card.language).toBe("en");
    expect(card.condition).toBe("马凡综合征");
    expect(card.disclaimer).toContain("not medical advice");
  });

  it("limits QR payload to compact emergency fields", () => {
    const profile = createEmptyProfile();
    profile.personal.name = "Alex";
    profile.medical.primaryCondition = "Long QT syndrome";
    profile.emergencyInstructions.specialistName = "Doctor Hidden";

    const card = generateEmergencyCard(profile);
    const payload = JSON.parse(createQrPayload(card));

    expect(payload.dx).toBe("Long QT syndrome");
    expect(JSON.stringify(payload)).not.toContain("Doctor Hidden");
  });
});

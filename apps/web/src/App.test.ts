import { createEmptyProfile } from "@rare-card/shared";
import { describe, expect, it } from "vitest";
import { aiWizardSteps, buildAIIntakeFromProfile, describeAgeFromBirthDate, getWizardSteps, hasAISettingsConfigured, validateStep } from "./App";
import { defaultAISettings } from "./aiProfile";

describe("App wizard helpers", () => {
  it("keeps the AI-assisted wizard on the same profile flow after interface setup", () => {
    expect(aiWizardSteps.map((step) => step.id)).toEqual(["mode", "aiSetup", "identity", "diagnosis", "risk", "emergency", "preview"]);
    expect(getWizardSteps("ai").map((step) => step.id)).toEqual(["mode", "aiSetup", "identity", "diagnosis", "risk", "emergency", "preview"]);
  });

  it("does not block the AI setup step when API settings are missing", () => {
    const result = validateStep("aiSetup", createEmptyProfile(), "ai", defaultAISettings);

    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => warning.field)).toContain("ai.config");
  });

  it("recognizes AI field completion as unavailable until endpoint, model, and key are configured", () => {
    expect(hasAISettingsConfigured(defaultAISettings)).toBe(false);
    expect(hasAISettingsConfigured({ ...defaultAISettings, baseUrl: "https://gateway.example/v1", apiKey: "sk-test" })).toBe(true);
  });

  it("builds emergency AI context only from the current profile", () => {
    const profile = createEmptyProfile();
    profile.personal.name = "测试患者";
    profile.personal.birthDate = "2020-05-08";
    profile.medical.primaryCondition = "测试诊断";
    profile.medical.primaryConditionEn = "Test condition";
    profile.medical.orphaCode = "ORPHA:123";
    profile.medical.diagnosisNotes = "诊断补充";
    profile.medical.allergies = [{ id: "a1", substance: "青霉素", reaction: "皮疹", severity: "severe" }];
    profile.medical.medications = [{ id: "m1", name: "药物A", dosage: "10mg", frequency: "每日一次" }];
    profile.emergencyInstructions.criticalWarnings = ["发热需尽快评估"];
    profile.emergencyInstructions.avoidTreatments = ["避免药物B"];
    profile.emergencyInstructions.preferredProtocol = "先出示医疗卡";
    profile.emergencyInstructions.specialistName = "李医生";
    profile.emergencyInstructions.specialistHospital = "测试医院";
    profile.emergencyInstructions.specialistPhone = "010-12345678";
    profile.emergencyContacts = [{ id: "c1", name: "张三", relationship: "母亲", phone: "13800000000", priority: 1 }];

    const context = buildAIIntakeFromProfile(profile);

    expect(context.patientName).toBe("测试患者");
    expect(context.birthDate).toBe("2020-05-08");
    expect(context.age).toMatch(/\d+岁/);
    expect(context.diagnosis).toContain("测试诊断");
    expect(context.diagnosis).toContain("ORPHA:123");
    expect(context.allergies).toContain("青霉素");
    expect(context.medications).toContain("药物A");
    expect(context.doctorAdvice).toContain("避免药物B");
    expect(context.contacts).toContain("李医生");
    expect(context.contacts).toContain("张三");
  });

  it("calculates a stable age description from birth date", () => {
    expect(describeAgeFromBirthDate("2020-05-08", new Date("2026-05-07T00:00:00"))).toBe("5岁");
    expect(describeAgeFromBirthDate("2026-03-07", new Date("2026-05-07T00:00:00"))).toBe("2个月");
  });
});

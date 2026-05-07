import { createEmptyProfile } from "@rare-card/shared";
import { describe, expect, it } from "vitest";
import { applyEmergencySuggestionToProfile } from "./emergencySuggestion";

describe("emergency suggestion application", () => {
  it("merges non-empty list suggestions and removes duplicates", () => {
    const profile = createEmptyProfile();
    profile.emergencyInstructions.criticalWarnings = ["避免延误急救"];

    const next = applyEmergencySuggestionToProfile(profile, "criticalWarnings", ["避免延误急救", "联系专科医生"]);

    expect(next.emergencyInstructions.criticalWarnings).toEqual(["避免延误急救", "联系专科医生"]);
  });

  it("writes non-empty text suggestions to the target emergency field", () => {
    const profile = createEmptyProfile();
    profile.cardPreferences.verificationStatus = "doctor-confirmed";

    const next = applyEmergencySuggestionToProfile(profile, "preferredProtocol", "到院后先出示急诊医疗卡。");

    expect(next.emergencyInstructions.preferredProtocol).toBe("到院后先出示急诊医疗卡。");
    expect(next.cardPreferences.verificationStatus).toBe("unverified");
  });

  it("does not modify the profile when the suggestion is empty", () => {
    const profile = createEmptyProfile();
    profile.emergencyInstructions.preferredProtocol = "现有说明";

    const next = applyEmergencySuggestionToProfile(profile, "preferredProtocol", "");

    expect(next).toBe(profile);
    expect(next.emergencyInstructions.preferredProtocol).toBe("现有说明");
  });
});

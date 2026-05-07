import type { PatientProfile } from "./types";

export const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;

export function createEmptyProfile(): PatientProfile {
  return {
    personal: {
      name: "",
      birthDate: "",
      bloodType: "unknown",
      primaryLanguage: "zh"
    },
    medical: {
      primaryCondition: "",
      primaryConditionEn: "",
      orphaCode: "",
      icdCode: "",
      diagnosisNotes: "",
      allergies: [{ id: createId(), substance: "", reaction: "", severity: "severe" }],
      medications: [{ id: createId(), name: "", dosage: "", frequency: "" }]
    },
    emergencyInstructions: {
      criticalWarnings: [""],
      preferredProtocol: "",
      avoidTreatments: [""],
      specialistName: "",
      specialistHospital: "",
      specialistPhone: ""
    },
    emergencyContacts: [{ id: createId(), name: "", relationship: "", phone: "", priority: 1 }],
    cardPreferences: {
      language: "zh",
      size: "wallet",
      theme: "clinical",
      includeQrCode: true,
      verificationStatus: "unverified"
    }
  };
}

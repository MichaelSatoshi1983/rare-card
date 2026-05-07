import type { EmergencyCard } from "./types";

export interface QrPayload {
  v: 1;
  name: string;
  dob: string;
  blood: string;
  dx: string;
  warn: string[];
  avoid: string[];
  allergies: string[];
  meds: string[];
  contacts: string[];
  verified: EmergencyCard["verificationStatus"];
}

export function createQrPayload(card: EmergencyCard): string {
  const payload: QrPayload = {
    v: 1,
    name: card.patientName,
    dob: card.birthDate,
    blood: card.bloodType,
    dx: [card.condition, ...card.conditionCodes].filter(Boolean).join(" / "),
    warn: card.criticalWarnings.slice(0, 5),
    avoid: card.avoidTreatments.slice(0, 5),
    allergies: card.allergies.slice(0, 6).map((item) => [item.substance, item.reaction].filter(Boolean).join(": ")),
    meds: card.medications.slice(0, 8).map((item) => [item.name, item.dosage, item.frequency].filter(Boolean).join(" ")),
    contacts: card.contacts.slice(0, 3).map((item) => [item.name, item.relationship, item.phone].filter(Boolean).join(" ")),
    verified: card.verificationStatus
  };

  return JSON.stringify(payload);
}

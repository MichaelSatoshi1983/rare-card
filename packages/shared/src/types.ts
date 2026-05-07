export type BloodType = "unknown" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export type CardLanguage = "zh" | "en";

export type CardSize = "wallet" | "a4" | "lockscreen";

export type VerificationStatus = "unverified" | "patient-confirmed" | "doctor-confirmed";

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  priority: number;
}

export interface Allergy {
  id: string;
  substance: string;
  reaction: string;
  severity: "mild" | "severe" | "life-threatening";
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
}

export interface RareDiseasePreset {
  id: string;
  nameZh: string;
  nameEn: string;
  category: string;
  orphaCode?: string;
  icdCode?: string;
}

export interface PatientProfile {
  personal: {
    name: string;
    birthDate: string;
    bloodType: BloodType;
    primaryLanguage: string;
  };
  medical: {
    primaryCondition: string;
    primaryConditionEn?: string;
    orphaCode?: string;
    icdCode?: string;
    diagnosisNotes?: string;
    allergies: Allergy[];
    medications: Medication[];
  };
  emergencyInstructions: {
    criticalWarnings: string[];
    preferredProtocol: string;
    avoidTreatments: string[];
    specialistName: string;
    specialistHospital: string;
    specialistPhone: string;
  };
  emergencyContacts: EmergencyContact[];
  cardPreferences: {
    language: CardLanguage;
    size: CardSize;
    theme: CardTheme;
    includeQrCode: boolean;
    verificationStatus: VerificationStatus;
  };
}

export type CardTheme = "clinical" | "contrast" | "calm" | "travel";

export interface EmergencyCard {
  id: string;
  generatedAt: string;
  language: CardLanguage;
  size: CardSize;
  theme: CardTheme;
  verificationStatus: VerificationStatus;
  patientName: string;
  birthDate: string;
  bloodType: BloodType;
  condition: string;
  conditionCodes: string[];
  summary: string;
  criticalWarnings: string[];
  avoidTreatments: string[];
  allergies: Array<Pick<Allergy, "substance" | "reaction" | "severity">>;
  medications: Array<Pick<Medication, "name" | "dosage" | "frequency">>;
  preferredProtocol: string;
  specialist: {
    name: string;
    hospital: string;
    phone: string;
  };
  contacts: Array<Pick<EmergencyContact, "name" | "relationship" | "phone">>;
  disclaimer: string;
}

export interface GenerateOptions {
  now?: Date;
}

export interface AIProvider {
  generateEmergencyCard(profile: PatientProfile, options?: GenerateOptions): Promise<EmergencyCard>;
  suggestImprovements(currentCard: EmergencyCard): Promise<Partial<EmergencyCard>>;
  translateCard(card: EmergencyCard, targetLanguage: CardLanguage): Promise<EmergencyCard>;
}

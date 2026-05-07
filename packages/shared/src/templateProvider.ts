import { cardLabels } from "./labels";
import type { AIProvider, CardLanguage, EmergencyCard, GenerateOptions, PatientProfile } from "./types";

const DISCLAIMER: Record<CardLanguage, string> = {
  zh: "本卡片由用户填写信息生成，仅供急救沟通参考，不构成医疗建议。请以患者/医生确认的信息为准。",
  en: "This card is generated from user-entered information for emergency communication only. It is not medical advice. Use patient/doctor-confirmed information."
};

const clean = (value?: string) => value?.trim() ?? "";

const nonEmpty = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);

export function generateEmergencyCard(profile: PatientProfile, options: GenerateOptions = {}): EmergencyCard {
  const language = profile.cardPreferences.language;
  const labels = cardLabels[language];
  const now = options.now ?? new Date();
  const condition =
    language === "en" && clean(profile.medical.primaryConditionEn)
      ? clean(profile.medical.primaryConditionEn)
      : clean(profile.medical.primaryCondition) || labels.rareDisease;
  const conditionCodes = nonEmpty([profile.medical.orphaCode ?? "", profile.medical.icdCode ?? ""]);
  const warnings = nonEmpty(profile.emergencyInstructions.criticalWarnings);
  const avoidTreatments = nonEmpty(profile.emergencyInstructions.avoidTreatments);
  const notes = clean(profile.medical.diagnosisNotes);
  const protocol = clean(profile.emergencyInstructions.preferredProtocol);

  const summaryParts =
    language === "zh"
      ? [
          `${clean(profile.personal.name) || "未填写姓名"}，主要诊断：${condition}。`,
          conditionCodes.length ? `编码：${conditionCodes.join(" / ")}。` : "",
          warnings.length ? `关键警告：${warnings.join("；")}。` : "",
          notes ? `补充说明：${notes}。` : ""
        ]
      : [
          `${clean(profile.personal.name) || "Unnamed patient"}, primary diagnosis: ${condition}.`,
          conditionCodes.length ? `Codes: ${conditionCodes.join(" / ")}.` : "",
          warnings.length ? `Critical warnings: ${warnings.join("; ")}.` : "",
          notes ? `Notes: ${notes}.` : ""
        ];

  return {
    id: `card-${now.getTime()}`,
    generatedAt: now.toISOString(),
    language,
    size: profile.cardPreferences.size,
    theme: profile.cardPreferences.theme,
    verificationStatus: profile.cardPreferences.verificationStatus,
    patientName: clean(profile.personal.name),
    birthDate: clean(profile.personal.birthDate),
    bloodType: profile.personal.bloodType,
    condition,
    conditionCodes,
    summary: summaryParts.filter(Boolean).join(" "),
    criticalWarnings: warnings,
    avoidTreatments,
    allergies: profile.medical.allergies
      .filter((item) => clean(item.substance) || clean(item.reaction))
      .map(({ substance, reaction, severity }) => ({ substance: clean(substance), reaction: clean(reaction), severity })),
    medications: profile.medical.medications
      .filter((item) => clean(item.name) || clean(item.dosage) || clean(item.frequency))
      .map(({ name, dosage, frequency }) => ({ name: clean(name), dosage: clean(dosage), frequency: clean(frequency) })),
    preferredProtocol: protocol,
    specialist: {
      name: clean(profile.emergencyInstructions.specialistName),
      hospital: clean(profile.emergencyInstructions.specialistHospital),
      phone: clean(profile.emergencyInstructions.specialistPhone)
    },
    contacts: profile.emergencyContacts
      .filter((item) => clean(item.name) || clean(item.phone))
      .sort((a, b) => a.priority - b.priority)
      .map(({ name, relationship, phone }) => ({
        name: clean(name),
        relationship: clean(relationship),
        phone: clean(phone)
      })),
    disclaimer: DISCLAIMER[language]
  };
}

export class TemplateAIProvider implements AIProvider {
  async generateEmergencyCard(profile: PatientProfile, options?: GenerateOptions): Promise<EmergencyCard> {
    return generateEmergencyCard(profile, options);
  }

  async suggestImprovements(currentCard: EmergencyCard): Promise<Partial<EmergencyCard>> {
    return {
      criticalWarnings: currentCard.criticalWarnings,
      disclaimer: currentCard.disclaimer
    };
  }

  async translateCard(card: EmergencyCard, targetLanguage: CardLanguage): Promise<EmergencyCard> {
    return {
      ...card,
      language: targetLanguage,
      disclaimer: DISCLAIMER[targetLanguage]
    };
  }
}

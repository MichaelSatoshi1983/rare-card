import type { CardLanguage, VerificationStatus } from "./types";

export const cardLabels: Record<CardLanguage, Record<string, string>> = {
  zh: {
    title: "急诊医疗卡",
    rareDisease: "罕见病/主要诊断",
    patient: "患者",
    birthDate: "出生日期",
    bloodType: "血型",
    criticalWarnings: "关键警告",
    avoidTreatments: "禁忌/避免",
    allergies: "过敏",
    medications: "用药",
    protocol: "急救说明",
    specialist: "专科医生",
    contacts: "紧急联系人",
    verified: "核实状态",
    qr: "扫码查看摘要",
    noKnownAllergies: "未填写过敏信息",
    noMedications: "未填写常用药",
    noWarnings: "未填写关键警告"
  },
  en: {
    title: "Emergency Medical Card",
    rareDisease: "Rare disease / Primary diagnosis",
    patient: "Patient",
    birthDate: "Date of birth",
    bloodType: "Blood type",
    criticalWarnings: "Critical warnings",
    avoidTreatments: "Avoid / contraindications",
    allergies: "Allergies",
    medications: "Medications",
    protocol: "Emergency instructions",
    specialist: "Specialist",
    contacts: "Emergency contacts",
    verified: "Verification",
    qr: "Scan for summary",
    noKnownAllergies: "No allergy information entered",
    noMedications: "No routine medications entered",
    noWarnings: "No critical warnings entered"
  }
};

export const verificationLabels: Record<CardLanguage, Record<VerificationStatus, string>> = {
  zh: {
    unverified: "未核实",
    "patient-confirmed": "患者确认",
    "doctor-confirmed": "医生确认"
  },
  en: {
    unverified: "Unverified",
    "patient-confirmed": "Patient confirmed",
    "doctor-confirmed": "Doctor confirmed"
  }
};

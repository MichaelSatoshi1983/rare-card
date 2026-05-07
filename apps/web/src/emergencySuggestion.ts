import type { PatientProfile } from "@rare-card/shared";

export function applyEmergencySuggestionToProfile(profile: PatientProfile, fieldKey: string, value: string | string[]): PatientProfile {
  if (!hasAIFieldSuggestionValue(value)) return profile;

  if (fieldKey === "criticalWarnings" || fieldKey === "avoidTreatments") {
    const suggested = Array.isArray(value) ? value : splitLooseList(value);
    if (!suggested.length) return profile;
    return markProfileUnverified({
      ...profile,
      emergencyInstructions: {
        ...profile.emergencyInstructions,
        [fieldKey]: mergeStringLists(profile.emergencyInstructions[fieldKey], suggested)
      }
    });
  }

  if (fieldKey === "preferredProtocol" || fieldKey === "specialistName" || fieldKey === "specialistHospital" || fieldKey === "specialistPhone") {
    const nextValue = normalizeTextSuggestion(value);
    if (!nextValue) return profile;
    return markProfileUnverified({
      ...profile,
      emergencyInstructions: {
        ...profile.emergencyInstructions,
        [fieldKey]: nextValue
      }
    });
  }

  const contactMatch = /^contact:([^:]+):(name|relationship|phone)$/.exec(fieldKey);
  if (contactMatch) {
    const [, contactId, contactField] = contactMatch;
    const nextValue = normalizeTextSuggestion(value);
    if (!nextValue) return profile;
    return markProfileUnverified({
      ...profile,
      emergencyContacts: profile.emergencyContacts.map((contact) => (contact.id === contactId ? { ...contact, [contactField]: nextValue } : contact))
    });
  }

  return profile;
}

function markProfileUnverified(profile: PatientProfile): PatientProfile {
  return {
    ...profile,
    cardPreferences: {
      ...profile.cardPreferences,
      verificationStatus: "unverified"
    }
  };
}

export function hasAIFieldSuggestionValue(value: string | string[]) {
  return Array.isArray(value) ? value.some((item) => clean(item)) : Boolean(clean(value));
}

export function formatAIFieldSuggestionValue(value: string | string[]) {
  return Array.isArray(value) ? value.filter((item) => clean(item)).join("\n") : value;
}

function normalizeTextSuggestion(value: string | string[]) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean).join("\n") : clean(value);
}

function mergeStringLists(current: string[], suggested: string[]) {
  const merged = [...current.filter((item) => clean(item)), ...suggested.filter((item) => clean(item))];
  const unique = [...new Set(merged)];
  return unique.length ? unique : [""];
}

function splitLooseList(value: string) {
  return value
    .split(/[\n；;，,、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function clean(value?: string) {
  return value?.trim() ?? "";
}

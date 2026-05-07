import { createEmptyProfile, createId } from "@rare-card/shared";
import type { Allergy, BloodType, CardLanguage, Medication, PatientProfile } from "@rare-card/shared";

export type AISettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  saveApiKey: boolean;
  responseMode: AIResponseMode;
};

export type AIIntake = {
  patientName: string;
  birthDate: string;
  age: string;
  diagnosis: string;
  knownRisks: string;
  allergies: string;
  medications: string;
  doctorAdvice: string;
  contacts: string;
  freeText: string;
  preferredLanguage: CardLanguage;
};

export type AIDraft = {
  profile: PatientProfile;
  reviewNotes: string[];
  source: "json_schema" | "json_object";
};

type ResponseFormatMode = AIDraft["source"];
export type AIResponseMode = "auto" | ResponseFormatMode;

export type EmergencyAIFieldRequest = {
  key: string;
  label: string;
  kind: "text" | "list";
  currentValue: string | string[];
  instruction?: string;
};

export type AIFieldSuggestion = {
  field: string;
  value: string | string[];
  reviewNotes: string[];
};

type EmergencyFieldSpec = {
  fieldType:
    | "criticalWarnings"
    | "avoidTreatments"
    | "preferredProtocol"
    | "specialistName"
    | "specialistHospital"
    | "specialistPhone"
    | "contactName"
    | "contactRelationship"
    | "contactPhone"
    | "unknown";
  outputKind: "text" | "list";
  evidenceScope: string[];
  rules: string[];
  noEvidenceValue: "" | [];
  contactId?: string;
  contactField?: "name" | "relationship" | "phone";
};

export const AI_SETTINGS_STORAGE_KEY = "rare-card-ai-settings-v1";

export const defaultAISettings: AISettings = {
  baseUrl: "",
  apiKey: "",
  model: "gpt-4o-mini",
  saveApiKey: false,
  responseMode: "auto"
};

export const defaultAIIntake: AIIntake = {
  patientName: "",
  birthDate: "",
  age: "",
  diagnosis: "",
  knownRisks: "",
  allergies: "",
  medications: "",
  doctorAdvice: "",
  contacts: "",
  freeText: "",
  preferredLanguage: "zh"
};

const emergencyFieldRuleCatalog: Record<EmergencyFieldSpec["fieldType"], Omit<EmergencyFieldSpec, "contactId" | "contactField">> = {
  criticalWarnings: {
    fieldType: "criticalWarnings",
    outputKind: "list",
    evidenceScope: ["诊断", "已知风险", "过敏", "正在用药", "医生医嘱", "既有关键警告"],
    noEvidenceValue: [],
    rules: [
      "生成 1-5 条急诊现场必须看到的短警告。",
      "只能基于诊断、已知风险、过敏、用药、医生医嘱或既有警告整理；不得添加资料中没有的病情、风险或处置结论。",
      "每条用短句表达，优先写能影响急诊分诊、用药、过敏规避、联系专科医生的内容。",
      "如果现有内容冗长，可以压缩为更清晰的急诊警告；如果没有可靠依据，value 返回 []。"
    ]
  },
  avoidTreatments: {
    fieldType: "avoidTreatments",
    outputKind: "list",
    evidenceScope: ["明确禁忌", "过敏相关避免项", "医生明确交代的避免处置", "既有禁忌/避免"],
    noEvidenceValue: [],
    rules: [
      "只整理资料中明确出现的禁忌、过敏相关避免项、医生明确交代的避免药物/操作/处置。",
      "不要根据诊断泛化推断禁忌，不要为了完整性补齐常见禁忌。",
      "没有明确依据时 value 返回 []，并在 reviewNotes 说明 AI 未找到可靠依据。",
      "每条保持短句，不输出诊疗建议或替代治疗方案。"
    ]
  },
  preferredProtocol: {
    fieldType: "preferredProtocol",
    outputKind: "text",
    evidenceScope: ["年龄或出生日期", "疾病/诊断", "禁忌/避免项", "过敏", "正在用药", "已知风险", "医生医嘱", "既有急救说明"],
    noEvidenceValue: "",
    rules: [
      "根据患者年龄或出生日期、疾病/诊断、禁忌/避免项、正在用药和过敏信息，生成一段短急救说明，适合急诊医生快速阅读。",
      "急救说明应优先覆盖：疑似相关急性发作时需尽快评估处理、已知禁忌或过敏需避免、当前用药和年龄相关限制需纳入医生判断。",
      "只基于资料中已有信息进行组织；不确定的疾病关联、禁忌、用药影响或年龄限制必须标注“需医生核实”。",
      "不要写详细治疗方案、药物剂量、给药时机、诊断结论或超出资料的医学判断。",
      "建议控制在 120 个中文字符以内；没有可靠依据时 value 返回空字符串。"
    ]
  },
  specialistName: {
    fieldType: "specialistName",
    outputKind: "text",
    evidenceScope: ["医生姓名原文", "医嘱或自由文本中明确提到的专科医生"],
    noEvidenceValue: "",
    rules: [
      "只做原文精确提取医生姓名。",
      "不得猜测医生、科室负责人、患者主治医生或联系人身份。",
      "如果资料中有多个医生且无法确认目标专科医生，value 返回空字符串。",
      "不要输出称谓说明之外的额外内容。"
    ]
  },
  specialistHospital: {
    fieldType: "specialistHospital",
    outputKind: "text",
    evidenceScope: ["医院名称原文", "医嘱或自由文本中明确提到的专科医院"],
    noEvidenceValue: "",
    rules: [
      "只做原文精确提取医院名称。",
      "不得根据医生、地区、诊断或科室猜测医院。",
      "如果资料中有多个医院且无法确认目标专科医院，value 返回空字符串。",
      "不要输出地址、科室或备注，除非它们是医院名称原文的一部分。"
    ]
  },
  specialistPhone: {
    fieldType: "specialistPhone",
    outputKind: "text",
    evidenceScope: ["专科医生电话原文", "医院联系电话原文", "医嘱或自由文本中明确标注的专科联系电话"],
    noEvidenceValue: "",
    rules: [
      "只做原文精确提取电话，保留原文中的国家区号、分机号、空格或连字符。",
      "不得生成、补全、格式化或猜测电话号码。",
      "只有电话明确属于专科医生或医院联系电话时才返回；无法确认归属时 value 返回空字符串。",
      "不要把紧急联系人电话写入专科联系电话。"
    ]
  },
  contactName: {
    fieldType: "contactName",
    outputKind: "text",
    evidenceScope: ["联系人原文", "联系人列表", "自由文本中明确标注的紧急联系人"],
    noEvidenceValue: "",
    rules: [
      "只提取当前目标联系人字段对应的姓名。",
      "禁止把多个联系人混写，禁止把医生姓名或医院名称当作联系人姓名。",
      "如果无法确认哪个联系人对应当前字段，value 返回空字符串。",
      "不要猜测姓名或补全缺失字。"
    ]
  },
  contactRelationship: {
    fieldType: "contactRelationship",
    outputKind: "text",
    evidenceScope: ["联系人关系原文", "联系人列表", "自由文本中明确标注的关系"],
    noEvidenceValue: "",
    rules: [
      "只提取当前目标联系人字段对应的关系。",
      "禁止把多个联系人混写，禁止根据姓名、性别、称呼或排序猜测关系。",
      "如果无法确认哪个联系人对应当前字段，value 返回空字符串。",
      "输出应是短关系词，例如“母亲”“配偶”“朋友”。"
    ]
  },
  contactPhone: {
    fieldType: "contactPhone",
    outputKind: "text",
    evidenceScope: ["联系人电话原文", "联系人列表", "自由文本中明确标注的紧急联系人电话"],
    noEvidenceValue: "",
    rules: [
      "只做原文精确提取电话，保留原文中的国家区号、分机号、空格或连字符。",
      "禁止把多个联系人混写，不得生成、补全、格式化或猜测电话号码。",
      "只返回当前目标联系人对应的电话；无法确认哪个电话对应当前联系人时 value 返回空字符串。",
      "不要把专科医生或医院联系电话写入紧急联系人电话。"
    ]
  },
  unknown: {
    fieldType: "unknown",
    outputKind: "text",
    evidenceScope: ["用户输入", "既有资料"],
    noEvidenceValue: "",
    rules: [
      "只根据资料中明确出现的信息补全当前字段。",
      "没有可靠依据时返回空字符串或空数组。",
      "不得编造或猜测。"
    ]
  }
};

const profileDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["profile", "reviewNotes"],
  properties: {
    profile: {
      type: "object",
      additionalProperties: false,
      required: ["personal", "medical", "emergencyInstructions", "emergencyContacts"],
      properties: {
        personal: {
          type: "object",
          additionalProperties: false,
          required: ["name", "birthDate", "bloodType", "primaryLanguage"],
          properties: {
            name: { type: "string" },
            birthDate: { type: "string" },
            bloodType: { type: "string", enum: ["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
            primaryLanguage: { type: "string" }
          }
        },
        medical: {
          type: "object",
          additionalProperties: false,
          required: ["primaryCondition", "primaryConditionEn", "orphaCode", "icdCode", "diagnosisNotes", "allergies", "medications"],
          properties: {
            primaryCondition: { type: "string" },
            primaryConditionEn: { type: "string" },
            orphaCode: { type: "string" },
            icdCode: { type: "string" },
            diagnosisNotes: { type: "string" },
            allergies: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["substance", "reaction", "severity"],
                properties: {
                  substance: { type: "string" },
                  reaction: { type: "string" },
                  severity: { type: "string", enum: ["mild", "severe", "life-threatening"] }
                }
              }
            },
            medications: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "dosage", "frequency"],
                properties: {
                  name: { type: "string" },
                  dosage: { type: "string" },
                  frequency: { type: "string" }
                }
              }
            }
          }
        },
        emergencyInstructions: {
          type: "object",
          additionalProperties: false,
          required: ["criticalWarnings", "preferredProtocol", "avoidTreatments", "specialistName", "specialistHospital", "specialistPhone"],
          properties: {
            criticalWarnings: { type: "array", items: { type: "string" } },
            preferredProtocol: { type: "string" },
            avoidTreatments: { type: "array", items: { type: "string" } },
            specialistName: { type: "string" },
            specialistHospital: { type: "string" },
            specialistPhone: { type: "string" }
          }
        },
        emergencyContacts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "relationship", "phone"],
            properties: {
              name: { type: "string" },
              relationship: { type: "string" },
              phone: { type: "string" }
            }
          }
        }
      }
    },
    reviewNotes: { type: "array", items: { type: "string" } }
  }
};

const profileDraftOutputContract = {
  profile: {
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
      allergies: [{ substance: "", reaction: "", severity: "severe" }],
      medications: [{ name: "", dosage: "", frequency: "" }]
    },
    emergencyInstructions: {
      criticalWarnings: [""],
      preferredProtocol: "",
      avoidTreatments: [""],
      specialistName: "",
      specialistHospital: "",
      specialistPhone: ""
    },
    emergencyContacts: [{ name: "", relationship: "", phone: "" }]
  },
  reviewNotes: [""]
};

export function loadAISettings(): AISettings {
  if (typeof localStorage === "undefined") return defaultAISettings;
  const stored = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
  if (!stored) return defaultAISettings;

  try {
    const parsed = JSON.parse(stored) as Partial<AISettings>;
    return {
      ...defaultAISettings,
      ...parsed,
      apiKey: parsed.saveApiKey ? parsed.apiKey ?? "" : "",
      saveApiKey: Boolean(parsed.saveApiKey),
      responseMode: responseModeValue(parsed.responseMode)
    };
  } catch {
    return defaultAISettings;
  }
}

export function saveAISettings(settings: AISettings) {
  if (typeof localStorage === "undefined") return;
  const persisted: Partial<AISettings> = {
    baseUrl: settings.baseUrl,
    model: settings.model,
    saveApiKey: settings.saveApiKey,
    responseMode: settings.responseMode
  };
  if (settings.saveApiKey) persisted.apiKey = settings.apiKey;
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(persisted));
}

export async function generateProfileDraftWithOpenAICompatibleApi(settings: AISettings, intake: AIIntake, currentProfile: PatientProfile): Promise<AIDraft> {
  const primaryMode = resolveResponseFormatMode(settings);
  try {
    return await requestDraft(settings, intake, currentProfile, primaryMode);
  } catch (error) {
    if (primaryMode !== "json_schema" || !isStructuredOutputUnsupported(error)) throw new Error(classifyAIError(error));
    try {
      return await requestDraft(settings, intake, currentProfile, "json_object");
    } catch (fallbackError) {
      throw new Error(classifyAIError(fallbackError));
    }
  }
}

export async function generateEmergencyFieldSuggestion(
  settings: AISettings,
  context: { profile: PatientProfile; intake: AIIntake },
  field: EmergencyAIFieldRequest
): Promise<AIFieldSuggestion> {
  const endpoint = getResponsesEndpoint(settings.baseUrl);
  const headers = buildAIHeaders(settings);
  const fieldSpec = resolveEmergencyFieldSpec(field);
  const body = buildResponsesRequestBody(
    settings,
    [
      "你是罕见病急诊医疗卡的字段级补全助手。",
      "只为用户指定的一个急救核实字段生成草稿建议。",
      "必须使用请求中的 fieldRules 作为主规则；targetField.legacyInstruction 仅是旧版 UI 提示，不得覆盖字段专属规则。",
      "不得编造诊断、医生姓名、医院、电话号码、联系人或已核实结论；不确定时返回空值，并把原因写入 reviewNotes。",
      "输出必须是唯一 JSON 对象，格式为 {\"field\":\"字段 key\", \"value\": 字符串或字符串数组, \"reviewNotes\": 字符串数组 }。"
    ].join("\n"),
    JSON.stringify(
      {
        task: "为急救核实页的单个字段生成字段专属补全建议。",
        outputRules: [
          "只返回 field、value、reviewNotes 三个顶层字段。",
          "field 必须等于 targetField.key。",
          fieldSpec.outputKind === "list" ? "value 必须是字符串数组。" : "value 必须是字符串。",
          "不要返回整张 profile。",
          "如果现有内容已经可用，可以基于现有内容进行更清晰的整理；如果没有可靠依据，返回 fieldRules.noEvidenceValue。",
          "返回空值时，reviewNotes 必须用一句话说明 AI 未找到可靠依据。"
        ],
        targetField: {
          key: field.key,
          label: field.label,
          kind: field.kind,
          currentValue: field.currentValue,
          legacyInstruction: field.instruction ?? ""
        },
        fieldRules: {
          fieldType: fieldSpec.fieldType,
          outputKind: fieldSpec.outputKind,
          evidenceScope: fieldSpec.evidenceScope,
          rules: fieldSpec.rules,
          noEvidenceValue: fieldSpec.noEvidenceValue,
          lengthLimits: getEmergencyFieldLengthLimits(fieldSpec),
          contactField: fieldSpec.contactField ?? null
        },
        intake: context.intake,
        profileContext: {
          personal: context.profile.personal,
          medical: context.profile.medical,
          emergencyInstructions: context.profile.emergencyInstructions,
          emergencyContacts: context.profile.emergencyContacts
        },
        targetContact: fieldSpec.contactId
          ? context.profile.emergencyContacts.find((contact) => contact.id === fieldSpec.contactId) ?? { id: fieldSpec.contactId, name: "", relationship: "", phone: "" }
          : null,
        safetyBoundary: {
          allowedSources: ["intake", "profileContext", "targetField.currentValue"],
          emptyValueMeans: "没有足够依据，不修改表单。",
          forbidden: ["猜测电话", "补全未知医生或医院", "合并多个联系人", "根据诊断泛化禁忌", "输出治疗方案"]
        }
      },
      null,
      2
    ),
    "json_object"
  );

  try {
    logAIRequest(`generate field suggestion (${field.key})`, endpoint, headers, body);
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const { rawBody, payload } = await readAIResponse(response);
    logAIResponse(`generate field suggestion (${field.key})`, response, rawBody, payload);

    if (!response.ok) {
      throw new AIRequestError(getApiErrorMessage(payload) || `API 请求失败：HTTP ${response.status}`, response.status);
    }

    const content = extractResponsesText(payload);
    if (!content) throw new Error("API 响应中没有可解析的内容。");
    return normalizeAIFieldSuggestionPayload(parseJsonObject(content), field);
  } catch (error) {
    logAIError(`generate field suggestion (${field.key})`, error);
    throw new Error(classifyAIError(error));
  }
}

function resolveEmergencyFieldSpec(field: EmergencyAIFieldRequest): EmergencyFieldSpec {
  const contactMatch = /^contact:([^:]+):(name|relationship|phone)$/.exec(field.key);
  if (contactMatch) {
    const contactId = contactMatch[1];
    const contactField = contactMatch[2] as "name" | "relationship" | "phone";
    const fieldType = contactField === "name" ? "contactName" : contactField === "relationship" ? "contactRelationship" : "contactPhone";
    return {
      ...emergencyFieldRuleCatalog[fieldType],
      contactId,
      contactField
    };
  }

  if (field.key === "criticalWarnings") return emergencyFieldRuleCatalog.criticalWarnings;
  if (field.key === "avoidTreatments") return emergencyFieldRuleCatalog.avoidTreatments;
  if (field.key === "preferredProtocol") return emergencyFieldRuleCatalog.preferredProtocol;
  if (field.key === "specialistName") return emergencyFieldRuleCatalog.specialistName;
  if (field.key === "specialistHospital") return emergencyFieldRuleCatalog.specialistHospital;
  if (field.key === "specialistPhone") return emergencyFieldRuleCatalog.specialistPhone;

  return {
    ...emergencyFieldRuleCatalog.unknown,
    outputKind: field.kind
  };
}

function getEmergencyFieldLengthLimits(fieldSpec: EmergencyFieldSpec) {
  if (fieldSpec.fieldType === "criticalWarnings") return "1-5 条；每条建议 26 个中文字符以内。";
  if (fieldSpec.fieldType === "avoidTreatments") return "0-N 条；每条建议 30 个中文字符以内。";
  if (fieldSpec.fieldType === "preferredProtocol") return "建议 120 个中文字符以内。";
  if (fieldSpec.fieldType === "specialistName" || fieldSpec.fieldType === "specialistHospital") return "只返回一个原文片段。";
  if (fieldSpec.fieldType === "specialistPhone" || fieldSpec.fieldType === "contactPhone") return "只返回一个原文电话号码。";
  if (fieldSpec.fieldType === "contactName" || fieldSpec.fieldType === "contactRelationship") return "只返回当前联系人字段的一个原文值。";
  return "保持简短。";
}

export function getResponsesEndpoint(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("请填写 API Base URL。");
  if (trimmed.endsWith("/responses")) return trimmed;
  if (trimmed.endsWith("/chat/completions")) return trimmed.replace(/\/chat\/completions$/, "/responses");
  return `${trimmed}/responses`;
}

export function resolveResponseFormatMode(settings: AISettings): ResponseFormatMode {
  if (settings.responseMode === "json_schema" || settings.responseMode === "json_object") return settings.responseMode;
  return isOfficialOpenAIBaseUrl(settings.baseUrl) ? "json_schema" : "json_object";
}

export async function testOpenAICompatibleConnection(settings: AISettings): Promise<string> {
  const endpoint = getResponsesEndpoint(settings.baseUrl);
  const body = buildResponsesRequestBody(settings, "Return a small json object only.", "Return json: {\"ok\": true}", "json_object");
  const headers = buildAIHeaders(settings);

  try {
    logAIRequest("test connection", endpoint, headers, body);
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const { rawBody, payload } = await readAIResponse(response);
    logAIResponse("test connection", response, rawBody, payload);

    if (!response.ok) {
      throw new AIRequestError(getApiErrorMessage(payload) || `API 请求失败：HTTP ${response.status}`, response.status);
    }

    return "连接测试成功：API 地址、模型和 Key 可以完成一次最小请求。";
  } catch (error) {
    logAIError("test connection", error);
    throw new Error(classifyAIError(error));
  }
}

export function classifyAIError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (error instanceof AIRequestError) {
    if (error.status === 401 || error.status === 403) return "API 鉴权失败：请检查 API Key、模型权限或账户额度。";
    if (error.status === 404) return "API 地址不可用：请确认 Base URL 包含 /v1，最终路径应为 /responses。";
    if (error.status === 400 || error.status === 422) return `API 参数不兼容：请检查模型名、响应格式策略或服务商兼容性。原始错误：${message}`;
    if (error.status >= 500) return `API 服务端错误：服务商返回 HTTP ${error.status}，请稍后重试或检查代理服务。`;
  }

  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("connection") || lower.includes("reset")) {
    return "网络请求失败：请检查 API 服务是否可达、浏览器 CORS 是否允许、Base URL 是否填写到 /v1。浏览器扩展的 content.js 报错通常不是本应用代码。";
  }

  return message || "请求失败，请检查 API 设置。";
}

async function requestDraft(settings: AISettings, intake: AIIntake, currentProfile: PatientProfile, mode: ResponseFormatMode): Promise<AIDraft> {
  const endpoint = getResponsesEndpoint(settings.baseUrl);
  const headers = buildAIHeaders(settings);
  const body = buildResponsesRequestBody(
    settings,
    "你是罕见病急诊医疗卡资料整理助手。只根据用户提供的信息生成急救沟通草稿，不得编造诊断、药物、电话、医生姓名或已核实结论。可以把明显需要医生确认的内容写入 reviewNotes 或诊断/急救说明里的“需核实”表述。输出必须是唯一 JSON 对象；顶层必须包含 profile 对象和 reviewNotes 数组。",
    JSON.stringify(
      {
        task: "根据简化采集信息生成 PatientProfile 草稿。空缺字段用空字符串或空数组，不要虚构。",
        outputContract: profileDraftOutputContract,
        outputRules: [
          "必须严格返回 {\"profile\": {...}, \"reviewNotes\": [...]}，不要把 profile 改名为 patientProfile、card 或 data。",
          "profile.personal、profile.medical、profile.emergencyInstructions、profile.emergencyContacts 都必须存在。",
          "数组缺失时返回 []；字符串缺失时返回 \"\"；血型未知时返回 \"unknown\"。"
        ],
        intake,
        existingCardPreferences: currentProfile.cardPreferences,
        existingProfileSummary: {
          name: currentProfile.personal.name,
          primaryCondition: currentProfile.medical.primaryCondition,
          criticalWarnings: currentProfile.emergencyInstructions.criticalWarnings,
          specialistPhone: currentProfile.emergencyInstructions.specialistPhone,
          contactPhones: currentProfile.emergencyContacts.map((contact) => contact.phone).filter(Boolean)
        }
      },
      null,
      2
    ),
    mode
  );

  logAIRequest(`generate draft (${mode})`, endpoint, headers, body);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch (error) {
    logAIError(`generate draft (${mode})`, error);
    throw error;
  }

  const { rawBody, payload } = await readAIResponse(response);
  logAIResponse(`generate draft (${mode})`, response, rawBody, payload);

  if (!response.ok) {
    throw new AIRequestError(getApiErrorMessage(payload) || `API 请求失败：HTTP ${response.status}`, response.status);
  }

  const content = extractResponsesText(payload);
  if (!content) throw new Error("API 响应中没有可解析的内容。");
  return normalizeAIDraftPayload(parseJsonObject(content), currentProfile, mode);
}

function buildAIHeaders(settings: AISettings) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${settings.apiKey.trim()}`
  };
}

async function readAIResponse(response: Response) {
  const rawBody = await response.text().catch((error) => {
    logAIError("read response body", error);
    return "";
  });
  return {
    rawBody,
    payload: parseJsonOrNull(rawBody)
  };
}

function logAIRequest(label: string, endpoint: string, headers: Record<string, string>, body: unknown) {
  console.groupCollapsed(`[RareCard] request: ${label}`);
  console.log("url", endpoint);
  console.log("method", "POST");
  console.log("headers", redactHeaders(headers));
  console.log("body", body);
  console.groupEnd();
}

function logAIResponse(label: string, response: Response, rawBody: string, payload: unknown) {
  console.groupCollapsed(`[RareCard] response: ${label}`);
  console.log("status", response.status, response.statusText);
  console.log("ok", response.ok);
  console.log("url", response.url);
  console.log("headers", Object.fromEntries(response.headers.entries()));
  console.log("rawBody", rawBody);
  console.log("json", payload);
  console.groupEnd();
}

function logAIError(label: string, error: unknown) {
  console.groupCollapsed(`[RareCard] error: ${label}`);
  console.error(error);
  console.groupEnd();
}

function redactHeaders(headers: Record<string, string>) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, key.toLowerCase() === "authorization" ? redactBearerToken(value) : value]));
}

function redactBearerToken(value: string) {
  const token = value.replace(/^Bearer\s+/i, "");
  if (!token) return "Bearer <empty>";
  return `Bearer ${token.slice(0, 7)}...${token.slice(-4)}`;
}

function parseJsonOrNull(value: string) {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function buildResponsesRequestBody(settings: AISettings, developerPrompt: string, userPrompt: string, mode: ResponseFormatMode) {
  const format =
    mode === "json_schema"
      ? {
          type: "json_schema",
          name: "rare_emergency_profile_draft",
          strict: true,
          schema: profileDraftSchema
        }
      : { type: "json_object" };

  return {
    model: settings.model.trim(),
    input: [
      {
        role: "developer",
        content: developerPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    text: { format }
  };
}

function normalizeAIDraftPayload(value: unknown, currentProfile: PatientProfile, source: ResponseFormatMode): AIDraft {
  const root = asRecord(unwrapDraftPayload(value), "返回内容不是 JSON 对象。");
  const profileCandidate = findProfileCandidate(root) ?? coerceLooseProfile(root);
  const draftProfile = asRecord(profileCandidate, "返回内容缺少 profile 对象。");
  const personal = asRecord(draftProfile.personal, "返回内容缺少 personal 对象。");
  const medical = asRecord(draftProfile.medical, "返回内容缺少 medical 对象。");
  const emergencyInstructions = asRecord(draftProfile.emergencyInstructions, "返回内容缺少 emergencyInstructions 对象。");

  const base = createEmptyProfile();
  const profile: PatientProfile = {
    ...base,
    personal: {
      name: stringValue(personal.name),
      birthDate: stringValue(personal.birthDate),
      bloodType: bloodTypeValue(personal.bloodType),
      primaryLanguage: stringValue(personal.primaryLanguage) || currentProfile.personal.primaryLanguage || "zh"
    },
    medical: {
      primaryCondition: stringValue(medical.primaryCondition),
      primaryConditionEn: stringValue(medical.primaryConditionEn),
      orphaCode: stringValue(medical.orphaCode),
      icdCode: stringValue(medical.icdCode),
      diagnosisNotes: stringValue(medical.diagnosisNotes),
      allergies: arrayValue(medical.allergies).map(normalizeAllergy).filter((item) => item.substance || item.reaction),
      medications: arrayValue(medical.medications).map(normalizeMedication).filter((item) => item.name || item.dosage || item.frequency)
    },
    emergencyInstructions: {
      criticalWarnings: stringArray(emergencyInstructions.criticalWarnings),
      preferredProtocol: stringValue(emergencyInstructions.preferredProtocol),
      avoidTreatments: stringArray(emergencyInstructions.avoidTreatments),
      specialistName: stringValue(emergencyInstructions.specialistName),
      specialistHospital: stringValue(emergencyInstructions.specialistHospital),
      specialistPhone: stringValue(emergencyInstructions.specialistPhone)
    },
    emergencyContacts: arrayValue(draftProfile.emergencyContacts)
      .map((item, index) => normalizeContact(item, index))
      .filter((contact) => contact.name || contact.phone),
    cardPreferences: {
      ...currentProfile.cardPreferences,
      verificationStatus: "unverified"
    }
  };

  const reviewNotes = stringArray(root.reviewNotes ?? root.review_notes ?? root.notes);
  if (!profile.emergencyInstructions.criticalWarnings.length) reviewNotes.push("未生成关键警告，请补充并核实。");
  if (!profile.emergencyInstructions.specialistPhone && !profile.emergencyContacts.some((contact) => contact.phone)) {
    reviewNotes.push("未找到紧急联系人或专科医生电话，请补充。");
  }

  return { profile, reviewNotes: [...new Set(reviewNotes)], source };
}

function normalizeAIFieldSuggestionPayload(payload: unknown, field: EmergencyAIFieldRequest): AIFieldSuggestion {
  const root = asRecord(unwrapFieldSuggestionPayload(payload), "返回内容不是 JSON 对象。");
  const rawValue = root.value ?? root.suggestion ?? root.result ?? root[field.key];
  const suggestionValue =
    field.kind === "list"
      ? looseStringArray(rawValue)
      : Array.isArray(rawValue)
        ? rawValue.map(stringValue).filter(Boolean).join("\n")
        : stringValue(rawValue);

  return {
    field: stringValue(root.field) || field.key,
    value: suggestionValue,
    reviewNotes: stringArray(root.reviewNotes ?? root.review_notes ?? root.notes)
  };
}

function unwrapFieldSuggestionPayload(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return current;
    const record = current as Record<string, unknown>;
    if ("value" in record || "suggestion" in record || "result" in record) return current;
    const key = ["data", "payload", "fieldSuggestion", "field_suggestion", "draft"].find((item) => record[item] && typeof record[item] === "object" && !Array.isArray(record[item]));
    if (!key) return current;
    current = record[key];
  }
  return current;
}

function unwrapDraftPayload(value: unknown): unknown {
  let current = value;
  const wrapperKeys = ["profile", "patientProfile", "patient_profile", "profileDraft", "profile_draft", "draft", "data", "result", "payload"];

  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return current;
    const record = current as Record<string, unknown>;
    if (findProfileCandidate(record)) return record;

    const nextKey = wrapperKeys.find((key) => record[key] && typeof record[key] === "object" && !Array.isArray(record[key]));
    if (!nextKey) return current;
    current = record[nextKey];
  }

  return current;
}

function looksLikeProfile(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Boolean(record.personal && record.medical && record.emergencyInstructions);
}

function findProfileCandidate(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return undefined;
  if (looksLikeProfile(value)) return value;

  const record = value as Record<string, unknown>;
  const directKeys = ["profile", "patientProfile", "patient_profile", "profileDraft", "profile_draft"];
  for (const key of directKeys) {
    const direct = record[key];
    if (looksLikeProfile(direct)) return direct;
  }

  for (const key of ["draft", "data", "result", "payload", "card", "medicalCard", "medical_card"]) {
    const nested = findProfileCandidate(record[key], depth + 1);
    if (nested) return nested;
  }

  return undefined;
}

function coerceLooseProfile(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const root = value as Record<string, unknown>;
  const personalSource = recordValue(root.personal) ?? recordValue(root.patient) ?? recordValue(root.patientInfo) ?? recordValue(root.patient_info) ?? recordValue(root.identity) ?? {};
  const medicalSource = recordValue(root.medical) ?? recordValue(root.diagnosis) ?? recordValue(root.condition) ?? {};
  const emergencySource =
    recordValue(root.emergencyInstructions) ?? recordValue(root.emergency_instructions) ?? recordValue(root.emergency) ?? recordValue(root.risk) ?? recordValue(root.risks) ?? {};

  const name = firstString(personalSource.name, root.patientName, root.patient_name, root.name);
  const primaryCondition = firstString(medicalSource.primaryCondition, medicalSource.primary_condition, medicalSource.diagnosis, root.primaryCondition, root.primary_condition, root.diagnosis, root.condition);
  const criticalWarnings = looseStringArray(
    emergencySource.criticalWarnings ??
      emergencySource.critical_warnings ??
      emergencySource.warnings ??
      root.criticalWarnings ??
      root.critical_warnings ??
      root.knownRisks ??
      root.known_risks ??
      root.warnings
  );

  if (!name && !primaryCondition && !criticalWarnings.length) return undefined;

  return {
    personal: {
      name,
      birthDate: firstString(personalSource.birthDate, personalSource.birth_date, root.birthDate, root.birth_date),
      bloodType: firstString(personalSource.bloodType, personalSource.blood_type, root.bloodType, root.blood_type) || "unknown",
      primaryLanguage: firstString(personalSource.primaryLanguage, personalSource.primary_language, root.primaryLanguage, root.primary_language) || "zh"
    },
    medical: {
      primaryCondition,
      primaryConditionEn: firstString(medicalSource.primaryConditionEn, medicalSource.primary_condition_en, medicalSource.diagnosisEn, medicalSource.diagnosis_en, root.primaryConditionEn),
      orphaCode: firstString(medicalSource.orphaCode, medicalSource.orpha_code, root.orphaCode),
      icdCode: firstString(medicalSource.icdCode, medicalSource.icd_code, root.icdCode),
      diagnosisNotes: firstString(medicalSource.diagnosisNotes, medicalSource.diagnosis_notes, root.diagnosisNotes, root.notes),
      allergies: arrayValue(medicalSource.allergies ?? root.allergies),
      medications: arrayValue(medicalSource.medications ?? root.medications)
    },
    emergencyInstructions: {
      criticalWarnings,
      preferredProtocol: firstString(emergencySource.preferredProtocol, emergencySource.preferred_protocol, emergencySource.protocol, root.preferredProtocol, root.protocol),
      avoidTreatments: looseStringArray(emergencySource.avoidTreatments ?? emergencySource.avoid_treatments ?? root.avoidTreatments ?? root.avoid_treatments),
      specialistName: firstString(emergencySource.specialistName, emergencySource.specialist_name, root.specialistName),
      specialistHospital: firstString(emergencySource.specialistHospital, emergencySource.specialist_hospital, root.specialistHospital),
      specialistPhone: firstString(emergencySource.specialistPhone, emergencySource.specialist_phone, root.specialistPhone, root.phone)
    },
    emergencyContacts: arrayValue(root.emergencyContacts ?? root.emergency_contacts ?? root.contacts)
  };
}

function normalizeAllergy(value: unknown): Allergy {
  const item = asRecord(value, "过敏条目不是对象。");
  return {
    id: createId(),
    substance: stringValue(item.substance),
    reaction: stringValue(item.reaction),
    severity: allergySeverityValue(item.severity)
  };
}

function normalizeMedication(value: unknown): Medication {
  const item = asRecord(value, "用药条目不是对象。");
  return {
    id: createId(),
    name: stringValue(item.name),
    dosage: stringValue(item.dosage),
    frequency: stringValue(item.frequency)
  };
}

function normalizeContact(value: unknown, index: number) {
  const item = asRecord(value, "联系人条目不是对象。");
  return {
    id: createId(),
    name: stringValue(item.name),
    relationship: stringValue(item.relationship),
    phone: stringValue(item.phone),
    priority: index + 1
  };
}

export function extractResponsesText(value: unknown) {
  const root = asRecord(value, "API 响应不是对象。");
  if (typeof root.output_text === "string") return root.output_text;

  return arrayValue(root.output)
    .flatMap((item) => {
      const outputItem = typeof item === "object" && item ? (item as Record<string, unknown>) : {};
      return arrayValue(outputItem.content);
    })
    .map((part) => {
      const record = typeof part === "object" && part ? (part as Record<string, unknown>) : {};
      if (typeof record.text === "string") return record.text;
      if (typeof record.content === "string") return record.content;
      return "";
    })
    .join("");
}

function parseJsonObject(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    throw new Error("返回内容不是有效 JSON。");
  }
}

function getApiErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string") {
    return (error as Record<string, string>).message;
  }
  if (typeof record.message === "string") return record.message;
  return "";
}

function isStructuredOutputUnsupported(error: unknown) {
  if (!(error instanceof AIRequestError)) return false;
  const message = error.message.toLowerCase();
  return (error.status === 400 || error.status === 422) && (message.includes("text.format") || message.includes("json_schema") || message.includes("schema"));
}

function isOfficialOpenAIBaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname === "api.openai.com";
  } catch {
    return false;
  }
}

function responseModeValue(value: unknown): AIResponseMode {
  return value === "json_schema" || value === "json_object" || value === "auto" ? value : "auto";
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = stringValue(value);
    if (text) return text;
  }
  return "";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return arrayValue(value).map(stringValue).filter(Boolean);
}

function looseStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean);
  const text = stringValue(value);
  return text ? splitLooseList(text) : [];
}

function splitLooseList(value: string) {
  return value
    .split(/\n|[;；。]|(?:^|\s)[-•]\s/g)
    .map((item) => item.replace(/^[\s,，、]+|[\s,，、]+$/g, ""))
    .filter(Boolean);
}

function bloodTypeValue(value: unknown): BloodType {
  const allowed: BloodType[] = ["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  return allowed.includes(value as BloodType) ? (value as BloodType) : "unknown";
}

function allergySeverityValue(value: unknown): Allergy["severity"] {
  return value === "mild" || value === "severe" || value === "life-threatening" ? value : "severe";
}

class AIRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

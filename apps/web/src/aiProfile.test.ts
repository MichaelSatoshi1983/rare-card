import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  AI_SETTINGS_STORAGE_KEY,
  buildResponsesRequestBody,
  classifyAIError,
  defaultAISettings,
  extractResponsesText,
  generateEmergencyFieldSuggestion,
  generateProfileDraftWithOpenAICompatibleApi,
  getResponsesEndpoint,
  loadAISettings,
  resolveResponseFormatMode,
  saveAISettings
} from "./aiProfile";
import { createEmptyProfile } from "@rare-card/shared";

describe("aiProfile helpers", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear()
      }
    });
  });

  it("normalizes OpenAI-compatible Responses URLs", () => {
    expect(getResponsesEndpoint("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1/responses");
    expect(getResponsesEndpoint("https://proxy.example/v1/responses")).toBe("https://proxy.example/v1/responses");
    expect(getResponsesEndpoint("https://proxy.example/v1/chat/completions")).toBe("https://proxy.example/v1/responses");
  });

  it("only persists the API key when the user opts in", () => {
    saveAISettings({ ...defaultAISettings, apiKey: "sk-test", saveApiKey: false });
    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).not.toContain("sk-test");
    expect(loadAISettings().apiKey).toBe("");

    saveAISettings({ ...defaultAISettings, apiKey: "sk-test", saveApiKey: true });
    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toContain("sk-test");
    expect(loadAISettings().apiKey).toBe("sk-test");
  });

  it("persists response mode with AI settings", () => {
    saveAISettings({ ...defaultAISettings, responseMode: "json_object" });
    expect(loadAISettings().responseMode).toBe("json_object");
  });

  it("uses json_object by default for custom OpenAI-compatible gateways", () => {
    expect(resolveResponseFormatMode({ ...defaultAISettings, baseUrl: "https://api.openai.com/v1", responseMode: "auto" })).toBe("json_schema");
    expect(resolveResponseFormatMode({ ...defaultAISettings, baseUrl: "https://ai.example/v1", responseMode: "auto" })).toBe("json_object");
  });

  it("classifies browser network failures with CORS guidance", () => {
    expect(classifyAIError(new TypeError("Failed to fetch"))).toContain("CORS");
  });

  it("builds Responses request bodies with text.format", () => {
    const body = buildResponsesRequestBody(defaultAISettings, "developer", "user", "json_schema");
    expect(body.input[0]).toEqual({ role: "developer", content: "developer" });
    expect(body.input[1]).toEqual({ role: "user", content: "user" });
    expect(body.text.format.type).toBe("json_schema");
  });

  it("keeps json_object prompts compatible with Responses JSON mode", () => {
    const body = buildResponsesRequestBody(defaultAISettings, "Return json only.", "Return json: {\"ok\":true}", "json_object");
    expect(JSON.stringify(body.input).toLowerCase()).toContain("json");
    expect(body.text.format.type).toBe("json_object");
  });

  it("extracts text from Responses output shapes", () => {
    expect(extractResponsesText({ output_text: "{\"ok\":true}" })).toBe("{\"ok\":true}");
    expect(
      extractResponsesText({
        output: [
          {
            content: [{ type: "output_text", text: "{\"ok\":true}" }]
          }
        ]
      })
    ).toBe("{\"ok\":true}");
  });

  it("accepts a direct PatientProfile object from compatible gateways", async () => {
    const profile = createEmptyProfile();
    profile.personal.name = "测试患者";
    profile.medical.primaryCondition = "测试诊断";
    profile.emergencyInstructions.criticalWarnings = ["避免延误急救"];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            ...profile,
            reviewNotes: ["请医生核实"]
          })
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const draft = await generateProfileDraftWithOpenAICompatibleApi(
      {
        ...defaultAISettings,
        baseUrl: "https://gateway.example/v1",
        apiKey: "sk-test",
        responseMode: "json_object"
      },
      {
        patientName: "测试患者",
        birthDate: "",
        age: "",
        diagnosis: "测试诊断",
        knownRisks: "避免延误急救",
        allergies: "",
        medications: "",
        doctorAdvice: "",
        contacts: "",
        freeText: "",
        preferredLanguage: "zh"
      },
      createEmptyProfile()
    );

    expect(draft.profile.personal.name).toBe("测试患者");
    expect(draft.profile.medical.primaryCondition).toBe("测试诊断");
    expect(draft.reviewNotes).toContain("请医生核实");
  });

  it("accepts common profile aliases and loose gateway JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            patientProfile: {
              personal: { name: "别名患者", birthDate: "", bloodType: "unknown", primaryLanguage: "zh" },
              medical: {
                primaryCondition: "别名诊断",
                primaryConditionEn: "",
                orphaCode: "",
                icdCode: "",
                diagnosisNotes: "",
                allergies: [],
                medications: []
              },
              emergencyInstructions: {
                criticalWarnings: ["立即联系医生"],
                preferredProtocol: "",
                avoidTreatments: [],
                specialistName: "",
                specialistHospital: "",
                specialistPhone: ""
              },
              emergencyContacts: []
            },
            review_notes: ["别名备注"]
          })
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const draft = await generateProfileDraftWithOpenAICompatibleApi(
      { ...defaultAISettings, baseUrl: "https://gateway.example/v1", apiKey: "sk-test", responseMode: "json_object" },
      { patientName: "别名患者", birthDate: "", age: "", diagnosis: "别名诊断", knownRisks: "", allergies: "", medications: "", doctorAdvice: "", contacts: "", freeText: "", preferredLanguage: "zh" },
      createEmptyProfile()
    );

    expect(draft.profile.personal.name).toBe("别名患者");
    expect(draft.profile.medical.primaryCondition).toBe("别名诊断");
    expect(draft.reviewNotes).toContain("别名备注");
  });

  it("generates a single emergency field suggestion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            field: "criticalWarnings",
            value: ["立即出示急诊医疗卡", "联系专科医生"],
            reviewNotes: ["使用前核实"]
          })
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const suggestion = await generateEmergencyFieldSuggestion(
      { ...defaultAISettings, baseUrl: "https://gateway.example/v1", apiKey: "sk-test", responseMode: "json_object" },
      {
        profile: createEmptyProfile(),
        intake: {
          patientName: "",
          birthDate: "",
          age: "",
          diagnosis: "测试诊断",
          knownRisks: "",
          allergies: "",
          medications: "",
          doctorAdvice: "",
          contacts: "",
          freeText: "",
          preferredLanguage: "zh"
        }
      },
      { key: "criticalWarnings", label: "关键警告", kind: "list", currentValue: [] }
    );

    expect(suggestion.field).toBe("criticalWarnings");
    expect(suggestion.value).toEqual(["立即出示急诊医疗卡", "联系专科医生"]);
    expect(suggestion.reviewNotes).toContain("使用前核实");
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("不要返回整张 profile");
  });

  it("builds critical warning field prompts with warning-specific rules", async () => {
    const fetchMock = mockFieldSuggestionResponse({ field: "criticalWarnings", value: [], reviewNotes: ["AI 未找到可靠依据"] });
    vi.stubGlobal("fetch", fetchMock);

    await generateEmergencyFieldSuggestion(fieldSettings(), fieldContext(), { key: "criticalWarnings", label: "关键警告", kind: "list", currentValue: [] });

    const prompt = readFieldPrompt(fetchMock);
    expect(prompt.fieldRules.fieldType).toBe("criticalWarnings");
    expect(prompt.fieldRules.outputKind).toBe("list");
    expect(prompt.fieldRules.lengthLimits).toContain("1-5 条");
    expect(prompt.fieldRules.rules.join("\n")).toContain("急诊现场必须看到");
    expect(prompt.outputRules.join("\n")).toContain("value 必须是字符串数组");
  });

  it("builds avoid-treatment prompts that require empty arrays when evidence is missing", async () => {
    const fetchMock = mockFieldSuggestionResponse({ field: "avoidTreatments", value: [], reviewNotes: ["AI 未找到可靠依据"] });
    vi.stubGlobal("fetch", fetchMock);

    await generateEmergencyFieldSuggestion(fieldSettings(), fieldContext(), { key: "avoidTreatments", label: "禁忌/避免", kind: "list", currentValue: [] });

    const prompt = readFieldPrompt(fetchMock);
    expect(prompt.fieldRules.fieldType).toBe("avoidTreatments");
    expect(prompt.fieldRules.noEvidenceValue).toEqual([]);
    expect(prompt.fieldRules.rules.join("\n")).toContain("没有明确依据时 value 返回 []");
    expect(prompt.fieldRules.rules.join("\n")).toContain("不要为了完整性补齐");
  });

  it("builds preferred protocol prompts from age, contraindications, condition, medications, and allergies", async () => {
    const fetchMock = mockFieldSuggestionResponse({ field: "preferredProtocol", value: "", reviewNotes: ["AI 未找到可靠依据"] });
    vi.stubGlobal("fetch", fetchMock);
    const context = fieldContext();
    context.intake.birthDate = "2020-05-08";
    context.intake.age = "5岁";
    context.intake.diagnosis = "测试诊断";
    context.intake.allergies = "青霉素 / 皮疹";
    context.intake.medications = "药物A / 10mg / 每日一次";
    context.intake.doctorAdvice = "避免药物B";

    await generateEmergencyFieldSuggestion(fieldSettings(), context, { key: "preferredProtocol", label: "急救说明", kind: "text", currentValue: "" });

    const prompt = readFieldPrompt(fetchMock);
    expect(prompt.fieldRules.fieldType).toBe("preferredProtocol");
    expect(prompt.fieldRules.evidenceScope).toEqual(expect.arrayContaining(["年龄或出生日期", "疾病/诊断", "禁忌/避免项", "过敏", "正在用药"]));
    expect(prompt.fieldRules.rules.join("\n")).toContain("根据患者年龄或出生日期、疾病/诊断、禁忌/避免项、正在用药和过敏信息");
    expect(prompt.fieldRules.rules.join("\n")).toContain("不要写详细治疗方案、药物剂量、给药时机");
    expect(prompt.intake).toMatchObject({
      birthDate: "2020-05-08",
      age: "5岁",
      diagnosis: "测试诊断",
      allergies: "青霉素 / 皮疹",
      medications: "药物A / 10mg / 每日一次",
      doctorAdvice: "避免药物B"
    });
  });

  it("builds phone prompts with exact extraction rules for specialist and contact phones", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fieldSuggestionResponse({ field: "specialistPhone", value: "", reviewNotes: ["AI 未找到可靠依据"] }))
      .mockResolvedValueOnce(fieldSuggestionResponse({ field: "contact:c1:phone", value: "", reviewNotes: ["AI 未找到可靠依据"] }));
    vi.stubGlobal("fetch", fetchMock);

    const context = fieldContext();
    context.profile.emergencyContacts = [{ id: "c1", name: "张三", relationship: "", phone: "", priority: 1 }];

    await generateEmergencyFieldSuggestion(fieldSettings(), context, { key: "specialistPhone", label: "联系电话", kind: "text", currentValue: "" });
    await generateEmergencyFieldSuggestion(fieldSettings(), context, { key: "contact:c1:phone", label: "联系人电话", kind: "text", currentValue: "" });

    const specialistPrompt = readFieldPrompt(fetchMock, 0);
    const contactPrompt = readFieldPrompt(fetchMock, 1);
    expect(specialistPrompt.fieldRules.rules.join("\n")).toContain("只做原文精确提取电话");
    expect(contactPrompt.fieldRules.rules.join("\n")).toContain("只做原文精确提取电话");
    expect(contactPrompt.fieldRules.rules.join("\n")).toContain("禁止把多个联系人混写");
    expect(contactPrompt.targetContact.id).toBe("c1");
  });

  it("accepts value, suggestion, and result aliases for emergency field suggestions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fieldSuggestionResponse({ field: "preferredProtocol", value: "交接说明", reviewNotes: [] }))
      .mockResolvedValueOnce(fieldSuggestionResponse({ field: "preferredProtocol", suggestion: "别名建议", reviewNotes: [] }))
      .mockResolvedValueOnce(fieldSuggestionResponse({ field: "criticalWarnings", result: ["结果别名"], reviewNotes: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const byValue = await generateEmergencyFieldSuggestion(fieldSettings(), fieldContext(), { key: "preferredProtocol", label: "急救说明", kind: "text", currentValue: "" });
    const bySuggestion = await generateEmergencyFieldSuggestion(fieldSettings(), fieldContext(), { key: "preferredProtocol", label: "急救说明", kind: "text", currentValue: "" });
    const byResult = await generateEmergencyFieldSuggestion(fieldSettings(), fieldContext(), { key: "criticalWarnings", label: "关键警告", kind: "list", currentValue: [] });

    expect(byValue.value).toBe("交接说明");
    expect(bySuggestion.value).toBe("别名建议");
    expect(byResult.value).toEqual(["结果别名"]);
  });
});

function fieldSettings() {
  return { ...defaultAISettings, baseUrl: "https://gateway.example/v1", apiKey: "sk-test", responseMode: "json_object" as const };
}

function fieldContext() {
  return {
    profile: createEmptyProfile(),
    intake: {
      patientName: "",
      birthDate: "",
      age: "",
      diagnosis: "测试诊断",
      knownRisks: "",
      allergies: "",
      medications: "",
      doctorAdvice: "",
      contacts: "",
      freeText: "",
      preferredLanguage: "zh" as const
    }
  };
}

function fieldSuggestionResponse(payload: Record<string, unknown>) {
  return new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function mockFieldSuggestionResponse(payload: Record<string, unknown>) {
  return vi.fn().mockResolvedValue(fieldSuggestionResponse(payload));
}

function readFieldPrompt(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0) {
  const rawBody = fetchMock.mock.calls[callIndex][1]?.body;
  const body = JSON.parse(String(rawBody)) as { input: Array<{ role: string; content: string }> };
  return JSON.parse(body.input[1].content) as Record<string, any>;
}

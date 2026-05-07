import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  FileDown,
  HeartPulse,
  Info,
  KeyRound,
  Languages,
  Moon,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  cardLabels,
  createEmptyProfile,
  createId,
  createQrPayload,
  generateEmergencyCard,
  rareDiseasePresets,
  verificationLabels
} from "@rare-card/shared";
import {
  generateEmergencyFieldSuggestion,
  getResponsesEndpoint,
  loadAISettings,
  saveAISettings,
  testOpenAICompatibleConnection as testCompatibleConnection
} from "./aiProfile";
import type { AIFieldSuggestion, AIIntake, AIResponseMode, AISettings, EmergencyAIFieldRequest } from "./aiProfile";
import { applyEmergencySuggestionToProfile, formatAIFieldSuggestionValue, hasAIFieldSuggestionValue } from "./emergencySuggestion";
import type {
  Allergy,
  BloodType,
  CardLanguage,
  CardSize,
  CardTheme,
  EmergencyCard,
  EmergencyContact,
  Medication,
  PatientProfile,
  VerificationStatus
} from "@rare-card/shared";
import {
  ActionToolbar,
  AppButton,
  BackupDialog,
  InlineSelect,
  InlineTextInput,
  ModulePanel,
  ProgressBar,
  SelectField,
  SegmentedControl,
  StepForm,
  SwitchControl,
  TextAreaField,
  TextField,
  TooltipIconButton as IconButton,
  TooltipProvider
} from "./ui";

const STORAGE_KEY = "rare-card-profile-v1";
const THEME_STORAGE_KEY = "rare-card-theme-v1";

const bloodTypes: BloodType[] = ["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const themes: Array<{ value: CardTheme; label: string }> = [
  { value: "clinical", label: "标准" },
  { value: "contrast", label: "高对比" },
  { value: "calm", label: "沉静灰" },
  { value: "travel", label: "随身版" }
];
const sizes: Array<{ value: CardSize; label: string }> = [
  { value: "wallet", label: "钱包卡" },
  { value: "a4", label: "A4" },
  { value: "lockscreen", label: "锁屏" }
];
const verificationOptions: Array<{ value: VerificationStatus; label: string }> = [
  { value: "unverified", label: "未核实" },
  { value: "patient-confirmed", label: "患者确认" },
  { value: "doctor-confirmed", label: "医生确认" }
];

type ProfileUpdater = (profile: PatientProfile) => PatientProfile;
type EntryMode = "manual" | "ai";
type AppTheme = "light" | "dark";
type WizardStepId = "mode" | "identity" | "diagnosis" | "risk" | "emergency" | "preview" | "aiSetup";
type ValidationIssue = { field: string; message: string };
type StepValidationResult = { errors: ValidationIssue[]; warnings: ValidationIssue[] };
type WizardStep = { id: WizardStepId; number: string; title: string };
type AIFieldSuggestionState = {
  status: "idle" | "generating" | "applied" | "empty" | "error";
  suggestion?: AIFieldSuggestion;
  error?: string;
};

const entryWizardSteps: WizardStep[] = [{ id: "mode", number: "0", title: "填写方式" }];
const manualWizardSteps: WizardStep[] = [
  ...entryWizardSteps,
  { id: "identity", number: "1", title: "身份信息" },
  { id: "diagnosis", number: "2", title: "疾病诊断" },
  { id: "risk", number: "3", title: "风险信息" },
  { id: "emergency", number: "4", title: "急救信息" },
  { id: "preview", number: "5", title: "预览导出" }
];
const aiWizardSteps: WizardStep[] = [
  ...entryWizardSteps,
  { id: "aiSetup", number: "1", title: "接口设置" },
  { id: "identity", number: "2", title: "身份信息" },
  { id: "diagnosis", number: "3", title: "疾病诊断" },
  { id: "risk", number: "4", title: "风险信息" },
  { id: "emergency", number: "5", title: "急救信息" },
  { id: "preview", number: "6", title: "预览导出" }
];

const primaryLanguageOptions = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" }
];

function loadProfile(): PatientProfile {
  if (typeof localStorage === "undefined") return createEmptyProfile();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return createEmptyProfile();

  try {
    const parsed = JSON.parse(stored) as Partial<PatientProfile>;
    const base = createEmptyProfile();
    return {
      ...base,
      ...parsed,
      personal: { ...base.personal, ...parsed.personal },
      medical: {
        ...base.medical,
        ...parsed.medical,
        allergies: parsed.medical?.allergies?.length ? parsed.medical.allergies : base.medical.allergies,
        medications: parsed.medical?.medications?.length ? parsed.medical.medications : base.medical.medications
      },
      emergencyInstructions: { ...base.emergencyInstructions, ...parsed.emergencyInstructions },
      emergencyContacts: parsed.emergencyContacts?.length ? parsed.emergencyContacts : base.emergencyContacts,
      cardPreferences: { ...base.cardPreferences, ...parsed.cardPreferences }
    };
  } catch {
    return createEmptyProfile();
  }
}

function loadTheme(): AppTheme {
  if (typeof localStorage === "undefined") return "light";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function App() {
  const [profile, setProfile] = useState<PatientProfile>(() => loadProfile());
  const [theme, setTheme] = useState<AppTheme>(() => loadTheme());
  const [importError, setImportError] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [currentStep, setCurrentStep] = useState<WizardStepId>("mode");
  const [maxUnlockedStepIndex, setMaxUnlockedStepIndex] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>(() => loadAISettings());
  const [aiConnectionStatus, setAIConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [aiConnectionMessage, setAIConnectionMessage] = useState("");
  const [aiFieldSuggestions, setAIFieldSuggestions] = useState<Record<string, AIFieldSuggestionState>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const card = useMemo(() => generateEmergencyCard(profile), [profile]);
  const qrPayload = useMemo(() => createQrPayload(card), [card]);
  const activeSteps = useMemo(() => getWizardSteps(entryMode), [entryMode]);
  const currentStepIndex = Math.max(
    0,
    activeSteps.findIndex((step) => step.id === currentStep)
  );
  const currentValidation = useMemo(
    () => validateStep(currentStep, profile, entryMode, aiSettings),
    [currentStep, profile, entryMode, aiSettings]
  );
  const stepResults = useMemo(
    () => activeSteps.map((step) => validateStep(step.id, profile, entryMode, aiSettings)),
    [activeSteps, profile, entryMode, aiSettings]
  );
  const progress = useMemo(() => getCompletionProgress(stepResults, maxUnlockedStepIndex, activeSteps.length), [stepResults, maxUnlockedStepIndex, activeSteps.length]);
  const missingSuggestions = useMemo(() => getMissingSuggestions(profile), [profile]);
  const hasLocalDraft = useMemo(() => hasProfileContent(profile), [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    saveAISettings(aiSettings);
  }, [aiSettings]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const updateProfile = (updater: ProfileUpdater) => setProfile((current) => updater(current));

  const setPreset = (presetId: string) => {
    const preset = rareDiseasePresets.find((item) => item.id === presetId);
    if (!preset) return;
    updateProfile((current) => ({
      ...current,
      medical: {
        ...current.medical,
        primaryCondition: preset.nameZh,
        primaryConditionEn: preset.nameEn,
        orphaCode: preset.orphaCode ?? current.medical.orphaCode,
        icdCode: preset.icdCode ?? current.medical.icdCode
      }
    }));
  };

  const exportJson = () => {
    downloadTextFile("rare-emergency-card-backup.json", JSON.stringify(profile, null, 2), "application/json");
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError("");
    try {
      const imported = JSON.parse(await file.text()) as PatientProfile;
      if (!imported.personal || !imported.medical || !imported.emergencyInstructions || !imported.cardPreferences) {
        throw new Error("Invalid backup");
      }
      setProfile({
        ...createEmptyProfile(),
        ...imported,
        personal: { ...createEmptyProfile().personal, ...imported.personal },
        medical: { ...createEmptyProfile().medical, ...imported.medical },
        emergencyInstructions: { ...createEmptyProfile().emergencyInstructions, ...imported.emergencyInstructions },
        emergencyContacts: imported.emergencyContacts?.length ? imported.emergencyContacts : createEmptyProfile().emergencyContacts,
        cardPreferences: { ...createEmptyProfile().cardPreferences, ...imported.cardPreferences }
      });
      setEntryMode(null);
      setCurrentStep("mode");
      setMaxUnlockedStepIndex(0);
      setShowValidation(false);
    } catch {
      setImportError("导入失败：请选择由本工具导出的 JSON 备份。");
    } finally {
      event.target.value = "";
    }
  };

  const selectEntryMode = (mode: EntryMode) => {
    setEntryMode(mode);
    setCurrentStep(mode === "ai" ? "aiSetup" : "identity");
    setMaxUnlockedStepIndex(1);
    setShowValidation(false);
  };

  const resumeLocalDraft = () => {
    const resumeState = getManualResumeState(profile);
    setEntryMode("manual");
    setCurrentStep(resumeState.stepId);
    setMaxUnlockedStepIndex(resumeState.maxUnlockedStepIndex);
    setShowValidation(false);
  };

  const updateAISetting = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setAISettings((current) => ({ ...current, [key]: value }));
    setAIConnectionStatus("idle");
    setAIConnectionMessage("");
  };

  const requestEmergencyFieldSuggestion = async (field: EmergencyAIFieldRequest) => {
    if (!hasAISettingsConfigured(aiSettings)) {
      setAIFieldSuggestions((current) => ({
        ...current,
        [field.key]: { status: "error", error: "配置 AI 后可补全。未配置时不会发送请求。" }
      }));
      return;
    }

    setAIFieldSuggestions((current) => ({ ...current, [field.key]: { status: "generating" } }));
    try {
      const suggestion = await generateEmergencyFieldSuggestion(aiSettings, { profile, intake: buildAIIntakeFromProfile(profile) }, field);
      if (hasAIFieldSuggestionValue(suggestion.value)) {
        updateProfile((current) => applyEmergencySuggestionToProfile(current, field.key, suggestion.value));
        setAIFieldSuggestions((current) => ({ ...current, [field.key]: { status: "applied", suggestion } }));
        return;
      }
      setAIFieldSuggestions((current) => ({ ...current, [field.key]: { status: "empty", suggestion } }));
    } catch (error) {
      setAIFieldSuggestions((current) => ({
        ...current,
        [field.key]: { status: "error", error: error instanceof Error ? error.message : "AI 补全失败，请稍后重试。" }
      }));
    }
  };

  const dismissEmergencyFieldSuggestion = (fieldKey: string) => {
    setAIFieldSuggestions((current) => {
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
  };

  const goToStep = (index: number) => {
    if (index > maxUnlockedStepIndex) return;
    setCurrentStep(activeSteps[index].id);
    setShowValidation(false);
  };

  const goToPreviousStep = () => {
    if (currentStepIndex === 0) return;
    setCurrentStep(activeSteps[currentStepIndex - 1].id);
    setShowValidation(false);
  };

  const goToNextStep = async () => {
    const validation = validateStep(currentStep, profile, entryMode, aiSettings);
    setShowValidation(true);
    if (validation.errors.length) return;

    if (currentStepIndex >= activeSteps.length - 1) return;
    const nextIndex = currentStepIndex + 1;
    setMaxUnlockedStepIndex((index) => Math.max(index, nextIndex));
    setCurrentStep(activeSteps[nextIndex].id);
    setShowValidation(false);
  };

  const testAIConnection = async () => {
    setAIConnectionStatus("testing");
    setAIConnectionMessage("");
    try {
      const message = await testCompatibleConnection(aiSettings);
      setAIConnectionStatus("success");
      setAIConnectionMessage(message);
    } catch (error) {
      setAIConnectionStatus("error");
      setAIConnectionMessage(error instanceof Error ? error.message : "连接测试失败，请检查 API 设置。");
    }
  };

  return (
    <TooltipProvider>
      <div className="app-shell">
        <header className="AppHeader">
          <div>
            <p className="AppHeader-eyebrow">rarecard.md / local workbench</p>
            <h1>罕见病急诊医疗卡</h1>
          </div>
          <ActionToolbar label="应用操作" className="AppHeader-actions">
            <AppButton variant="secondary" className="ThemeToggle" aria-label={`切换到${theme === "dark" ? "浅色" : "深色"}模式`} onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              {theme === "dark" ? "light" : "dark"}
            </AppButton>
            <BackupDialog fileInputRef={fileInputRef} importError={importError} onExport={exportJson} onImport={importJson} />
          </ActionToolbar>
        </header>

        <main className="Workbench">
          <aside className="WorkbenchRail" aria-label="流程导航">
            <div className="RailPanel">
              <p className="RailPanel-kicker">[workflow]</p>
              <WizardShell
                steps={activeSteps}
                currentStep={currentStep}
                maxUnlockedStepIndex={maxUnlockedStepIndex}
                stepResults={stepResults}
                onSelectStep={goToStep}
              />
            </div>
            <div className="RailPanel RailPanel--compact">
              <p className="RailPanel-kicker">[storage]</p>
              <p>{hasLocalDraft ? "本机浏览器草稿：已检测到" : "本机浏览器草稿：暂无内容"}</p>
            </div>
          </aside>

          <section className="Workspace-form" aria-label="患者信息问卷">
            {currentStep === "mode" ? (
              <CurrentStep
                currentStep={currentStep}
                profile={profile}
                updateProfile={updateProfile}
                validation={currentValidation}
                showValidation={showValidation}
                entryMode={entryMode}
                onSelectEntryMode={selectEntryMode}
                onResumeDraft={resumeLocalDraft}
                hasLocalDraft={hasLocalDraft}
                setPreset={setPreset}
                card={card}
                qrPayload={qrPayload}
                missingSuggestions={missingSuggestions}
                aiSettings={aiSettings}
                updateAISetting={updateAISetting}
                onTestAIConnection={testAIConnection}
                aiConnectionStatus={aiConnectionStatus}
                aiConnectionMessage={aiConnectionMessage}
                aiFieldSuggestions={aiFieldSuggestions}
                onRequestAIField={requestEmergencyFieldSuggestion}
                onDismissAIField={dismissEmergencyFieldSuggestion}
              />
            ) : (
              <StepForm onSubmit={goToNextStep}>
                <CurrentStep
                  currentStep={currentStep}
                  profile={profile}
                  updateProfile={updateProfile}
                  validation={currentValidation}
                  showValidation={showValidation}
                  entryMode={entryMode}
                  onSelectEntryMode={selectEntryMode}
                  onResumeDraft={resumeLocalDraft}
                  hasLocalDraft={hasLocalDraft}
                  setPreset={setPreset}
                  card={card}
                  qrPayload={qrPayload}
                  missingSuggestions={missingSuggestions}
                  aiSettings={aiSettings}
                  updateAISetting={updateAISetting}
                  onTestAIConnection={testAIConnection}
                  aiConnectionStatus={aiConnectionStatus}
                  aiConnectionMessage={aiConnectionMessage}
                  aiFieldSuggestions={aiFieldSuggestions}
                  onRequestAIField={requestEmergencyFieldSuggestion}
                  onDismissAIField={dismissEmergencyFieldSuggestion}
                />
                <StepActions
                  currentStepIndex={currentStepIndex}
                  totalSteps={activeSteps.length}
                  nextLabel="下一步"
                  onPrevious={goToPreviousStep}
                />
              </StepForm>
            )}
          </section>

          <SummaryAside
            card={card}
            profile={profile}
            progress={progress}
            missingSuggestions={missingSuggestions}
            entryMode={entryMode}
            currentStep={currentStep}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}

export { App, aiWizardSteps, buildAIIntakeFromProfile, describeAgeFromBirthDate, getWizardSteps, hasAISettingsConfigured, manualWizardSteps, validateStep };

function WizardShell({
  steps,
  currentStep,
  maxUnlockedStepIndex,
  stepResults,
  onSelectStep
}: {
  steps: WizardStep[];
  currentStep: WizardStepId;
  maxUnlockedStepIndex: number;
  stepResults: StepValidationResult[];
  onSelectStep: (index: number) => void;
}) {
  return (
    <nav className="Stepper" aria-label="填写阶段">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isUnlocked = index <= maxUnlockedStepIndex;
        const result = stepResults[index];
        const hasError = isUnlocked && !isActive && result.errors.length > 0;
        const hasWarning = isUnlocked && !isActive && !hasError && result.warnings.length > 0;
        const statusLabel = !isUnlocked ? "未解锁" : isActive ? "当前" : hasError ? "待补充" : hasWarning ? "建议" : "完成";
        const className = ["Stepper-item", isActive ? "is-active" : "", isUnlocked ? "is-unlocked" : "is-locked", hasError ? "has-error" : "", hasWarning ? "has-warning" : ""]
          .filter(Boolean)
          .join(" ");

        return (
          <AppButton key={step.id} variant="quiet" className={className} disabled={!isUnlocked} aria-current={isActive ? "step" : undefined} onClick={() => onSelectStep(index)}>
            <span className="Stepper-number">[{step.number.padStart(2, "0")}]</span>
            <span className="Stepper-title">{step.title}</span>
            <span className="Stepper-status">[{statusLabel}]</span>
          </AppButton>
        );
      })}
    </nav>
  );
}

function CurrentStep({
  currentStep,
  profile,
  updateProfile,
  validation,
  showValidation,
  entryMode,
  onSelectEntryMode,
  onResumeDraft,
  hasLocalDraft,
  setPreset,
  card,
  qrPayload,
  missingSuggestions,
  aiSettings,
  updateAISetting,
  onTestAIConnection,
  aiConnectionStatus,
  aiConnectionMessage,
  aiFieldSuggestions,
  onRequestAIField,
  onDismissAIField
}: {
  currentStep: WizardStepId;
  profile: PatientProfile;
  updateProfile: (updater: ProfileUpdater) => void;
  validation: StepValidationResult;
  showValidation: boolean;
  entryMode: EntryMode | null;
  onSelectEntryMode: (mode: EntryMode) => void;
  onResumeDraft: () => void;
  hasLocalDraft: boolean;
  setPreset: (presetId: string) => void;
  card: EmergencyCard;
  qrPayload: string;
  missingSuggestions: string[];
  aiSettings: AISettings;
  updateAISetting: <K extends keyof AISettings>(key: K, value: AISettings[K]) => void;
  onTestAIConnection: () => void | Promise<void>;
  aiConnectionStatus: "idle" | "testing" | "success" | "error";
  aiConnectionMessage: string;
  aiFieldSuggestions: Record<string, AIFieldSuggestionState>;
  onRequestAIField: (field: EmergencyAIFieldRequest) => void | Promise<void>;
  onDismissAIField: (fieldKey: string) => void;
}) {
  const step = getWizardSteps(entryMode).find((item) => item.id === currentStep) ?? entryWizardSteps[0];
  const fieldError = (field: string) => (showValidation ? validation.errors.find((issue) => issue.field === field)?.message : undefined);

  return (
    <ModulePanel eyebrow={`[step ${step.number.padStart(2, "0")}]`} title={step.title}>
      <div className="StepTitle">
        <span className="StepTitle-icon">{getStepIcon(currentStep)}</span>
        <span>{step.title}</span>
      </div>
      <ValidationSummary validation={validation} showValidation={showValidation} />

      {currentStep === "mode" ? (
        <ModeStep
          entryMode={entryMode}
          onSelectEntryMode={onSelectEntryMode}
          onResumeDraft={onResumeDraft}
          hasLocalDraft={hasLocalDraft}
          progress={getCompletionProgress([validation], 0, 1)}
          missingCount={missingSuggestions.length}
        />
      ) : null}

      {currentStep === "identity" ? (
        <IdentityStep profile={profile} updateProfile={updateProfile} fieldError={fieldError} />
      ) : null}

      {currentStep === "diagnosis" ? (
        <DiagnosisStep profile={profile} updateProfile={updateProfile} setPreset={setPreset} fieldError={fieldError} />
      ) : null}

      {currentStep === "risk" ? <RiskStep profile={profile} updateProfile={updateProfile} /> : null}

      {currentStep === "emergency" ? (
        <EmergencyStep
          profile={profile}
          updateProfile={updateProfile}
          fieldError={fieldError}
          showValidation={showValidation}
          aiAssistVisible={entryMode === "ai" || hasAISettingsConfigured(aiSettings)}
          aiAssistConfigured={hasAISettingsConfigured(aiSettings)}
          aiFieldSuggestions={aiFieldSuggestions}
          onRequestAIField={onRequestAIField}
          onDismissAIField={onDismissAIField}
        />
      ) : null}

      {currentStep === "aiSetup" ? (
        <AISetupStep
          settings={aiSettings}
          updateSetting={updateAISetting}
          fieldError={fieldError}
          onTestConnection={onTestAIConnection}
          connectionStatus={aiConnectionStatus}
          connectionMessage={aiConnectionMessage}
        />
      ) : null}

      {currentStep === "preview" ? (
        <PreviewExportStep
          profile={profile}
          updateProfile={updateProfile}
          card={card}
          qrPayload={qrPayload}
          missingSuggestions={missingSuggestions}
          hasAISuggestionsApplied={Object.values(aiFieldSuggestions).some((state) => state.status === "applied")}
        />
      ) : null}
    </ModulePanel>
  );
}

function ModeStep({
  entryMode,
  onSelectEntryMode,
  onResumeDraft,
  hasLocalDraft,
  progress,
  missingCount
}: {
  entryMode: EntryMode | null;
  onSelectEntryMode: (mode: EntryMode) => void;
  onResumeDraft: () => void;
  hasLocalDraft: boolean;
  progress: number;
  missingCount: number;
}) {
  return (
    <div className="StepBody StepBody--launch">
      <div className="ModeLaunch">
        <section className="ModeConsole" aria-label="启动状态">
          <div>
            <div className="ModeConsole-top">
              <span>[rare-card]</span>
              <span>{hasLocalDraft ? "draft.loaded" : "session.clean"}</span>
            </div>
            <pre className="AsciiMark" aria-hidden="true">{`RARE-CARD
EMERGENCY PROFILE`}</pre>
            <div className="ModePrompt">
              <span>|</span>
              <strong>{hasLocalDraft ? "resume local browser draft" : "select entry workflow"}</strong>
              <em>{progress}% complete</em>
            </div>
          </div>
        </section>

        <section className="ModeStartPanel" aria-label="填写入口">
          <div className={`DraftResume ${hasLocalDraft ? "is-ready" : "is-empty"}`}>
            <div>
              <span>[draft]</span>
              <strong>{hasLocalDraft ? "检测到本机浏览器草稿" : "暂无本机草稿"}</strong>
              <p>{hasLocalDraft ? "继续后会回到当前资料最需要补充的位置。" : "选择一种填写方式后才会创建本机草稿。"}</p>
            </div>
            {hasLocalDraft ? (
              <AppButton variant="primary" onClick={onResumeDraft}>
                <RotateCcw size={18} />
                继续上次编辑
              </AppButton>
            ) : null}
          </div>

          <div className="ModeMetrics" aria-label="启动摘要">
            <div>
              <span>[state]</span>
              <strong>{hasLocalDraft ? "loaded" : "blank"}</strong>
            </div>
            <div>
              <span>[progress]</span>
              <strong>{progress}%</strong>
            </div>
            <div>
              <span>[advice]</span>
              <strong>{missingCount}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="ModeGrid" aria-label="填写方式">
        <AppButton variant="option" className={`ModeOption ${entryMode === "ai" ? "is-active" : ""}`} onClick={() => onSelectEntryMode("ai")}>
          <FileText size={20} />
          <span>
            <strong>[assist] AI 辅助填写</strong>
            按身份、诊断、风险和急救信息逐步填写，在急救字段旁使用 AI 补全。
          </span>
        </AppButton>
        <AppButton variant="option" className={`ModeOption ${entryMode === "manual" ? "is-active" : ""}`} onClick={() => onSelectEntryMode("manual")}>
          <ClipboardCheck size={20} />
          <span>
            <strong>[manual] 手动逐步填写</strong>
            按身份、诊断、风险和急救信息填写。
          </span>
        </AppButton>
      </div>
      <p className="SummaryCopy">生成内容只作为草稿，应用前需要人工核实；卡片资料会保存在本机浏览器。</p>
    </div>
  );
}

function AISetupStep({
  settings,
  updateSetting,
  fieldError,
  onTestConnection,
  connectionStatus,
  connectionMessage
}: {
  settings: AISettings;
  updateSetting: <K extends keyof AISettings>(key: K, value: AISettings[K]) => void;
  fieldError: (field: string) => string | undefined;
  onTestConnection: () => void | Promise<void>;
  connectionStatus: "idle" | "testing" | "success" | "error";
  connectionMessage: string;
}) {
  const endpointPreview = getEndpointPreview(settings.baseUrl);

  return (
    <div className="StepBody">
      <div className="Notice">
        <KeyRound size={18} />
        <p>接口设置可跳过；未配置时仍可继续填写资料。配置后，API Key 会从浏览器发送到你填写的 Base URL，并用于急救字段 AI 补全。</p>
      </div>
      <div className="Grid Grid--two">
        <TextField label="API Base URL" value={settings.baseUrl} error={fieldError("ai.baseUrl")} onChange={(value) => updateSetting("baseUrl", value)} />
        <TextField label="模型" value={settings.model} error={fieldError("ai.model")} onChange={(value) => updateSetting("model", value)} />
        <TextField label="API Key" type="password" value={settings.apiKey} error={fieldError("ai.apiKey")} onChange={(value) => updateSetting("apiKey", value)} />
        <SelectField
          label="Responses 输出格式"
          value={settings.responseMode}
          onChange={(value) => updateSetting("responseMode", value as AIResponseMode)}
          options={[
            { value: "auto", label: "自动兼容" },
            { value: "json_object", label: "JSON 兼容模式" },
            { value: "json_schema", label: "结构化输出" }
          ]}
        />
        <SwitchControl checked={settings.saveApiKey} onCheckedChange={(checked) => updateSetting("saveApiKey", checked)}>
          本机保存 API Key
        </SwitchControl>
      </div>
      <div className="EndpointPreview">
        <span>最终请求地址</span>
        <code>{endpointPreview}</code>
      </div>
      <ActionToolbar label="接口连接操作" className="ConnectionActions">
        <AppButton variant="secondary" disabled={connectionStatus === "testing"} onClick={onTestConnection}>
          <Activity size={18} />
          {connectionStatus === "testing" ? "测试中" : "测试连接"}
        </AppButton>
        {connectionMessage ? (
          <div className={`ConnectionMessage ${connectionStatus === "success" ? "is-success" : "is-error"}`}>
            {connectionMessage}
          </div>
        ) : null}
      </ActionToolbar>
    </div>
  );
}

function IdentityStep({
  profile,
  updateProfile,
  fieldError
}: {
  profile: PatientProfile;
  updateProfile: (updater: ProfileUpdater) => void;
  fieldError: (field: string) => string | undefined;
}) {
  return (
    <div className="StepBody">
      <div className="Grid Grid--two">
        <TextField label="姓名" value={profile.personal.name} error={fieldError("personal.name")} onChange={(value) => updatePersonal(updateProfile, "name", value)} />
        <TextField label="出生日期" type="date" value={profile.personal.birthDate} onChange={(value) => updatePersonal(updateProfile, "birthDate", value)} />
        <SelectField
          label="血型"
          value={profile.personal.bloodType}
          onChange={(value) => updatePersonal(updateProfile, "bloodType", value as BloodType)}
          options={bloodTypes.map((value) => ({ value, label: value === "unknown" ? "未知" : value }))}
        />
        <SelectField
          label="患者常用语言"
          value={profile.personal.primaryLanguage}
          onChange={(value) => updatePersonal(updateProfile, "primaryLanguage", value)}
          options={primaryLanguageOptions}
        />
      </div>
    </div>
  );
}

function DiagnosisStep({
  profile,
  updateProfile,
  setPreset,
  fieldError
}: {
  profile: PatientProfile;
  updateProfile: (updater: ProfileUpdater) => void;
  setPreset: (presetId: string) => void;
  fieldError: (field: string) => string | undefined;
}) {
  return (
    <div className="StepBody">
      <div className="Grid Grid--two">
        <SelectField
          label="罕见病预设"
          value=""
          onChange={setPreset}
          options={[{ value: "", label: "选择预设" }, ...rareDiseasePresets.map((item) => ({ value: item.id, label: `${item.nameZh} / ${item.nameEn}` }))]}
        />
        <TextField
          label="主要诊断"
          value={profile.medical.primaryCondition}
          error={fieldError("medical.primaryCondition")}
          onChange={(value) => updateMedical(updateProfile, "primaryCondition", value)}
        />
        <TextField label="英文诊断名" value={profile.medical.primaryConditionEn ?? ""} onChange={(value) => updateMedical(updateProfile, "primaryConditionEn", value)} />
        <TextField label="ORPHA 编码" value={profile.medical.orphaCode ?? ""} onChange={(value) => updateMedical(updateProfile, "orphaCode", value)} />
        <TextField label="ICD 编码" value={profile.medical.icdCode ?? ""} onChange={(value) => updateMedical(updateProfile, "icdCode", value)} />
      </div>
      <TextAreaField label="诊断补充说明" value={profile.medical.diagnosisNotes ?? ""} onChange={(value) => updateMedical(updateProfile, "diagnosisNotes", value)} />
    </div>
  );
}

function RiskStep({ profile, updateProfile }: { profile: PatientProfile; updateProfile: (updater: ProfileUpdater) => void }) {
  return (
    <div className="StepBody">
      <AllergyEditor profile={profile} updateProfile={updateProfile} />
      <MedicationEditor profile={profile} updateProfile={updateProfile} />
    </div>
  );
}

function AIFieldButton({
  field,
  state,
  configured,
  onRequest
}: {
  field: EmergencyAIFieldRequest;
  state?: AIFieldSuggestionState;
  configured: boolean;
  onRequest: (field: EmergencyAIFieldRequest) => void | Promise<void>;
}) {
  const isGenerating = state?.status === "generating";
  const disabled = !configured || isGenerating;
  return (
    <AppButton
      className="AIFieldButton"
      variant="secondary"
      disabled={disabled}
      aria-label={configured ? `${field.label} AI 补全` : `${field.label} 配置 AI 后可补全`}
      title={configured ? `${field.label} AI 补全` : "配置 AI 后可补全"}
      onClick={() => onRequest(field)}
    >
      <Sparkles size={14} />
      {!configured ? "配置 AI 后可补全" : isGenerating ? "生成中" : "AI 补全"}
    </AppButton>
  );
}

function AIFieldSuggestionView({
  fieldKey,
  state,
  onDismiss
}: {
  fieldKey: string;
  state?: AIFieldSuggestionState;
  onDismiss: (fieldKey: string) => void;
}) {
  if (!state || state.status === "idle" || state.status === "generating") return null;

  if (state.status === "error") {
    return (
      <div className="AIFieldSuggestion AIFieldSuggestion--error">
        <p>{state.error || "AI 补全失败，请稍后重试。"}</p>
        <AppButton variant="secondary" onClick={() => onDismiss(fieldKey)}>
          忽略
        </AppButton>
      </div>
    );
  }

  const suggestion = state.suggestion;
  if (!suggestion) return null;
  const hasValue = hasAIFieldSuggestionValue(suggestion.value);
  const title = state.status === "applied" ? "AI 草稿已填入，待核实" : "AI 未找到可靠依据";

  return (
    <div className={`AIFieldSuggestion ${state.status === "empty" ? "AIFieldSuggestion--empty" : "AIFieldSuggestion--applied"}`}>
      <div>
        <span>{title}</span>
        {hasValue ? <p>{formatAIFieldSuggestionValue(suggestion.value)}</p> : <p>AI 未找到可靠依据，未修改表单。</p>}
        {suggestion.reviewNotes.length ? (
          <ul>
            {suggestion.reviewNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
        <small>AI 内容仅作草稿，使用前需人工核实。</small>
      </div>
      <ActionToolbar label="AI 建议操作" className="AIFieldSuggestion-actions">
        <AppButton variant="secondary" onClick={() => onDismiss(fieldKey)}>
          关闭
        </AppButton>
      </ActionToolbar>
    </div>
  );
}

function EmergencyStep({
  profile,
  updateProfile,
  fieldError,
  showValidation,
  aiAssistVisible,
  aiAssistConfigured,
  aiFieldSuggestions,
  onRequestAIField,
  onDismissAIField
}: {
  profile: PatientProfile;
  updateProfile: (updater: ProfileUpdater) => void;
  fieldError: (field: string) => string | undefined;
  showValidation: boolean;
  aiAssistVisible: boolean;
  aiAssistConfigured: boolean;
  aiFieldSuggestions: Record<string, AIFieldSuggestionState>;
  onRequestAIField: (field: EmergencyAIFieldRequest) => void | Promise<void>;
  onDismissAIField: (fieldKey: string) => void;
}) {
  const aiAction = (field: EmergencyAIFieldRequest) =>
    aiAssistVisible ? <AIFieldButton field={field} state={aiFieldSuggestions[field.key]} configured={aiAssistConfigured} onRequest={onRequestAIField} /> : undefined;
  const aiSuggestion = (fieldKey: string) =>
    aiAssistVisible ? <AIFieldSuggestionView fieldKey={fieldKey} state={aiFieldSuggestions[fieldKey]} onDismiss={onDismissAIField} /> : null;

  return (
    <div className="StepBody">
      <StringListEditor
        label="关键警告"
        values={profile.emergencyInstructions.criticalWarnings}
        placeholder="例如：避免使用某类药物，需立即联系专科医生"
        error={fieldError("emergencyInstructions.criticalWarnings")}
        onChange={(values) => updateEmergencyInstructions(updateProfile, "criticalWarnings", values)}
        assistAction={aiAction({
          key: "criticalWarnings",
          label: "关键警告",
          kind: "list",
          currentValue: profile.emergencyInstructions.criticalWarnings,
          instruction: "根据诊断、已知风险和医嘱生成急诊现场最需要看到的关键警告。"
        })}
        suggestion={aiSuggestion("criticalWarnings")}
      />
      <StringListEditor
        label="医生明确禁忌/过敏相关避免项/避免处置"
        values={profile.emergencyInstructions.avoidTreatments}
        placeholder="例如：医生明确要求避免的药物、操作或处置"
        onChange={(values) => updateEmergencyInstructions(updateProfile, "avoidTreatments", values)}
        assistAction={aiAction({
          key: "avoidTreatments",
          label: "医生明确禁忌/过敏相关避免项/避免处置",
          kind: "list",
          currentValue: profile.emergencyInstructions.avoidTreatments,
          instruction: "只整理医生明确禁忌、过敏相关避免项或明确避免处置；没有依据时不要编造。"
        })}
        suggestion={aiSuggestion("avoidTreatments")}
      />
      <TextAreaField
        label="急救说明"
        value={profile.emergencyInstructions.preferredProtocol}
        onChange={(value) => updateEmergencyInstructions(updateProfile, "preferredProtocol", value)}
        action={aiAction({
          key: "preferredProtocol",
          label: "急救说明",
          kind: "text",
          currentValue: profile.emergencyInstructions.preferredProtocol,
          instruction: "生成简明、可交给急诊医生阅读的处置沟通说明；不确定内容标注需医生核实。"
        })}
      />
      {aiSuggestion("preferredProtocol")}
      <div className="Grid Grid--three">
        <TextField
          label="专科医生"
          value={profile.emergencyInstructions.specialistName}
          onChange={(value) => updateEmergencyInstructions(updateProfile, "specialistName", value)}
          action={aiAction({
            key: "specialistName",
            label: "专科医生",
            kind: "text",
            currentValue: profile.emergencyInstructions.specialistName,
            instruction: "仅当输入资料中明确出现医生姓名时提取；不要猜测或编造。"
          })}
        />
        <TextField
          label="医院"
          value={profile.emergencyInstructions.specialistHospital}
          onChange={(value) => updateEmergencyInstructions(updateProfile, "specialistHospital", value)}
          action={aiAction({
            key: "specialistHospital",
            label: "医院",
            kind: "text",
            currentValue: profile.emergencyInstructions.specialistHospital,
            instruction: "仅当输入资料中明确出现医院名称时提取；不要猜测或编造。"
          })}
        />
        <TextField
          label="联系电话"
          value={profile.emergencyInstructions.specialistPhone}
          error={fieldError("emergencyContact.phone")}
          onChange={(value) => updateEmergencyInstructions(updateProfile, "specialistPhone", value)}
          action={aiAction({
            key: "specialistPhone",
            label: "联系电话",
            kind: "text",
            currentValue: profile.emergencyInstructions.specialistPhone,
            instruction: "仅当输入资料中明确出现专科医生或医院联系电话时提取；不要生成虚构号码。"
          })}
        />
      </div>
      <div className="Grid Grid--three AIGridSuggestions">
        {aiSuggestion("specialistName")}
        {aiSuggestion("specialistHospital")}
        {aiSuggestion("specialistPhone")}
      </div>
      <ContactEditor
        profile={profile}
        updateProfile={updateProfile}
        error={showValidation ? fieldError("emergencyContact.phone") : undefined}
        aiAssistVisible={aiAssistVisible}
        aiAssistConfigured={aiAssistConfigured}
        aiFieldSuggestions={aiFieldSuggestions}
        onRequestAIField={onRequestAIField}
        onDismissAIField={onDismissAIField}
      />
    </div>
  );
}

function PreviewExportStep({
  profile,
  updateProfile,
  card,
  qrPayload,
  missingSuggestions,
  hasAISuggestionsApplied
}: {
  profile: PatientProfile;
  updateProfile: (updater: ProfileUpdater) => void;
  card: EmergencyCard;
  qrPayload: string;
  missingSuggestions: string[];
  hasAISuggestionsApplied: boolean;
}) {
  const shouldWarnBeforeExport = profile.cardPreferences.verificationStatus === "unverified" || hasAISuggestionsApplied;

  return (
    <div className="StepBody PreviewStep">
      <div className="PreviewControls">
        <ActionToolbar label="卡片语言和尺寸" className="PreviewToolbar">
          <SegmentedControl
            ariaLabel="卡片语言"
            icon={<Languages size={18} />}
            value={profile.cardPreferences.language}
            options={[
              { value: "zh", label: "中" },
              { value: "en", label: "EN" }
            ]}
            onChange={(value) => updatePreference(updateProfile, "language", value as CardLanguage)}
          />
          <SegmentedControl ariaLabel="卡片尺寸" value={profile.cardPreferences.size} options={sizes} onChange={(value) => updatePreference(updateProfile, "size", value as CardSize)} />
        </ActionToolbar>

        <div className="ControlRow">
          <SelectField
            label="主题"
            value={profile.cardPreferences.theme}
            onChange={(value) => updatePreference(updateProfile, "theme", value as CardTheme)}
            options={themes}
          />
          <SelectField
            label="核实状态"
            value={profile.cardPreferences.verificationStatus}
            onChange={(value) => updatePreference(updateProfile, "verificationStatus", value as VerificationStatus)}
            options={verificationOptions}
          />
        </div>

        <SwitchControl
          checked={profile.cardPreferences.includeQrCode}
          onCheckedChange={(checked) => updatePreference(updateProfile, "includeQrCode", checked)}
        >
          <QrCode size={16} />
          二维码
        </SwitchControl>
      </div>

      <MissingSuggestions items={missingSuggestions} />
      {shouldWarnBeforeExport ? (
        <div className="Alert Alert--warning" role="alert">
          <strong>打印/导出前需核实</strong>
          <p>当前资料未核实或包含 AI 草稿。请由患者、监护人或医生核实后再打印、导出或随身使用。</p>
        </div>
      ) : null}
      <EmergencyCardPreview card={card} qrPayload={qrPayload} includeQrCode={profile.cardPreferences.includeQrCode} />

      <ActionToolbar label="导出操作" className="ExportActions">
        <AppButton variant="primary" onClick={() => window.print()}>
          <Printer size={18} />
          打印 / PDF
        </AppButton>
        <AppButton variant="secondary" onClick={() => downloadLockscreen(card)}>
          <FileDown size={18} />
          下载锁屏图
        </AppButton>
        <AppButton variant="secondary" onClick={() => downloadTextFile("emergency-card-summary.json", qrPayload, "application/json")}>
          <Download size={18} />
          摘要 JSON
        </AppButton>
      </ActionToolbar>
    </div>
  );
}

function StepActions({
  currentStepIndex,
  totalSteps,
  nextLabel,
  nextDisabled,
  onPrevious
}: {
  currentStepIndex: number;
  totalSteps: number;
  nextLabel: string;
  nextDisabled?: boolean;
  onPrevious: () => void;
}) {
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <ActionToolbar label="步骤操作" className="StepActions">
      <AppButton variant="secondary" type="button" disabled={currentStepIndex === 0} onClick={onPrevious}>
        <ChevronLeft size={18} />
        上一步
      </AppButton>
      <AppButton variant="primary" type="submit" disabled={isLastStep || nextDisabled}>
        {nextLabel}
        <ChevronRight size={18} />
      </AppButton>
    </ActionToolbar>
  );
}

function SummaryAside({
  card,
  profile,
  progress,
  missingSuggestions,
  entryMode,
  currentStep
}: {
  card: EmergencyCard;
  profile: PatientProfile;
  progress: number;
  missingSuggestions: string[];
  entryMode: EntryMode | null;
  currentStep: WizardStepId;
}) {
  const summary = getSummaryDisplay({ card, profile, entryMode, currentStep });

  return (
    <aside className="SummaryPane" aria-label="填写摘要">
      <section className="SummaryPanel">
        <div className="SummaryPanel-head">
          <ClipboardCheck size={19} />
          <h2>完成进度</h2>
        </div>
        <ProgressBar value={progress} label={`完成进度 ${progress}%`} />
        <p className="SummaryProgress">{progress}%</p>
      </section>

      <section className="SummaryPanel">
        <div className="SummaryPanel-head">
          <HeartPulse size={19} />
          <h2>卡片摘要</h2>
        </div>
        <dl className="SummaryList">
          <div>
            <dt>姓名</dt>
            <dd>{summary.name}</dd>
          </div>
          <div>
            <dt>诊断</dt>
            <dd>{summary.condition}</dd>
          </div>
          <div>
            <dt>关键警告</dt>
            <dd>{summary.warningText}</dd>
          </div>
          <div>
            <dt>急救电话</dt>
            <dd>{summary.phone}</dd>
          </div>
        </dl>
        {summary.note ? <p className="SummaryCopy SummaryCopy--strong">{summary.note}</p> : null}
      </section>

      <section className="SummaryPanel SummaryPanel--preview">
        <div className="SummaryPanel-head">
          <FileText size={19} />
          <h2>卡片快照</h2>
        </div>
        <div className={`MiniCard ${card.patientName ? "" : "is-empty"}`}>
          <div className="MiniCard-title">
            <span>{cardLabels[card.language].title}</span>
            <strong>{card.patientName || "待填写"}</strong>
          </div>
          <dl className="MiniCard-fields">
            <div>
              <dt>诊断</dt>
              <dd>{summary.condition === "未填写" ? "—" : summary.condition}</dd>
            </div>
            <div>
              <dt>警告</dt>
              <dd>{summary.warningText === "未填写" ? "—" : summary.warningText}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="SummaryPanel SummaryPanel--notice">
        <div className="SummaryPanel-head">
          <Info size={19} />
          <h2>核实提醒</h2>
        </div>
        <p className="SummaryCopy">信息保存在本机浏览器草稿中。医疗内容请由患者、监护人或医生核实后再打印使用。</p>
        {missingSuggestions.length ? <p className="SummaryCopy SummaryCopy--strong">仍有 {missingSuggestions.length} 个建议补充项。</p> : null}
      </section>
    </aside>
  );
}

function ValidationSummary({ validation, showValidation }: { validation: StepValidationResult; showValidation: boolean }) {
  const shouldShowWarnings = showValidation && !validation.errors.length && validation.warnings.length > 0;
  if (!showValidation || (!validation.errors.length && !shouldShowWarnings)) return null;

  const issues = validation.errors.length ? validation.errors : validation.warnings;
  return (
    <div className={`Alert ${validation.errors.length ? "Alert--error" : "Alert--warning"}`} role="alert">
      <strong>{validation.errors.length ? "请先完成必填项" : "可以继续，建议稍后补充"}</strong>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}

function MissingSuggestions({ items }: { items: string[] }) {
  return (
    <section className="SuggestionPanel">
      <h3>缺失建议项</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>建议项已填写，请继续核实内容准确性。</p>
      )}
    </section>
  );
}

function getStepIcon(step: WizardStepId) {
  const icons: Record<WizardStepId, React.ReactNode> = {
    mode: <ClipboardCheck size={20} />,
    identity: <UserRound size={20} />,
    diagnosis: <Activity size={20} />,
    risk: <AlertTriangle size={20} />,
    emergency: <ShieldCheck size={20} />,
    preview: <ClipboardCheck size={20} />,
    aiSetup: <KeyRound size={20} />
  };
  return icons[step];
}

function FormHeader({ number, icon, title }: { number: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="form-header">
      <span className="step-number">{number}</span>
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function StringListEditor({
  label,
  values,
  placeholder,
  onChange,
  error,
  assistAction,
  suggestion
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
  error?: string;
  assistAction?: React.ReactNode;
  suggestion?: React.ReactNode;
}) {
  const normalized = values.length ? values : [""];

  return (
    <div className={`list-editor ${error ? "has-error" : ""}`}>
      <div className="list-title-row">
        <div className="list-title">{label}</div>
        {assistAction}
      </div>
      {error ? <em>{error}</em> : null}
      {normalized.map((value, index) => (
        <div className="inline-row" key={`${label}-${index}`}>
          <InlineTextInput
            value={value}
            placeholder={placeholder}
            onChange={(nextValue) => onChange(normalized.map((item, itemIndex) => (itemIndex === index ? nextValue : item)))}
          />
          <IconButton label="删除" onClick={() => onChange(normalized.filter((_, itemIndex) => itemIndex !== index))}>
            <Trash2 size={17} />
          </IconButton>
        </div>
      ))}
      <AppButton variant="secondary" className="Button--add" onClick={() => onChange([...normalized, ""])}>
        <Plus size={17} />
        添加{label}
      </AppButton>
      {suggestion}
    </div>
  );
}

function AllergyEditor({ profile, updateProfile }: { profile: PatientProfile; updateProfile: (updater: ProfileUpdater) => void }) {
  const updateAllergy = (id: string, patch: Partial<Allergy>) =>
    updateProfile((current) => ({
      ...current,
      medical: {
        ...current.medical,
        allergies: current.medical.allergies.map((item) => (item.id === id ? { ...item, ...patch } : item))
      }
    }));

  return (
    <div className="list-editor">
      <div className="list-title">过敏</div>
      {profile.medical.allergies.map((item) => (
        <div className="repeat-row" key={item.id}>
          <InlineTextInput value={item.substance} placeholder="过敏原" onChange={(value) => updateAllergy(item.id, { substance: value })} />
          <InlineTextInput value={item.reaction} placeholder="反应" onChange={(value) => updateAllergy(item.id, { reaction: value })} />
          <InlineSelect
            value={item.severity}
            onChange={(value) => updateAllergy(item.id, { severity: value as Allergy["severity"] })}
            options={[
              { value: "mild", label: "轻度" },
              { value: "severe", label: "严重" },
              { value: "life-threatening", label: "危及生命" }
            ]}
          />
          <IconButton label="删除" onClick={() => removeById(updateProfile, "allergies", item.id)}>
            <Trash2 size={17} />
          </IconButton>
        </div>
      ))}
      <AppButton variant="secondary" className="Button--add" onClick={() => addAllergy(updateProfile)}>
        <Plus size={17} />
        添加过敏
      </AppButton>
    </div>
  );
}

function MedicationEditor({ profile, updateProfile }: { profile: PatientProfile; updateProfile: (updater: ProfileUpdater) => void }) {
  const updateMedication = (id: string, patch: Partial<Medication>) =>
    updateProfile((current) => ({
      ...current,
      medical: {
        ...current.medical,
        medications: current.medical.medications.map((item) => (item.id === id ? { ...item, ...patch } : item))
      }
    }));

  return (
    <div className="list-editor">
      <div className="list-title">用药</div>
      {profile.medical.medications.map((item) => (
        <div className="repeat-row" key={item.id}>
          <InlineTextInput value={item.name} placeholder="药物名称" onChange={(value) => updateMedication(item.id, { name: value })} />
          <InlineTextInput value={item.dosage} placeholder="剂量" onChange={(value) => updateMedication(item.id, { dosage: value })} />
          <InlineTextInput value={item.frequency} placeholder="频率" onChange={(value) => updateMedication(item.id, { frequency: value })} />
          <IconButton label="删除" onClick={() => removeById(updateProfile, "medications", item.id)}>
            <Trash2 size={17} />
          </IconButton>
        </div>
      ))}
      <AppButton variant="secondary" className="Button--add" onClick={() => addMedication(updateProfile)}>
        <Plus size={17} />
        添加用药
      </AppButton>
    </div>
  );
}

function InlineAssistControl({
  value,
  placeholder,
  onChange,
  assistAction
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  assistAction?: React.ReactNode;
}) {
  return (
    <div className="InlineAssistControl">
      <InlineTextInput value={value} placeholder={placeholder} onChange={onChange} />
      {assistAction}
    </div>
  );
}

function ContactEditor({
  profile,
  updateProfile,
  error,
  aiAssistVisible = false,
  aiAssistConfigured = false,
  aiFieldSuggestions = {},
  onRequestAIField,
  onDismissAIField
}: {
  profile: PatientProfile;
  updateProfile: (updater: ProfileUpdater) => void;
  error?: string;
  aiAssistVisible?: boolean;
  aiAssistConfigured?: boolean;
  aiFieldSuggestions?: Record<string, AIFieldSuggestionState>;
  onRequestAIField?: (field: EmergencyAIFieldRequest) => void | Promise<void>;
  onDismissAIField?: (fieldKey: string) => void;
}) {
  const updateContact = (id: string, patch: Partial<EmergencyContact>) =>
    updateProfile((current) => ({
      ...current,
      emergencyContacts: current.emergencyContacts.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));
  const aiAction = (field: EmergencyAIFieldRequest) =>
    aiAssistVisible && onRequestAIField ? <AIFieldButton field={field} state={aiFieldSuggestions[field.key]} configured={aiAssistConfigured} onRequest={onRequestAIField} /> : null;
  const aiSuggestion = (fieldKey: string) =>
    aiAssistVisible && onDismissAIField ? <AIFieldSuggestionView fieldKey={fieldKey} state={aiFieldSuggestions[fieldKey]} onDismiss={onDismissAIField} /> : null;

  return (
    <div className={`list-editor ${error ? "has-error" : ""}`}>
      <div className="list-title">紧急联系人</div>
      {error ? <em>{error}</em> : null}
      {profile.emergencyContacts.map((item) => (
        <div className="ContactAssistGroup" key={item.id}>
          <div className="repeat-row contact-row">
            <InlineAssistControl
              value={item.name}
              placeholder="姓名"
              onChange={(value) => updateContact(item.id, { name: value })}
              assistAction={aiAction({
                key: `contact:${item.id}:name`,
                label: "联系人姓名",
                kind: "text",
                currentValue: item.name,
                instruction: "仅当资料中明确出现紧急联系人姓名时提取；不要编造姓名。"
              })}
            />
            <InlineAssistControl
              value={item.relationship}
              placeholder="关系"
              onChange={(value) => updateContact(item.id, { relationship: value })}
              assistAction={aiAction({
                key: `contact:${item.id}:relationship`,
                label: "联系人关系",
                kind: "text",
                currentValue: item.relationship,
                instruction: "仅当资料中明确出现联系人关系时提取；不要猜测关系。"
              })}
            />
            <InlineAssistControl
              value={item.phone}
              placeholder="电话"
              onChange={(value) => updateContact(item.id, { phone: value })}
              assistAction={aiAction({
                key: `contact:${item.id}:phone`,
                label: "联系人电话",
                kind: "text",
                currentValue: item.phone,
                instruction: "仅当资料中明确出现紧急联系人电话时提取；不要生成虚构号码。"
              })}
            />
            <IconButton label="删除" onClick={() => updateProfile((current) => ({ ...current, emergencyContacts: current.emergencyContacts.filter((contact) => contact.id !== item.id) }))}>
              <Trash2 size={17} />
            </IconButton>
          </div>
          <div className="ContactAssistSuggestions">
            {aiSuggestion(`contact:${item.id}:name`)}
            {aiSuggestion(`contact:${item.id}:relationship`)}
            {aiSuggestion(`contact:${item.id}:phone`)}
          </div>
        </div>
      ))}
      <AppButton
        type="button"
        variant="secondary"
        className="Button--add"
        onClick={() =>
          updateProfile((current) => ({
            ...current,
            emergencyContacts: [...current.emergencyContacts, { id: createId(), name: "", relationship: "", phone: "", priority: current.emergencyContacts.length + 1 }]
          }))
        }
      >
        <Plus size={17} />
        添加联系人
      </AppButton>
    </div>
  );
}

function EmergencyCardPreview({ card, qrPayload, includeQrCode }: { card: EmergencyCard; qrPayload: string; includeQrCode: boolean }) {
  const labels = cardLabels[card.language];
  const verified = verificationLabels[card.language][card.verificationStatus];

  return (
    <article className={`medical-card theme-${card.theme} size-${card.size}`} id="print-card">
      <header className="card-head">
        <div>
          <p>{labels.title}</p>
          <h2>{card.patientName || labels.patient}</h2>
        </div>
        <span className="verification">{verified}</span>
      </header>

      <section className="diagnosis-block">
        <span>{labels.rareDisease}</span>
        <strong>{card.condition}</strong>
        {card.conditionCodes.length ? <small>{card.conditionCodes.join(" / ")}</small> : null}
      </section>

      <div className="identity-row">
        <InfoPill label={labels.birthDate} value={card.birthDate || "-"} />
        <InfoPill label={labels.bloodType} value={card.bloodType === "unknown" ? "-" : card.bloodType} />
      </div>

      <CardSection title={labels.criticalWarnings} fallback={labels.noWarnings} items={card.criticalWarnings} urgent />
      <CardSection title={labels.avoidTreatments} items={card.avoidTreatments} />
      <CardSection title={labels.allergies} fallback={labels.noKnownAllergies} items={card.allergies.map((item) => [item.substance, item.reaction].filter(Boolean).join(": "))} />
      <CardSection title={labels.medications} fallback={labels.noMedications} items={card.medications.map((item) => [item.name, item.dosage, item.frequency].filter(Boolean).join(" "))} />

      {card.preferredProtocol ? (
        <section className="card-section">
          <h3>{labels.protocol}</h3>
          <p>{card.preferredProtocol}</p>
        </section>
      ) : null}

      <div className="card-bottom">
        <section className="card-section contact-section">
          <h3>{labels.specialist}</h3>
          <p>{[card.specialist.name, card.specialist.hospital, card.specialist.phone].filter(Boolean).join(" / ") || "-"}</p>
          <h3>{labels.contacts}</h3>
          {card.contacts.length ? (
            <ul>
              {card.contacts.map((contact, index) => (
                <li key={`${contact.phone}-${index}`}>{[contact.name, contact.relationship, contact.phone].filter(Boolean).join(" / ")}</li>
              ))}
            </ul>
          ) : (
            <p>-</p>
          )}
        </section>
        {includeQrCode ? (
          <div className="qr-block">
            <QRCodeSVG value={qrPayload} size={104} level="M" includeMargin />
            <span>{labels.qr}</span>
          </div>
        ) : null}
      </div>
      <footer>{card.disclaimer}</footer>
    </article>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CardSection({ title, items, fallback, urgent = false }: { title: string; items: string[]; fallback?: string; urgent?: boolean }) {
  const visibleItems = items.filter(Boolean);
  return (
    <section className={`card-section ${urgent ? "urgent" : ""}`}>
      <h3>{title}</h3>
      {visibleItems.length ? (
        <ul>
          {visibleItems.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{fallback ?? "-"}</p>
      )}
    </section>
  );
}

function getSummaryDisplay({
  card,
  profile,
  entryMode,
  currentStep
}: {
  card: EmergencyCard;
  profile: PatientProfile;
  entryMode: EntryMode | null;
  currentStep: WizardStepId;
}) {
  if (!entryMode) {
    return {
      name: "未填写",
      condition: "未填写",
      warningText: "未填写",
      phone: "未填写",
      note: "请选择填写方式；检测到本机草稿时可直接继续编辑。"
    };
  }

  const contactPhone = profile.emergencyInstructions.specialistPhone.trim() || profile.emergencyContacts.find((contact) => contact.phone.trim())?.phone.trim() || "未填写";
  return {
    name: card.patientName || "未填写",
    condition: clean(profile.medical.primaryCondition) || clean(profile.medical.primaryConditionEn) || "未填写",
    warningText: card.criticalWarnings.length ? `${card.criticalWarnings.length} 条` : "未填写",
    phone: contactPhone,
    note: entryMode === "ai" && currentStep === "aiSetup" ? "设置接口后继续按身份、诊断、风险和急救信息逐步填写。" : ""
  };
}

function getCompletionProgress(stepResults: StepValidationResult[], maxUnlockedStepIndex: number, totalSteps: number) {
  if (!totalSteps) return 0;
  const unlockedCount = Math.max(0, Math.min(maxUnlockedStepIndex + 1, totalSteps));
  const completedCount = stepResults.slice(0, unlockedCount).filter((result) => result.errors.length === 0).length;
  return Math.round((completedCount / totalSteps) * 100);
}

function getManualResumeState(profile: PatientProfile): { stepId: WizardStepId; maxUnlockedStepIndex: number } {
  const identityResult = validateStep("identity", profile, "manual");
  if (identityResult.errors.length) return { stepId: "identity", maxUnlockedStepIndex: 1 };

  const diagnosisResult = validateStep("diagnosis", profile, "manual");
  if (diagnosisResult.errors.length) return { stepId: "diagnosis", maxUnlockedStepIndex: 2 };

  const emergencyResult = validateStep("emergency", profile, "manual");
  if (emergencyResult.errors.length) return { stepId: "emergency", maxUnlockedStepIndex: 4 };

  return { stepId: "preview", maxUnlockedStepIndex: 5 };
}

function hasProfileContent(profile: PatientProfile) {
  const listValues = [
    ...profile.emergencyInstructions.criticalWarnings,
    ...profile.emergencyInstructions.avoidTreatments,
    ...profile.medical.allergies.flatMap((item) => [item.substance, item.reaction]),
    ...profile.medical.medications.flatMap((item) => [item.name, item.dosage, item.frequency]),
    ...profile.emergencyContacts.flatMap((item) => [item.name, item.relationship, item.phone])
  ];
  const directValues = [
    profile.personal.name,
    profile.personal.birthDate,
    profile.medical.primaryCondition,
    profile.medical.primaryConditionEn,
    profile.medical.orphaCode,
    profile.medical.icdCode,
    profile.medical.diagnosisNotes,
    profile.emergencyInstructions.preferredProtocol,
    profile.emergencyInstructions.specialistName,
    profile.emergencyInstructions.specialistHospital,
    profile.emergencyInstructions.specialistPhone
  ];

  return profile.personal.bloodType !== "unknown" || [...directValues, ...listValues].some((value) => clean(value));
}

function validateStep(
  stepId: WizardStepId,
  profile: PatientProfile,
  entryMode: EntryMode | null = null,
  aiSettings?: AISettings
): StepValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (stepId === "mode" && !entryMode) {
    errors.push({ field: "entryMode", message: "请选择填写方式。" });
  }

  if (stepId === "aiSetup") {
    if (!hasAISettingsConfigured(aiSettings)) warnings.push({ field: "ai.config", message: "未配置 AI 时可继续填写；急救字段补全会保持禁用。" });
  }

  if (stepId === "identity") {
    if (!clean(profile.personal.name)) errors.push({ field: "personal.name", message: "请填写患者姓名。" });
    if (!clean(profile.personal.birthDate)) warnings.push({ field: "personal.birthDate", message: "建议补充出生日期。" });
    if (profile.personal.bloodType === "unknown") warnings.push({ field: "personal.bloodType", message: "建议补充血型。" });
  }

  if (stepId === "diagnosis") {
    if (!clean(profile.medical.primaryCondition)) errors.push({ field: "medical.primaryCondition", message: "请填写主要诊断。" });
    if (!clean(profile.medical.orphaCode) && !clean(profile.medical.icdCode)) warnings.push({ field: "medical.codes", message: "建议补充 ORPHA 或 ICD 编码。" });
  }

  if (stepId === "risk") {
    if (!profile.medical.allergies.some((item) => clean(item.substance) || clean(item.reaction))) warnings.push({ field: "medical.allergies", message: "建议补充过敏信息。" });
    if (!profile.medical.medications.some((item) => clean(item.name) || clean(item.dosage) || clean(item.frequency))) warnings.push({ field: "medical.medications", message: "建议补充当前用药。" });
  }

  if (stepId === "emergency") {
    if (!profile.emergencyInstructions.criticalWarnings.some((warning) => clean(warning))) {
      errors.push({ field: "emergencyInstructions.criticalWarnings", message: "请至少填写一条关键警告。" });
    }
    if (!hasEmergencyPhone(profile)) {
      errors.push({ field: "emergencyContact.phone", message: "请至少填写一个紧急联系人电话或专科医生联系电话。" });
    }
    if (!clean(profile.emergencyInstructions.preferredProtocol)) warnings.push({ field: "emergencyInstructions.preferredProtocol", message: "建议补充急救说明。" });
  }

  return { errors, warnings };
}

function getMissingSuggestions(profile: PatientProfile) {
  return manualWizardSteps
    .filter((step) => step.id !== "preview")
    .flatMap((step) => validateStep(step.id, profile).warnings)
    .map((issue) => issue.message);
}

function hasEmergencyPhone(profile: PatientProfile) {
  return Boolean(clean(profile.emergencyInstructions.specialistPhone) || profile.emergencyContacts.some((contact) => clean(contact.phone)));
}

function buildAIIntakeFromProfile(profile: PatientProfile): AIIntake {
  const allergies = profile.medical.allergies
    .map((item) => [item.substance, item.reaction, item.severity].map(clean).filter(Boolean).join(" / "))
    .filter(Boolean)
    .join("\n");
  const medications = profile.medical.medications
    .map((item) => [item.name, item.dosage, item.frequency].map(clean).filter(Boolean).join(" / "))
    .filter(Boolean)
    .join("\n");
  const contacts = [
    profile.emergencyInstructions.specialistName || profile.emergencyInstructions.specialistHospital || profile.emergencyInstructions.specialistPhone
      ? `专科联系：${[profile.emergencyInstructions.specialistName, profile.emergencyInstructions.specialistHospital, profile.emergencyInstructions.specialistPhone].map(clean).filter(Boolean).join(" / ")}`
      : "",
    ...profile.emergencyContacts.map((item) => [item.name, item.relationship, item.phone].map(clean).filter(Boolean).join(" / "))
  ]
    .filter(Boolean)
    .join("\n");

  return {
    patientName: clean(profile.personal.name),
    birthDate: clean(profile.personal.birthDate),
    age: describeAgeFromBirthDate(profile.personal.birthDate),
    diagnosis: [profile.medical.primaryCondition, profile.medical.primaryConditionEn, profile.medical.orphaCode, profile.medical.icdCode].map(clean).filter(Boolean).join(" / "),
    knownRisks: profile.emergencyInstructions.criticalWarnings.filter((item) => clean(item)).join("\n"),
    allergies,
    medications,
    doctorAdvice: [profile.emergencyInstructions.preferredProtocol, ...profile.emergencyInstructions.avoidTreatments].map(clean).filter(Boolean).join("\n"),
    contacts,
    freeText: [profile.medical.diagnosisNotes, ...profile.emergencyInstructions.avoidTreatments].map(clean).filter(Boolean).join("\n"),
    preferredLanguage: profile.cardPreferences.language
  };
}

function hasAISettingsConfigured(settings?: AISettings) {
  return Boolean(clean(settings?.baseUrl) && clean(settings?.model) && clean(settings?.apiKey));
}

function describeAgeFromBirthDate(birthDate: string, now = new Date()) {
  const trimmed = clean(birthDate);
  if (!trimmed) return "";
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime()) || date > now) return "";

  let years = now.getFullYear() - date.getFullYear();
  const hasHadBirthdayThisYear = now.getMonth() > date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!hasHadBirthdayThisYear) years -= 1;

  if (years >= 1) return `${years}岁`;

  let months = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months -= 1;
  if (months >= 1) return `${months}个月`;

  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
  return `${days}天`;
}

function getEndpointPreview(baseUrl: string) {
  try {
    return getResponsesEndpoint(baseUrl);
  } catch {
    return "请填写完整 Base URL，例如 https://host/v1";
  }
}

function splitLooseList(value: string) {
  return value
    .split(/[\n；;，,、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getWizardSteps(entryMode: EntryMode | null) {
  if (entryMode === "manual") return manualWizardSteps;
  if (entryMode === "ai") return aiWizardSteps;
  return entryWizardSteps;
}

function clean(value?: string) {
  return value?.trim() ?? "";
}

function updatePersonal<K extends keyof PatientProfile["personal"]>(updateProfile: (updater: ProfileUpdater) => void, key: K, value: PatientProfile["personal"][K]) {
  updateProfile((current) => ({ ...current, personal: { ...current.personal, [key]: value } }));
}

function updateMedical<K extends keyof PatientProfile["medical"]>(updateProfile: (updater: ProfileUpdater) => void, key: K, value: PatientProfile["medical"][K]) {
  updateProfile((current) => ({ ...current, medical: { ...current.medical, [key]: value } }));
}

function updateEmergencyInstructions<K extends keyof PatientProfile["emergencyInstructions"]>(
  updateProfile: (updater: ProfileUpdater) => void,
  key: K,
  value: PatientProfile["emergencyInstructions"][K]
) {
  updateProfile((current) => ({ ...current, emergencyInstructions: { ...current.emergencyInstructions, [key]: value } }));
}

function updatePreference<K extends keyof PatientProfile["cardPreferences"]>(updateProfile: (updater: ProfileUpdater) => void, key: K, value: PatientProfile["cardPreferences"][K]) {
  updateProfile((current) => ({ ...current, cardPreferences: { ...current.cardPreferences, [key]: value } }));
}

function addAllergy(updateProfile: (updater: ProfileUpdater) => void) {
  updateProfile((current) => ({
    ...current,
    medical: {
      ...current.medical,
      allergies: [...current.medical.allergies, { id: createId(), substance: "", reaction: "", severity: "severe" }]
    }
  }));
}

function addMedication(updateProfile: (updater: ProfileUpdater) => void) {
  updateProfile((current) => ({
    ...current,
    medical: {
      ...current.medical,
      medications: [...current.medical.medications, { id: createId(), name: "", dosage: "", frequency: "" }]
    }
  }));
}

function removeById(updateProfile: (updater: ProfileUpdater) => void, key: "allergies" | "medications", id: string) {
  updateProfile((current) => ({
    ...current,
    medical: {
      ...current.medical,
      [key]: current.medical[key].filter((item) => item.id !== id)
    }
  }));
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadLockscreen(card: EmergencyCard) {
  const canvas = document.createElement("canvas");
  canvas.width = 1170;
  canvas.height = 2532;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const palette = getCanvasPalette(card.theme);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.panel;
  roundRect(ctx, 90, 260, 990, 1900, 18);
  ctx.fill();

  ctx.fillStyle = palette.accent;
  roundRect(ctx, 90, 260, 990, 220, 18);
  ctx.fill();

  ctx.fillStyle = palette.accentText;
  ctx.font = "700 52px 'Berkeley Mono', 'SFMono-Regular', monospace";
  ctx.fillText(cardLabels[card.language].title, 140, 350);
  ctx.font = "700 72px 'Berkeley Mono', 'SFMono-Regular', monospace";
  wrapCanvasText(ctx, card.patientName || cardLabels[card.language].patient, 140, 435, 860, 82);

  ctx.fillStyle = palette.text;
  ctx.font = "700 46px 'Berkeley Mono', 'SFMono-Regular', monospace";
  ctx.fillText(card.condition, 140, 610);
  ctx.font = "400 34px 'Berkeley Mono', 'SFMono-Regular', monospace";
  wrapCanvasText(ctx, card.summary, 140, 680, 890, 48);

  let y = 870;
  y = drawCanvasList(ctx, cardLabels[card.language].criticalWarnings, card.criticalWarnings, 140, y, palette.danger);
  y = drawCanvasList(ctx, cardLabels[card.language].avoidTreatments, card.avoidTreatments, 140, y + 36, palette.text);
  y = drawCanvasList(ctx, cardLabels[card.language].allergies, card.allergies.map((item) => [item.substance, item.reaction].filter(Boolean).join(": ")), 140, y + 36, palette.text);
  y = drawCanvasList(ctx, cardLabels[card.language].medications, card.medications.map((item) => [item.name, item.dosage, item.frequency].filter(Boolean).join(" ")), 140, y + 36, palette.text);

  ctx.font = "700 34px 'Berkeley Mono', 'SFMono-Regular', monospace";
  ctx.fillStyle = palette.text;
  ctx.fillText(cardLabels[card.language].contacts, 140, y + 42);
  ctx.font = "400 31px 'Berkeley Mono', 'SFMono-Regular', monospace";
  wrapCanvasText(ctx, card.contacts.map((item) => [item.name, item.relationship, item.phone].filter(Boolean).join(" / ")).join(" | ") || "-", 140, y + 94, 890, 42);

  ctx.fillStyle = palette.muted;
  ctx.font = "400 25px 'Berkeley Mono', 'SFMono-Regular', monospace";
  wrapCanvasText(ctx, card.disclaimer, 140, 2070, 890, 34);

  const link = document.createElement("a");
  link.download = "emergency-card-lockscreen.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function getCanvasPalette(theme: CardTheme) {
  const palettes = {
    clinical: { background: "#fdfcfc", panel: "#f8f7f7", accent: "#201d1d", accentText: "#fdfcfc", danger: "#201d1d", text: "#201d1d", muted: "#6e6e73" },
    contrast: { background: "#201d1d", panel: "#fdfcfc", accent: "#201d1d", accentText: "#fdfcfc", danger: "#201d1d", text: "#201d1d", muted: "#646262" },
    calm: { background: "#f1eeee", panel: "#fdfcfc", accent: "#302c2c", accentText: "#fdfcfc", danger: "#201d1d", text: "#201d1d", muted: "#6e6e73" },
    travel: { background: "#f8f7f7", panel: "#fdfcfc", accent: "#201d1d", accentText: "#fdfcfc", danger: "#201d1d", text: "#201d1d", muted: "#6e6e73" }
  } satisfies Record<CardTheme, { background: string; panel: string; accent: string; accentText: string; danger: string; text: string; muted: string }>;
  return palettes[theme];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;
  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });
  if (line) ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

function drawCanvasList(ctx: CanvasRenderingContext2D, title: string, items: string[], x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = "700 36px 'Berkeley Mono', 'SFMono-Regular', monospace";
  ctx.fillText(title, x, y);
  ctx.fillStyle = "#201d1d";
  ctx.font = "400 31px 'Berkeley Mono', 'SFMono-Regular', monospace";
  let currentY = y + 52;
  const visible = items.filter(Boolean).slice(0, 5);
  if (!visible.length) {
    ctx.fillText("-", x, currentY);
    return currentY + 34;
  }
  visible.forEach((item) => {
    currentY = wrapCanvasText(ctx, `• ${item}`, x, currentY, 880, 42);
  });
  return currentY;
}

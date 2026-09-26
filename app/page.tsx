"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  professionalFields,
  commonToolsByField,
  collaborationTypesByField,
  cvLanguageOptions,
  designPreferences,
  languageLevels,
  platformsByField,
  professionalEvidenceByField,
  getFormOptionLabel,
} from "@/lib/forms";
import { getText, languages, type LanguageCode } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { getCountryLabel, getCountryOptions } from "@/lib/countries";
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";
import { calculateRequestPrice, CVUP_BASE_PRICE_DZD } from "@/lib/pricing";
import { shouldGenerateCoverLetter } from "@/lib/request-deliverables";
import { getSavedClientLanguage, saveClientPreference } from "@/lib/client-preferences";
import { hasAtLeastThreeDistinctSpokenLanguages } from "@/lib/spoken-languages";

const supportingQuestionKeys = [
  "achievements",
  "additional_experience",
  "missing_information",
  "excluded_information",
  "additional_professional_information",
] as const;

type SupportingQuestionKey = (typeof supportingQuestionKeys)[number];
const primaryAttachmentKeys = ["job_description", "current_cv", "certifications", "template"] as const;
type PrimaryAttachmentKey = (typeof primaryAttachmentKeys)[number];

type SupportingMaterialPayload = {
  question_key: string;
  link: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
};
type ExistingSupportingMaterial = { question_key: string; link?: string | null; file_name?: string | null };

type SpokenLanguageEntry = { language: string; level: string; professional_writing: boolean; language_other: string; level_other: string };
const createEmptySpokenLanguage = (): SpokenLanguageEntry => ({ language: "", level: "", professional_writing: false, language_other: "", level_other: "" });
function ensureMinimumSpokenLanguages(entries: unknown): SpokenLanguageEntry[] {
  const saved = Array.isArray(entries) ? entries.filter((entry): entry is SpokenLanguageEntry => Boolean(entry && typeof entry === "object")) : [];
  return [...saved, ...Array.from({ length: Math.max(0, 3 - saved.length) }, createEmptySpokenLanguage)];
}

const initialSupportingLinks: Record<SupportingQuestionKey, string[]> = Object.fromEntries(
  supportingQuestionKeys.map((key) => [key, [""]])
) as Record<SupportingQuestionKey, string[]>;

const initialSupportingFiles: Record<SupportingQuestionKey, (File | null)[]> = Object.fromEntries(
  supportingQuestionKeys.map((key) => [key, [null]])
) as Record<SupportingQuestionKey, (File | null)[]>;

const initialExtraLinks: Record<PrimaryAttachmentKey, string[]> = {
  job_description: [],
  current_cv: [],
  certifications: [],
  template: [],
};

const initialExtraFiles: Record<PrimaryAttachmentKey, (File | null)[]> = {
  job_description: [],
  current_cv: [],
  certifications: [],
  template: [],
};

const initialForm = {
  form_language: "fr",
  full_name: "",
  full_name_arabic: "",
  gender: "",
  date_of_birth: "",
  include_gender_in_cv: false,
  include_date_of_birth_in_cv: false,
  phone: "",
  email: "",
  website: "",
  cv_type: "General CV",
  target_job_title: "",
  company_name: "",
  job_url: "",
  job_description_text: "",
  job_description_file: null as File | null,
  professional_field: "",
  target_role: "",
  cv_language_count: 1,
  selected_cv_languages: ["French"],
  selected_cv_languages_other: "",
  has_current_cv: "Yes",
  current_cv_file: null as File | null,
  optional_cv_link: "",
  tools: [] as string[],
  spoken_languages: [createEmptySpokenLanguage(), createEmptySpokenLanguage(), createEmptySpokenLanguage()],
  professional_evidence: [] as string[],
  professional_evidence_other: "",
  platforms_worked_with: [] as string[],
  platforms_other: "",
  tools_other: "",
  has_measurable_achievements: "No",
  measurable_achievements_text: "",
  has_additional_experience: "No",
  additional_experience_text: "",
  collaboration_types: [] as string[],
  collaboration_other: "",
  current_country: "",
  nationality: "",
  willing_to_relocate: "No",
  target_countries: "",
  work_authorization: "Not sure",
  work_authorization_other: "",
  additional_professional_information: "",
  cv_design_preference_other: "",
  has_certifications: "No",
  certifications_text: "",
  certifications_file: null as File | null,
  certifications_link: "",
  cv_design_preference: "ATS-friendly simple professional design",
  cv_template_file: null as File | null,
  cv_template_link: "",
  additional_information: "",
  excluded_information: "",
  recruitment_consent: "No",
  final_consent: false,
};

function CvUpLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-logo-circle ${compact ? "brand-logo-circle--compact" : ""}`}>
      <Image
        src="/brand/cvup-logo.png"
        alt="CVUp"
        width={compact ? 42 : 92}
        height={compact ? 42 : 92}
        className="brand-logo"
        priority={compact}
      />
    </span>
  );
}

function WhatsAppIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="whatsapp-icon"><path d="M19.05 4.93A9.88 9.88 0 0 0 12.02 2C6.56 2 2.12 6.43 2.12 11.9c0 1.75.46 3.46 1.34 4.96L2 22l5.28-1.39a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.89-4.44 9.89-9.9 0-2.65-1.03-5.14-2.87-6.98Zm-7.03 15.2h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.14.83.84-3.06-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.53 3.69-8.22 8.23-8.22a8.18 8.18 0 0 1 5.82 2.41 8.18 8.18 0 0 1 2.4 5.83c0 4.53-3.69 8.21-8.19 8.21Zm4.5-6.15c-.25-.13-1.47-.73-1.7-.81-.23-.08-.39-.13-.55.13-.16.25-.63.81-.77.98-.14.16-.28.19-.53.06-.25-.13-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.01-.39.11-.52.11-.11.25-.28.37-.42.13-.14.17-.25.25-.41.08-.16.04-.3-.02-.42-.06-.13-.55-1.34-.76-1.84-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.25-.84.82-.84 2.02s.86 2.34.98 2.5c.12.16 1.68 2.57 4.07 3.6.57.25 1.01.4 1.36.51.57.18 1.09.15 1.5.09.46-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.22-.16-.47-.29Z" /></svg>;
}

export default function HomePage() {
  const router = useRouter();
  const sofizpayUrl = process.env.NEXT_PUBLIC_SOFIZPAY_PAYMENT_URL?.trim();
  const [language, setLanguage] = useState<LanguageCode>("fr");
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFloatingCta, setShowFloatingCta] = useState(true);
  const [clientFlow, setClientFlow] = useState(false);
  const [hasReusableProfile, setHasReusableProfile] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [draftOwnerId, setDraftOwnerId] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [draftFileNames, setDraftFileNames] = useState<string[]>([]);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spokenLanguageError, setSpokenLanguageError] = useState(false);
  const [reviewEditStep, setReviewEditStep] = useState<number | null>(null);
  const [supportingLinks, setSupportingLinks] = useState(initialSupportingLinks);
  const [supportingFiles, setSupportingFiles] = useState(initialSupportingFiles);
  const [existingSupportingMaterials, setExistingSupportingMaterials] = useState<ExistingSupportingMaterial[]>([]);
  const [extraLinks, setExtraLinks] = useState(initialExtraLinks);
  const [extraFiles, setExtraFiles] = useState(initialExtraFiles);
  const [editingRequestCode, setEditingRequestCode] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editSubmissionToken, setEditSubmissionToken] = useState<string | null>(null);
  const [existingFileNames, setExistingFileNames] = useState<Partial<Record<"current_cv_file" | "job_description_file" | "certifications_file" | "cv_template_file", string>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const wizardSteps = [
    { ar: "بياناتك الشخصية", fr: "Vos informations", en: "Personal details" },
    { ar: "هدف السيرة الذاتية", fr: "Votre objectif", en: "CV target" },
    { ar: "الخبرة المهنية", fr: "Expérience professionnelle", en: "Professional experience" },
    { ar: "المهارات والأدوات", fr: "Compétences et outils", en: "Skills & tools" },
    { ar: "اللغات والشهادات", fr: "Langues et certifications", en: "Languages & certifications" },
    { ar: "الملفات والتفضيلات", fr: "Documents et préférences", en: "Files & preferences" },
    { ar: "مراجعة الطلب", fr: "Vérification", en: "Review" },
  ] as const;
  const stepTitle = (step: (typeof wizardSteps)[number]) => step[language];
  const optionLabel = (value: string) => {
    const label = getFormOptionLabel(value, language);
    return value === "Other" ? `+ ${label}` : label;
  };
  const ui = (ar: string, fr: string, en: string) => language === "ar" ? ar : language === "fr" ? fr : en;
  const countryOptions = useMemo(() => getCountryOptions(language), [language]);
  const countryLabel = (value: string) => getCountryLabel(value, language);

  useEffect(() => {
    document.getElementById("wizard-step-title")?.focus();
  }, [currentStep]);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const editCode = params.get("edit");
      const isAccountRequest = ["1", "profile"].includes(params.get("new") || "") || Boolean(editCode);
      setClientFlow(isAccountRequest);

      const flowLanguage: LanguageCode = getSavedClientLanguage();
      const storedLanguage = window.localStorage.getItem("cvup_language");
      const flowText = (ar: string, fr: string, en: string) => flowLanguage === "ar" ? ar : flowLanguage === "fr" ? fr : en;
      if (storedLanguage === "ar" || storedLanguage === "fr" || storedLanguage === "en") {
        setLanguage(storedLanguage);
        setForm((current) => ({ ...current, form_language: storedLanguage }));
      }

      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (isAccountRequest && !user) {
        const next = editCode ? `/?edit=${encodeURIComponent(editCode)}#form` : "/?new=1#form";
        window.location.replace(`/account/login?next=${encodeURIComponent(next)}`);
        return;
      }

      if (editCode && user) {
        setStatus(flowText("جارٍ تحميل الطلب السابق…", "Chargement de la demande…", "Loading your previous request…"));
        const response = await fetch(`/api/account/requests/${encodeURIComponent(editCode)}`, { cache: "no-store" });
        const result = await response.json();

        if (!response.ok || !result?.request) {
          setStatus(result?.error || flowText("تعذر تحميل الطلب.", "Impossible de charger la demande.", "We couldn't load this request."));
          return;
        }

        if (!result.editable) {
          setStatus(flowText("لا يمكن تعديل هذا الطلب بعد بدء المعالجة.", "Cette demande ne peut plus être modifiée après le début du traitement.", "This request can no longer be edited after processing has started."));
          return;
        }

        const request = result.request as Record<string, unknown>;
        setExistingSupportingMaterials(Array.isArray(request.supporting_materials)
          ? request.supporting_materials.filter((item): item is ExistingSupportingMaterial => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).question_key === "string"))
          : []);
        const raw = request.raw_payload && typeof request.raw_payload === "object" && !Array.isArray(request.raw_payload) ? request.raw_payload as Record<string, unknown> : {};
        const formLanguage = ["ar", "fr", "en"].includes(String(raw.form_language || request.form_language))
          ? String(raw.form_language || request.form_language) as LanguageCode
          : "fr";

        setLanguage(formLanguage);
        window.localStorage.setItem("cvup_language", formLanguage);
        setForm((current) => ({
          ...current,
          ...raw,
          form_language: formLanguage,
          full_name: String(raw.full_name || request.full_name || ""),
          full_name_arabic: String(raw.full_name_arabic || ""),
          phone: String(raw.phone || request.phone || ""),
          email: String(raw.email || request.email || user.email || ""),
          cv_type: String(raw.cv_type || request.cv_type || "General CV"),
          target_job_title: String(raw.target_job_title || request.target_job_title || ""),
          company_name: String(raw.company_name || request.company_name || ""),
          job_url: String(raw.job_url || request.job_url || ""),
          job_description_text: String(raw.job_description_text || request.job_description_text || ""),
          professional_field: String(raw.professional_field || request.professional_field || current.professional_field),
          target_role: String(raw.target_role || request.target_role || ""),
          cv_language_count: Number(raw.cv_language_count || request.cv_language_count || 1),
          selected_cv_languages: Array.isArray(raw.selected_cv_languages)
            ? raw.selected_cv_languages
            : Array.isArray(request.selected_cv_languages) ? request.selected_cv_languages : ["French"],
          has_current_cv: raw.has_current_cv === true || raw.has_current_cv === "Yes" || request.has_current_cv === true ? "Yes" : "No",
          optional_cv_link: String(raw.optional_cv_link || request.optional_cv_link || ""),
          tools: Array.isArray(raw.tools) ? raw.tools : Array.isArray(request.tools) ? request.tools : [],
          spoken_languages: ensureMinimumSpokenLanguages(Array.isArray(raw.spoken_languages) ? raw.spoken_languages : request.spoken_languages),
          has_certifications: raw.has_certifications === true || raw.has_certifications === "Yes" || request.has_certifications === true ? "Yes" : "No",
          certifications_text: String(raw.certifications_text || request.certifications_text || ""),
          certifications_link: String(raw.certifications_link || request.certifications_link || ""),
          cv_design_preference: String(raw.cv_design_preference || request.cv_design_preference || current.cv_design_preference),
          cv_template_link: String(raw.cv_template_link || request.cv_template_link || ""),
          additional_information: String(raw.additional_information || request.additional_information || ""),
          excluded_information: String(raw.excluded_information || request.excluded_information || ""),
          recruitment_consent: raw.recruitment_consent === true || raw.recruitment_consent === "Yes" || request.recruitment_consent === true ? "Yes" : "No",
          final_consent: Boolean(raw.final_consent ?? request.final_consent),
          current_cv_file: null,
          job_description_file: null,
          certifications_file: null,
          cv_template_file: null,
        } as typeof current));

        setEditingRequestCode(editCode);
        setEditingRequestId(String(request.id));
        setEditSubmissionToken(typeof result.submission_token === "string" ? result.submission_token : null);
        setExistingFileNames({
          current_cv_file: typeof request.current_cv_file_name === "string" ? request.current_cv_file_name : undefined,
          job_description_file: typeof request.job_description_file_name === "string" ? request.job_description_file_name : undefined,
          certifications_file: typeof request.certifications_file_name === "string" ? request.certifications_file_name : undefined,
          cv_template_file: typeof request.cv_template_file_name === "string" ? request.cv_template_file_name : undefined,
        });
        setCurrentStep(7);
        setReviewEditStep(null);
        setStatus(null);
        window.requestAnimationFrame(() => document.getElementById("form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }

      if (!user) return;
      let localDraft: Record<string, unknown> | null = null;
      if (isAccountRequest && !editCode) {
        try {
          const storedDraft = window.localStorage.getItem(`cvup_request_draft_${user.id}`);
          localDraft = storedDraft ? JSON.parse(storedDraft) as Record<string, unknown> : null;
        } catch {
          localDraft = null;
        }
      }
      const [profileResult, remoteDraftResponse] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        isAccountRequest && !editCode ? fetch("/api/account/draft", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).catch(() => null) : Promise.resolve(null),
      ]);
      const profile = profileResult.data;
      const remoteDraft = remoteDraftResponse?.draft && typeof remoteDraftResponse.draft === "object" ? remoteDraftResponse.draft as Record<string, unknown> : null;
      const requestDraft = remoteDraft || localDraft;
      const profileData = profile?.profile_data && typeof profile.profile_data === "object" && !Array.isArray(profile.profile_data) ? profile.profile_data as Record<string, unknown> : {};
      const professionalProfile = profileData.professional_profile && typeof profileData.professional_profile === "object" && !Array.isArray(profileData.professional_profile) ? profileData.professional_profile as Record<string, unknown> : {};
      const personalProfile = profileData.personal_profile && typeof profileData.personal_profile === "object" && !Array.isArray(profileData.personal_profile) ? profileData.personal_profile as Record<string, unknown> : {};
      const savedExperience = typeof professionalProfile.experience === "string" ? professionalProfile.experience : "";
      const savedAchievements = typeof professionalProfile.achievements === "string" ? professionalProfile.achievements : "";
      const savedEducation = typeof professionalProfile.education === "string" ? professionalProfile.education : "";
      const savedProjects = typeof professionalProfile.projects === "string" ? professionalProfile.projects : "";
      const savedSkills = typeof professionalProfile.skills === "string" ? professionalProfile.skills : "";
      const savedAdditionalInformation = [
        savedEducation && `${flowText("التعليم والتكوين", "Études et formations", "Education and training")}\n${savedEducation}`,
        savedProjects && `${flowText("المشاريع", "Projets", "Projects")}\n${savedProjects}`,
        savedSkills && `${flowText("المهارات", "Compétences", "Skills")}\n${savedSkills}`,
      ].filter(Boolean).join("\n\n");
      const savedTools = Array.isArray(profile?.tools) ? profile.tools.filter((item: unknown): item is string => typeof item === "string") : [];
      const savedLanguages = Array.isArray(profile?.spoken_languages) ? profile.spoken_languages : [];
      setHasReusableProfile(Boolean(profile?.full_name_latin || profile?.full_name_arabic || profile?.phone || profile?.professional_field || savedExperience || savedEducation || savedProjects || savedSkills || savedAchievements || personalProfile.gender || personalProfile.date_of_birth || savedTools.length || savedLanguages.length || (typeof profile?.certifications_text === "string" && profile.certifications_text.trim())));
      setForm((current) => ({
        ...current,
        email: current.email || user.email || "",
        full_name: current.full_name || profile?.full_name_latin || "",
        full_name_arabic: current.full_name_arabic || profile?.full_name_arabic || "",
        gender: current.gender || (typeof personalProfile.gender === "string" ? personalProfile.gender : ""),
        date_of_birth: current.date_of_birth || (typeof personalProfile.date_of_birth === "string" ? personalProfile.date_of_birth : ""),
        include_gender_in_cv: current.include_gender_in_cv || personalProfile.include_gender_in_cv === true,
        include_date_of_birth_in_cv: current.include_date_of_birth_in_cv || personalProfile.include_date_of_birth_in_cv === true,
        phone: current.phone || profile?.phone || "",
        current_country: current.current_country || profile?.current_country || "",
        nationality: current.nationality || profile?.nationality || "",
        professional_field: profile?.professional_field || current.professional_field,
        target_role: current.target_role || profile?.target_role || "",
        tools: current.tools.length ? current.tools : savedTools,
        spoken_languages: savedLanguages.length ? ensureMinimumSpokenLanguages(savedLanguages) : current.spoken_languages,
        certifications_text: current.certifications_text || profile?.certifications_text || "",
        additional_experience_text: current.additional_experience_text || savedExperience,
        has_additional_experience: savedExperience ? "Yes" : current.has_additional_experience,
        measurable_achievements_text: current.measurable_achievements_text || savedAchievements,
        has_measurable_achievements: savedAchievements ? "Yes" : current.has_measurable_achievements,
        additional_professional_information: current.additional_professional_information || savedAdditionalInformation,
      }));

      if (isAccountRequest && !editCode) {
        setDraftOwnerId(user.id);
        if (requestDraft && requestDraft.form && typeof requestDraft.form === "object" && !Array.isArray(requestDraft.form)) {
          const savedForm = requestDraft.form as Record<string, unknown>;
          setForm((current) => ({
            ...current,
            ...savedForm,
            form_language: ["ar", "fr", "en"].includes(String(savedForm.form_language)) ? savedForm.form_language as LanguageCode : current.form_language,
            current_cv_file: null,
            job_description_file: null,
            certifications_file: null,
            cv_template_file: null,
            final_consent: false,
          } as typeof current));
          if (requestDraft.supportingLinks && typeof requestDraft.supportingLinks === "object") setSupportingLinks({ ...initialSupportingLinks, ...requestDraft.supportingLinks as typeof initialSupportingLinks });
          if (requestDraft.extraLinks && typeof requestDraft.extraLinks === "object") setExtraLinks({ ...initialExtraLinks, ...requestDraft.extraLinks as typeof initialExtraLinks });
          const savedStep = Number(requestDraft.step);
          if (Number.isInteger(savedStep) && savedStep >= 1 && savedStep <= 7) setCurrentStep(savedStep);
          if (Array.isArray(requestDraft.fileNames)) setDraftFileNames(requestDraft.fileNames.filter((name): name is string => typeof name === "string"));
          if (typeof requestDraft.saved_at === "string") setDraftSavedAt(requestDraft.saved_at);
          setDraftExists(true);
        }
        setDraftReady(true);
      }

      if (isAccountRequest) {
        if (!requestDraft) setCurrentStep(1);
        window.requestAnimationFrame(() => document.getElementById("form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    })();
  }, []);

  useEffect(() => {
    if (!draftReady || !clientFlow || editingRequestCode || !draftOwnerId) return;
    const fileFields = new Set(["current_cv_file", "job_description_file", "certifications_file", "cv_template_file"]);
    const draftForm = Object.fromEntries(Object.entries(form).filter(([key]) => !fileFields.has(key)));
    draftForm.final_consent = false;
    const fileNames = [
      form.current_cv_file?.name,
      form.job_description_file?.name,
      form.certifications_file?.name,
      form.cv_template_file?.name,
      ...Object.values(supportingFiles).flatMap((files) => files.map((file) => file?.name)),
      ...Object.values(extraFiles).flatMap((files) => files.map((file) => file?.name)),
    ].filter((name): name is string => Boolean(name));
    const draft = { form: draftForm, supportingLinks, extraLinks, step: currentStep, fileNames };
    const localKey = `cvup_request_draft_${draftOwnerId}`;
    const substantiveKeys = ["full_name", "full_name_arabic", "gender", "date_of_birth", "phone", "email", "target_job_title", "company_name", "job_url", "job_description_text", "professional_field", "target_role", "optional_cv_link", "professional_evidence_other", "measurable_achievements_text", "additional_experience_text", "current_country", "nationality", "target_countries", "work_authorization_other", "additional_professional_information", "certifications_text", "certifications_link", "cv_template_link", "cv_design_preference_other", "additional_information", "excluded_information"];
    const hasSubstantiveFormData = substantiveKeys.some((key) => typeof draftForm[key] === "string" && String(draftForm[key]).trim())
      || form.tools.length > 0 || form.spoken_languages.some((entry) => entry.language || entry.language_other || entry.level)
      || form.professional_evidence.length > 0 || form.platforms_worked_with.length > 0 || form.collaboration_types.length > 0
      || fileNames.length > 0 || Object.values(supportingLinks).flat().some((link) => link.trim()) || Object.values(extraLinks).flat().some((link) => link.trim());
    if (!hasSubstantiveFormData) {
      window.localStorage.removeItem(localKey);
      if (draftExists) {
        void fetch("/api/account/draft", { method: "DELETE" })
          .then((response) => {
            if (response.ok) {
              setDraftExists(false);
              setDraftSaveStatus("idle");
              setDraftSavedAt("");
            }
          })
          .catch(() => null);
      }
      return;
    }
    try { window.localStorage.setItem(localKey, JSON.stringify(draft)); } catch { /* Browser storage may be unavailable. */ }
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    const saveDraft = async (keepalive = false) => {
      try {
        const response = await fetch("/api/account/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft }),
          keepalive,
        });
        if (!response.ok) throw new Error("Draft save failed");
        const result = await response.json();
        setDraftSaveStatus("saved");
        setDraftExists(true);
        setDraftSavedAt(typeof result.saved_at === "string" ? result.saved_at : new Date().toISOString());
        try { window.localStorage.setItem(localKey, JSON.stringify({ ...draft, saved_at: typeof result.saved_at === "string" ? result.saved_at : new Date().toISOString() })); } catch { /* Browser storage may be unavailable. */ }
      } catch {
        setDraftSaveStatus("error");
      }
    };
    const saveOnExit = () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
      void saveDraft(true);
    };
    window.addEventListener("pagehide", saveOnExit);
    draftSaveTimer.current = setTimeout(() => {
      setDraftSaveStatus("saving");
      void saveDraft();
    }, 700);
    return () => {
      window.removeEventListener("pagehide", saveOnExit);
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [draftReady, draftExists, clientFlow, editingRequestCode, draftOwnerId, form, supportingLinks, extraLinks, supportingFiles, extraFiles, currentStep]);

  function validationMessageFor(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    if (field.validity.valueMissing) {
      return ui(
        "هذا الحقل إجباري. يرجى إدخال المعلومة المطلوبة قبل المتابعة.",
        "Ce champ est obligatoire. Veuillez renseigner l’information demandée avant de continuer.",
        "This field is required. Please enter the requested information before continuing."
      );
    }
    if (field.validity.typeMismatch && field.type === "email") {
      return ui(
        "يرجى إدخال بريد إلكتروني صحيح، مثال: name@example.com",
        "Veuillez saisir une adresse e-mail valide, par exemple : name@example.com",
        "Please enter a valid email address, for example: name@example.com"
      );
    }
    if (field.validity.typeMismatch && field.type === "url") {
      return ui(
        "يرجى إدخال رابط كامل وصحيح، مثال: https://example.com",
        "Veuillez saisir un lien complet et valide, par exemple : https://example.com",
        "Please enter a complete valid link, for example: https://example.com"
      );
    }
    if (field.validity.patternMismatch && field.dataset.validationKind === "latin-name") {
      return ui(
        "يرجى كتابة الاسم واللقب بالأحرف اللاتينية فقط كما تريد أن يظهرا في السيرة الذاتية.",
        "Veuillez écrire le nom et le prénom uniquement en caractères latins, tels qu’ils doivent apparaître sur le CV.",
        "Please write your full name using Latin characters only, exactly as it should appear on the CV."
      );
    }
    if (field.validity.patternMismatch && field.dataset.validationKind === "phone") {
      return ui(
        "يرجى إدخال رقم واتساب صحيح مع رمز الدولة، مثال: +213 5XX XX XX XX",
        "Veuillez saisir un numéro WhatsApp valide avec l’indicatif du pays, par exemple : +213 5XX XX XX XX",
        "Please enter a valid WhatsApp number with country code, for example: +213 5XX XX XX XX"
      );
    }
    return ui(
      "المعلومة المدخلة غير صحيحة. يرجى مراجعتها وتصحيحها قبل المتابعة.",
      "La valeur saisie n’est pas valide. Veuillez la vérifier et la corriger avant de continuer.",
      "The entered value is not valid. Please review and correct it before continuing."
    );
  }

  function clearInlineValidation(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    field.classList.remove("border-red-500", "focus:border-red-500", "bg-red-50");
    field.removeAttribute("aria-invalid");
    const container = field.closest("label") ?? field.parentElement;
    container?.querySelector(":scope > [data-inline-validation-error]")?.remove();
  }

  function showInlineValidation(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    clearInlineValidation(field);
    field.classList.add("border-red-500", "focus:border-red-500", "bg-red-50");
    field.setAttribute("aria-invalid", "true");
    const message = document.createElement("p");
    message.dataset.inlineValidationError = "true";
    message.className = "mt-2 text-sm font-medium text-red-600";
    message.setAttribute("role", "alert");
    message.textContent = validationMessageFor(field);
    const container = field.closest("label") ?? field.parentElement;
    container?.appendChild(message);
  }

  function handleInvalidField(event: React.InvalidEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.target;
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      showInlineValidation(field);
    }
  }

  function handleValidationInput(event: React.FormEvent<HTMLFormElement>) {
    const field = event.target;
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      if (field.checkValidity()) clearInlineValidation(field);
    }
  }

  function validateCurrentStep() {
    if (!formRef.current || currentStep === 7) return true;
    const fields = Array.from(formRef.current.querySelectorAll<HTMLElement>(`[data-wizard-step="${currentStep}"] input, [data-wizard-step="${currentStep}"] select, [data-wizard-step="${currentStep}"] textarea`));
    const invalid = fields.find((field) => field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement ? !field.checkValidity() : false);
    if (invalid) {
      const invalidField = invalid as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      showInlineValidation(invalidField);
      invalidField.focus({ preventScroll: true });
      invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (currentStep === 5) {
      const entries = form.spoken_languages;
      if (!hasAtLeastThreeDistinctSpokenLanguages(entries)) {
        setSpokenLanguageError(true);
        const languageSelect = formRef.current.querySelector<HTMLSelectElement>('[data-language-select="true"]');
        languageSelect?.focus({ preventScroll: true });
        languageSelect?.scrollIntoView({ behavior: "smooth", block: "center" });
        return false;
      }
    }
    setSpokenLanguageError(false);
    return true;
  }

  function buildFormPayload() {
    const fileFields = new Set(["current_cv_file", "job_description_file", "certifications_file", "cv_template_file"]);
    const serializableForm = Object.fromEntries(Object.entries(form).filter(([key]) => !fileFields.has(key)));
    const supportingMaterials: SupportingMaterialPayload[] = [
      ...supportingQuestionKeys.flatMap((questionKey) =>
        supportingLinks[questionKey]
          .map((link) => link.trim())
          .filter(Boolean)
          .map((link) => ({ question_key: questionKey, link }))
      ),
      ...primaryAttachmentKeys.flatMap((attachmentKey) =>
        extraLinks[attachmentKey]
          .map((link) => link.trim())
          .filter(Boolean)
          .map((link) => ({ question_key: attachmentKey, link }))
      ),
    ];

    return {
      ...serializableForm,
      selected_cv_languages: form.selected_cv_languages.map((item) =>
        item === "Other" ? form.selected_cv_languages_other.trim() || "Other" : item
      ),
      recruitment_consent: form.recruitment_consent === "Yes",
      final_consent: form.final_consent,
      supporting_materials: supportingMaterials,
    };
  }

  async function moveStep(direction: 1 | -1) {
    if (direction === 1 && !validateCurrentStep()) return;

    if (direction === 1 && reviewEditStep === currentStep) {
      if (editingRequestCode) {
        setIsSubmitting(true);
        setStatus(null);
        try {
          const sectionPayload = { ...buildFormPayload() };
          delete (sectionPayload as Record<string, unknown>).supporting_materials;
          delete (sectionPayload as Record<string, unknown>).final_consent;
          const response = await fetch(`/api/account/requests/${encodeURIComponent(editingRequestCode)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ form: sectionPayload }),
          });
          const result = await response.json().catch(() => null);
          if (!response.ok) throw new Error(result?.error || ui("تعذر حفظ هذا القسم.", "Impossible d’enregistrer cette section.", "We couldn't save this section."));
          if (typeof result?.submission_token === "string") setEditSubmissionToken(result.submission_token);
          setReviewEditStep(null);
          setCurrentStep(7);
        } catch (error) {
          setStatus(error instanceof Error ? error.message : ui("تعذر حفظ التغييرات.", "Impossible d’enregistrer les modifications.", "Couldn't save your changes."));
          setIsSubmitting(false);
          return;
        }
        setIsSubmitting(false);
      } else {
        setReviewEditStep(null);
        setCurrentStep(7);
      }
    } else {
      setCurrentStep((step) => Math.min(7, Math.max(1, step + direction)));
    }

    document.getElementById("form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function editReviewStep(step: number) {
    setReviewEditStep(step);
    setCurrentStep(step);
    document.getElementById("form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const reviewValue = (value: unknown) => {
    if (Array.isArray(value)) return value.length ? value.map((item) => typeof item === "string" ? optionLabel(item) : String(item)).join(", ") : "—";
    if (typeof value === "boolean") return value ? getText(language, "yes") : getText(language, "no");
    if (typeof value === "string") return value ? optionLabel(value) : "—";
    return value === null || value === undefined ? "—" : String(value);
  };
  const fileName = (file: File | null, key?: keyof typeof existingFileNames) => file?.name || (key ? existingFileNames[key] : undefined) || "—";
  const isTargetedCv = form.cv_type !== "General CV";
  const supportLabels: Record<SupportingQuestionKey, string> = {
    achievements: ui("ملفات الإنجازات", "Justificatifs des réalisations", "Achievement evidence"),
    additional_experience: ui("مرفقات الخبرة الإضافية", "Pièces d’expérience complémentaire", "Additional experience attachments"),
    missing_information: ui("مرفقات المعلومات الناقصة", "Pièces des informations manquantes", "Missing information attachments"),
    excluded_information: ui("مرفقات المعلومات المستبعدة", "Pièces des informations exclues", "Excluded information attachments"),
    additional_professional_information: ui("مرفقات المعلومات المهنية الإضافية", "Pièces professionnelles complémentaires", "Additional professional information attachments"),
  };
  const supportingReview = supportingQuestionKeys.flatMap((key) => [
    ...supportingLinks[key].map((link) => link.trim()).filter(Boolean).map((link) => `${supportLabels[key]} — ${link}`),
    ...supportingFiles[key].filter((file): file is File => file instanceof File).map((file) => `${supportLabels[key]} — ${file.name}`),
  ]);
  const extraAttachmentLabels: Record<PrimaryAttachmentKey, string> = {
    job_description: ui("روابط أو ملفات وصف الوظيفة الإضافية", "Liens ou fichiers supplémentaires de l’offre", "Extra job description links or files"),
    current_cv: ui("روابط أو ملفات السيرة الإضافية", "Liens ou fichiers CV supplémentaires", "Extra CV links or files"),
    certifications: ui("روابط أو ملفات شهادات إضافية", "Liens ou fichiers de certificats supplémentaires", "Extra certificate links or files"),
    template: ui("روابط أو ملفات قوالب إضافية", "Liens ou fichiers de modèles supplémentaires", "Extra template links or files"),
  };
  const extraAttachmentReview = primaryAttachmentKeys.flatMap((key) => [
    ...extraLinks[key].map((link) => link.trim()).filter(Boolean).map((link) => `${extraAttachmentLabels[key]} — ${link}`),
    ...extraFiles[key].filter((file): file is File => file instanceof File).map((file) => `${extraAttachmentLabels[key]} — ${file.name}`),
  ]);
  const savedSupportingReview = existingSupportingMaterials.map((material) => {
    const key = material.question_key as SupportingQuestionKey | PrimaryAttachmentKey;
    const label = key in supportLabels ? supportLabels[key as SupportingQuestionKey] : key in extraAttachmentLabels ? extraAttachmentLabels[key as PrimaryAttachmentKey] : key;
    return `${label} — ${material.file_name || material.link || ""}`;
  }).filter((item) => item.trim().endsWith("—") === false);
  const currentSelectedFileNames = [
    form.current_cv_file?.name,
    form.job_description_file?.name,
    form.certifications_file?.name,
    form.cv_template_file?.name,
    ...Object.values(supportingFiles).flatMap((files) => files.map((file) => file?.name)),
    ...Object.values(extraFiles).flatMap((files) => files.map((file) => file?.name)),
  ].filter((name): name is string => Boolean(name));
  const draftFilesToReselect = draftFileNames.filter((name) => !currentSelectedFileNames.includes(name));
  const reviewGroups: { step: number; title: string; values: [string, unknown][] }[] = [
    { step: 1, title: stepTitle(wizardSteps[0]), values: [
      [ui("لغة النموذج", "Langue du formulaire", "Form language"), language === "ar" ? ui("العربية", "Arabe", "Arabic") : language === "fr" ? ui("الفرنسية", "Français", "French") : ui("الإنجليزية", "Anglais", "English")],
      [ui("الاسم بالأحرف اللاتينية", "Nom en caractères latins", "Name in Latin characters"), form.full_name],
      [ui("الاسم بالعربية", "Nom en arabe", "Name in Arabic"), form.full_name_arabic],
      [ui("الجنس", "Genre", "Gender"), form.gender],
      [ui("إظهار الجنس في السيرة الذاتية", "Afficher le genre sur le CV", "Show gender on CV"), form.gender ? (form.include_gender_in_cv ? ui("نعم", "Oui", "Yes") : ui("لا", "Non", "No")) : ""],
      [ui("تاريخ الميلاد", "Date de naissance", "Date of birth"), form.date_of_birth],
      [ui("إظهار تاريخ الميلاد في السيرة الذاتية", "Afficher la date de naissance sur le CV", "Show date of birth on CV"), form.date_of_birth ? (form.include_date_of_birth_in_cv ? ui("نعم", "Oui", "Yes") : ui("لا", "Non", "No")) : ""],
      [ui("رقم واتساب", "Numéro WhatsApp", "WhatsApp number"), form.phone],
      [ui("البريد الإلكتروني", "E-mail", "Email"), form.email],
      [ui("الموقع الإلكتروني", "Site web", "Website"), form.website],
    ] },
    { step: 2, title: stepTitle(wizardSteps[1]), values: [
      [ui("نوع السيرة الذاتية", "Type de CV", "CV type"), form.cv_type],
      [ui("الدور المستهدف", "Rôle visé", "Target role"), form.target_role],
      [ui("المجال المهني", "Domaine professionnel", "Professional field"), form.professional_field],
      [ui("عدد نسخ السيرة الذاتية", "Nombre de versions du CV", "Number of CV versions"), form.cv_language_count],
      [ui("لغات السيرة الذاتية المطلوبة", "Langues du CV demandées", "Requested CV languages"), form.selected_cv_languages.map((item) => item === "Other" ? form.selected_cv_languages_other || optionLabel(item) : optionLabel(item))],
      ...(isTargetedCv ? [
        [ui("المسمى الوظيفي", "Poste visé", "Job title"), form.target_job_title],
        [ui("الشركة", "Entreprise", "Company"), form.company_name],
        [ui("رابط الوظيفة", "Lien de l’offre", "Job URL"), form.job_url],
        [ui("وصف الوظيفة المكتوب", "Description du poste saisie", "Entered job description"), form.job_description_text],
        [ui("ملف وصف الوظيفة", "Fichier de l’offre", "Job description file"), fileName(form.job_description_file, "job_description_file")],
      ] as [string, unknown][] : []),
    ] },
    { step: 3, title: stepTitle(wizardSteps[2]), values: [
      [ui("المسؤوليات والخبرات المحددة", "Responsabilités et expériences sélectionnées", "Selected responsibilities and experience"), form.professional_evidence],
      [ui("مسؤوليات أخرى", "Autres responsabilités", "Other responsibilities"), form.professional_evidence_other],
      [ui("إنجازات قابلة للقياس؟", "Réalisations mesurables ?", "Measurable achievements?"), form.has_measurable_achievements],
      [ui("تفاصيل الإنجازات", "Détails des réalisations", "Achievement details"), form.measurable_achievements_text],
      [ui("خبرة إضافية؟", "Expérience supplémentaire ?", "Additional experience?"), form.has_additional_experience],
      [ui("تفاصيل الخبرة الإضافية", "Détails de l’expérience supplémentaire", "Additional experience details"), form.additional_experience_text],
      [ui("أنواع التعاون", "Types de collaboration", "Collaboration types"), form.collaboration_types],
      [ui("أنواع تعاون أخرى", "Autres types de collaboration", "Other collaboration types"), form.collaboration_other],
      [ui("بلد الإقامة", "Pays de résidence", "Current country"), form.current_country ? countryLabel(form.current_country) : ""],
      [ui("الجنسية", "Nationalité", "Nationality"), form.nationality ? countryLabel(form.nationality) : ""],
      [ui("الاستعداد للانتقال", "Disponibilité à déménager", "Willing to relocate"), form.willing_to_relocate],
      [ui("البلدان المستهدفة", "Pays ciblés", "Target countries"), form.target_countries],
      [ui("تصريح العمل", "Autorisation de travail", "Work authorization"), form.work_authorization],
      [ui("تفاصيل تصريح العمل الأخرى", "Autres détails d’autorisation", "Other work authorization details"), form.work_authorization_other],
    ] },
    { step: 4, title: stepTitle(wizardSteps[3]), values: [
      [ui("الأدوات", "Outils", "Tools"), form.tools], [ui("أدوات أخرى", "Autres outils", "Other tools"), form.tools_other],
      [ui("المنصات المستخدمة", "Plateformes utilisées", "Platforms used"), form.platforms_worked_with], [ui("منصات أخرى", "Autres plateformes", "Other platforms"), form.platforms_other],
    ] },
    { step: 5, title: stepTitle(wizardSteps[4]), values: [
      [ui("اللغات ومستوياتها", "Langues et niveaux", "Languages and proficiency levels"), form.spoken_languages.map((entry) => `${entry.language === "Other" ? entry.language_other || optionLabel(entry.language) : optionLabel(entry.language)} — ${entry.level === "Other" ? entry.level_other || optionLabel(entry.level) : optionLabel(entry.level)}${entry.professional_writing ? ` · ${ui("كتابة مهنية", "Écriture professionnelle", "Professional writing")}` : ""}`)],
      [ui("هل لديك شهادات أو تكوين إضافي؟", "Avez-vous des certificats ou formations ?", "Do you have certificates or additional training?"), form.has_certifications],
      [ui("تفاصيل الشهادات والتكوين", "Détails des certificats et formations", "Certificates and training details"), form.certifications_text],
      [ui("رابط الشهادة", "Lien du certificat", "Certificate link"), form.certifications_link],
      [ui("ملف الشهادة أو التكوين", "Fichier du certificat ou de formation", "Certificate or training file"), fileName(form.certifications_file, "certifications_file")],
    ] },
    { step: 6, title: stepTitle(wizardSteps[5]), values: [
      [ui("هل لديك سيرة ذاتية حالية؟", "Avez-vous déjà un CV ?", "Do you have a current CV?"), form.has_current_cv],
      [ui("ملف السيرة الحالية", "Fichier du CV actuel", "Current CV file"), fileName(form.current_cv_file, "current_cv_file")],
      [ui("رابط السيرة الحالية", "Lien du CV actuel", "Current CV link"), form.optional_cv_link],
      [ui("التصميم المفضل", "Design préféré", "Preferred design"), form.cv_design_preference],
      [ui("تفضيل تصميم آخر", "Autre préférence de design", "Other design preference"), form.cv_design_preference_other],
      [ui("ملف القالب", "Fichier modèle", "Template file"), fileName(form.cv_template_file, "cv_template_file")],
      [ui("رابط القالب", "Lien du modèle", "Template link"), form.cv_template_link],
      [getText(language, "missingInfo"), form.additional_information], [getText(language, "excludedInfo"), form.excluded_information],
      [getText(language, "finalProfessionalInfo"), form.additional_professional_information],
      [ui("الموافقة على مشاركة السيرة", "Accord de partage du CV", "Consent to share the CV"), form.recruitment_consent],
      [ui("التأكيد النهائي على دقة المعلومات", "Confirmation finale de l’exactitude", "Final confirmation of accuracy"), form.final_consent],
      [ui("الروابط والملفات الداعمة", "Liens et fichiers justificatifs", "Supporting links and files"), [...supportingReview, ...extraAttachmentReview, ...savedSupportingReview]],
      [ui("ملفات المسودة التي تحتاج إلى إعادة اختيار", "Fichiers du brouillon à sélectionner de nouveau", "Draft files to select again"), draftFilesToReselect],
    ] },
  ];

  useEffect(() => {
    const formElement = document.getElementById("form");
    if (!formElement) return;
    const observer = new IntersectionObserver(([entry]) => setShowFloatingCta(!entry.isIntersecting), { threshold: 0.08 });
    observer.observe(formElement);
    return () => observer.disconnect();
  }, []);

  const fieldTools = useMemo(
    () => commonToolsByField[form.professional_field] ?? commonToolsByField["Other"],
    [form.professional_field]
  );
  const fieldEvidence = useMemo(
    () => professionalEvidenceByField[form.professional_field] ?? professionalEvidenceByField.Other,
    [form.professional_field]
  );
  const fieldPlatforms = platformsByField[form.professional_field];
  const fieldCollaborations = collaborationTypesByField[form.professional_field];

  const handleFieldChange = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const fileLimitHint = () => (
    <p className="mt-1 text-xs text-slate-500">
      {ui(
        `الحد الأقصى لكل ملف: ${MAX_UPLOAD_SIZE_MB} MB`,
        `Taille maximale par fichier : ${MAX_UPLOAD_SIZE_MB} Mo`,
        `Maximum size per file: ${MAX_UPLOAD_SIZE_MB} MB`
      )}
    </p>
  );

  const supportingMaterialFields = (questionKey: SupportingQuestionKey) => {
    const links = supportingLinks[questionKey];
    const files = supportingFiles[questionKey];

    return (
      <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
        <p className="mb-3 text-sm text-slate-600">
          {ui(
            `يمكنك إضافة أكثر من رابط وأكثر من ملف داعم. كل العناصر اختيارية، والحد الأقصى لكل ملف ${MAX_UPLOAD_SIZE_MB} MB.`,
            `Vous pouvez ajouter plusieurs liens et plusieurs fichiers justificatifs. Tout est facultatif et chaque fichier est limité à ${MAX_UPLOAD_SIZE_MB} Mo.`,
            `You can add multiple links and multiple supporting files. Everything is optional, with a ${MAX_UPLOAD_SIZE_MB} MB limit per file.`
          )}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {links.map((value, index) => (
              <div key={`link-${questionKey}-${index}`} className="flex gap-2">
                <input
                  type="url"
                  value={value}
                  onChange={(event) => setSupportingLinks((current) => ({
                    ...current,
                    [questionKey]: current[questionKey].map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                  }))}
                  placeholder={ui("رابط اختياري", "Lien facultatif", "Optional link")}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
                {links.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setSupportingLinks((current) => ({
                      ...current,
                      [questionKey]: current[questionKey].filter((_, itemIndex) => itemIndex !== index),
                    }))}
                    className="rounded-xl border border-slate-300 px-3 text-slate-500"
                    aria-label={ui("حذف الرابط", "Supprimer le lien", "Remove link")}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSupportingLinks((current) => ({
                ...current,
                [questionKey]: [...current[questionKey], ""],
              }))}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              <span aria-hidden="true">+</span>
              {ui("إضافة رابط آخر", "Ajouter un autre lien", "Add another link")}
            </button>
          </div>

          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={`file-${questionKey}-${index}`} className="flex gap-2">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => setSupportingFiles((current) => ({
                    ...current,
                    [questionKey]: current[questionKey].map((item, itemIndex) => itemIndex === index ? event.target.files?.[0] ?? null : item),
                  }))}
                  className="min-w-0 flex-1 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm"
                />
                {files.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setSupportingFiles((current) => ({
                      ...current,
                      [questionKey]: current[questionKey].filter((_, itemIndex) => itemIndex !== index),
                    }))}
                    className="rounded-xl border border-slate-300 px-3 text-slate-500"
                    aria-label={ui("حذف الملف", "Supprimer le fichier", "Remove file")}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            {fileLimitHint()}
            <button
              type="button"
              onClick={() => setSupportingFiles((current) => ({
                ...current,
                [questionKey]: [...current[questionKey], null],
              }))}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              <span aria-hidden="true">+</span>
              {ui("إضافة ملف آخر", "Ajouter un autre fichier", "Add another file")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const extraAttachmentFields = (attachmentKey: PrimaryAttachmentKey) => {
    const links = extraLinks[attachmentKey];
    const files = extraFiles[attachmentKey];

    return (
      <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
        {links.map((value, index) => (
          <div key={`extra-link-${attachmentKey}-${index}`} className="mb-2 flex gap-2">
            <input
              type="url"
              value={value}
              onChange={(event) => setExtraLinks((current) => ({
                ...current,
                [attachmentKey]: current[attachmentKey].map((item, itemIndex) => itemIndex === index ? event.target.value : item),
              }))}
              placeholder={ui("رابط إضافي", "Lien supplémentaire", "Additional link")}
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
            />
            <button
              type="button"
              onClick={() => setExtraLinks((current) => ({
                ...current,
                [attachmentKey]: current[attachmentKey].filter((_, itemIndex) => itemIndex !== index),
              }))}
              className="rounded-xl border border-slate-300 px-3 text-slate-500"
              aria-label={ui("حذف الرابط", "Supprimer le lien", "Remove link")}
            >
              ×
            </button>
          </div>
        ))}

        {files.map((file, index) => (
          <div key={`extra-file-${attachmentKey}-${index}`} className="mb-2 flex gap-2">
            <input
              type="file"
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
              onChange={(event) => setExtraFiles((current) => ({
                ...current,
                [attachmentKey]: current[attachmentKey].map((item, itemIndex) => itemIndex === index ? event.target.files?.[0] ?? null : item),
              }))}
              className="min-w-0 flex-1 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setExtraFiles((current) => ({
                ...current,
                [attachmentKey]: current[attachmentKey].filter((_, itemIndex) => itemIndex !== index),
              }))}
              className="rounded-xl border border-slate-300 px-3 text-slate-500"
              aria-label={ui("حذف الملف", "Supprimer le fichier", "Remove file")}
            >
              ×
            </button>
          </div>
        ))}

        {fileLimitHint()}

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExtraLinks((current) => ({
              ...current,
              [attachmentKey]: [...current[attachmentKey], ""],
            }))}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            <span aria-hidden="true">+</span>
            {ui("إضافة رابط آخر", "Ajouter un autre lien", "Add another link")}
          </button>
          <button
            type="button"
            onClick={() => setExtraFiles((current) => ({
              ...current,
              [attachmentKey]: [...current[attachmentKey], null],
            }))}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            <span aria-hidden="true">+</span>
            {ui("إضافة ملف آخر", "Ajouter un autre fichier", "Add another file")}
          </button>
        </div>
      </div>
    );
  };

  const handleLanguageSelect = (code: LanguageCode) => {
    setLanguage(code);
    window.localStorage.setItem("cvup_language", code);
    setForm((current) => ({ ...current, form_language: code }));
    void saveClientPreference("preferred_language", code);
  };
  const hasReviewValue = (value: unknown) => Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 && value.trim() !== "—" : value !== null && value !== undefined;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const allFiles = [
        form.current_cv_file,
        form.job_description_file,
        form.certifications_file,
        form.cv_template_file,
        ...Object.values(supportingFiles).flat(),
        ...Object.values(extraFiles).flat(),
      ].filter((file): file is File => file instanceof File);

      if (allFiles.some((file) => file.size > MAX_UPLOAD_SIZE_BYTES)) {
        throw new Error(ui(
          `حجم كل ملف يجب ألا يتجاوز ${MAX_UPLOAD_SIZE_MB} MB.`,
          `Chaque fichier doit faire au maximum ${MAX_UPLOAD_SIZE_MB} Mo.`,
          `Each file must be ${MAX_UPLOAD_SIZE_MB} MB or smaller.`
        ));
      }

      const {
        current_cv_file,
        job_description_file,
        certifications_file,
        cv_template_file,
      } = form;
      const body = buildFormPayload();

      const response = await fetch(
        editingRequestCode ? `/api/account/requests/${encodeURIComponent(editingRequestCode)}` : "/api/requests",
        {
          method: editingRequestCode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingRequestCode ? { form: body } : body),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Submission failed.");
      }

      const requestCode = typeof result?.request_code === "string" ? result.request_code : "";
      const requestId = typeof result?.id === "string" ? result.id : editingRequestId || "";
      const submissionToken = typeof result?.submission_token === "string" ? result.submission_token : editSubmissionToken || "";

      if (!requestCode || !requestId || !submissionToken) {
        throw new Error(ui(
          "تم إنشاء الطلب لكن تعذر تجهيز رفع الملفات.",
          "La demande a été créée, mais le téléversement des fichiers n’a pas pu être préparé.",
          "The request was created, but file upload could not be prepared."
        ));
      }

      const uploadFile = async (file: File, kind: string) => {
        const supabase = getSupabaseBrowserClient();
        const prepareResponse = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            kind,
            token: submissionToken,
            fileName: file.name,
            fileType: file.type || null,
            fileSize: file.size,
          }),
        });
        const prepared = await prepareResponse.json();

        if (!prepareResponse.ok || !prepared?.path || !prepared?.upload_token) {
          throw new Error(prepared?.error || ui(
            "تعذر تجهيز رفع أحد الملفات.",
            "Impossible de préparer le téléversement d’un fichier.",
            "A file upload could not be prepared."
          ));
        }

        const { error: storageError } = await supabase.storage
          .from("cvup-requests")
          .uploadToSignedUrl(prepared.path, prepared.upload_token, file, {
            cacheControl: "3600",
            contentType: prepared.content_type || file.type || undefined,
          });

        if (storageError) {
          throw new Error(ui(
            "تعذر رفع أحد الملفات إلى التخزين.",
            "Le téléversement d’un fichier vers le stockage a échoué.",
            "A file could not be uploaded to storage."
          ));
        }

        const finalizeResponse = await fetch("/api/upload", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            kind,
            token: submissionToken,
            path: prepared.path,
            fileName: file.name,
            fileType: prepared.content_type || file.type || null,
            fileSize: file.size,
          }),
        });
        const finalized = await finalizeResponse.json();

        if (!finalizeResponse.ok) {
          throw new Error(finalized?.error || ui(
            "تم رفع الملف لكن تعذر حفظ معلوماته.",
            "Le fichier a été téléversé mais ses informations n’ont pas pu être enregistrées.",
            "The file was uploaded, but its metadata could not be saved."
          ));
        }

        return {
          path: String(prepared.path),
          file_name: file.name,
          file_type: prepared.content_type || file.type || null,
        };
      };

      const primaryFiles: Array<{ file: File | null; kind: string }> = [
        { file: current_cv_file, kind: "current_cv" },
        { file: job_description_file, kind: "job_description" },
        { file: certifications_file, kind: "certifications" },
        { file: cv_template_file, kind: "template" },
      ];

      for (const item of primaryFiles) {
        if (item.file) await uploadFile(item.file, item.kind);
      }

      const materials = [...body.supporting_materials];

      for (const questionKey of supportingQuestionKeys) {
        for (const file of supportingFiles[questionKey].filter((item): item is File => item instanceof File)) {
          const uploadResult = await uploadFile(file, `supporting:${questionKey}`);
          materials.push({
            question_key: questionKey,
            link: null,
            file_path: String(uploadResult.path),
            file_name: uploadResult.file_name || file.name,
            file_type: uploadResult.file_type || file.type || null,
          });
        }
      }

      for (const attachmentKey of primaryAttachmentKeys) {
        for (const file of extraFiles[attachmentKey].filter((item): item is File => item instanceof File)) {
          const uploadResult = await uploadFile(file, `supporting:${attachmentKey}`);
          materials.push({
            question_key: attachmentKey,
            link: null,
            file_path: String(uploadResult.path),
            file_name: uploadResult.file_name || file.name,
            file_type: uploadResult.file_type || file.type || null,
          });
        }
      }

      if (materials.length) {
        const materialsResponse = await fetch(`/api/requests/${encodeURIComponent(requestCode)}/supporting-materials`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${submissionToken}`,
          },
          body: JSON.stringify({ materials }),
        });

        if (!materialsResponse.ok) {
          throw new Error(ui(
            "تم إنشاء الطلب لكن تعذر حفظ المرفقات الداعمة.",
            "La demande a été créée, mais les pièces justificatives n’ont pas pu être enregistrées.",
            "The request was created, but the supporting materials could not be saved."
          ));
        }
      }

      if (clientFlow && draftOwnerId && !editingRequestCode) {
        window.localStorage.removeItem(`cvup_request_draft_${draftOwnerId}`);
        await fetch("/api/account/draft", { method: "DELETE" }).catch(() => null);
        setDraftReady(false);
      }

      if (editingRequestCode) {
        setStatus(ui("تم حفظ التعديلات بنجاح.", "Modifications enregistrées.", "Changes saved successfully."));
        window.sessionStorage.setItem("cvup_updated_price_dzd", String(Number(result?.price_dzd) || requestPrice));
        window.sessionStorage.setItem("cvup_updated_language_count", String(cvLanguageCount));
        window.sessionStorage.setItem("cvup_updated_targeted", String(coverLetterIncluded));
        router.push("/account");
      } else {
        setStatus(ui(`تم إرسال الطلب: ${requestCode}`, `Demande envoyée : ${requestCode}`, `Request submitted: ${requestCode}`));
        window.sessionStorage.setItem(`cvup_price_${requestCode}`, String(Number(result?.price_dzd) || requestPrice));
        window.sessionStorage.setItem(`cvup_language_${requestCode}`, language);
        window.sessionStorage.setItem(`cvup_type_${requestCode}`, form.cv_type);
        window.sessionStorage.setItem(`cvup_cover_letter_${requestCode}`, String(Boolean(result?.cover_letter_included)));
        window.sessionStorage.setItem(`cvup_language_count_${requestCode}`, String(cvLanguageCount));
        window.sessionStorage.setItem(`cvup_name_${requestCode}`, form.full_name);
        window.sessionStorage.setItem(`cvup_name_ar_${requestCode}`, form.full_name_arabic);
        router.push(`/success?request_code=${encodeURIComponent(requestCode)}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit your request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTargeted = form.cv_type === "CV targeted to a specific job";
  const coverLetterIncluded = shouldGenerateCoverLetter({
    cv_type: form.cv_type,
    target_role: form.target_role,
    target_job_title: form.target_job_title,
    company_name: form.company_name,
    job_url: form.job_url,
    job_description_text: form.job_description_text,
  });
  const cvLanguageCount = Math.max(Number(form.cv_language_count) || 1, form.selected_cv_languages.length);
  const requestPrice = calculateRequestPrice(cvLanguageCount);

  return (
    <main className={`site-shell min-h-screen text-slate-900${clientFlow ? " client-flow" : ""}`} lang={language} dir={language === "ar" ? "rtl" : "ltr"}>
      <header className="site-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <a href="#top" className="brand-lockup" aria-label="CVUp home">
            <CvUpLogo compact />
            <span className="brand-word">CVUp</span>
          </a>
          <div className="header-actions">
            <a className="header-contact hidden sm:inline-flex" href="https://wa.me/213794851081" target="_blank" rel="noreferrer">WhatsApp</a>
            <div className="language-switcher">
            {languages.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => handleLanguageSelect(item.code as LanguageCode)}
                className={`language-button ${
                  language === item.code ? "language-button--active" : ""
                }`}
              >
                {item.label}
              </button>
            ))}
            </div>
          </div>
        </div>
      </header>

      <section id="top" className="hero-band mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
        <div className="hero-grid grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="hero-copy-column">
            <div className="hero-brandline mb-5">
              <CvUpLogo />
              <span>Truth first / relevance / optimization</span>
            </div>
            <h1 className="hero-title max-w-2xl text-4xl font-bold text-slate-900 md:text-6xl">
              {getText(language, "heroTitle")}
            </h1>
            <p className="hero-copy mt-5 max-w-xl text-lg leading-8 text-slate-600">
              {getText(language, "heroText")}
            </p>
            <div className="price-lockup mt-7">
              <span className="price-amount">{CVUP_BASE_PRICE_DZD} DA</span>
              <span className="price-arabic">800 دج</span>
              <span className="price-caption">{language === "ar" ? "سيرة ذاتية احترافية محسنة لطلبات التوظيف" : "CV professionnel optimisé pour vos candidatures"}</span>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#form"
                className="button-primary inline-flex items-center justify-center"
              >
                {getText(language, "ctaPrimary")}
              </a>
              <a className="button-contact button-whatsapp" href="https://wa.me/213794851081" target="_blank" rel="noreferrer"><span aria-hidden="true">W</span>{language === "ar" ? "تواصل عبر واتساب" : "Contact WhatsApp"}</a>
              <a className="button-contact" href="tel:+213794851081"><span aria-hidden="true">☎</span>{language === "ar" ? "اتصل الآن" : "Appeler maintenant"}</a>
            </div>
            <p className="mt-4 max-w-xl text-sm text-slate-600">{getText(language, "ctaSecondary")}</p>
          </div>

          <div className="how-panel hero-how-panel">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{getText(language, "sectionHow")}</p>
            <div className="mt-4 space-y-4">
              {[
                { num: 1, text: getText(language, "step1") },
                { num: 2, text: getText(language, "step2") },
                { num: 3, text: getText(language, "step3") },
              ].map((step) => (
                <div key={step.num} className="how-step">
                  <div className="step-number">
                    {step.num}
                  </div>
                  <div className="text-sm text-slate-700">{step.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--options mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">{getText(language, "sectionOptions")}</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="landing-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-lg font-bold text-slate-900">{getText(language, "generalTitle")}</p>
            <p className="mt-3 text-slate-600">{getText(language, "generalText")}</p>
          </div>
          <div className="landing-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-lg font-bold text-slate-900">{getText(language, "targetedTitle")}</p>
            <p className="mt-3 text-slate-600">{getText(language, "targetedText")}</p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--included mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">{getText(language, "includedTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              ar: "هيكلة متوافقة مع أنظمة ATS",
              fr: "Structure compatible avec les ATS",
              en: "ATS-friendly structure",
            },
            {
              ar: "إعادة صياغة احترافية",
              fr: "Réécriture professionnelle",
              en: "Professional rewriting",
            },
            {
              ar: "نسخة بلغة واحدة أو لغتين أو 3 لغات",
              fr: "Version en 1, 2 ou 3 langues",
              en: "1, 2 or 3 language versions",
            },
            {
              ar: "رسالة تحفيزية",
              fr: "Lettre de motivation",
              en: "Cover Letter",
            },
            {
              ar: "تخصيص السيرة الذاتية حسب المنصب عند الحاجة",
              fr: "Adaptation au poste ciblé si nécessaire",
              en: "Job-specific tailoring if needed",
            },
            {
              ar: "تنسيق احترافي",
              fr: "Mise en page professionnelle",
              en: "Professional formatting",
            },
            {
              ar: "بدون اختلاق معلومات",
              fr: "Aucune information inventée",
              en: "No invented information",
            },
          ].map((item) => {
            const label = language === "ar" ? item.ar : language === "fr" ? item.fr : item.en;
            return (
              <div key={item.en} className="included-card rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700">
                {label}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="ethics-panel">
          <h2 className="text-2xl font-bold text-slate-900">{getText(language, "ethicsTitle")}</h2>
          <p className="mt-3 text-slate-600">{getText(language, "ethicsText")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="payment-panel">
          <div><p className="section-kicker">{language === "ar" ? "الدفع" : language === "fr" ? "Paiement" : "Payment"}</p><h2>{language === "ar" ? "دفع آمن وتأكيد يدوي" : language === "fr" ? "Paiement sécurisé et confirmation manuelle" : "Secure payment with manual confirmation"}</h2><p>{language === "ar" ? "بعد إرسال الطلب، نتواصل معك عبر واتساب لتأكيد الدفع ومتابعة معالجة طلبك." : language === "fr" ? "Après l’envoi de votre demande, nous vous contactons sur WhatsApp pour confirmer le paiement et poursuivre le traitement." : "After submitting your request, we contact you on WhatsApp to confirm payment and continue processing."}</p></div>
          {sofizpayUrl ? (
            <a className="button-contact button-sofizpay" href={sofizpayUrl} target="_blank" rel="noreferrer">{language === "ar" ? "ادفع عبر Sofizpay" : language === "fr" ? "Payer avec Sofizpay" : "Pay with Sofizpay"} <span aria-hidden="true">↗</span></a>
          ) : (
            <a className="button-contact button-sofizpay" href="https://wa.me/213794851081" target="_blank" rel="noreferrer">{language === "ar" ? "تواصل للدفع" : language === "fr" ? "Contacter pour payer" : "Contact to pay"} <span aria-hidden="true">↗</span></a>
          )}
        </div>
      </section>

      <section id="form" className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="form-panel rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-8">
          <div className="section-kicker">{language === "ar" ? "CVUp / خطوتك المهنية القادمة" : language === "fr" ? "CVUp / votre prochaine étape professionnelle" : "CVUp / your next professional move"}</div>
          <h2 className="text-2xl font-bold text-slate-900">{language === "ar" ? "املأ طلب السيرة الذاتية الاحترافية" : language === "fr" ? "Remplissez votre demande de CV professionnel" : getText(language, "formTitle")}</h2>
          <p className="mt-2 text-slate-600">{getText(language, "formDescription")}</p>

          <div className="wizard-progress" aria-label="Form progress">
            <div className="wizard-mobile-progress"><span>{currentStep} / 7</span><strong>{stepTitle(wizardSteps[currentStep - 1])}</strong><div className="wizard-progress-track"><span style={{ width: `${(currentStep / 7) * 100}%` }} /></div></div>
            <nav className="wizard-sidebar" aria-label="Form steps">
              {wizardSteps.map((step, index) => {
                const number = index + 1;
                return <button key={step.en} type="button" className={`wizard-step-link ${number === currentStep ? "is-current" : ""} ${number < currentStep ? "is-complete" : ""}`} aria-current={number === currentStep ? "step" : undefined} onClick={() => number <= currentStep && setCurrentStep(number)}><span className="wizard-step-number">{number < currentStep ? "✓" : `0${number}`}</span><span>{stepTitle(step)}</span></button>;
              })}
            </nav>
            <div className="wizard-main">
              <div className="wizard-heading"><span className="wizard-overline">{currentStep} / 7 · {Math.round((currentStep / 7) * 100)}%</span><h3 id="wizard-step-title" tabIndex={-1}>{stepTitle(wizardSteps[currentStep - 1])}</h3><p>{language === "ar" ? "أكمل هذه الخطوة ثم تابع عندما تكون جاهزًا." : language === "fr" ? "Complétez cette étape, puis continuez quand vous êtes prêt." : "Complete this step, then continue when you are ready."}</p></div>
              <form ref={formRef} className="wizard-form mt-8 space-y-6" onSubmit={handleSubmit} onInvalid={handleInvalidField} onInput={handleValidationInput} data-current-step={currentStep} noValidate>
            {clientFlow && !editingRequestCode && draftReady ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
              <p className="font-semibold">{draftSaveStatus === "saved"
                ? ui("تم حفظ طلبك كمسودة تلقائيًا.", "Votre demande est enregistrée automatiquement comme brouillon.", "Your request is being saved automatically as a draft.")
                : draftSaveStatus === "error"
                  ? ui("المسودة محفوظة على هذا الجهاز، تعذّر مزامنتها مع الحساب مؤقتًا.", "Le brouillon est conservé sur cet appareil, mais sa synchronisation a échoué.", "The draft is saved on this device, but could not sync to your account yet.")
                  : ui("يُحفظ طلبك كمسودة تلقائيًا.", "Votre demande est enregistrée automatiquement comme brouillon.", "Your request is being saved automatically as a draft.")}</p>
              {draftSavedAt ? <p className="mt-1 text-xs text-emerald-800">{ui("آخر حفظ", "Dernier enregistrement", "Last saved")}: {new Intl.DateTimeFormat(language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(draftSavedAt))}</p> : null}
              {draftFilesToReselect.length ? <p className="mt-1 leading-6">{ui("تذكير: أعد اختيار الملفات المرفقة سابقًا؛ تحفظ المسودة النصوص والروابط ولا تحفظ محتوى الملفات المحلية.", "Rappel : sélectionnez à nouveau les fichiers choisis précédemment. Le brouillon conserve les textes et liens, pas les fichiers locaux.", "Reminder: reselect files chosen earlier. The draft keeps text and links, but not local file contents.")}</p> : null}
            </div> : null}
            {clientFlow && !editingRequestCode && hasReusableProfile && currentStep === 1 ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-950">
              <p className="font-semibold">{ui("معلوماتك المحفوظة جاهزة للاستخدام", "Vos informations enregistrées sont prêtes à être réutilisées", "Your saved information is ready to reuse")}</p>
              <p className="mt-1 leading-6">{ui("أكمل أو عدّل ما يلزم لهذا الطلب. التغييرات هنا تخص هذا الطلب فقط ولا تعدّل ملفك المحفوظ تلقائيًا.", "Complétez ou modifiez les informations nécessaires pour cette demande. Ces changements ne modifient pas votre profil enregistré.", "Change what is needed for this request. These edits apply to this request only and do not silently change your saved profile.")}</p>
            </div> : null}
            <div data-wizard-step="1" className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "formLanguage")}</span>
                <select
                  value={form.form_language}
                  onChange={(e) => handleLanguageSelect(e.target.value as LanguageCode)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                >
                  {languages.map((item) => (
                    <option key={item.code} value={item.code}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{ui("الاسم واللقب بالأحرف اللاتينية", "Nom complet en caractères latins", "Full name in Latin characters")}</span>
                <input
                  required
                  autoComplete="name"
                  pattern="[A-Za-zÀ-ÖØ-öø-ÿ' .-]+"
                  data-validation-kind="latin-name"
                  value={form.full_name}
                  onChange={(e) => handleFieldChange("full_name", e.target.value)}
                  placeholder={ui("مثال: الاسم الكامل", "Ex. : prénom et nom", "e.g. Your full name")}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{ui("الاسم واللقب بالعربية", "Nom complet en arabe", "Full name in Arabic")}</span>
                <input
                  required
                  dir="rtl"
                  pattern="[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF' .-]+"
                  value={form.full_name_arabic}
                  onChange={(e) => handleFieldChange("full_name_arabic", e.target.value)}
                  placeholder="سيف الدين شارف"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
              </label>
            </div>

            <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
              <label>
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(event) => handleFieldChange("website", event.target.value)}
                />
              </label>
            </div>

            <div data-wizard-step="1" className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "phone")}</span>
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-required="true"
                  pattern="\\+?[0-9 ()-]{8,20}"
                  data-validation-kind="phone"
                  value={form.phone}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                  placeholder={language === "ar" ? "مثال: +213 5XX XX XX XX" : language === "fr" ? "Ex. : +213 5XX XX XX XX" : "Example: +213 5XX XX XX XX"}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "email")}</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
              </label>
            </div>

            <section data-wizard-step="1" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
              <h4 className="font-semibold text-slate-900">{ui("معلومات شخصية اختيارية", "Informations personnelles facultatives", "Optional personal details")}</h4>
              <p className="mt-1 text-sm text-slate-600">{ui("أدخلها عند رغبتك فقط، وحدد أدناه ما تريد إظهاره في السيرة الذاتية.", "Vous pouvez les renseigner si vous le souhaitez et choisir ci-dessous ce qui apparaîtra sur le CV.", "Add these only if you want to, then choose which details should appear on your CV.")}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="request-gender" className="mb-2 block text-sm font-medium text-slate-700">{ui("الجنس (اختياري)", "Genre (facultatif)", "Gender (optional)")}</label>
                  <input id="request-gender" value={form.gender} onChange={(event) => handleFieldChange("gender", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" />
                  {form.gender.trim() ? <label className="mt-3 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.include_gender_in_cv} onChange={(event) => handleFieldChange("include_gender_in_cv", event.target.checked)} /><span>{ui("أدرجه في السيرة الذاتية", "Inclure dans le CV", "Include on the CV")}</span></label> : null}
                </div>
                <div>
                  <label htmlFor="request-birth-date" className="mb-2 block text-sm font-medium text-slate-700">{ui("تاريخ الميلاد (اختياري)", "Date de naissance (facultative)", "Date of birth (optional)")}</label>
                  <input id="request-birth-date" type="date" value={form.date_of_birth} onChange={(event) => handleFieldChange("date_of_birth", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" />
                  {form.date_of_birth ? <label className="mt-3 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.include_date_of_birth_in_cv} onChange={(event) => handleFieldChange("include_date_of_birth_in_cv", event.target.checked)} /><span>{ui("أدرجه في السيرة الذاتية", "Inclure dans le CV", "Include on the CV")}</span></label> : null}
                </div>
              </div>
            </section>

            <div data-wizard-step="2">
              <span className="mb-3 block text-sm font-medium text-slate-700">{getText(language, "cvType")}</span>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { label: getText(language, "generalChoice"), value: "General CV" },
                  { label: getText(language, "targetedChoice"), value: "CV targeted to a specific job" },
                ].map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="radio"
                      checked={form.cv_type === option.value}
                      onChange={() => handleFieldChange("cv_type", option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <p className={`mt-3 rounded-xl px-4 py-3 text-sm leading-6 ${isTargeted ? "border border-emerald-200 bg-emerald-50 text-emerald-900" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
                {isTargeted
                  ? ui("السيرة الموجهة تُبنى على معلومات الوظيفة وخبرتك المؤكدة. عند توفر تفاصيل كافية، نرفق رسالة تحفيزية مخصصة دون تكلفة إضافية.", "Le CV ciblé s’appuie sur l’offre et votre expérience confirmée. Si le contexte est suffisant, une lettre personnalisée est incluse sans frais supplémentaires.", "A targeted CV uses the job details and your confirmed experience. When enough context is available, a tailored cover letter is included at no extra cost.")
                  : ui("السيرة العامة غير مرتبطة بوظيفة أو شركة محددة، ولا تتضمن رسالة تحفيزية.", "Le CV général n’est lié à aucun poste ni entreprise précis et n’inclut pas de lettre de motivation.", "A general CV is not tied to a specific job or company and does not include a cover letter.")}
              </p>
            </div>

            {isTargeted && (
              <div data-wizard-step="2" className="grid gap-5 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "targetJobTitle")}</span>
                  <input
                    value={form.target_job_title}
                    onChange={(e) => handleFieldChange("target_job_title", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "companyName")}</span>
                  <input
                    value={form.company_name}
                    onChange={(e) => handleFieldChange("company_name", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "jobUrl")}</span>
                  <input
                    value={form.job_url}
                    onChange={(e) => handleFieldChange("job_url", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "jobDescription")}</span>
                  <textarea
                    rows={5}
                    value={form.job_description_text}
                    onChange={(e) => handleFieldChange("job_description_text", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                </label>
                <div className="md:col-span-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "uploadJobDescription")}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => handleFieldChange("job_description_file", e.target.files?.[0] ?? null)}
                      className="w-full rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm"
                    />
                    {fileLimitHint()}
                  </label>
                  {extraAttachmentFields("job_description")}
                </div>
                <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {getText(language, "note")}
                </div>
              </div>
            )}

            <div data-wizard-step="2" className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "professionalField")}</span>
                <select
                  value={form.professional_field}
                  onChange={(e) => handleFieldChange("professional_field", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">{ui("اختر المجال المهني", "Choisissez un domaine professionnel", "Select a professional field")}</option>
                  {professionalFields.map((field) => (
                    <option key={field} value={field}>{optionLabel(field)}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "targetRole")}</span>
                <input
                  value={form.target_role}
                  onChange={(e) => handleFieldChange("target_role", e.target.value)}
                  placeholder={language === "ar" ? "مثال: مدير تسويق رقمي، محاسب، مسؤول موارد بشرية..." : language === "fr" ? "Ex. : Responsable marketing digital, Comptable, Chargé RH..." : "Digital Marketing Manager, Accountant, HR Officer..."}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
              </label>
            </div>

            <div data-wizard-step="6">
              <span className="mb-3 block text-sm font-medium text-slate-700">{getText(language, "cvLanguages")}</span>
              <div className="grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((count) => (
                  <label key={count} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3">
                    <input
                      type="radio"
                      checked={form.cv_language_count === count}
                      onChange={() => {
                        handleFieldChange("cv_language_count", count);
                        const selected = count === 1 ? ["French"] : count === 2 ? ["French", "English"] : ["Arabic", "French", "English"];
                        handleFieldChange("selected_cv_languages", selected);
                      }}
                    />
                    <span className="text-sm font-medium">
                      {count === 1 ? getText(language, "oneLanguage") : count === 2 ? getText(language, "twoLanguages") : getText(language, "threeLanguages")}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {cvLanguageOptions.map((languageOption) => (
                  <label key={languageOption} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3">
                    <input
                      type="checkbox"
                      checked={form.selected_cv_languages.includes(languageOption)}
                      onChange={() => {
                        const next = form.selected_cv_languages.includes(languageOption)
                          ? form.selected_cv_languages.filter((item) => item !== languageOption)
                          : [...form.selected_cv_languages, languageOption];
                        handleFieldChange("selected_cv_languages", next.slice(0, form.cv_language_count));
                      }}
                    />
                    <span>{optionLabel(languageOption)}</span>
                  </label>
                ))}
              </div>
              <div className="review-price mt-4"><span>{language === "ar" ? `السعر النهائي · ${cvLanguageCount} لغات` : language === "fr" ? `Prix final · ${cvLanguageCount} langue(s)` : `Final price · ${cvLanguageCount} language(s)`}{coverLetterIncluded ? <small className="block font-medium">{language === "ar" ? "🎁 رسالة تحفيزية مخصصة هدية دون تكلفة إضافية" : language === "fr" ? "🎁 Lettre de motivation personnalisée offerte" : "🎁 Personalized cover letter included free"}</small> : null}</span><strong>{language === "ar" ? `${requestPrice} دج` : `${requestPrice} DA`}</strong></div>
              {form.selected_cv_languages.includes("Other") ? (
                <input
                  value={form.selected_cv_languages_other}
                  onChange={(event) => handleFieldChange("selected_cv_languages_other", event.target.value)}
                  placeholder={ui("اكتب اللغة الأخرى", "Précisez l’autre langue", "Specify the other language")}
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
              ) : null}
            </div>

            <div data-wizard-step="6">
              <span className="mb-3 block text-sm font-medium text-slate-700">{getText(language, "hasCurrentCv")}</span>
              <div className="flex gap-4">
                {[
                  { label: getText(language, "yes"), value: "Yes" },
                  { label: getText(language, "no"), value: "No" },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.has_current_cv === option.value}
                      onChange={() => handleFieldChange("has_current_cv", option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {form.has_current_cv === "Yes" && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "uploadCurrentCv")}</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => handleFieldChange("current_cv_file", e.target.files?.[0] ?? null)}
                      className="w-full rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm"
                    />
                    {fileLimitHint()}
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "optionalLink")}</span>
                    <input
                      type="url"
                      value={form.optional_cv_link}
                      onChange={(e) => handleFieldChange("optional_cv_link", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                    />
                  </label>
                  <div className="md:col-span-2">{extraAttachmentFields("current_cv")}</div>
                </div>
              )}
            </div>

            <div data-wizard-step="3">
              <h3 className="text-lg font-bold text-slate-900">{getText(language, "professionalEvidenceTitle")}</h3>
              <p className="mt-2 text-sm text-slate-600">{getText(language, "professionalEvidenceHelper")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {fieldEvidence.map((item) => (
                  <label key={item} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.professional_evidence.includes(item)}
                      onChange={() => {
                        const next = form.professional_evidence.includes(item)
                          ? form.professional_evidence.filter((value) => value !== item)
                          : [...form.professional_evidence, item];
                        handleFieldChange("professional_evidence", next);
                      }}
                    />
                    <span>{item === "Other" ? `+ ${getText(language, "professionalEvidenceOther")}` : optionLabel(item)}</span>
                  </label>
                ))}
              </div>
              {form.professional_evidence.includes("Other") && (
                <input
                  value={form.professional_evidence_other}
                  onChange={(e) => handleFieldChange("professional_evidence_other", e.target.value)}
                  placeholder={getText(language, "otherSpecify")}
                  className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
              )}
            </div>

            {fieldPlatforms && (
              <div data-wizard-step="4">
                <h3 className="text-lg font-bold text-slate-900">{getText(language, "platformsTitle")}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {fieldPlatforms.map((item) => (
                    <label key={item} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={form.platforms_worked_with.includes(item)}
                        onChange={() => {
                          const next = form.platforms_worked_with.includes(item)
                            ? form.platforms_worked_with.filter((value) => value !== item)
                            : [...form.platforms_worked_with, item];
                          handleFieldChange("platforms_worked_with", next);
                        }}
                      />
                      <span>{item === "Other" ? `+ ${getText(language, "platformsOther")}` : optionLabel(item)}</span>
                    </label>
                  ))}
                </div>
                {form.platforms_worked_with.includes("Other") && (
                  <input
                    value={form.platforms_other}
                    onChange={(e) => handleFieldChange("platforms_other", e.target.value)}
                    placeholder={getText(language, "otherSpecify")}
                    className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                )}
              </div>
            )}

            <div data-wizard-step="4">
              <span className="mb-3 block text-sm font-medium text-slate-700">{getText(language, "tools")}</span>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {fieldTools.map((tool) => (
                  <label key={tool} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.tools.includes(tool)}
                      onChange={() => {
                        const next = form.tools.includes(tool)
                          ? form.tools.filter((item) => item !== tool)
                          : [...form.tools, tool];
                        handleFieldChange("tools", next);
                      }}
                    />
                    <span>{optionLabel(tool)}</span>
                  </label>
                ))}
              </div>
              {form.tools.includes("Other") && (
                <input
                  value={form.tools_other}
                  onChange={(e) => handleFieldChange("tools_other", e.target.value)}
                  placeholder={getText(language, "toolsOther")}
                  className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
              )}
            </div>

            <div data-wizard-step="3">
              <h3 className="text-lg font-bold text-slate-900">{getText(language, "achievementsTitle")}</h3>
              <div className="mt-3 flex gap-4">
                {["Yes", "No"].map((value) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.has_measurable_achievements === value}
                      onChange={() => handleFieldChange("has_measurable_achievements", value)}
                    />
                    <span>{value === "Yes" ? getText(language, "yes") : getText(language, "no")}</span>
                  </label>
                ))}
              </div>
              {form.has_measurable_achievements === "Yes" && (
                <>
                  <p className="mt-3 text-sm text-slate-600">{getText(language, "achievementsHelper")}</p>
                  <textarea
                    rows={4}
                    value={form.measurable_achievements_text}
                    onChange={(e) => handleFieldChange("measurable_achievements_text", e.target.value)}
                    placeholder={getText(language, "achievementsPlaceholder")}
                    className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                  {supportingMaterialFields("achievements")}
                </>
              )}
            </div>

            <div data-wizard-step="3">
              <h3 className="text-lg font-bold text-slate-900">{getText(language, "additionalExperienceTitle")}</h3>
              <div className="mt-3 flex gap-4">
                {["Yes", "No"].map((value) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.has_additional_experience === value}
                      onChange={() => handleFieldChange("has_additional_experience", value)}
                    />
                    <span>{value === "Yes" ? getText(language, "yes") : getText(language, "no")}</span>
                  </label>
                ))}
              </div>
              {form.has_additional_experience === "Yes" && (
                <>
                  <textarea
                    rows={4}
                    value={form.additional_experience_text}
                    onChange={(e) => handleFieldChange("additional_experience_text", e.target.value)}
                    placeholder={getText(language, "additionalExperiencePlaceholder")}
                    className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                  {supportingMaterialFields("additional_experience")}
                </>
              )}
            </div>

            {fieldCollaborations && (
              <div data-wizard-step="3">
                <h3 className="text-lg font-bold text-slate-900">{getText(language, "collaborationTitle")}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {fieldCollaborations.map((item) => (
                    <label key={item} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={form.collaboration_types.includes(item)}
                        onChange={() => {
                          const next = form.collaboration_types.includes(item)
                            ? form.collaboration_types.filter((value) => value !== item)
                            : [...form.collaboration_types, item];
                          handleFieldChange("collaboration_types", next);
                        }}
                      />
                      <span>{item === "Other" ? `+ ${getText(language, "collaborationOther")}` : optionLabel(item)}</span>
                    </label>
                  ))}
                </div>
                {form.collaboration_types.includes("Other") && (
                  <input
                    value={form.collaboration_other}
                    onChange={(e) => handleFieldChange("collaboration_other", e.target.value)}
                    placeholder={getText(language, "otherSpecify")}
                    className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                )}
              </div>
            )}

            <div data-wizard-step="6" className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-lg font-bold text-slate-900">{getText(language, "eligibilityTitle")}</h3>
              <p className="mt-2 text-sm text-slate-600">{getText(language, "eligibilityNote")}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    {getText(language, "currentCountry")} <span className="font-normal text-slate-500">({ui("اختياري", "facultatif", "optional")})</span>
                  </span>
                  <select value={form.current_country} onChange={(e) => handleFieldChange("current_country", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500">
                    <option value="">{ui("اختر البلد", "Choisir un pays", "Choose a country")}</option>
                    {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    {getText(language, "nationality")} <span className="font-normal text-slate-500">({ui("اختياري", "facultatif", "optional")})</span>
                  </span>
                  <select value={form.nationality} onChange={(e) => handleFieldChange("nationality", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500">
                    <option value="">{ui("اختر الجنسية", "Choisir une nationalité", "Choose a nationality")}</option>
                    {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "willingToRelocate")}</span>
                  <select value={form.willing_to_relocate} onChange={(e) => handleFieldChange("willing_to_relocate", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500">
                    <option value="Yes">{getText(language, "yes")}</option>
                    <option value="No">{getText(language, "no")}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "workAuthorization")}</span>
                  <select value={form.work_authorization} onChange={(e) => handleFieldChange("work_authorization", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500">
                    {["Citizen / National", "Permanent resident", "Valid work permit", "Need employer sponsorship", "Not sure", "Other"].map((option) => <option key={option} value={option}>{option === "Other" ? `+ ${getText(language, "workAuthorizationOther")}` : optionLabel(option)}</option>)}
                  </select>
                </label>
                {form.work_authorization === "Other" && <input value={form.work_authorization_other} onChange={(e) => handleFieldChange("work_authorization_other", e.target.value)} placeholder={getText(language, "otherSpecify")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" />}
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "targetCountries")}</span>
                  <input value={form.target_countries} onChange={(e) => handleFieldChange("target_countries", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" />
                </label>
              </div>
            </div>

            <div data-wizard-step="5">
              <span className="mb-3 block text-sm font-medium text-slate-700">{getText(language, "languagesSpoken")}</span>
              <p className="mb-3 text-sm leading-6 text-slate-600">
                {ui("أدخل ثلاث لغات مختلفة على الأقل، وحدد مستواك في كل واحدة.", "Indiquez au moins trois langues différentes et votre niveau pour chacune.", "Add at least three different languages and select your level for each.")}
              </p>
              <div className="space-y-3">
                {form.spoken_languages.map((entry, index) => (
                  <div key={`spoken-language-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-2">
                    <select
                      value={entry.language}
                      required
                      data-language-select="true"
                      aria-label={ui(`اللغة رقم ${index + 1}`, `Langue ${index + 1}`, `Language ${index + 1}`)}
                      onChange={(e) => {
                        const next = [...form.spoken_languages];
                        next[index] = { ...next[index], language: e.target.value };
                        handleFieldChange("spoken_languages", next);
                        setSpokenLanguageError(false);
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                    >
                      <option value="">{ui("اختر اللغة", "Choisir une langue", "Select a language")}</option>
                      {[
                        "Arabic",
                        "French",
                        "English",
                        "Spanish",
                        "German",
                        "Italian",
                        "Other",
                      ].map((option) => (
                        <option key={option} value={option}>{optionLabel(option)}</option>
                      ))}
                    </select>
                    <select
                      value={entry.level}
                      required
                      aria-label={ui(`مستوى اللغة رقم ${index + 1}`, `Niveau de la langue ${index + 1}`, `Level for language ${index + 1}`)}
                      onChange={(e) => {
                        const next = [...form.spoken_languages];
                        next[index] = { ...next[index], level: e.target.value };
                        handleFieldChange("spoken_languages", next);
                        setSpokenLanguageError(false);
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                    >
                      <option value="">{ui("حدد المستوى", "Choisir un niveau", "Select a level")}</option>
                      {languageLevels.map((level) => (
                        <option key={level} value={level}>{optionLabel(level)}</option>
                      ))}
                    </select>
                    {entry.language === "Other" && (
                      <input
                        required
                        value={entry.language_other}
                        onChange={(e) => {
                          const next = [...form.spoken_languages];
                          next[index] = { ...next[index], language_other: e.target.value };
                          handleFieldChange("spoken_languages", next);
                          setSpokenLanguageError(false);
                        }}
                        placeholder={getText(language, "otherSpecify")}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                      />
                    )}
                    {entry.level === "Other" && (
                      <input
                        required
                        value={entry.level_other}
                        onChange={(e) => {
                          const next = [...form.spoken_languages];
                          next[index] = { ...next[index], level_other: e.target.value };
                          handleFieldChange("spoken_languages", next);
                          setSpokenLanguageError(false);
                        }}
                        placeholder={getText(language, "otherSpecify")}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                      />
                    )}
                    <label className="flex items-center gap-2 text-sm md:col-span-2">
                      <input
                        type="checkbox"
                        checked={entry.professional_writing}
                        onChange={(e) => {
                          const next = [...form.spoken_languages];
                          next[index] = { ...next[index], professional_writing: e.target.checked };
                          handleFieldChange("spoken_languages", next);
                        }}
                      />
                      <span>{getText(language, "professionalWriting")}</span>
                    </label>
                    {form.spoken_languages.length > 3 && <button
                      type="button"
                      onClick={() => {
                        handleFieldChange("spoken_languages", form.spoken_languages.filter((_, itemIndex) => itemIndex !== index));
                        setSpokenLanguageError(false);
                      }}
                      className="justify-self-start rounded-full px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      {ui("حذف اللغة", "Supprimer cette langue", "Remove language")}
                    </button>}
                  </div>
                ))}
                {spokenLanguageError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {ui("يرجى إدخال ثلاث لغات مختلفة على الأقل وتحديد مستوى كل لغة.", "Veuillez indiquer au moins trois langues différentes et choisir le niveau de chacune.", "Please enter at least three different languages and choose a level for each.")}
                </p>}
                <button
                  type="button"
                  onClick={() => handleFieldChange("spoken_languages", [...form.spoken_languages, createEmptySpokenLanguage()])}
                  className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <span aria-hidden="true">+</span> {getText(language, "addLanguage")}
                </button>
              </div>
            </div>

            <div data-wizard-step="5">
              <span className="mb-3 block text-sm font-medium text-slate-700">{getText(language, "certifications")}</span>
              <div className="flex gap-4">
                {[
                  { label: getText(language, "yes"), value: "Yes" },
                  { label: getText(language, "no"), value: "No" },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.has_certifications === option.value}
                      onChange={() => handleFieldChange("has_certifications", option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {form.has_certifications === "Yes" && (
                <div className="mt-4 space-y-4">
                  <textarea
                    rows={3}
                    value={form.certifications_text}
                    onChange={(e) => handleFieldChange("certifications_text", e.target.value)}
                    placeholder={language === "ar" ? "اسم الشهادة أو التكوين" : language === "fr" ? "Nom de la certification ou de la formation" : "Certification or training name"}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
                    <p className="text-sm font-semibold text-slate-800">
                      {ui("أو حمّل ملف الشهادة أو إثبات التكوين", "Ou téléversez le justificatif de formation ou le certificat", "Or upload the certificate or training proof")}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {ui("اختياري — PDF أو DOCX أو TXT أو صورة", "Facultatif — PDF, DOCX, TXT ou image", "Optional — PDF, DOCX, TXT, or image")}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 focus-within:ring-2 focus-within:ring-emerald-300">
                        <span aria-hidden="true">↑</span>
                        {ui("اختيار ملف", "Choisir un fichier", "Choose a file")}
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
                          aria-label={ui("ملف الشهادة أو إثبات التكوين", "Fichier du certificat ou justificatif de formation", "Certificate or training proof file")}
                          onChange={(e) => handleFieldChange("certifications_file", e.target.files?.[0] ?? null)}
                          className="sr-only"
                        />
                      </label>
                      <span className="min-w-0 break-all text-sm text-slate-700">
                        {form.certifications_file?.name || existingFileNames.certifications_file || ui("لم يتم اختيار ملف", "Aucun fichier choisi", "No file selected")}
                      </span>
                      {form.certifications_file && <button
                        type="button"
                        onClick={() => handleFieldChange("certifications_file", null)}
                        className="rounded-full px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        {ui("إزالة", "Retirer", "Remove")}
                      </button>}
                    </div>
                    {fileLimitHint()}
                  </div>
                  <input
                    type="url"
                    value={form.certifications_link}
                    onChange={(e) => handleFieldChange("certifications_link", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                    placeholder={language === "ar" ? "رابط اختياري" : language === "fr" ? "Lien facultatif" : "Optional link"}
                  />
                  {extraAttachmentFields("certifications")}
                </div>
              )}
            </div>

            <div data-wizard-step="6">
              <span className="mb-3 block text-sm font-medium text-slate-700">{getText(language, "designPreference")}</span>
              <div className="space-y-3">
                {designPreferences.map((option) => (
                  <label key={option} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                    <input
                      type="radio"
                      checked={form.cv_design_preference === option}
                      onChange={() => handleFieldChange("cv_design_preference", option)}
                    />
                    <span className="text-sm">{option === "Other" ? `+ ${getText(language, "designOther")}` : optionLabel(option)}</span>
                  </label>
                ))}
              </div>
              {form.cv_design_preference === "I have a specific template" && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => handleFieldChange("cv_template_file", e.target.files?.[0] ?? null)}
                      className="w-full rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm"
                    />
                    {fileLimitHint()}
                  </div>
                  <input
                    type="url"
                    value={form.cv_template_link}
                    onChange={(e) => handleFieldChange("cv_template_link", e.target.value)}
                    placeholder={language === "ar" ? "رابط القالب" : language === "fr" ? "Lien du modèle" : "Template link"}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                  />
                  <div className="md:col-span-2">{extraAttachmentFields("template")}</div>
                </div>
              )}
              {form.cv_design_preference === "Other" && (
                <input
                  value={form.cv_design_preference_other}
                  onChange={(e) => handleFieldChange("cv_design_preference_other", e.target.value)}
                  placeholder={getText(language, "otherSpecify")}
                  className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
              )}
            </div>

            <div data-wizard-step="6" className="space-y-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "missingInfo")}</span>
                <textarea
                  rows={3}
                  value={form.additional_information}
                  onChange={(e) => handleFieldChange("additional_information", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
                {supportingMaterialFields("missing_information")}
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "excludedInfo")}</span>
                <textarea
                  rows={3}
                  value={form.excluded_information}
                  onChange={(e) => handleFieldChange("excluded_information", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
                {supportingMaterialFields("excluded_information")}
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{getText(language, "finalProfessionalInfo")}</span>
                <p className="mb-2 text-sm text-slate-600">{getText(language, "finalProfessionalInfoHelper")}</p>
                <textarea
                  rows={4}
                  value={form.additional_professional_information}
                  onChange={(e) => handleFieldChange("additional_professional_information", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
                />
                {supportingMaterialFields("additional_professional_information")}
              </label>
            </div>

            <div data-wizard-step="6">
              <span className="mb-3 block text-sm font-medium text-slate-700">{getText(language, "recruitmentConsent")}</span>
              <div className="space-y-3">
                {[
                  { label: getText(language, "recruitmentYes"), value: "Yes" },
                  { label: getText(language, "recruitmentNo"), value: "No" },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                    <input
                      type="radio"
                      checked={form.recruitment_consent === option.value}
                      onChange={() => handleFieldChange("recruitment_consent", option.value)}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-600">{getText(language, "recruitmentNote")}</p>
            </div>

            {editingRequestCode ? (
              <div data-wizard-step="7" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <p className="text-sm font-semibold text-emerald-900">
                  {ui("أنت تعدّل طلبًا سابقًا. اختر «تعديل» بجانب أي قسم، احفظه، ثم احفظ التغييرات النهائية.", "Vous modifiez une demande existante. Utilisez « Modifier » pour changer une section, puis enregistrez les modifications finales.", "You're editing an existing request. Use “Edit” on any section, save it, then save the final changes.")}
                </p>
                <p dir="ltr" className="mt-1 text-xs text-emerald-700">#{editingRequestCode}</p>
              </div>
            ) : null}

            <div data-wizard-step="7" className="review-grid">
              {isTargetedCv && !coverLetterIncluded ? <p role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{ui("لتحضير رسالة تحفيزية مخصصة، أضف عنوان الوظيفة أو وصفها أو رابط الإعلان. لن نختلق معلومات غير متوفرة.", "Pour préparer une lettre personnalisée, ajoutez l’intitulé, la description ou le lien de l’offre. Nous n’inventerons aucune information manquante.", "To prepare a tailored cover letter, add the job title, description, or listing link. We will not invent missing information.")}</p> : null}
              {reviewGroups.map((group) => {
                const values = group.values.filter(([, value]) => hasReviewValue(value));
                return <section key={group.step} className="review-card">
                  <div className="review-card__heading"><h4>{group.title}</h4><button type="button" onClick={() => editReviewStep(group.step)}>{language === "ar" ? "تعديل" : language === "fr" ? "Modifier" : "Edit"}</button></div>
                  {values.length ? values.map(([label, value]) => <div key={String(label)} className="review-row"><span>{label}</span><strong>{reviewValue(value)}</strong></div>) : <p className="pt-3 text-sm text-slate-500">{ui("لم تُضف معلومات في هذا القسم بعد.", "Aucune information n’a encore été ajoutée à cette section.", "No information has been added to this section yet.")}</p>}
                </section>;
              })}
              <div className="review-price"><span>{language === "ar" ? "السعر النهائي" : language === "fr" ? "Prix final" : "Final price"}{` · ${cvLanguageCount} ${language === "ar" ? "لغات" : language === "fr" ? "langue(s)" : "language(s)"}`}{coverLetterIncluded ? <small className="block font-medium">{language === "ar" ? "🎁 رسالة تحفيزية مخصصة هدية دون تكلفة إضافية" : language === "fr" ? "🎁 Lettre de motivation personnalisée offerte" : "🎁 Personalized cover letter included free"}</small> : null}</span><strong>{language === "ar" ? `${requestPrice} دج` : `${requestPrice} DA`}</strong></div>
            </div>

            <label data-wizard-step="7" className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              <input
                required
                type="checkbox"
                checked={form.final_consent}
                onChange={(e) => handleFieldChange("final_consent", e.target.checked)}
              />
              <span>{getText(language, "finalConsent")}</span>
            </label>

            {status && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{status}</p>}

            <button
              data-wizard-step="7"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? (language === "ar" ? "جارٍ الحفظ..." : language === "fr" ? "Enregistrement..." : "Saving...")
                : editingRequestCode
                  ? ui("حفظ التعديلات", "Enregistrer les modifications", "Save changes")
                  : getText(language, "submit")}
            </button>
          </form>
              <div className="wizard-controls"><button type="button" className="wizard-control wizard-control--back" onClick={() => moveStep(-1)} disabled={currentStep === 1}>{language === "ar" ? "السابق" : language === "fr" ? "Précédent" : "Back"}</button>{currentStep < 7 ? <button type="button" className="wizard-control wizard-control--next" onClick={() => moveStep(1)}>{reviewEditStep === currentStep ? (language === "ar" ? "حفظ والعودة للمراجعة" : language === "fr" ? "Enregistrer et revenir à la vérification" : "Save and return to review") : (language === "ar" ? "التالي" : language === "fr" ? "Continuer" : "Continue")}</button> : null}</div>
            </div>
          </div>
        </div>
      </section>
      <footer className="site-footer">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="brand-lockup"><CvUpLogo compact /><span className="brand-word">CVUp</span></div>
          <p className="text-sm text-slate-500">Real experience. Better presentation.</p>
          <div className="social-links">
            <a href="https://www.facebook.com/profile.php?id=61594422910379" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://www.instagram.com/cvuptool/" target="_blank" rel="noreferrer">Instagram</a>
          </div>
        </div>
      </footer>
      {showFloatingCta ? <a className="floating-cta" href="#form">{language === "ar" ? "املأ الآن طلب السيرة الاحترافية" : language === "fr" ? "Remplissez votre demande maintenant" : "Start your professional CV request"}<span aria-hidden="true">↗</span></a> : null}
      <a className="floating-whatsapp" href="https://wa.me/213794851081" target="_blank" rel="noreferrer" aria-label="Contact CVUp on WhatsApp"><WhatsAppIcon /></a>
    </main>
  );
}

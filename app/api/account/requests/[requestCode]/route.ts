import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { createRequestSubmissionToken } from "@/lib/request-submission-token";
import { editableClientRequestStatuses, isClientRequestEditable } from "@/lib/client-request-editability";
import { getAuthenticatedAccountUser } from "@/lib/account-auth";
import { calculateRequestPrice } from "@/lib/pricing";
import { shouldGenerateCoverLetter } from "@/lib/request-deliverables";
import { hasAtLeastThreeDistinctSpokenLanguages } from "@/lib/spoken-languages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function GET(_request: Request, context: { params: Promise<{ requestCode: string }> }) {
  const user = await getAuthenticatedAccountUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { requestCode } = await context.params;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("cv_requests")
    .select("*")
    .eq("request_code", requestCode)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const editable = isClientRequestEditable(data);
  const submissionToken = editable
    ? await createRequestSubmissionToken(String(data.id), String(data.request_code))
    : null;

  return NextResponse.json({
    request: data,
    editable,
    submission_token: submissionToken,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ requestCode: string }> }) {
  const user = await getAuthenticatedAccountUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { requestCode } = await context.params;
  const body = await request.json().catch(() => null);
  const form = body?.form;

  if (!form || typeof form !== "object" || Array.isArray(form)) {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }
  if ((Number(request.headers.get("content-length") || "0") > 300_000) || JSON.stringify(body).length > 300_000) {
    return NextResponse.json({ error: "Request payload is too large." }, { status: 413 });
  }

  const supabase = getSupabaseServerClient();
const { data: existing, error: readError } = await supabase
    .from("cv_requests")
    .select("*")
    .eq("request_code", requestCode)
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError || !existing) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (!isClientRequestEditable(existing)) {
    return NextResponse.json({ error: "This request can no longer be edited." }, { status: 409 });
  }

  const allowedFormFields = new Set([
    "form_language", "full_name", "full_name_arabic", "gender", "date_of_birth", "include_gender_in_cv", "include_date_of_birth_in_cv", "phone", "email", "website", "cv_type", "target_job_title", "company_name", "job_url", "job_description_text", "professional_field", "target_role", "cv_language_count", "selected_cv_languages", "selected_cv_languages_other", "has_current_cv", "optional_cv_link", "tools", "spoken_languages", "professional_evidence", "professional_evidence_other", "platforms_worked_with", "platforms_other", "tools_other", "has_measurable_achievements", "measurable_achievements_text", "has_additional_experience", "additional_experience_text", "collaboration_types", "collaboration_other", "current_country", "nationality", "willing_to_relocate", "target_countries", "work_authorization", "work_authorization_other", "additional_professional_information", "cv_design_preference_other", "has_certifications", "certifications_text", "certifications_link", "cv_design_preference", "cv_template_link", "additional_information", "excluded_information", "recruitment_consent", "final_consent", "supporting_materials",
  ]);
  if (Object.keys(form).some((key) => !allowedFormFields.has(key))) {
    return NextResponse.json({ error: "The request contains fields that cannot be edited." }, { status: 400 });
  }
  if (typeof form.website === "string" && form.website.trim()) {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }

  const cvType = String(form.cv_type || existing.cv_type || "General CV");
  if (!["General CV", "CV targeted to a specific job"].includes(cvType)) {
    return NextResponse.json({ error: "Invalid CV type." }, { status: 400 });
  }

  const languageCount = Number(form.cv_language_count ?? existing.cv_language_count ?? 1);
  if (![1, 2, 3].includes(languageCount)) {
    return NextResponse.json({ error: "Invalid CV language count." }, { status: 400 });
  }

  const selectedLanguages = safeArray(form.selected_cv_languages).map(String).slice(0, 3);
  const priceDzd = calculateRequestPrice(Math.max(languageCount, selectedLanguages.length));
  const coverLetterIncluded = shouldGenerateCoverLetter({ ...existing, ...form, cv_type: cvType });
  const currentRaw = existing.raw_payload && typeof existing.raw_payload === "object" ? existing.raw_payload : {};
  const mergedRaw = {
    ...currentRaw,
    ...form,
    price_dzd: priceDzd,
    cover_letter_included: coverLetterIncluded,
    job_description_file: undefined,
    current_cv_file: undefined,
    certifications_file: undefined,
    cv_template_file: undefined,
  };

  const updatePayload = {
    form_language: String(form.form_language || existing.form_language || "fr"),
    full_name: String(form.full_name || existing.full_name || "").trim(),
    phone: String(form.phone || existing.phone || "").trim(),
    email: String(form.email || existing.email || "").trim().toLowerCase(),
    cv_type: cvType,
    target_job_title: cvType === "General CV" ? null : String(form.target_job_title || "").trim() || null,
    company_name: cvType === "General CV" ? null : String(form.company_name || "").trim() || null,
    job_url: cvType === "General CV" ? null : String(form.job_url || "").trim() || null,
    job_description_text: cvType === "General CV" ? null : String(form.job_description_text || "").trim() || null,
    professional_field: String(form.professional_field || existing.professional_field || "").trim() || null,
    target_role: String(form.target_role || existing.target_role || "").trim() || null,
    cv_language_count: languageCount,
    selected_cv_languages: selectedLanguages,
    has_current_cv: form.has_current_cv === true || form.has_current_cv === "Yes",
    optional_cv_link: String(form.optional_cv_link || "").trim() || null,
    tools: safeArray(form.tools).map(String),
    spoken_languages: form.spoken_languages ?? existing.spoken_languages,
    has_certifications: form.has_certifications === true || form.has_certifications === "Yes",
    certifications_text: String(form.certifications_text || "").trim() || null,
    certifications_link: String(form.certifications_link || "").trim() || null,
    cv_design_preference: String(form.cv_design_preference || "").trim() || null,
    cv_template_link: String(form.cv_template_link || "").trim() || null,
    additional_information: String(form.additional_information || "").trim() || null,
    excluded_information: String(form.excluded_information || "").trim() || null,
    recruitment_consent: form.recruitment_consent === true || form.recruitment_consent === "Yes",
    final_consent: Object.hasOwn(form, "final_consent") ? form.final_consent === true : existing.final_consent === true,
    raw_payload: mergedRaw,
  };

  if (updatePayload.full_name.length < 2 || updatePayload.full_name.length > 160 || !/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/u.test(updatePayload.full_name)) {
    return NextResponse.json({ error: "Enter a valid full name using Latin characters." }, { status: 400 });
  }
  if (updatePayload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatePayload.email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (updatePayload.phone.length < 6 || updatePayload.phone.length > 32) {
    return NextResponse.json({ error: "Enter a valid WhatsApp number." }, { status: 400 });
  }
  if (!/^(ar|fr|en)$/.test(updatePayload.form_language)) {
    return NextResponse.json({ error: "Choose a valid form language." }, { status: 400 });
  }
  if (Object.hasOwn(form, "spoken_languages") && !hasAtLeastThreeDistinctSpokenLanguages(form.spoken_languages)) {
    const error = updatePayload.form_language === "ar"
      ? "أدخل ثلاث لغات مختلفة على الأقل وحدد مستوى كل لغة."
      : updatePayload.form_language === "fr"
        ? "Indiquez au moins trois langues différentes et leur niveau."
        : "Enter at least three different languages and select a level for each.";
    return NextResponse.json({ error }, { status: 400 });
  }
  if (Object.hasOwn(form, "final_consent") && form.final_consent !== true) {
    return NextResponse.json({ error: "Please confirm the request details before saving." }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("cv_requests")
    .update(updatePayload)
    .eq("id", existing.id)
    .eq("user_id", user.id)
    .in("status", editableClientRequestStatuses())
    .or("payment_status.neq.PAID,payment_status.is.null")
    .select("id,request_code,status,payment_status,cv_type,cv_language_count,selected_cv_languages")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: "This request can no longer be edited. Refresh the page to see its latest status." }, { status: 409 });
  }

  const submissionToken = await createRequestSubmissionToken(String(existing.id), String(existing.request_code));
  return NextResponse.json({
    success: true,
    id: updated.id,
    request_code: updated.request_code,
    request: updated,
    submission_token: submissionToken,
    price_dzd: priceDzd,
    cover_letter_included: coverLetterIncluded,
  }, { headers: { "Cache-Control": "no-store" } });
}

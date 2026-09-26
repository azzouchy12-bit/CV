import JSZip from "jszip";
import { getAdminRequestByCode } from "@/lib/admin-data";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getAnalysis } from "@/lib/analysis-data";
import { shouldGenerateCoverLetter } from "@/lib/request-deliverables";

const bucket = "cvup-requests";
const generatedBucket = "cvup-generated";

type SupportingMaterial = {
  question_key?: string;
  link?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
};

function supportingMaterials(value: unknown): SupportingMaterial[] {
  return Array.isArray(value) ? value.filter((item): item is SupportingMaterial => Boolean(item && typeof item === "object")) : [];
}

function safeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "request";
}

function text(value: unknown) {
  if (Array.isArray(value)) return value.length ? value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(", ") : "—";
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function row(label: string, value: unknown) {
  return `- **${label}:** ${text(value)}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ requestCode: string }> }) {
  const { requestCode } = await params;
  const request = await getAdminRequestByCode(requestCode);
  if (!request) return new Response("Request not found.", { status: 404 });

  const raw = record(request.raw_payload);
  const coverLetterEligible = shouldGenerateCoverLetter(request);
  const analysis = request.id ? await getAnalysis(String(request.id)).catch(() => null) : null;
  const coverLetter = coverLetterEligible && typeof analysis?.analysis.cover_letter === "string"
    ? analysis.analysis.cover_letter.trim()
    : "";
  const supporting = supportingMaterials(request.supporting_materials);
  const uploadedFiles = [
    ["Current CV", request.current_cv_file_path, request.current_cv_file_name],
    ["Job Description", request.job_description_file_path, request.job_description_file_name],
    ["Certifications", request.certifications_file_path, request.certifications_file_name],
    ["Template / Reference", request.cv_template_file_path, request.cv_template_file_name],
  ] as Array<[string, string | null | undefined, string | null | undefined]>;

  const markdown = [
    "# CVUp Client Dossier",
    "",
    "## Request",
    row("Request code", request.request_code),
    row("Submitted at", request.created_at),
    row("Current work status", request.status),
    row("Form language", request.form_language),
    "",
    "## Client",
    row("Full name", request.full_name),
    row("Phone / WhatsApp", request.phone),
    row("Email", request.email),
    "",
    "## CV Request",
    row("CV type", request.cv_type),
    row("Target role", request.target_role),
    row("Professional field", request.professional_field),
    row("CV language count", request.cv_language_count),
    row("Selected CV languages", request.selected_cv_languages),
    row("Personalized cover letter included", coverLetterEligible),
    "",
    "## Target Job",
    row("Target job title", request.target_job_title),
    row("Company", request.company_name),
    row("Job URL", request.job_url),
    row("Job Description", request.job_description_text),
    "",
    "## Professional Information",
    row("Professional evidence", raw.professional_evidence),
    row("Other professional evidence", raw.professional_evidence_other),
    row("Platforms", raw.platforms_worked_with),
    row("Other platforms", raw.platforms_other),
    row("Tools", request.tools),
    row("Other tools", raw.tools_other),
    row("Has measurable achievements", raw.has_measurable_achievements),
    row("Achievements", raw.measurable_achievements_text),
    row("Has additional experience", raw.has_additional_experience),
    row("Additional experience", raw.additional_experience_text),
    row("Collaboration types", raw.collaboration_types),
    row("Other collaboration", raw.collaboration_other),
    row("Additional professional information", raw.additional_professional_information),
    "",
    "## Languages",
    row("Spoken languages", request.spoken_languages),
    "",
    "## Eligibility / Mobility",
    row("Current country", raw.current_country),
    row("Nationality", raw.nationality),
    row("Willing to relocate", raw.willing_to_relocate),
    row("Target countries", raw.target_countries),
    row("Work authorization", raw.work_authorization),
    row("Other work authorization", raw.work_authorization_other),
    "",
    "## Certifications",
    row("Has certifications", request.has_certifications),
    row("Certification details", request.certifications_text),
    row("Certification link", request.certifications_link),
    row("Certification file", request.certifications_file_name),
    "",
    "## Preferences",
    row("Has current CV", request.has_current_cv),
    row("Current CV link", request.optional_cv_link),
    row("CV design preference", request.cv_design_preference),
    row("Other design preference", raw.cv_design_preference_other),
    row("Template / reference link", request.cv_template_link),
    row("Additional information", request.additional_information),
    row("Information to exclude", request.excluded_information),
    row("Recruitment consent", request.recruitment_consent),
    row("Final consent", request.final_consent),
    "",
    "## Payment",
    row("Payment method", request.payment_method),
    row("Payment status", request.payment_status),
    row("Payment reference", request.payment_reference),
    row("Payment notes", request.payment_notes),
    row("Paid at", request.paid_at),
    "",
    "## Supporting Materials",
    ...(supporting.length
      ? supporting.flatMap((item) => [
          row("Question", item.question_key),
          row("Link", item.link),
          row("File", item.file_name),
          "",
        ])
      : [row("Supporting materials", "—")]),
    "",
    "## Uploaded Files",
    ...uploadedFiles.map(([label, path, name]) => row(label, name ? `${name} (${path || "path unavailable"})` : "—")),
    "",
    "## All Client-Provided Answers",
    "The JSON block below preserves the complete submitted intake payload for manual processing.",
    "",
    "```json",
    JSON.stringify(raw, null, 2),
    "```",
    "",
  ].join("\n");

  const zip = new JSZip();
  zip.file("request.md", markdown);
  if (coverLetter) zip.file("cover-letter.md", coverLetter);

  const supabase = getSupabaseServerClient();
  const warnings: string[] = [];

  for (const [label, path, name] of uploadedFiles) {
    if (!path || !name) continue;
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      warnings.push(`${label}: ${name} could not be downloaded.`);
      continue;
    }
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const safeName = name.replace(/[\\/]/g, "-");
    zip.file(`uploads/${safeLabel}--${safeName}`, await data.arrayBuffer());
  }

  for (const item of supporting) {
    if (!item.file_path || !item.file_name) continue;
    const { data, error } = await supabase.storage.from(bucket).download(item.file_path);
    if (error || !data) {
      warnings.push(`Supporting material ${item.question_key || "unknown"}: ${item.file_name} could not be downloaded.`);
      continue;
    }
    const safeQuestion = String(item.question_key || "supporting").replace(/[^a-zA-Z0-9_-]/g, "-");
    zip.file(`supporting/${safeQuestion}/${item.file_name.replace(/[\\/]/g, "-")}`, await data.arrayBuffer());
  }

  if (warnings.length) {
    zip.file("upload-warnings.txt", warnings.join("\n"));
  }

  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const archiveName = `${safeSlug(String(request.full_name))}-${request.request_code}.zip`;
  const requestFolder = safeSlug(String(request.id || request.request_code));
  const generatedPath = `dossiers/${requestFolder}/${Date.now()}/${archiveName}`;

  const { error: uploadError } = await supabase.storage
    .from(generatedBucket)
    .upload(generatedPath, archive, {
      contentType: "application/zip",
      cacheControl: "60",
      upsert: false,
    });

  if (uploadError) {
    return new Response("Could not prepare dossier download.", { status: 500 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(generatedBucket)
    .createSignedUrl(generatedPath, 300, { download: true });

  if (signedError || !signed?.signedUrl) {
    await supabase.storage.from(generatedBucket).remove([generatedPath]);
    return new Response("Could not create dossier download link.", { status: 500 });
  }

  return Response.redirect(signed.signedUrl, 307);
}

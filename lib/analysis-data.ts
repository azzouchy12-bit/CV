import { getSupabaseServerClient } from "@/lib/supabase";
import type { CvAnalysis } from "@/lib/ai-schema";
import type { CandidateDossier } from "@/lib/ai-provider";
import type { CvRequestRow } from "@/lib/admin-data";
import { extractCandidateCvText, extractJobDescriptionText, extractSupportingCandidateText } from "@/lib/file-extraction";
import { shouldGenerateCoverLetter } from "@/lib/request-deliverables";
import { prepareCandidateRawPayload } from "@/lib/profile-privacy";

export type StoredAnalysis = {
  id: string;
  request_id: string;
  status: string;
  analysis: CvAnalysis;
  provider: string | null;
  created_at: string;
  updated_at: string;
};

export async function buildCandidateDossier(request: CvRequestRow): Promise<CandidateDossier> {
  const [cv, jobDescription, supporting] = await Promise.all([
    extractCandidateCvText({ path: request.current_cv_file_path, name: request.current_cv_file_name, type: request.current_cv_file_type }),
    extractJobDescriptionText({ path: request.job_description_file_path, name: request.job_description_file_name, type: request.job_description_file_type }),
    extractSupportingCandidateText([
      { path: request.certifications_file_path, name: request.certifications_file_name, type: request.certifications_file_type },
      { path: request.cv_template_file_path, name: request.cv_template_file_name, type: request.cv_template_file_type },
    ]),
  ]);

  const sourceWarnings = [cv.warning, ...(!request.job_description_text ? [jobDescription.warning] : []), ...supporting.warnings].filter(
    (warning): warning is NonNullable<typeof warning> => Boolean(warning)
  );

  return {
    request_code: String(request.request_code),
    candidate_form_data: { ...request, raw_payload: undefined },
    candidate_raw_payload: prepareCandidateRawPayload(request.raw_payload),
    existing_cv_text: cv.text,
    job_description_text: request.job_description_text || jobDescription.text,
    supporting_candidate_text: supporting.text,
    source_warnings: sourceWarnings,
    generate_cover_letter: shouldGenerateCoverLetter(request),
  };
}

export async function saveAnalysis(requestId: string, analysis: CvAnalysis, provider: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("cv_analyses")
    .upsert({ request_id: requestId, status: analysis.internal_quality.ready_for_generation ? "READY_TO_GENERATE" : "NEEDS_REVIEW", analysis, provider, updated_at: new Date().toISOString() }, { onConflict: "request_id" })
    .select("id, request_id, status, analysis, provider, created_at, updated_at")
    .single();
  if (error || !data) throw new Error(error?.message || "Analysis could not be saved.");
  return data as StoredAnalysis;
}

export async function getAnalysis(requestId: string): Promise<StoredAnalysis | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("cv_analyses").select("id, request_id, status, analysis, provider, created_at, updated_at").eq("request_id", requestId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as StoredAnalysis | null;
}

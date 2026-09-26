export type RequestTarget = {
  cv_type?: unknown;
  target_role?: unknown;
  target_job_title?: unknown;
  company_name?: unknown;
  job_url?: unknown;
  job_description_text?: unknown;
};

/** A general CV is never paired with a cover letter; targeted requests need real target context. */
export function shouldGenerateCoverLetter(request: RequestTarget): boolean {
  if (request.cv_type !== "CV targeted to a specific job") return false;
  return [request.target_role, request.target_job_title, request.company_name, request.job_url, request.job_description_text]
    .some((value) => typeof value === "string" && value.trim().length > 0);
}

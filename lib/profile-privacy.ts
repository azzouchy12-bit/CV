export function prepareCandidateRawPayload(rawPayload: unknown): Record<string, unknown> {
  const payload = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
    ? { ...(rawPayload as Record<string, unknown>) }
    : {};
  const includeGender = payload.include_gender_in_cv === true;
  const includeBirthDate = payload.include_date_of_birth_in_cv === true;
  if (!includeGender) delete payload.gender;
  if (!includeBirthDate) delete payload.date_of_birth;
  payload.cv_personal_detail_preferences = {
    include_gender_in_cv: includeGender,
    include_date_of_birth_in_cv: includeBirthDate,
  };
  return payload;
}

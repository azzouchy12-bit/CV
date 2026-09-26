export const analysisStatuses = ["READY_TO_GENERATE", "NEEDS_REVIEW"] as const;
export type AnalysisStatus = (typeof analysisStatuses)[number];

export type QualityLevel = "low" | "medium" | "good" | "strong";
export type MatchStatus = "confirmed" | "partial" | "not_confirmed";

export type CandidateFacts = {
  professional_summary_facts: string[];
  experience: string[];
  education: string[];
  certifications: string[];
  confirmed_skills: string[];
  confirmed_tools: string[];
  confirmed_platforms: string[];
  confirmed_languages: string[];
  confirmed_achievements: string[];
  collaboration_experience: string[];
};

export type JobAnalysis = {
  is_targeted_job: boolean;
  job_title: string;
  company: string;
  main_responsibilities: string[];
  required_skills: string[];
  preferred_skills: string[];
  required_tools: string[];
  required_languages: string[];
  experience_requirements: string[];
  eligibility_requirements: string[];
  important_keywords: string[];
};

export type JobMatch = {
  requirement: string;
  candidate_evidence: string;
  status: MatchStatus;
};

export type Gap = {
  requirement: string;
  reason: "not_confirmed";
};

export type CvStrategy = {
  target_title: string;
  priority_experiences: string[];
  secondary_experiences: string[];
  recommended_section_order: string[];
  content_to_emphasize: string[];
  content_to_reduce: string[];
  keywords_safe_to_use: string[];
};

export type InternalQuality = {
  data_completeness: QualityLevel;
  job_relevance: QualityLevel;
  evidence_strength: QualityLevel;
  ats_structure_readiness: "not_ready" | "ready";
  ready_for_generation: boolean;
};

export type CvAnalysis = {
  cover_letter: string | null;
  candidate_facts: CandidateFacts;
  job_analysis: JobAnalysis;
  job_matches: JobMatch[];
  gaps: Gap[];
  eligibility_flags: string[];
  content_to_exclude: string[];
  cv_strategy: CvStrategy;
  internal_quality: InternalQuality;
};

const qualityLevels = new Set<QualityLevel>(["low", "medium", "good", "strong"]);
const matchStatuses = new Set<MatchStatus>(["confirmed", "partial", "not_confirmed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function requireStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!isStringArray(value)) throw new Error(`Analysis field ${key} must be a string array.`);
  return value;
}

function requireString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`Analysis field ${key} must be a string.`);
  return value;
}

function parseCandidateFacts(value: unknown): CandidateFacts {
  if (!isRecord(value)) throw new Error("Analysis candidate_facts is missing or invalid.");
  return {
    professional_summary_facts: requireStringArray(value, "professional_summary_facts"),
    experience: requireStringArray(value, "experience"),
    education: requireStringArray(value, "education"),
    certifications: requireStringArray(value, "certifications"),
    confirmed_skills: requireStringArray(value, "confirmed_skills"),
    confirmed_tools: requireStringArray(value, "confirmed_tools"),
    confirmed_platforms: requireStringArray(value, "confirmed_platforms"),
    confirmed_languages: requireStringArray(value, "confirmed_languages"),
    confirmed_achievements: requireStringArray(value, "confirmed_achievements"),
    collaboration_experience: requireStringArray(value, "collaboration_experience"),
  };
}

function parseJobAnalysis(value: unknown): JobAnalysis {
  if (!isRecord(value)) throw new Error("Analysis job_analysis is missing or invalid.");
  if (typeof value.is_targeted_job !== "boolean") throw new Error("Analysis is_targeted_job must be boolean.");
  return {
    is_targeted_job: value.is_targeted_job,
    job_title: requireString(value, "job_title"),
    company: requireString(value, "company"),
    main_responsibilities: requireStringArray(value, "main_responsibilities"),
    required_skills: requireStringArray(value, "required_skills"),
    preferred_skills: requireStringArray(value, "preferred_skills"),
    required_tools: requireStringArray(value, "required_tools"),
    required_languages: requireStringArray(value, "required_languages"),
    experience_requirements: requireStringArray(value, "experience_requirements"),
    eligibility_requirements: requireStringArray(value, "eligibility_requirements"),
    important_keywords: requireStringArray(value, "important_keywords"),
  };
}

export function parseCvAnalysis(value: unknown, includeCoverLetter = false): CvAnalysis {
  if (!isRecord(value)) throw new Error("AI analysis must be an object.");
  const coverLetter = value.cover_letter;
  if (includeCoverLetter && (typeof coverLetter !== "string" || !coverLetter.trim())) {
    throw new Error("Analysis is missing the requested cover letter.");
  }
  const matches = value.job_matches;
  if (!Array.isArray(matches)) throw new Error("Analysis job_matches must be an array.");
  const jobMatches = matches.map((item) => {
    if (!isRecord(item) || typeof item.requirement !== "string" || typeof item.candidate_evidence !== "string" || !matchStatuses.has(item.status as MatchStatus)) {
      throw new Error("Analysis contains an invalid job match.");
    }
    return { requirement: item.requirement, candidate_evidence: item.candidate_evidence, status: item.status as MatchStatus };
  });
  const gaps = value.gaps;
  if (!Array.isArray(gaps)) throw new Error("Analysis gaps must be an array.");
  const parsedGaps = gaps.map((item) => {
    if (!isRecord(item) || typeof item.requirement !== "string" || item.reason !== "not_confirmed") {
      throw new Error("Analysis contains an invalid gap.");
    }
    return { requirement: item.requirement, reason: "not_confirmed" as const };
  });
  if (!isRecord(value.cv_strategy) || !isRecord(value.internal_quality)) throw new Error("Analysis strategy or quality is missing.");
  const quality = value.internal_quality;
  if (!qualityLevels.has(quality.data_completeness as QualityLevel) || !qualityLevels.has(quality.job_relevance as QualityLevel) || !qualityLevels.has(quality.evidence_strength as QualityLevel) || !["not_ready", "ready"].includes(String(quality.ats_structure_readiness)) || typeof quality.ready_for_generation !== "boolean") {
    throw new Error("Analysis internal_quality is invalid.");
  }
  const strategy = value.cv_strategy;
  return {
    cover_letter: includeCoverLetter ? String(coverLetter).trim() : null,
    candidate_facts: parseCandidateFacts(value.candidate_facts),
    job_analysis: parseJobAnalysis(value.job_analysis),
    job_matches: jobMatches,
    gaps: parsedGaps,
    eligibility_flags: requireStringArray(value, "eligibility_flags"),
    content_to_exclude: requireStringArray(value, "content_to_exclude"),
    cv_strategy: {
      target_title: requireString(strategy, "target_title"),
      priority_experiences: requireStringArray(strategy, "priority_experiences"),
      secondary_experiences: requireStringArray(strategy, "secondary_experiences"),
      recommended_section_order: requireStringArray(strategy, "recommended_section_order"),
      content_to_emphasize: requireStringArray(strategy, "content_to_emphasize"),
      content_to_reduce: requireStringArray(strategy, "content_to_reduce"),
      keywords_safe_to_use: requireStringArray(strategy, "keywords_safe_to_use"),
    },
    internal_quality: {
      data_completeness: quality.data_completeness as QualityLevel,
      job_relevance: quality.job_relevance as QualityLevel,
      evidence_strength: quality.evidence_strength as QualityLevel,
      ats_structure_readiness: quality.ats_structure_readiness as "not_ready" | "ready",
      ready_for_generation: quality.ready_for_generation,
    },
  };
}

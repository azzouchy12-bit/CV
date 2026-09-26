import { parseCvAnalysis, type CvAnalysis } from "@/lib/ai-schema";

export type CandidateDossier = {
  request_code: string;
  candidate_form_data: Record<string, unknown>;
  candidate_raw_payload: unknown;
  existing_cv_text: string | null;
  job_description_text: string | null;
  supporting_candidate_text: string | null;
  source_warnings: string[];
  generate_cover_letter: boolean;
};

export interface AiProvider {
  analyzeCandidate(input: CandidateDossier): Promise<CvAnalysis>;
}

export class AiProviderHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly type: string | null,
    public readonly code: string | null,
    public readonly providerMessage: string | null,
    public readonly requestId: string | null
  ) {
    super(`AI provider returned HTTP ${status}.`);
    this.name = "AiProviderHttpError";
  }
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

async function parseProviderError(response: Response): Promise<AiProviderHttpError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const error = record.error && typeof record.error === "object" && !Array.isArray(record.error)
    ? (record.error as Record<string, unknown>)
    : {};
  const requestId = safeString(response.headers.get("x-request-id")) || safeString(record.request_id) || safeString(error.request_id);
  return new AiProviderHttpError(
    response.status,
    safeString(error.type),
    safeString(error.code),
    safeString(error.message),
    requestId
  );
}

class HttpAiProvider implements AiProvider {
  constructor(private readonly apiKey: string, private readonly baseUrl: string, private readonly model: string) {}

  async analyzeCandidate(input: CandidateDossier): Promise<CvAnalysis> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Return only the requested structured JSON. Use only candidate-provided evidence. Source priority for candidate facts is explicit form data, then raw structured payload, then existing CV text, then supporting candidate file text. For job descriptions, use pasted job_description_text before uploaded file text. Never infer facts from job requirements. source_warnings are internal metadata, not candidate facts or invented gaps. Unsupported requirements must be gaps with reason not_confirmed. Include cover_letter as a polished, personalized application letter in the form language only when dossier.generate_cover_letter is true, using candidate evidence and supplied target details only; otherwise cover_letter must be null. Respect cv_personal_detail_preferences: include gender or date of birth in any deliverable only when its matching include flag is true, even if that detail appears in uploaded CV text. Never invent names, dates, experience, achievements, or contact details.",
          },
          { role: "user", content: JSON.stringify({ task: "Analyze this CVUp candidate dossier and prepare the requested deliverables", dossier: input }) },
        ],
      }),
    });
    if (!response.ok) throw await parseProviderError(response);
    const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned no structured analysis.");
    return parseCvAnalysis(JSON.parse(content), input.generate_cover_letter);
  }
}

export function getAiProvider(): AiProvider {
  const apiKey = process.env.CVUP_AI_API_KEY?.trim();
  const baseUrl = process.env.CVUP_AI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const model = process.env.CVUP_AI_MODEL?.trim();
  if (!apiKey || !model) throw new Error("AI provider is not configured. Set CVUP_AI_API_KEY and CVUP_AI_MODEL on the server.");
  return new HttpAiProvider(apiKey, baseUrl, model);
}

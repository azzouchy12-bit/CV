export const clientRequestStates = ["draft", "action_required", "submitted", "in_progress", "ready"] as const;
export type ClientRequestState = (typeof clientRequestStates)[number];

type RequestStateInput = {
  status?: unknown;
  payment_status?: unknown;
};

const readyStatuses = new Set(["READY", "DELIVERED", "COMPLETED"]);
const progressStatuses = new Set(["IN_PROGRESS", "PROCESSING", "PAID"]);
const submittedStatuses = new Set(["NEW", "SUBMITTED", "PENDING"]);

/** Map stored workflow values to stable, user-facing categories. */
export function getClientRequestState(request: RequestStateInput): ClientRequestState {
  const status = typeof request.status === "string" ? request.status.toUpperCase() : "";
  const payment = typeof request.payment_status === "string" ? request.payment_status.toUpperCase() : "";

  if (readyStatuses.has(status)) return "ready";
  if (progressStatuses.has(status) || payment === "PAID") return "in_progress";
  if (status === "DRAFT") return "draft";
  // Current request creation uses NEW + PENDING until payment is confirmed.
  if (payment === "PENDING") return "action_required";
  if (submittedStatuses.has(status)) return "submitted";

  // Unknown states stay visible under Submitted instead of becoming fake drafts.
  return "submitted";
}

export function categorizeClientRequests<T extends RequestStateInput>(requests: T[]) {
  return requests.reduce<Record<ClientRequestState, T[]>>((groups, request) => {
    groups[getClientRequestState(request)].push(request);
    return groups;
  }, { draft: [], action_required: [], submitted: [], in_progress: [], ready: [] });
}

export function isSavedClientDraft(value: unknown): value is { form: Record<string, unknown>; step?: number; saved_at?: string; fileNames?: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return Boolean(draft.form && typeof draft.form === "object" && !Array.isArray(draft.form) && Object.keys(draft.form as object).length);
}

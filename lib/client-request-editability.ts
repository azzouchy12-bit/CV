/** Statuses used for requests that have not entered payment or production. */
const editableStatuses = new Set(["NEW", "DRAFT", "PENDING"]);

export type ClientRequestEditability = {
  status?: unknown;
  payment_status?: unknown;
};

/** Fail closed: unknown and production states are read-only. */
export function isClientRequestEditable(request: ClientRequestEditability): boolean {
  const status = typeof request.status === "string" ? request.status.toUpperCase() : "";
  const paymentStatus = typeof request.payment_status === "string" ? request.payment_status.toUpperCase() : "";
  return paymentStatus !== "PAID" && editableStatuses.has(status);
}

export function editableClientRequestStatuses(): string[] {
  return [...editableStatuses];
}

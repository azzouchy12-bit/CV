import assert from "node:assert/strict";
import { test } from "node:test";
import { isClientRequestEditable } from "../lib/client-request-editability.ts";
import { safeInternalRedirect } from "../lib/auth-redirect.ts";

test("only unpaid, pre-processing statuses can be edited", () => {
  for (const status of ["NEW", "DRAFT", "PENDING"]) {
    assert.equal(isClientRequestEditable({ status, payment_status: "PENDING" }), true);
  }
  for (const status of ["IN_PROGRESS", "READY", "DELIVERED", "COMPLETED", "CANCELLED", "UNKNOWN"]) {
    assert.equal(isClientRequestEditable({ status, payment_status: "PENDING" }), false, status);
  }
  assert.equal(isClientRequestEditable({ status: "NEW", payment_status: "PAID" }), false);
  assert.equal(isClientRequestEditable({ status: "NEW", payment_status: null }), true);
  assert.equal(isClientRequestEditable({ status: null, payment_status: "PENDING" }), false);
});

test("safe internal redirects preserve local route, query and fragment", () => {
  assert.equal(safeInternalRedirect("/request/new?source=account#form", "/account", "https://cvup.example"), "/request/new?source=account#form");
});

test("safe internal redirects reject external and ambiguous URLs", () => {
  for (const value of ["https://evil.example", "//evil.example", "/\\\\evil.example", "javascript:alert(1)", null]) {
    assert.equal(safeInternalRedirect(value, "/account", "https://cvup.example"), "/account", String(value));
  }
});

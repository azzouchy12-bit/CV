import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateRequestPrice } from "../lib/pricing.ts";
import { shouldGenerateCoverLetter } from "../lib/request-deliverables.ts";

test("request pricing adds 200 DZD per additional CV language", () => {
  assert.equal(calculateRequestPrice(1), 800);
  assert.equal(calculateRequestPrice(2), 1000);
  assert.equal(calculateRequestPrice(3), 1200);
  assert.equal(calculateRequestPrice(0), 800);
});

test("cover letter is excluded for general CVs and needs real targeted context", () => {
  assert.equal(shouldGenerateCoverLetter({ cv_type: "General CV", target_job_title: "Designer" }), false);
  assert.equal(shouldGenerateCoverLetter({ cv_type: "CV targeted to a specific job" }), false);
  assert.equal(shouldGenerateCoverLetter({ cv_type: "CV targeted to a specific job", target_job_title: "Designer" }), true);
});

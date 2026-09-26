import test from "node:test";
import assert from "node:assert/strict";
import { prepareCandidateRawPayload } from "../lib/profile-privacy.ts";

test("personal details are removed from AI payload unless explicitly included in the CV", () => {
  const raw = {
    gender: "Female",
    date_of_birth: "1990-01-02",
    include_gender_in_cv: false,
    include_date_of_birth_in_cv: false,
    full_name: "Test Candidate",
  };
  const prepared = prepareCandidateRawPayload(raw);
  assert.equal("gender" in prepared, false);
  assert.equal("date_of_birth" in prepared, false);
  assert.equal(prepared.full_name, "Test Candidate");
  assert.deepEqual(prepared.cv_personal_detail_preferences, {
    include_gender_in_cv: false,
    include_date_of_birth_in_cv: false,
  });
  assert.equal(raw.gender, "Female");
});

test("only individually approved personal details remain in AI payload", () => {
  const prepared = prepareCandidateRawPayload({
    gender: "Female",
    date_of_birth: "1990-01-02",
    include_gender_in_cv: true,
    include_date_of_birth_in_cv: false,
  });
  assert.equal(prepared.gender, "Female");
  assert.equal("date_of_birth" in prepared, false);
});

test("invalid raw payloads do not leak incidental object data", () => {
  assert.deepEqual(prepareCandidateRawPayload(null), {
    cv_personal_detail_preferences: {
      include_gender_in_cv: false,
      include_date_of_birth_in_cv: false,
    },
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUsage, planFromProfile } from "../lib/usage.js";

test("parseUsage: sesión, semanal y solo modelos con valor", () => {
  const u = parseUsage({
    five_hour: { utilization: 10, resets_at: "2026-10-21T07:30:00Z" },
    seven_day: { utilization: 90, resets_at: "2026-10-28T01:00:00Z" },
    seven_day_opus: { utilization: null },
    seven_day_sonnet: { utilization: 40, resets_at: null },
  });
  assert.deepEqual(u.session, { key: "five_hour", label: "Sesión 5 h", util: 10, resetsAt: "2026-10-21T07:30:00Z" });
  assert.equal(u.weekly.label, "Semanal");
  assert.equal(u.weekly.util, 90);
  assert.deepEqual(u.models.map(m => m.label), ["Sonnet"]);
});

test("parseUsage: orden de los modelos", () => {
  const q = { utilization: 1, resets_at: null };
  const u = parseUsage({ seven_day_oauth_apps: q, seven_day_cowork: q, seven_day_omelette: q, seven_day_sonnet: q, seven_day_opus: q });
  assert.deepEqual(u.models.map(m => m.label), ["Opus", "Sonnet", "Claude Design", "Cowork", "Apps OAuth"]);
});

test("parseUsage tolera campos ausentes", () => {
  const u = parseUsage({});
  assert.equal(u.session.util, null);
  assert.equal(u.session.resetsAt, null);
  assert.deepEqual(u.models, []);
  assert.equal(parseUsage(null).weekly.util, null);
});

test("plan desde el perfil", () => {
  assert.equal(planFromProfile({ organization: { organization_type: "claude_team" } }), "TEAM");
  assert.equal(planFromProfile({ organization: { organization_type: "claude_enterprise" } }), "ENTERPRISE");
  assert.equal(planFromProfile({ organization: { organization_type: "claude_pro" } }), "PRO");
  assert.equal(planFromProfile({ account: { has_claude_pro: true } }), "PRO");
  assert.equal(planFromProfile({ organization: { organization_type: "claude_max", rate_limit_tier: "default_claude_max_20x" } }), "MAX 20×");
  assert.equal(planFromProfile({ account: { has_claude_max: true } }), "MAX");
  assert.equal(planFromProfile({}), null);
  assert.equal(planFromProfile(null), null);
});

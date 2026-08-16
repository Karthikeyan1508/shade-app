/**
 * Action Dispatcher — pushes a recommendation to Slack (if configured) and
 * ALWAYS writes it to the compliance_log, which is the point of the whole
 * exercise: an automatic, defensible audit trail, whether or not anyone
 * ever sees the Slack message.
 */

import getDb from "./db";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface DispatchInput {
  recommendationId: number;
  siteId: string;
  siteName: string;
  tier: string;
  actionText: string;
  reason: string;
}

async function postToSlack(input: DispatchInput) {
  if (!SLACK_WEBHOOK_URL) {
    console.log(`[dispatcher] (no SLACK_WEBHOOK_URL set — logging instead of posting)\n  ${input.siteName}: ${input.actionText}`);
    return;
  }
  const body = {
    text: `*${input.tier} at ${input.siteName}*\n${input.actionText}\n_${input.reason}_`,
  };
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`[dispatcher] Slack post failed: ${res.status}`);
}

export async function dispatch(input: DispatchInput) {
  const db = getDb();
  await postToSlack(input);

  db.prepare(
    `INSERT INTO compliance_log (recommendation_id, site_id, ts, event_type, payload_json)
     VALUES (?, ?, ?, 'recommendation_dispatched', ?)`
  ).run(input.recommendationId, input.siteId, new Date().toISOString(), JSON.stringify(input));
}

export async function logApproval(recommendationId: number, siteId: string, approvedBy = "demo-supervisor") {
  const db = getDb();
  const ts = new Date().toISOString();
  db.prepare(`UPDATE recommendations SET status = 'approved', approved_ts = ? WHERE id = ?`).run(ts, recommendationId);
  db.prepare(
    `INSERT INTO compliance_log (recommendation_id, site_id, ts, event_type, payload_json)
     VALUES (?, ?, ?, 'recommendation_approved', ?)`
  ).run(recommendationId, siteId, ts, JSON.stringify({ approvedBy }));
}

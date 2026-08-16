/**
 * Agent — turns a risk state + shift schedule into ONE named, explainable
 * recommendation.
 *
 * If GROQ_API_KEY is set, we ask an LLM (via Groq's free tier, OpenAI-
 * compatible endpoint) for a structured JSON recommendation. If it's not
 * set — e.g. before anyone on the team has signed up for anything — we fall
 * back to a deterministic rule-based recommender so the pipeline still
 * works end to end with ZERO API keys configured at all.
 *
 * Either path returns the same shape, validated before it's allowed to reach
 * the dispatcher. Never let raw model output hit the DB/Slack unchecked.
 */

import { RiskResult } from "./risk-engine";

export interface ShiftInfo {
  crewId: string;
  crewName: string;
  task: string;
  locationType: string;
  startTime: string;
  endTime: string;
}

export interface Recommendation {
  crewId: string | null;
  action: string; // short imperative, e.g. "reschedule" | "move_indoors" | "reroute" | "monitor"
  actionText: string; // human-readable action card text
  reason: string;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function ruleBasedRecommendation(
  siteName: string,
  risk: RiskResult,
  shifts: ShiftInfo[]
): Recommendation {
  const outdoorShift = shifts.find((s) => s.locationType === "outdoor");
  const crew = outdoorShift?.crewName ?? "the outdoor crew";
  const crewId = outdoorShift?.crewId ?? null;

  if (risk.tier === "Extreme" || risk.tier === "Danger") {
    return {
      crewId,
      action: "move_indoors",
      actionText: `Move ${crew} off outdoor tasks at ${siteName} now — ${risk.metric.toUpperCase()} is ${risk.value} (${risk.tier}).`,
      reason: `${risk.metric} crossed the ${risk.tier} threshold at ${siteName}.`,
    };
  }
  if (risk.tier === "Warning") {
    return {
      crewId,
      action: "reschedule",
      actionText: `Shift ${crew}'s outdoor window at ${siteName} earlier to avoid the coming Danger threshold.`,
      reason: `${risk.metric} is ${risk.value}, trending toward Danger at ${siteName}.`,
    };
  }
  return {
    crewId,
    action: "monitor",
    actionText: `No action needed at ${siteName} right now — continue monitoring.`,
    reason: `${risk.metric} is ${risk.value} (${risk.tier}).`,
  };
}

async function llmRecommendation(
  siteName: string,
  risk: RiskResult,
  shifts: ShiftInfo[]
): Promise<Recommendation> {
  const system = `You are Shade, a heat-safety scheduling agent for industrial worksites.
Given a site's current heat-risk tier and its shift schedule, propose exactly ONE concrete,
specific action. Respond with ONLY a JSON object matching this shape, no prose:
{"crewId": string|null, "action": "move_indoors"|"reschedule"|"reroute"|"monitor", "actionText": string, "reason": string}`;

  const user = JSON.stringify({ siteName, risk, shifts });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error(`Groq request failed: ${res.status}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);
  return validateRecommendation(parsed);
}

function validateRecommendation(obj: unknown): Recommendation {
  const r = obj as Partial<Recommendation>;
  if (
    typeof r !== "object" ||
    r === null ||
    typeof r.actionText !== "string" ||
    typeof r.reason !== "string" ||
    !["move_indoors", "reschedule", "reroute", "monitor"].includes(r.action ?? "")
  ) {
    throw new Error("Agent returned a malformed recommendation — rejecting.");
  }
  return {
    crewId: r.crewId ?? null,
    action: r.action as Recommendation["action"],
    actionText: r.actionText,
    reason: r.reason,
  };
}

/** Get a recommendation for a site. Uses Groq if configured, else a rule-based fallback. */
export async function getRecommendation(
  siteName: string,
  risk: RiskResult,
  shifts: ShiftInfo[]
): Promise<Recommendation> {
  if (!GROQ_API_KEY) return ruleBasedRecommendation(siteName, risk, shifts);
  try {
    return await llmRecommendation(siteName, risk, shifts);
  } catch (err) {
    console.error("[agent] LLM call failed, falling back to rule-based:", err);
    return ruleBasedRecommendation(siteName, risk, shifts);
  }
}

export function agentModeLabel(): "LLM (Groq)" | "rule-based (no key set)" {
  return GROQ_API_KEY ? "LLM (Groq)" : "rule-based (no key set)";
}

import type { RequestInsight, TriageKind } from "@/lib/types";

/**
 * The vocabulary of AI triage, shared by the server (question criteria, SQL
 * filters) and the UI (labels, chips). Browser-safe: no db, no env.
 *
 * Keys are stored in the database; renaming one orphans old rows, so add new
 * keys instead of editing existing ones.
 */

/** Sender services Jev can pick from. The description is what the model reads. */
export const TRIAGE_SOURCES = {
  stripe: { label: "Stripe", description: "Stripe (payments, billing, Connect)" },
  github: { label: "GitHub", description: "GitHub (repositories, Actions, apps)" },
  gitlab: { label: "GitLab", description: "GitLab" },
  bitbucket: { label: "Bitbucket", description: "Bitbucket" },
  vercel: { label: "Vercel", description: "Vercel (deployments, projects)" },
  netlify: { label: "Netlify", description: "Netlify" },
  shopify: { label: "Shopify", description: "Shopify (stores, orders, products)" },
  paypal: { label: "PayPal", description: "PayPal" },
  paddle: { label: "Paddle", description: "Paddle" },
  lemonsqueezy: { label: "Lemon Squeezy", description: "Lemon Squeezy" },
  slack: { label: "Slack", description: "Slack (Events API, slash commands, interactivity)" },
  discord: { label: "Discord", description: "Discord (interactions, bots)" },
  telegram: { label: "Telegram", description: "Telegram Bot API" },
  meta: { label: "Meta", description: "Meta platforms: WhatsApp Business, Messenger, Facebook or Instagram" },
  twilio: { label: "Twilio", description: "Twilio (SMS, voice, messaging)" },
  email: { label: "Email", description: "An email delivery service such as SendGrid, Mailgun, Postmark, Resend or Amazon SES" },
  linear: { label: "Linear", description: "Linear (issues, projects)" },
  atlassian: { label: "Atlassian", description: "Jira, Confluence or another Atlassian product" },
  clerk: { label: "Clerk", description: "Clerk (user authentication events)" },
  supabase: { label: "Supabase", description: "Supabase (database webhooks, auth hooks)" },
  google: { label: "Google", description: "A Google service such as Cloud Pub/Sub, Firebase, Calendar or Forms" },
  aws: { label: "AWS", description: "Amazon Web Services such as SNS or EventBridge" },
  automation: { label: "Automation", description: "An automation platform such as Zapier, Make, n8n or IFTTT" },
  forms: { label: "Forms", description: "A form or scheduling tool such as Typeform, Tally, Calendly or Cal.com" },
  hubspot: { label: "HubSpot", description: "HubSpot" },
  other: {
    label: "Other",
    description: "None of the services listed: the user's own application, another service, a manual request (curl, Postman, a browser) or unidentifiable traffic",
  },
} as const satisfies Record<string, { label: string; description: string }>;

export type TriageSource = keyof typeof TRIAGE_SOURCES;

export const TRIAGE_KINDS: Record<TriageKind, { label: string; description: string; hue: number }> = {
  event: {
    label: "Event",
    description: "A genuine event notification from a service: something happened, such as a payment, a push, a message, an order or a deployment",
    hue: 145,
  },
  test: {
    label: "Test",
    description: "A test, sample or example delivery: sent from a dashboard's 'send test event' button, a CLI trigger, or containing obvious placeholder data",
    hue: 242,
  },
  handshake: {
    label: "Handshake",
    description: "A setup or keep-alive request: URL verification challenge, subscription confirmation, ping or health check",
    hue: 200,
  },
  probe: {
    label: "Probe",
    description: "Unsolicited internet noise: vulnerability scanners, bots, crawlers, or requests probing for files and admin pages such as .env, wp-login.php or /admin",
    hue: 15,
  },
  other: {
    label: "Other",
    description: "Anything else, such as a hand-written API call or someone opening the URL in a browser",
    hue: 240,
  },
};

/** Ordered levels of the attention Score. Index = score. */
export const ATTENTION_LEVELS = [
  "Routine: expected, informational traffic that needs no action, such as a successful payment, a push, a ping or a created record",
  "Worth a look: notable or unusual but nothing is broken, such as a refund, a cancellation, a permission or configuration change, or a new signup",
  "Needs action: the sending service reports that something failed or is at risk, such as a failed payment, a dispute or chargeback, a failed build or deploy, an outage, or a security alert. Scanners and bots probing the inbox itself are noise, not this level",
] as const;

/** Attention at or above this counts as "needs action". */
export const NEEDS_ACTION_MIN = 1.5;
/** Attention at or above this (and below NEEDS_ACTION_MIN) counts as "notable". */
export const NOTABLE_MIN = 0.75;
/** Noul probabilities at or above this are shown as flags. */
export const FLAG_MIN = 0.7;

export type AttentionTier = "action" | "notable" | "routine";

export function attentionTier(attention: number | null | undefined): AttentionTier | null {
  if (attention == null) return null;
  if (attention >= NEEDS_ACTION_MIN) return "action";
  if (attention >= NOTABLE_MIN) return "notable";
  return "routine";
}

export const ATTENTION_TIERS: Record<AttentionTier, { label: string; hue: number }> = {
  action: { label: "Needs action", hue: 15 },
  notable: { label: "Notable", hue: 75 },
  routine: { label: "Routine", hue: 145 },
};

export function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  return source in TRIAGE_SOURCES ? TRIAGE_SOURCES[source as TriageSource].label : source;
}

/** Probability of the chosen option of a Choice question, when stored. */
export function choiceProbability(insight: RequestInsight, question: "source" | "kind"): number | null {
  const chosen = insight[question];
  if (!chosen) return null;
  return insight.probabilities[question]?.[chosen] ?? null;
}

/** A known sender we're reasonably sure about; null for "other" or a coin flip. */
export function confidentSource(insight: RequestInsight | undefined): string | null {
  if (!insight || insight.status !== "ok" || !insight.source || insight.source === "other") return null;
  const p = choiceProbability(insight, "source");
  return p == null || p >= 0.5 ? insight.source : null;
}

/** The request needs a human: high attention and not internet noise. */
export function needsAction(insight: RequestInsight | undefined): boolean {
  return Boolean(insight && insight.status === "ok" && insight.kind !== "probe" && attentionTier(insight.attention) === "action");
}

/** The Gateway refused the call for rate limiting (e.g. free-tier credits); worth retrying later. */
export function isRateLimited(insight: RequestInsight | null | undefined): boolean {
  return Boolean(insight?.error && /rate.?limit|429|too many requests/i.test(insight.error));
}

import "dotenv/config";

export const SHEET_ACTIVE_QUEUE = "Active_Queue";
export const SHEET_TEMPLATES = "Templates";

export const TEMPLATE_T1 = "T1_NAMED_PERSON";
export const TEMPLATE_T2 = "T2_ROLE_INBOX";
export const VALID_TEMPLATE_IDS = new Set([TEMPLATE_T1, TEMPLATE_T2]);

export const FALLBACKS = Object.freeze({
  first_name: "team",
  full_name: "",
  company: "your company",
});

export const DEFAULTS = Object.freeze({
  file: "./email_outreach_list.xlsx",
  cap: 10,
  delay: 45,
  jitter: 15,
  sentLog: "./sent.log",
  errorSleepSeconds: 10,
});

/**
 * Load and validate credentials from env. Required only when actually sending.
 * @param {{ requireCreds?: boolean }} [opts]
 * @returns {{ gmailUser: string, gmailAppPassword: string, fromName: string }}
 */
export function loadCredentials({ requireCreds = true } = {}) {
  const gmailUser = process.env.GMAIL_USER || "";
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || "";
  const fromName = process.env.FROM_NAME || "Mahendra Singh Puniya";

  if (requireCreds) {
    const missing = [];
    if (!gmailUser) missing.push("GMAIL_USER");
    if (!gmailAppPassword) missing.push("GMAIL_APP_PASSWORD");
    if (missing.length > 0) {
      throw new Error(
        `Missing required env vars: ${missing.join(", ")}. Copy .env.example to .env and fill in your Gmail credentials.`
      );
    }
  }

  return { gmailUser, gmailAppPassword, fromName };
}

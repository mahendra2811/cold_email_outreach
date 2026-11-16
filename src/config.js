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
  file: "./excel/HR_Contacts.xlsx",
  cap: 10,
  dailyCap: 100,
  delay: 45,
  jitter: 15,
  sentLog: "./sent.log",
  errorSleepSeconds: 10,
  proofEmail: "mahendrapuniya92@gmail.com",
});

/**
 * Load credentials for a specific account index.
 * Account 0 → GMAIL_USER / GMAIL_APP_PASSWORD / FROM_NAME
 * Account 1 → GMAIL_USER2 / GMAIL_APP_PASSWORD2 / FROM_NAME2
 * @param {number} [n=0]
 * @param {{ requireCreds?: boolean }} [opts]
 * @returns {{ gmailUser: string, gmailAppPassword: string, fromName: string }}
 */
export function loadAccountCredentials(n = 0, { requireCreds = true } = {}) {
  const suffix = n === 0 ? "" : String(n + 1); // 0→"", 1→"2", 2→"3"
  const gmailUser = process.env[`GMAIL_USER${suffix}`] || "";
  const gmailAppPassword = process.env[`GMAIL_APP_PASSWORD${suffix}`] || "";
  const fromName =
    process.env[`FROM_NAME${suffix}`] || process.env.FROM_NAME || "Mahendra Singh Puniya";

  if (requireCreds) {
    const missing = [];
    if (!gmailUser) missing.push(`GMAIL_USER${suffix}`);
    if (!gmailAppPassword) missing.push(`GMAIL_APP_PASSWORD${suffix}`);
    if (missing.length > 0) {
      throw new Error(
        `Missing required env vars for account ${n}: ${missing.join(", ")}. Check your .env file.`
      );
    }
  }

  return { gmailUser, gmailAppPassword, fromName };
}

/** @deprecated Use loadAccountCredentials(0) instead. */
export function loadCredentials({ requireCreds = true } = {}) {
  return loadAccountCredentials(0, { requireCreds });
}

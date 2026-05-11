import nodemailer from 'nodemailer';

/**
 * @typedef {Object} SenderConfig
 * @property {string} gmailUser
 * @property {string} gmailAppPassword
 * @property {string} fromName
 */

/**
 * @typedef {Object} SendArgs
 * @property {string} to
 * @property {string} subject
 * @property {string} text
 */

/**
 * Create a nodemailer transport for Gmail SMTP using an App Password.
 * @param {SenderConfig} cfg
 */
export function createTransport(cfg) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: cfg.gmailUser, pass: cfg.gmailAppPassword },
  });
}

/**
 * Build a sender function. In dry-run mode no real transport is created.
 * @param {SenderConfig} cfg
 * @param {{ dryRun: boolean }} opts
 * @returns {(args: SendArgs) => Promise<{ messageId?: string, dryRun: boolean }>}
 */
export function createSender(cfg, { dryRun }) {
  if (dryRun) {
    return async () => ({ dryRun: true });
  }

  const transport = createTransport(cfg);
  const fromHeader = `"${cfg.fromName}" <${cfg.gmailUser}>`;

  return async ({ to, subject, text }) => {
    const info = await transport.sendMail({
      from: fromHeader,
      to,
      subject,
      text,
    });
    return { messageId: info.messageId, dryRun: false };
  };
}

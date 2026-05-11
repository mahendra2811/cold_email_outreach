import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

import {
  SHEET_ACTIVE_QUEUE,
  SHEET_TEMPLATES,
  TEMPLATE_T1,
  TEMPLATE_T2,
  VALID_TEMPLATE_IDS,
} from './config.js';

/**
 * @typedef {Object} QueueRow
 * @property {string} email
 * @property {string} template_id
 * @property {string} template_variables - raw JSON string
 * @property {string} suggested_subject
 * @property {string} person_full_name
 * @property {string} company_guess
 * @property {string} manual_skip
 * @property {number} rowIndex - 1-based row index from sheet (excluding header)
 */

const SUBJECT_PREFIX_RE = /^\s*SUBJECT:\s*(.+?)\r?\n\r?\n([\s\S]*)$/;

/**
 * Read the Excel workbook at the given path.
 * @param {string} filePath
 * @returns {XLSX.WorkBook}
 */
function readWorkbook(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Excel file not found: ${abs}`);
  }
  return XLSX.readFile(abs);
}

/**
 * Load template bodies from the Templates sheet.
 * Strips the `SUBJECT: ...\n\n` prefix from each body.
 * @param {string} filePath
 * @returns {{ [TEMPLATE_T1]: string, [TEMPLATE_T2]: string }}
 */
export function loadTemplates(filePath) {
  const wb = readWorkbook(filePath);
  const sheet = wb.Sheets[SHEET_TEMPLATES];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_TEMPLATES}" not found in ${filePath}`);
  }

  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  /** @type {Record<string, string>} */
  const out = {};

  for (const row of aoa) {
    const id = String(row[0] || '').trim();
    if (!VALID_TEMPLATE_IDS.has(id)) continue;
    const body = String(row[1] || '');
    const m = body.match(SUBJECT_PREFIX_RE);
    out[id] = m ? m[2].trim() : body.trim();
  }

  if (!out[TEMPLATE_T1] || !out[TEMPLATE_T2]) {
    const missing = [TEMPLATE_T1, TEMPLATE_T2].filter((k) => !out[k]);
    throw new Error(
      `Templates sheet missing required template(s): ${missing.join(', ')}`,
    );
  }

  return /** @type {any} */ (out);
}

/**
 * Load and normalize the Active_Queue sheet.
 * @param {string} filePath
 * @returns {QueueRow[]}
 */
export function loadQueue(filePath) {
  const wb = readWorkbook(filePath);
  const sheet = wb.Sheets[SHEET_ACTIVE_QUEUE];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_ACTIVE_QUEUE}" not found in ${filePath}`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  /** @type {QueueRow[]} */
  const out = [];

  rows.forEach((r, i) => {
    out.push({
      email: String(r.email || '').trim(),
      template_id: String(r.template_id || '').trim(),
      template_variables: String(r.template_variables || '').trim(),
      suggested_subject: String(r.suggested_subject || '').trim(),
      person_full_name: String(r.person_full_name || '').trim(),
      company_guess: String(r.company_guess || '').trim(),
      manual_skip: String(r.manual_skip || '').trim(),
      rowIndex: i + 2,
    });
  });

  return out;
}

import { FALLBACKS } from './config.js';

/**
 * @typedef {Object} TemplateVars
 * @property {string} [first_name]
 * @property {string} [full_name]
 * @property {string} [company]
 */

/**
 * Parse the `template_variables` JSON string from a queue row.
 * Throws a clear error on invalid or non-object JSON.
 * @param {string} raw
 * @returns {TemplateVars}
 */
export function parseTemplateVariables(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`invalid JSON: ${e.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('template_variables must be a JSON object');
  }
  return parsed;
}

/**
 * Apply fallback values for missing or empty-string fields.
 * Treats empty string as missing (uses fallback).
 * @param {TemplateVars} vars
 * @returns {Required<TemplateVars>}
 */
export function applyFallbacks(vars) {
  const v = vars || {};
  const pick = (key) => {
    const val = v[key];
    if (val === undefined || val === null || val === '') return FALLBACKS[key];
    return String(val);
  };
  return {
    first_name: pick('first_name'),
    full_name: pick('full_name'),
    company: pick('company'),
  };
}

const PLACEHOLDER_RE = /\{(first_name|full_name|company)\}/g;

/**
 * Replace `{first_name}`, `{full_name}`, `{company}` placeholders in a string.
 * Unknown placeholders are left unchanged.
 * @param {string} input
 * @param {Required<TemplateVars>} vars
 * @returns {string}
 */
export function fillTemplate(input, vars) {
  if (!input) return '';
  return String(input).replace(PLACEHOLDER_RE, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Same placeholder logic as fillTemplate; kept as a separate export for clarity
 * since per-spec only {company} and {first_name} appear in subjects.
 * @param {string} subject
 * @param {Required<TemplateVars>} vars
 * @returns {string}
 */
export function fillSubject(subject, vars) {
  return fillTemplate(subject, vars);
}

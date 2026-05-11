import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyFallbacks,
  fillSubject,
  fillTemplate,
  parseTemplateVariables,
} from '../src/template.js';

test('fillTemplate replaces {first_name}, {full_name}, {company}', () => {
  const body = 'Hi {first_name},\n\nI saw {company} and {full_name}.';
  const out = fillTemplate(body, {
    first_name: 'Ajay',
    full_name: 'Ajay Tiwari',
    company: 'ABB India',
  });
  assert.equal(out, 'Hi Ajay,\n\nI saw ABB India and Ajay Tiwari.');
});

test('applyFallbacks uses "team" when first_name missing', () => {
  const vars = applyFallbacks({ company: 'Foo' });
  assert.equal(vars.first_name, 'team');
});

test('applyFallbacks uses "your company" when company missing', () => {
  const vars = applyFallbacks({ first_name: 'Ajay' });
  assert.equal(vars.company, 'your company');
});

test('applyFallbacks treats empty string as missing for first_name', () => {
  const vars = applyFallbacks({ first_name: '', company: 'Foo' });
  assert.equal(vars.first_name, 'team');
});

test('applyFallbacks treats empty string as missing for company', () => {
  const vars = applyFallbacks({ first_name: 'Ajay', company: '' });
  assert.equal(vars.company, 'your company');
});

test('applyFallbacks defaults full_name to empty string', () => {
  const vars = applyFallbacks({ first_name: 'Ajay', company: 'Foo' });
  assert.equal(vars.full_name, '');
});

test('fillTemplate replaces multiple occurrences of same placeholder', () => {
  const body = '{company} {company} {company}';
  const out = fillTemplate(body, applyFallbacks({ company: 'ABB' }));
  assert.equal(out, 'ABB ABB ABB');
});

test('fillSubject replaces {company} and {first_name}', () => {
  const subject = 'Application at {company} — for {first_name}';
  const out = fillSubject(
    subject,
    applyFallbacks({ company: 'ABB', first_name: 'Ajay' }),
  );
  assert.equal(out, 'Application at ABB — for Ajay');
});

test('unknown placeholders are left unchanged (do not crash)', () => {
  const body = 'Hi {first_name}, your role is {role}.';
  const out = fillTemplate(body, applyFallbacks({ first_name: 'Ajay' }));
  assert.equal(out, 'Hi Ajay, your role is {role}.');
});

test('fillTemplate is safe when called with empty string body', () => {
  assert.equal(fillTemplate('', applyFallbacks({})), '');
});

test('parseTemplateVariables returns object for valid JSON', () => {
  const vars = parseTemplateVariables('{"company":"ABB","first_name":"Ajay"}');
  assert.equal(vars.company, 'ABB');
  assert.equal(vars.first_name, 'Ajay');
});

test('parseTemplateVariables throws on invalid JSON', () => {
  assert.throws(() => parseTemplateVariables('{not json}'));
});

test('parseTemplateVariables throws on non-object JSON', () => {
  assert.throws(() => parseTemplateVariables('"string"'));
  assert.throws(() => parseTemplateVariables('null'));
  assert.throws(() => parseTemplateVariables('[1,2]'));
});

test('replacement value containing $ is treated literally (no $$ escape oddity)', () => {
  const out = fillTemplate(
    'Pay: {company}',
    applyFallbacks({ company: '$50/hr ($$)' }),
  );
  assert.equal(out, 'Pay: $50/hr ($$)');
});

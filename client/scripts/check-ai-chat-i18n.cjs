#!/usr/bin/env node
// 验证 5 语言 aiChat 键完整性
const fs = require('fs');
const path = require('path');

const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko'];

function loadJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  // 去除 BOM (单/双 BOM 都容错)
  while (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

function flattenKeys(obj, prefix = '') {
  const out = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenKeys(v, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

const root = process.cwd();
const MODULES = path.join(root, 'src', 'locales', 'modules');

// === aiChat.json ===
console.log('=== aiChat.json ===');
const baseFp = path.join(MODULES, 'zh-CN', 'aiChat.json');
const base = loadJson(baseFp);
const baseKeys = flattenKeys(base);
console.log(`zh-CN baseline: ${baseKeys.length} keys`);

for (const loc of LOCALES) {
  const fp = path.join(MODULES, loc, 'aiChat.json');
  if (!fs.existsSync(fp)) {
    console.log(`${loc}: MISSING FILE`);
    continue;
  }
  const data = loadJson(fp);
  const keys = new Set(flattenKeys(data));
  const missing = baseKeys.filter(k => !keys.has(k));
  console.log(`${loc}: ${keys.size} keys, missing ${missing.length}${missing.length ? ' [first 10]: ' + missing.slice(0, 10).join(', ') : ''}`);
}

// === aiChatInput.json ===
console.log('\n=== aiChatInput.json ===');
const inputFp = path.join(MODULES, 'zh-CN', 'aiChatInput.json');
if (fs.existsSync(inputFp)) {
  const base2 = loadJson(inputFp);
  const baseKeys2 = flattenKeys(base2);
  console.log(`zh-CN baseline: ${baseKeys2.length} keys`);
  for (const loc of LOCALES) {
    const fp = path.join(MODULES, loc, 'aiChatInput.json');
    if (!fs.existsSync(fp)) {
      console.log(`${loc}: MISSING FILE`);
      continue;
    }
    const data = loadJson(fp);
    const keys = new Set(flattenKeys(data));
    const missing = baseKeys2.filter(k => !keys.has(k));
    console.log(`${loc}: ${keys.size} keys, missing ${missing.length}${missing.length ? ' [first 10]: ' + missing.slice(0, 10).join(', ') : ''}`);
  }
} else {
  console.log('aiChatInput.json: NOT EXISTS in zh-CN');
}

// === aiChatComponents.json ===
console.log('\n=== aiChatComponents.json ===');
const compFp = path.join(MODULES, 'zh-CN', 'aiChatComponents.json');
if (fs.existsSync(compFp)) {
  const base3 = loadJson(compFp);
  const baseKeys3 = flattenKeys(base3);
  console.log(`zh-CN baseline: ${baseKeys3.length} keys`);
  for (const loc of LOCALES) {
    const fp = path.join(MODULES, loc, 'aiChatComponents.json');
    if (!fs.existsSync(fp)) {
      console.log(`${loc}: MISSING FILE`);
      continue;
    }
    const data = loadJson(fp);
    const keys = new Set(flattenKeys(data));
    const missing = baseKeys3.filter(k => !keys.has(k));
    console.log(`${loc}: ${keys.size} keys, missing ${missing.length}${missing.length ? ' [first 10]: ' + missing.slice(0, 10).join(', ') : ''}`);
  }
} else {
  console.log('aiChatComponents.json: NOT EXISTS in zh-CN');
}

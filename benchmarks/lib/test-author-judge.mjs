// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { stripComments } from './dry-judge.mjs';

const FUNCS = ['capitalize', 'isBlank', 'countVowels'];
const COMPARE = new Set(['equal', 'strictEqual', 'deepEqual', 'deepStrictEqual']);

function readBalanced(code, openIdx, openCh, closeCh) {
  let depth = 0;
  for (let i = openIdx; i < code.length; i += 1) {
    const c = code[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      i += 1;
      while (i < code.length && code[i] !== q) {
        if (code[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }
    if (c === openCh) depth += 1;
    else if (c === closeCh) {
      depth -= 1;
      if (depth === 0) return { end: i, inner: code.slice(openIdx + 1, i) };
    }
  }
  return null;
}

function splitTopArgs(inner) {
  const args = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      cur += c;
      i += 1;
      while (i < inner.length && inner[i] !== q) {
        cur += inner[i];
        if (inner[i] === '\\') {
          i += 1;
          if (i < inner.length) cur += inner[i];
        }
        i += 1;
      }
      if (i < inner.length) cur += inner[i];
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) {
      args.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function extractAssertCalls(code) {
  const out = [];
  const re = /\bassert\s*\.\s*([A-Za-z0-9_]+)\s*\(/g;
  let matched;
  while ((matched = re.exec(code))) {
    const open = matched.index + matched[0].length - 1;
    const balanced = readBalanced(code, open, '(', ')');
    if (!balanced) break;
    out.push({
      method: matched[1],
      args: splitTopArgs(balanced.inner),
      raw: code.slice(matched.index, balanced.end + 1),
    });
    re.lastIndex = balanced.end + 1;
  }
  return out;
}

function squash(value) {
  return String(value).replace(/\s+/g, '');
}

function literalValue(expr) {
  const text = expr.trim();
  if (text === 'true') return { ok: true, value: true };
  if (text === 'false') return { ok: true, value: false };
  if (text === 'null') return { ok: true, value: null };
  if (text === 'undefined') return { ok: true, value: undefined };
  if (/^-?\d+(\.\d+)?$/.test(text)) return { ok: true, value: Number(text) };
  if (
    (text.startsWith('"') && text.endsWith('"') && text.length >= 2) ||
    (text.startsWith("'") && text.endsWith("'") && text.length >= 2)
  ) {
    return { ok: true, value: text.slice(1, -1) };
  }
  return { ok: false };
}

function isTautologicalAssert(assertion) {
  const args = assertion.args;
  if (COMPARE.has(assertion.method) && args.length >= 2) {
    if (squash(args[0]) === squash(args[1])) return true;
    const left = literalValue(args[0]);
    const right = literalValue(args[1]);
    if (left.ok && right.ok && Object.is(left.value, right.value)) return true;
  }
  if (assertion.method === 'ok') {
    const expr = args[0] || '';
    const compact = squash(expr);
    if (compact === 'true' || compact === '!false' || compact === '!!true' || compact === '!!1') return true;
    const same = expr.match(/^\s*([\s\S]+?)\s*===\s*([\s\S]+?)\s*$/);
    if (same && squash(same[1]) === squash(same[2])) return true;
  }
  return false;
}

function callsFunc(assertion) {
  const blob = assertion.args.join(',');
  return FUNCS.some((name) => new RegExp(`\\b${name}\\s*\\(`).test(blob));
}

export function judgeWrittenTests(src) {
  const code = stripComments(src);
  const importsAssert = /\bimport\b[\s\S]*node:assert/.test(code) || /require\(\s*['"]node:assert['"]\s*\)/.test(code);
  if (!importsAssert) return { ok: false, reason: '必须使用 node:assert' };
  const asserts = extractAssertCalls(code);
  const tautology = asserts.find(isTautologicalAssert);
  if (tautology) return { ok: false, reason: `恒真断言不得通过: ${tautology.raw.slice(0, 120)}` };
  const real = asserts.filter(callsFunc);
  if (real.length < 6) return { ok: false, reason: `调用被测函数的断言不足 6 条, 实际 ${real.length}` };
  for (const name of FUNCS) {
    const covered = real.some((assertion) => new RegExp(`\\b${name}\\s*\\(`).test(assertion.args.join(',')));
    if (!covered) return { ok: false, reason: `断言未覆盖 ${name}` };
  }
  return { ok: true, reason: '' };
}

/** 直接调用三个被测函数，比较真实返回值。恒真断言过不了这一层。 */
export function utilsBehaviorMismatches(mod) {
  const cases = [
    ['capitalize("hello")', mod.capitalize?.('hello'), 'Hello'],
    ['capitalize("")', mod.capitalize?.(''), ''],
    ['capitalize("x")', mod.capitalize?.('x'), 'X'],
    ['isBlank("   ")', mod.isBlank?.('   '), true],
    ['isBlank("a")', mod.isBlank?.('a'), false],
    ['isBlank(null)', mod.isBlank?.(null), true],
    ['countVowels("Beautiful")', mod.countVowels?.('Beautiful'), 5],
    ['countVowels("")', mod.countVowels?.(''), 0],
    ['countVowels("xyz")', mod.countVowels?.('xyz'), 0],
  ];
  return cases
    .filter(([, got, want]) => !Object.is(got, want))
    .map(([name, got, want]) => `${name}: 得到 ${String(got)}，期望 ${String(want)}`);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权限放宽租约化对账(目标级 / 限时 / 可审计)
 *
 * 两类红:
 *  L1 放宽必须源自租约且**带到期** —— `grantPermissionLease(` 的每个调用点,同一次调用
 *     文本里必须同时出现 (expiresAt|ttlMs) 与 (expiresAfterTurns|maxCalls)。缺任一即红:
 *     "无期限的放宽"这一型不允许存在(构造器也判死,这里是第二道,防有人绕过构造器自拼对象)。
 *  L2 放宽必须走唯一出口 —— 任何**引用了租约符号**的文件,自己写 `'ask'` 比较式来放行
 *     即红(`permissions.ts` 的 `applyLeaseToDecision` 是唯一落点)。触发条件是租约符号
 *     本身而不是手工清单 —— 清单会腐烂,符号不会。
 *
 * 口径同守门 70/77/83/98/101/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱、两面旗同给 exit 2、清单与内容**同面同轮**、取不到判
 * "无法判定"(**不记绿**)。staged/worktree 档棘轮锚点 = 该文件 HEAD blob 自身的违规数。
 *
 * 接线现状(如实登记、不夸大):本门**尚未**进 `scripts/guardian-runner.mjs` 注册表 ——
 * 该文件当日被他人在飞改动持有,并行改注册表会互相覆盖注册块(门 93 记过同型事故)。
 * 当前问责入口 = 直接跑本脚本(手动 / CI)。刻意**不**登记进根 package.json:守门 89 R4
 * 会把它算作已接线并要文档点名,而登记一条跑不通的出路比不登记更贵。接进提交链时必须同时
 * 补 `blocking` + `skipEnv`,由镜像测试 T1 钉住"未注册 ⇒ 不得声称已装车"。
 *
 * 用法:node scripts/check-permission-lease-bounded.mjs [--staged|--worktree|--self-test]
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_DIRS = ['apps/cli/src', 'packages'];
const SRC_RE = /\.(ts|tsx|mts|cts)$/;
const SKIP_RE = /(^|\/)(node_modules|dist|\.next|tests?|__tests__|fixtures?)(\/|$)|\.test\.(ts|tsx)$/;

const GRANT_RE = /grantPermissionLease\s*\(/g;
const TTL_RE = /\b(?:expiresAt|ttlMs)\b/;
const BOUND_RE = /\b(?:expiresAfterTurns|maxCalls)\b/;
const ASK_FLIP_RE = /['"]ask['"]\s*(?:===|!==)|(?:===|!==)\s*['"]ask['"]/g;
/** 租约符号面:出现这些标识符的文件才被 L2 问责(不是白名单,是触发条件) */
const LEASE_SYMBOL_RE = /\b(?:PermissionLease|activePermissionLease|grantPermissionLease|resolveLeaseRelaxation|viaLease)\b/;
const SINGLE_EXIT_FILE = 'apps/cli/src/tools/permissions.ts';

export function classify(file) {
  return SCAN_DIRS.some((d) => file.startsWith(`${d}/`)) && SRC_RE.test(file) && !SKIP_RE.test(file);
}

function readCallArgs(code, matchIndex) {
  const open = code.indexOf('(', matchIndex);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < code.length && i < open + 4000; i += 1) {
    if (code[i] === '(') depth += 1;
    else if (code[i] === ')') {
      depth -= 1;
      if (depth === 0) return code.slice(open, i + 1);
    }
  }
  return code.slice(open, open + 4000);
}

function lineOf(text, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) if (text[i] === '\n') n += 1;
  return n;
}

/**
 * 剥注释(字符串感知状态机)。
 * 两条实测教训一起处理:① 只按行首 `//` 剥会把文件头 JSDoc 里提到的
 * `grantPermissionLease()` 当成调用点判红(本门第一次自跑就咬到了自己);
 * ② 不能用正则剥块注释 —— `'https://x/*'` 这类串内序列会骗掉状态机(守门 70 记过同型)。
 */
function stripComments(text) {
  const out = [];
  let i = 0;
  let state = 'code'; // code | line | block | squote | dquote | template
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && n === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") { state = 'squote'; }
      else if (c === '"') { state = 'dquote'; }
      else if (c === '`') { state = 'template'; }
      out.push(c);
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out.push(c); }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && n === '/') { state = 'code'; i += 2; continue; }
      if (c === '\n') out.push(c); // 保住行号
      i += 1;
      continue;
    }
    // 字符串态:整段保留(判据字面量常出现在字符串里),转义跳一位
    if (c === '\\') { out.push(c, n ?? ''); i += 2; continue; }
    if ((state === 'squote' && c === "'") || (state === 'dquote' && c === '"') || (state === 'template' && c === '`')) {
      state = 'code';
    }
    out.push(c);
    i += 1;
  }
  return out.join('');
}

export function scanSource(text, file = '') {
  const findings = [];
  const code = stripComments(text);
  for (const m of code.matchAll(GRANT_RE)) {
    // 声明处(`export function grantPermissionLease(`)不是调用点 —— 它没有实参可判
    const before = code.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
    if (/\b(?:function|const|type|interface)\s+$/.test(before)) continue;
    const callText = readCallArgs(code, m.index ?? 0);
    if (!TTL_RE.test(callText) || !BOUND_RE.test(callText)) {
      findings.push({
        kind: 'L1',
        line: lineOf(text, m.index ?? 0),
        text: 'grantPermissionLease 缺到期或到量界(两者必须同时给)',
      });
    }
  }
  const leaseAware = file !== SINGLE_EXIT_FILE && LEASE_SYMBOL_RE.test(code);
  if (leaseAware) {
    for (const m of code.matchAll(ASK_FLIP_RE)) {
      findings.push({ kind: 'L2', line: lineOf(text, m.index ?? 0), text: `绕唯一出口: ${m[0]}` });
    }
  }
  return findings;
}

function listFiles(face) {
  const args =
    face === 'staged'
      ? ['ls-files', '--', ...SCAN_DIRS]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_DIRS];
  const out = gitRaw(args, ROOT, { timeout: 30_000 });
  if (out === null || out === undefined) throw new Error('git 枚举失败');
  return String(out)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function readFace(face, files) {
  if (face === 'worktree') return new Map(files.map((f) => [f, readWorktreeFile(ROOT, f)]));
  const specs = files.map((f) => (face === 'staged' ? `:${f}` : `HEAD:${f}`));
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 28 });
  const m = new Map();
  files.forEach((f, i) => m.set(f, got.get(specs[i]) ?? null));
  return m;
}

/** baseline=null ⇒ 全量档(无"之前",一切命中都问责);否则吃该文件 HEAD 自身计数棘轮 */
export function aggregate(files, contents, baseline) {
  const reds = [];
  const undetermined = [];
  for (const f of files) {
    const text = contents.get(f);
    if (typeof text !== 'string') {
      undetermined.push(f);
      continue;
    }
    const hits = scanSource(text, f);
    if (hits.length === 0) continue;
    const baseText = baseline === null ? null : baseline.get(f);
    const baseCount = typeof baseText === 'string' ? scanSource(baseText, f).length : 0;
    for (const hit of hits.slice(baseCount)) reds.push({ file: f, ...hit });
  }
  return { reds, undetermined };
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  });
  if (picked.error) {
    console.error(`❌ ${picked.error}`);
    return 2;
  }
  const face = picked.face;
  let files;
  try {
    files = listFiles(face).filter(classify);
  } catch (e) {
    console.error(`❌ 无法判定:${e instanceof Error ? e.message : String(e)}(不记为通过)`);
    return 2;
  }
  if (files.length === 0) {
    console.error('❌ 无法判定:被审面枚举到 0 个候选文件(空扫不记绿)');
    return 2;
  }
  let contents;
  let baseline;
  try {
    contents = readFace(face, files);
    baseline = face === 'head' ? null : readFace('head', files);
  } catch (e) {
    console.error(`❌ 无法判定:取面失败 ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const { reds, undetermined } = aggregate(files, contents, baseline);
  for (const r of reds) console.log(`❌ ${r.kind} ${r.file}:${r.line} ${r.text}`);
  if (reds.length > 0) {
    console.log(`❌ 权限放宽未租约化 ${reds.length} 处(面=${face})`);
    return 1;
  }
  if (undetermined.length > 0) {
    console.log(`⚠️ 无法判定:${undetermined.length} 个文件在该面取不到内容(不记为通过)`);
    return 2;
  }
  console.log(`✅ 权限放宽均已租约化(扫描 ${files.length} 文件,面=${face})`);
  return 0;
}

function selfTest() {
  const cases = [
    ['L1 缺到期 ⇒ 红', "grantPermissionLease({ scope: 's', capabilities: ['a'], grantor: 'cli-flag' })", 1, 'x.ts'],
    ['L1 只给时长 ⇒ 红', "grantPermissionLease({ scope:'s', capabilities:['a'], ttlMs: 1 })", 1, 'x.ts'],
    [
      'L1 两条界齐备 ⇒ 绿',
      "grantPermissionLease({ scope:'s', capabilities:['a'], ttlMs: 1, expiresAfterTurns: 2 })",
      0,
      'x.ts',
    ],
    ['L2 租约感知文件自行翻 ask ⇒ 红', "import { activePermissionLease } from './p.js'; if (d === 'ask') ok = true", 1, 'apps/cli/src/other.ts'],
    ['L2 唯一出口自身 ⇒ 绿', "if (d === 'ask') ok = true", 0, SINGLE_EXIT_FILE],
    ['L2 非租约文件的 ask 比较 ⇒ 绿(不牵连无关代码)', "if (d === 'ask') ok = true", 0, 'apps/cli/src/other.ts'],
    ['L2 注释里的提及 ⇒ 绿', "// if (d === 'ask') ok = true", 0, 'apps/cli/src/other.ts'],
  ];
  let bad = 0;
  for (const [name, src, expectHits, file] of cases) {
    const got = scanSource(src, file).length;
    const ok = got === expectHits;
    if (!ok) bad += 1;
    console.log(`${ok ? '✅' : '❌'} ${name}: 命中 ${got}(期望 ${expectHits})`);
  }
  console.log(bad === 0 ? `✅ --self-test ${cases.length} 例全绿` : `❌ --self-test 失败 ${bad} 例`);
  return bad === 0 ? 0 : 1;
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}`);
      process.exit(2);
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

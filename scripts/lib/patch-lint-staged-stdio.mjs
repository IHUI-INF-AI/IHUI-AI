#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Temporary patch script: force stdio into lint-staged tinyexec spawns (EBUSY root cause).
// Idempotent. Preserves LF. Run: node scripts/lib/patch-lint-staged-stdio.mjs [--check] [--soft]
//   --check 只读判针(0 三针齐 / 1 有缺口 / 2 读不到安装副本·未判定),盯针门 check-lint-staged-stdio-pin.mjs 就是 spawn 它;
//   --soft  安装期专用:读不到副本/上游改版只告警不中断 install(postinstall 用这档),与 --check 互斥。
// 三针落在 node_modules ⇒ 每次 pnpm install 之后都要重跑一次(幂等,已打则零写盘);判针靠 --check,不要靠肉眼。
//
// 2026-10-12 增设第二针(inject-giterr-visible):lint-staged 把 git 步骤的真实失败
// (命令/退出码/stderr)吞进 debugLog(默认关)⇒ 钩子与人都只见一句 "failed due to a git error"。
// 2026-10-10 起的 "EBUSY 形态" 误分类正是这一格失明造成的:index.lock 被并行写者持有
// (exit 128 "File exists")被空 stderr 掩盖两天。本针让 execGit 在失败时把
// cmd+exit+stderr 原样回显到 stderr —— 钩子的 stderrText 由此拿到真因,分类器才能分对。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LINT_DIR = path.join(ROOT, 'node_modules', '.pnpm', 'lint-staged@17.3.0', 'node_modules', 'lint-staged', 'lib');

const files = [
  { name: 'execGit.js', mode: 'replace-nodeOptions' },
  { name: 'execGit.js', mode: 'inject-giterr-visible' },
  { name: 'getSpawnedTask.js', mode: 'inject-tinyExecOptions' },
];

const STDIO_LINE = 'stdio: ["ignore", "pipe", "pipe"],';
const STDIO_DOUBLE = STDIO_LINE;
const STDIO_SINGLE = "stdio: ['ignore', 'pipe', 'pipe'],";
// 第二针的标记串(幂等判据);注入块里的每一行都要能在重跑时被识别为"已打"。
const GITERR_MARKER = '__IHUI_GITERR_VISIBLE__';

function hasStdio(text) {
  return (
    text.includes(STDIO_DOUBLE) ||
    text.includes(STDIO_SINGLE) ||
    /stdio:\s*\[/.test(text)
  );
}

function patchReplaceNodeOptions(text) {
  if (hasStdio(text)) return null;
  const marker = 'nodeOptions: {';
  const idx = text.indexOf(marker);
  if (idx === -1) throw new Error('nodeOptions marker not found');
  // Insert stdio right after the opening of that object.
  const insertAt = idx + marker.length;
  return text.slice(0, insertAt) + '\n        ' + STDIO_DOUBLE + text.slice(insertAt);
}

function patchInjectTinyExecOptions(text) {
  if (hasStdio(text)) return null;
  const marker = 'const tinyExecOptions = {';
  const idx = text.indexOf(marker);
  if (idx === -1) throw new Error('tinyExecOptions marker not found');
  const open = text.indexOf('{', idx);
  const insertAt = open + 1;
  return text.slice(0, insertAt) + '\n    ' + STDIO_DOUBLE + text.slice(insertAt);
}

// 第二针:失败可见性。只锚 17.3.0 execGit.js 的失败块逐字形态;上游改版 ⇒ 抛错给人看,
// 绝不静默跳过(静默跳过 = 针"看起来打了"而实际没打,正是本脚本要消灭的那类假绿)。
function patchInjectGitErrVisible(text) {
  if (text.includes(GITERR_MARKER)) return null;
  const needle =
    '  if (result.exitCode > 0) {\n' +
    '    throw new Error(result.stderr.trimEnd(), { cause: result })\n' +
    '  }';
  if (!text.includes(needle)) throw new Error('execGit failure block not found (upstream changed?)');
  const replacement =
    '  if (result.exitCode > 0) {\n' +
    `    // ${GITERR_MARKER} (scripts/lib/patch-lint-staged-stdio.mjs): lint-staged swallows real\n` +
    '    // git failures into debugLog (off by default); surface cmd+exit+stderr so the\n' +
    '    // pre-commit hook can classify truthfully (index.lock contention is NOT EBUSY).\n' +
    '    try {\n' +
    "      process.stderr.write(\n" +
    '        `[lint-staged git-fail] exit=${result.exitCode} git ${cmd.join(" ")}\\n${String(result.stderr || "").trimEnd()}\\n`,\n' +
    '      )\n' +
    '    } catch {}\n' +
    '    throw new Error(result.stderr.trimEnd(), { cause: result })\n' +
    '  }';
  return text.replace(needle, replacement);
}

const PATCHERS = {
  'replace-nodeOptions': patchReplaceNodeOptions,
  'inject-tinyExecOptions': patchInjectTinyExecOptions,
  'inject-giterr-visible': patchInjectGitErrVisible,
};

const checkOnly = process.argv.includes('--check');
// --soft = postinstall 专用档(2026-10-27):安装期任何"读不到安装副本 / 上游改版导致针打不上"
// 都只告警、绝不中断 install —— 一条补丁脚本把 pnpm install 顶红,唯一结局是人们 --ignore-scripts,
// 反而把整套 lint-staged 与全部钩子一起关掉(§12e 同型:失效方向必须是"多要一次说明",不是"多放一次跳门")。
// 它与 --check 互斥:soft 恒 0 ⇒ 同时给会让盯针读数变成假绿,直接拒绝,不产出任何读数。
const soft = process.argv.includes('--soft');
if (soft && checkOnly) {
  console.error('--soft 与 --check 不能同给(--soft 恒 0,读数会变假绿);判针请只跑 --check');
  process.exit(2);
}
const byFile = new Map();
for (const f of files) {
  if (!byFile.has(f.name)) byFile.set(f.name, []);
  byFile.get(f.name).push(f.mode);
}
let changed = 0;
for (const [name, modes] of byFile) {
  const p = path.join(LINT_DIR, name);
  if (!fs.existsSync(p)) {
    console.error(`MISSING ${p}`);
    if (soft) {
      console.error('(--soft:安装副本不在/版本目录漂移 ⇒ 只告警不中断 install;装好后跑 --check 复核)');
      continue;
    }
    process.exit(2);
  }
  let text = fs.readFileSync(p, 'utf8');
  const applied = [];
  for (const mode of modes) {
    let patched;
    try {
      patched = PATCHERS[mode](text);
    } catch (e) {
      if (!soft) throw e;
      console.error(`WARN ${name} ${mode}: ${e?.message ?? e}(--soft:不中断 install,本针未打上)`);
      applied.push(`${mode}: SKIPPED(soft)`);
      continue;
    }
    if (patched === null) {
      applied.push(`${mode}: ALREADY-PATCHED`);
      continue;
    }
    if (checkOnly) {
      applied.push(`${mode}: NEEDS-PATCH`);
      changed++;
      continue;
    }
    text = patched;
    applied.push(`${mode}: PATCHED`);
    changed++;
  }
  if (!checkOnly && applied.some((l) => l.endsWith(': PATCHED'))) {
    fs.writeFileSync(p, text, 'utf8');
  }
  for (const l of applied) console.log(`${name} ${l}`);
}

if (checkOnly && changed > 0) process.exit(1);
console.log(checkOnly ? 'check done' : 'apply done');
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

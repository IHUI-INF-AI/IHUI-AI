// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:ihui-deploy.ps1 里 Invoke-LiveDocStaleRecovery 的**失败出口**。
//
// 为什么只测拒绝支路:这个函数的正向动作是 `git checkout HEAD -- <活文档>` —— 它会覆盖
// 共享工作区里别人可能正在写的那份副本。判据的正例侧由 scripts/live-doc-staleness-decision.mjs
// 自己的 15 例镜像测试负责(含"一行无出处必判 needHuman"与"多重集超额必判 needHuman");
// 这里要钉的是**调用方有没有把拒绝当真**:
//   D1  挡路清单里出现非活文档路径 ⇒ 一律不复原(哪怕判定器会说 alignable)
//   D2  判定器不在位 ⇒ 不复原(不得退化成"那就直接 checkout 试试")
//   D3  取不到 node ⇒ 不复原
//   D4  判定器 exit 非 0 ⇒ 不复原,且必须把判定器的输出留在日志里(否则下一个人无从复核)
//   D5  备份写不出去 ⇒ 不复原(没有逐字节底稿就不许覆盖台账)
//   D6  装车:函数必须真被 ff 失败分支调用,且只在 BLOCKED-WIP 那一支调用
// 形状锁(D6)是本仓最高频失效型的防线:函数在、自检过、但提交链上没人调用 = 没有。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const DEPLOY = join(repoRoot, 'deploy', 'win', 'ihui-deploy.ps1');

function findShell() {
  const cands = [
    process.env.SystemRoot ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : null,
    'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    'C:/Program Files/PowerShell/7/pwsh.exe',
  ].filter(Boolean);
  for (const c of cands) if (existsSync(c)) return c;
  return null;
}
const SHELL = findShell();

// 取函数原文执行(不 dot-source 整个部署脚本 —— 那会真跑一轮生产部署)。
const src = readFileSync(DEPLOY, 'utf8');
const startMark = 'function Invoke-LiveDocStaleRecovery {';
const startIdx = src.indexOf(startMark);
assert.ok(startIdx >= 0, 'ihui-deploy.ps1 里没有 Invoke-LiveDocStaleRecovery');

// 按大括号配对取整个函数体(与实现无关的取法会跨进下一个函数)
const i = src.indexOf('{', startIdx);
let depth = 0;
let endIdx = -1;
for (let p = i; p < src.length; p++) {
  const ch = src[p];
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) {
      endIdx = p + 1;
      break;
    }
  }
}
assert.ok(endIdx > i, '函数体大括号配平失败');
const FN = src.slice(startIdx, endIdx);

function runPs(body, scratch) {
  if (!SHELL) assert.fail('本机取不到 PowerShell ⇒ 未判定，不得当作通过');
  const f = join(scratch, 'case.ps1');
  // 2026-10-07(G-998074):夹具体携带部署脚本原文的中文日志串;BOM 缺席时 PS5.1 把 UTF-8
  // 按 ANSI/GBK 误读 ⇒ 中文字面量被截成 ParserError,六个用例"没跑"被读成"判了"。
  // 带 BOM 落盘;pwsh7 对 BOM/无 BOM 同读,两代壳兼容。实测:BOM 后 rc=0、RESULT=False 逐字命中。
  writeFileSync(f, '\uFEFF' + body, 'utf8');
  const r = spawnSync(SHELL, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', f], {
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return (r.stdout || '') + (r.stderr || '');
}

function harness(extraStubs = '', blockers = "'PROJECT_PLAN.md', 'README.md'") {
  // 桩:Log 收集到 $script:Logs;Resolve-NodeExe / $Root 由用例决定。
  // 清单从部署脚本原文里抽($LiveDocPaths 才是唯一真相),测试不得自己抄一份 ——
  // 抄了就会出现"测试改名单、生产还是旧名单"的双份真相(本仓对登记表腐烂记过多次)。
  const liveDecl = (src.match(/^\$LiveDocPaths\s*=\s*@\([^)]*\)/m) || [''])[0];
  assert.ok(liveDecl.length > 0, 'ihui-deploy.ps1 里找不到 $LiveDocPaths 的数组声明(名单形态变了?)');
  return [
    `$ErrorActionPreference='Continue'`,
    // 2026-10-07(G-998074):重定向下 PS5.1 的 stdout 默认走 OEM 代码页(本机 GBK),node 侧
    // 按 utf8 解码必成乱码 ⇒ 中文断言全数失明。夹具体内显式收口到 UTF-8(pwsh7 同语句合法)。
    `try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}`,
    `$script:Logs = New-Object System.Collections.ArrayList`,
    `function Log { param([string]$m) [void]$script:Logs.Add($m) }`,
    `function Ok { param([string]$m) Log $m }`,
    liveDecl,
    extraStubs,
    FN,
    `$r = Invoke-LiveDocStaleRecovery -Blockers @(${blockers})`,
    `Write-Output ("RESULT=" + $r)`,
    `Write-Output ("LOGCOUNT=" + $script:Logs.Count)`,
    `$script:Logs | ForEach-Object { Write-Output ("LOG|" + $_) }`,
  ].join('\n');
}

test('D0 名单本身:三份活文档在内、代码路径不在内', () => {
  const scratch = mkScratch('livedoc-d0');
  try {
    const decl = (src.match(/^\$LiveDocPaths\s*=\s*@\([^)]*\)/m) || [''])[0];
    assert.ok(decl.length > 0, 'ihui-deploy.ps1 里找不到 $LiveDocPaths 的数组声明');
    const out = runPs(
      [`function Resolve-NodeExe { return $null }`, decl, `Write-Output ($LiveDocPaths -join ',')`].join('\n'),
      scratch
    );
    for (const p of ['PROJECT_PLAN.md', 'README.md', 'AGENTS.md']) assert.ok(out.includes(p), `名单缺 ${p}: ${out}`);
    assert.ok(!out.includes('apps/'), `名单不该含代码路径: ${out}`);
  } finally {
    rmScratch(scratch);
  }
});

test('D1 清单里出现非活文档路径 ⇒ 一律不复原', () => {
  const scratch = mkScratch('livedoc-d1');
  try {
    const out = runPs(harness(`function Resolve-NodeExe { return $null }`, "'PROJECT_PLAN.md', 'apps/web/src/main.tsx'"), scratch);
    assert.match(out, /RESULT=False/);
    assert.match(out, /LIVE-DOC 不复原:挡路清单里有 1 个非活文档路径/);
  } finally {
    rmScratch(scratch);
  }
});

test('D2 判定器不在位 ⇒ 不复原(不得退化成直接 checkout)', () => {
  const scratch = mkScratch('livedoc-d2');
  try {
    const stub = `function Resolve-NodeExe { return 'node' }\n$Root = '${scratch.replace(/\\/g, '/')}'`;
    const out = runPs(harness(stub), scratch);
    assert.match(out, /RESULT=False/);
    assert.match(out, /LIVE-DOC 未判定:判定器不在位/);
  } finally {
    rmScratch(scratch);
  }
});

test('D3 取不到 node ⇒ 不复原', () => {
  const scratch = mkScratch('livedoc-d3');
  try {
    const out = runPs(harness(`function Resolve-NodeExe { return $null }`), scratch);
    assert.match(out, /RESULT=False/);
    assert.match(out, /node\.exe 取不到/);
  } finally {
    rmScratch(scratch);
  }
});

test('D5 备份落不下去 ⇒ 根本不许尝试 checkout(守卫顺序必须是"先有底稿再覆盖")', () => {
  const scratch = mkScratch('livedoc-d5');
  try {
    mkdirSync(join(scratch, 'scripts'), { recursive: true });
    writeFileSync(join(scratch, 'scripts', 'live-doc-staleness-decision.mjs'), 'process.exit(0);\n', 'utf8');
    writeFileSync(join(scratch, 'PROJECT_PLAN.md'), 'x\n', 'utf8');
    writeFileSync(join(scratch, 'README.md'), 'y\n', 'utf8');
    // 把备份目录的位置用一个同名**文件**占住 ⇒ New-Item 必然终止性失败(整条备份走不通)
    mkdirSync(join(scratch, '.ihui-agent/tmp'), { recursive: true });
    writeFileSync(join(scratch, '.ihui-agent/tmp/live-doc-stale'), '占位文件', 'utf8');
    const stub =
      `function Resolve-NodeExe { return '${process.execPath.replace(/\\/g, '/')}' }\n` +
      `$Root = '${scratch.replace(/\\/g, '/')}'`;
    const out = runPs(harness(stub), scratch);
    assert.match(out, /RESULT=False/);
    assert.match(out, /备份失败,放弃复原/);
    // 这条断言才是本次实测抓到的缺陷本体:旧写法(Copy-Item 不带 -ErrorAction Stop)在这里
    // 会**继续往下走 git checkout**,把"有没有底稿"这件事变成一句空话。
    assert.ok(!/git checkout/.test(out), `备份失败后仍尝试了 checkout:${out}`);
  } finally {
    rmScratch(scratch);
  }
});

test('D5b 反向对照:备份成功 ⇒ 才会走到 checkout(证明 D5 拦的是守卫、不是整条路)', () => {
  const scratch = mkScratch('livedoc-d5b');
  try {
    mkdirSync(join(scratch, 'scripts'), { recursive: true });
    writeFileSync(join(scratch, 'scripts', 'live-doc-staleness-decision.mjs'), 'process.exit(0);\n', 'utf8');
    writeFileSync(join(scratch, 'PROJECT_PLAN.md'), 'x\n', 'utf8');
    writeFileSync(join(scratch, 'README.md'), 'y\n', 'utf8');
    const stub =
      `function Resolve-NodeExe { return '${process.execPath.replace(/\\/g, '/')}' }\n` +
      `$Root = '${scratch.replace(/\\/g, '/')}'`;
    const out = runPs(harness(stub), scratch);
    // 临时目录不是 git 仓 ⇒ checkout 必失败;这里要的是"确实走到了这一步"的证据
    assert.match(out, /RESULT=False/);
    assert.match(out, /git checkout 失败/);
    assert.ok(existsSync(join(scratch, '.ihui-agent', 'tmp', 'live-doc-stale')), '底稿目录没建出来');
  } finally {
    rmScratch(scratch);
  }
});

test('D6 装车:复原函数必须真被 ff 失败分支调用,且只在 BLOCKED-WIP 那一支', () => {
  assert.ok(/Invoke-LiveDocStaleRecovery -Blockers \$blockers/.test(src), 'BLOCKED-WIP 分支没有调用复原函数');
  // 只数**定义行**与**带 -Blockers 的调用点**;注释里提到函数名是允许的
  // (说明性文字里写标识符是本仓常态,按"出现次数"计数会把它算成第二个调用点)。
  const defs = src.match(/^function Invoke-LiveDocStaleRecovery\b/gm) || [];
  const calls = src.match(/Invoke-LiveDocStaleRecovery -Blockers/g) || [];
  assert.equal(defs.length, 1, `定义行应恰好 1,实得 ${defs.length}`);
  assert.equal(calls.length, 1, `调用点应恰好 1,实得 ${calls.length}`);
  const divIdx = src.indexOf("if ($mergeOut -match 'Not possible to fast-forward')");
  const blkIdx = src.indexOf('$blockers = @($dirtyPaths');
  const callIdx = src.indexOf('Invoke-LiveDocStaleRecovery -Blockers');
  assert.ok(divIdx >= 0 && blkIdx >= 0, '找不到 divergence / blockers 分支锚点(那段结构被改过?)');
  assert.ok(divIdx < blkIdx && blkIdx < callIdx, '调用点不在 BLOCKED-WIP 分支内');
});

test('D4 判定器判不可复原时:返回 False 且判定器输出必须留在日志里', () => {
  const scratch = mkScratch('livedoc-d4');
  try {
    mkdirSync(join(scratch, 'scripts'), { recursive: true });
    // 假判定器:exit 1 并打几行理由(真判定器对"有活账"就返这个)
    writeFileSync(
      join(scratch, 'scripts', 'live-doc-staleness-decision.mjs'),
      'console.log("NEEDHUMAN 有 10 行无出处");process.exit(1);\n',
      'utf8'
    );
    const node = process.execPath;
    const stub = `function Resolve-NodeExe { return '${node.replace(/\\/g, '/')}' }\n$Root = '${scratch.replace(/\\/g, '/')}'`;
    const out = runPs(harness(stub), scratch);
    assert.match(out, /RESULT=False/);
    assert.match(out, /判不可复原\(exit=1\)/);
    assert.match(out, /LOG\|.*NEEDHUMAN 有 10 行无出处/, '判定器的理由没进日志 ⇒ 下一个人无法复核');
    assert.ok(!/git checkout/.test(out), '拒绝支路不得出现 checkout 动作');
  } finally {
    rmScratch(scratch);
  }
});

test('D7 措辞锁:拒绝句必须点名三个面(HEAD∪归档∪远端)—— 判据变了话没变,会把复核者指去查错的面', () => {
  // 2026-10-10:判定器加了远端面(origin/main)与"旧修订被取代"第二判据;
  // 拒绝句若仍写"HEAD 与归档",下一个人会按旧两面的口径去复核一份其实是三面判过的副本。
  const refusal = src.split(/\r?\n/).find((l) => l.includes('判不可复原(exit=$code)')) || '';
  assert.ok(refusal.length > 0, '找不到拒绝句锚点(那段结构被改过?)');
  assert.ok(refusal.includes('HEAD∪归档∪远端'), `拒绝句没带三面口径:${refusal}`);
  assert.ok(refusal.includes('被取代'), `拒绝句没提"长度闸内也认不出被取代":${refusal}`);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

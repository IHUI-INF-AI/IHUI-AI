// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:deploy/win/alert-dedup.ps1 的按身份分槽去重(AGENTS §22c:测试不得复制判据实现,
// 一律经真模块跑出来的 stdout 结论断言)。
//
// 钉住的东西按危险排序:
//  T1  旧缺陷的阳性对照 —— 同一故障两条措辞交替时,单槽实现会把第一条的时间戳覆盖掉,
//      于是"每轮换签名 ⇒ 去重结构上永不命中"(实测 48h 47 封)。分槽实现必须让两条各自
//      落在自己的窗口里:交替的第二条不得把第一条顶出窗口。
//  T2  同身份窗口内必不重寄(否则修完去重反而更吵)。
//  T3  到点必重寄,且持续时长/序号写进正文(否则"抑制"读起来像"已处置")。
//  T4  状态读不懂 ⇒ 照旧寄并喊出原因 —— 静默当"已寄过"等于把告警变成哑弹。
//  T5  文件不存在 ⇒ 首封照寄(不是未判定)。
//  T6  旧单槽格式必须被迁成一条历史记录,而不是整表作废(整表作废会立刻重发刚寄过的那封)。
//  T7  模块不得要求 PS7 —— 它被不要求 7 的 ihui-monitor.ps1 加载,加载失败的症状是
//      "监控不再发信"(安静),比噪声严重得多。
//  T8  条目数必须封顶(无上限 ⇒ 状态文件随签名数无限增长)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const MODULE = join(repoRoot, 'deploy', 'win', 'alert-dedup.ps1');

// 解释器必须给绝对路径:本仓记过「裸 powershell 不在 PATH」这一坑(服务身份与交互终端的
// PATH 不同),spawnSync 找不到可执行文件时返回的是 status=null 而不是报错 ——
// 拿 null 去 assert.equal(status, 0) 只会得到一句 "null !== 0",看不出是根本没跑起来。
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

function pwsh(cmd, env = {}) {
  if (!SHELL) {
    return { out: '未判定:找不到 PowerShell 可执行文件(候选路径都不在位)', status: null, missingShell: true };
  }
  const r = spawnSync(SHELL, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, ...env },
    windowsHide: true,
  });
  if (r.error) return { out: `派生失败: ${r.error.message}`, status: null };
  return { out: (r.stdout || '') + (r.stderr || ''), status: r.status };
}

function requireShell(out) {
  if (out && out.missingShell) {
    assert.fail('本机取不到 PowerShell 可执行文件 ⇒ 本测试**未判定**,不得当作通过(把没跑写成跑过是本仓最高频失效型)');
  }
}

// T1/T2/T3 共用一次跑批:交替两签名 + 各自窗口
test('T1 两条措辞交替时各自守着自己的窗口(旧单槽实现正是被这一型打穿)', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/');
    const script = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${stateFile}'`,
      `$a = Test-AlertDueByIdentity -Sig 'DIVERGED 需人工收敛' -StateFile $sf -RepeatHours 4`,
      `$b = Test-AlertDueByIdentity -Sig 'WIP 有未提交文件挡住 ff' -StateFile $sf -RepeatHours 4`,
      `$a2 = Test-AlertDueByIdentity -Sig 'DIVERGED 需人工收敛' -StateFile $sf -RepeatHours 4`,
      `$b2 = Test-AlertDueByIdentity -Sig 'WIP 有未提交文件挡住 ff' -StateFile $sf -RepeatHours 4`,
      `Write-Output ("{0}|{1}|{2}|{3}" -f $a.Decision, $b.Decision, $a2.Decision, $b2.Decision)`,
      `Write-Output ("{0}|{1}" -f $a2.Due, $b2.Due)`,
    ].join('\n');
    const { out, status } = pwsh(script);
    requireShell(out); assert.equal(status, 0, `pwsh 非零退出: ${out}`);
    const [decisions, dues] = out.split(/\r?\n/).filter((l) => l.includes('|'));
    // 两条措辞各寄第一封(各自是新身份),随后各自命中自己的窗口 ⇒ 都不再寄
    assert.equal(decisions, 'due-new|due-new|window-hit|window-hit', `交替判定错: ${out}`);
    assert.equal(dues, 'False|False', `窗口内仍判寄: ${out}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T2/T3 同身份窗口内不重寄、到点必重寄且正文带持续时长', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/');
    // RepeatHours=0 ⇒ 窗口宽度为零:任何一次判定都不可能在"未到周期"里,只能算到点重发。
    // (刻意不用 0.0001 这种极小正数 —— 两次调用只差几毫秒,ageH 会**小于**那个窗口,
    //  于是"到点重发"这条支路根本走不到,测试会红在测试自己身上。2026-09-28 实测踩过。)
    const script = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${stateFile}'`,
      `$x = Test-AlertDueByIdentity -Sig '同一件事' -StateFile $sf -RepeatHours 0`,
      `$y = Test-AlertDueByIdentity -Sig '同一件事' -StateFile $sf -RepeatHours 0`,
      `Write-Output ("{0}|{1}|{2}|{3}" -f $x.Decision, $y.Decision, $y.Due, $y.Note.Contains('第 2 次重发'))`,
    ].join('\n');
    const { out, status } = pwsh(script);
    requireShell(out); assert.equal(status, 0, out);
    const line = out.split(/\r?\n/).find((l) => l.includes('|'));
    assert.equal(line, 'due-new|due-repeat|True|True', `重发判定错: ${out}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T4 状态文件读不懂 ⇒ 照旧寄并点名原因(绝不静默当"已寄过")', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json');
    writeFileSync(stateFile, '{ 这不是 JSON', 'utf8');
    const script = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$x = Test-AlertDueByIdentity -Sig '真故障' -StateFile '${stateFile.replace(/\\/g, '/')}' -RepeatHours 4`,
      `Write-Output ("{0}|{1}|{2}" -f $x.Due, $x.Decision, $x.Note.Contains('去重状态不可用'))`,
    ].join('\n');
    const { out, status } = pwsh(script);
    requireShell(out); assert.equal(status, 0, out);
    assert.equal(out.split(/\r?\n/).find((l) => l.includes('|')), 'True|undetermined|True', `未判定处理错: ${out}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T5 状态文件不存在 = 首寄(不算未判定)', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'nope.json').replace(/\\/g, '/');
    const script = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$x = Test-AlertDueByIdentity -Sig '首封' -StateFile '${stateFile}' -RepeatHours 4`,
      `Write-Output ("{0}|{1}|{2}" -f $x.Due, $x.Decision, [string]::IsNullOrEmpty($x.Note))`,
    ].join('\n');
    const { out, status } = pwsh(script);
    requireShell(out); assert.equal(status, 0, out);
    assert.equal(out.split(/\r?\n/).find((l) => l.includes('|')), 'True|due-new|True', `首寄判定错: ${out}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T6 旧单槽格式被迁成一条历史记录,而不是整表作废', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json');
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    writeFileSync(
      stateFile,
      JSON.stringify({ sig: '刚寄过的那条', sigTs: recent, sigFirstTs: recent, repeatNo: 0, lastSend: recent }),
      'utf8'
    );
    const script = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$x = Test-AlertDueByIdentity -Sig '刚寄过的那条' -StateFile '${stateFile.replace(/\\/g, '/')}' -RepeatHours 4`,
      `Write-Output ("{0}|{1}" -f $x.Due, $x.Decision)`,
    ].join('\n');
    const { out, status } = pwsh(script);
    requireShell(out); assert.equal(status, 0, out);
    // 60 秒前寄过、窗口 4h ⇒ 必须判"窗口内",否则旧格式一迁就全员重发
    assert.equal(out.split(/\r?\n/).find((l) => l.includes('|')), 'False|window-hit', `旧格式迁移错: ${out}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T7 模块不得要求 PS7(加载失败的表现是监控静默不发信)', () => {
  const src = readFileSync(MODULE, 'utf8');
  // 只认**真正生效的 pragma 行**(行首 #requires)。整文匹配会把模块头注里那句
  // "本模块刻意不写 `#requires -Version 7`"读成违规 —— 说明性文字里逐字写出被禁序列
  // 会反噬判据自己,本仓记过不止一次(守门 131 的注释形态同族)。
  const pragmaLine = src.split(/\r?\n/).find((l) => /^\s*#requires\b/i.test(l));
  assert.equal(pragmaLine, undefined, `alert-dedup.ps1 顶部有 PS7 pragma,会让它在未要求 7 的监控侧加载失败: ${pragmaLine}`);
  // 而两个调用方都必须真把它 dot-source 进来 —— 函数在、没人调用 = 没有这道机制
  const monitor = readFileSync(join(repoRoot, 'deploy', 'win', 'ihui-monitor.ps1'), 'utf8');
  const deploy = readFileSync(join(repoRoot, 'deploy', 'win', 'ihui-deploy.ps1'), 'utf8');
  assert.ok(/alert-dedup\.ps1/.test(monitor), 'ihui-monitor.ps1 没有加载 alert-dedup.ps1');
  assert.ok(/alert-dedup\.ps1/.test(deploy), 'ihui-deploy.ps1 没有加载 alert-dedup.ps1');
  assert.ok(/Test-AlertDueByIdentity/.test(monitor), 'ihui-monitor.ps1 没在用分槽去重出口');
  assert.ok(/Test-AlertDueByIdentity/.test(deploy), 'ihui-deploy.ps1 没在用分槽去重出口');
});

test('T8 条目数封顶(无上限 ⇒ 状态文件随签名数无限增长)', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/');
    // 必须造**多于** MaxEntries 的身份才能证明封顶在工作:12 条只验出"没封顶也是 12",
    // 那是一条恒绿的断言(本仓对"永远绿的断言与永远红的同样没用"记过多次)。
    const lines = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${stateFile}'`,
      `1..70 | ForEach-Object { Test-AlertDueByIdentity -Sig ("身份" + $_) -StateFile $sf -RepeatHours 4 | Out-Null }`,
      `$j = Get-Content $sf -Raw | ConvertFrom-Json`,
      `Write-Output ("count=" + @($j.alerts.PSObject.Properties).Count + " version=" + $j.version)`,
    ];
    const { out, status } = pwsh(lines.join('\n'));
    requireShell(out); assert.equal(status, 0, out);
    assert.match(out, /count=50 version=2/, `未封顶或版本不对: ${out}`);
  } finally {
    rmScratch(scratch);
  }
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

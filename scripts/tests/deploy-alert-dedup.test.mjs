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
//  T9  「按预期现象抑制」必须有终态(2026-09-29 补,修我自己的缺陷):API 崩溃循环 2.5 小时
//      期间每轮诊断都落 `[部署重启中-预期现象]`(部署环每轮重建即刷新"最近构建"),
//      无条件 return 等于永久豁免,而永久豁免的症状就是安静。
//  T9-T13 钉住 Test-AlertSuppressionGrace 的五条分支:窗内抑制(理由带持续分钟)/ 到期升级 /
//      断窗后重新起锚(修噪声不得造出新噪声)/ 档案读不懂 ⇒ 不抑制 / grace 与去重共用一份档案
//      但互不顶账。T14 是反向源码锁:监控侧不得再回到"无条件 return",且必须真调用该出口。
//      两条变异各自实测翻红过(把到期判据短路 ⇒ T10 红;把监控分支改回无条件 return ⇒ T14 红),
//      还原后 13/13 且两个文件 sha1 与变异前逐字相同。
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

test('T9 首轮与窗内续轮都抑制,但理由必须带"已连续几分钟"(抑制不是静默)', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/');
    const script = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${stateFile}'`,
      `$a = Test-AlertSuppressionGrace -Sig 'api(8802) 未监听' -StateFile $sf -GraceMinutes 20`,
      `$b = Test-AlertSuppressionGrace -Sig 'api(8802) 未监听' -StateFile $sf -GraceMinutes 20`,
      `Write-Output ("{0}|{1}|{2}|{3}" -f $a.Suppressed, $a.Decision, $b.Suppressed, $b.Note.Contains('上限 20 分钟'))`,
    ].join('\n');
    const { out, status } = pwsh(script);
    requireShell(out); assert.equal(status, 0, `pwsh 非零退出: ${out}`);
    assert.equal(out.split(/\r?\n/).find((l) => l.includes('|')), 'True|grace-window|True|True', `窗内抑制判定错: ${out}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T10 连续抑制到期 ⇒ 不再抑制并落回发信路径(这一条就是 09-29 那 2.5 小时的缺口)', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json');
    const sf = stateFile.replace(/\\/g, '/');
    // 先正常跑一轮起锚,再把锚点时刻改到 25 分钟前(不等真实时间 —— 等时间的测试
    // 在 CI 上会被跳过或被拉长,而这一型判据的失效表现是"安静")。
    const first = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$x = Test-AlertSuppressionGrace -Sig 'api(8802) 未监听' -StateFile '${sf}' -GraceMinutes 20`,
      `Write-Output ("{0}|{1}" -f $x.Suppressed, $x.Decision)`,
    ].join('\n');
    const r1 = pwsh(first);
    requireShell(r1.out); assert.equal(r1.status, 0, r1.out);
    assert.equal(r1.out.split(/\r?\n/).find((l) => l.includes('|')), 'True|grace-window', `起锚那轮就该抑制: ${r1.out}`);

    const st = JSON.parse(readFileSync(stateFile, 'utf8'));
    const keys = Object.keys(st.alerts);
    assert.equal(keys.length, 1, `起锚后档案里应只有一条 grace 记录,实得 ${keys.length} 条: ${JSON.stringify(st)}`);
    st.alerts[keys[0]].firstTs = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    st.alerts[keys[0]].lastSend = new Date(Date.now() - 1 * 60 * 1000).toISOString();
    writeFileSync(stateFile, JSON.stringify(st), 'utf8');

    const second = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$y = Test-AlertSuppressionGrace -Sig 'api(8802) 未监听' -StateFile '${sf}' -GraceMinutes 20`,
      `Write-Output ("{0}|{1}|{2}|{3}" -f $y.Suppressed, $y.Decision, $y.ElapsedMinutes, $y.Note.Contains('不再按预期现象抑制'))`,
    ].join('\n');
    const r2 = pwsh(second);
    requireShell(r2.out); assert.equal(r2.status, 0, r2.out);
    const line = r2.out.split(/\r?\n/).find((l) => l.includes('|'));
    // ElapsedMinutes 必须 >20 且 <30(25 分钟锚点 + 本轮间隔):量到的时长要真是量出来的,
    // 写死一个数就等于把"持续多久"这一维重新变成散文。
    const [sup, dec, elapsed, hasNote] = line.split('|');
    assert.equal(sup, 'False', `到期仍在抑制: ${line}`);
    assert.equal(dec, 'escalated', `到期判定名不对: ${line}`);
    assert.ok(Number(elapsed) >= 24 && Number(elapsed) < 30, `持续分钟不是量出来的: ${line}`);
    assert.equal(hasNote, 'True', `升级理由没写进 Note: ${line}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T11 断满一个窗口后重新起锚(修噪声不得造出新噪声)', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json');
    const sf = stateFile.replace(/\\/g, '/');
    pwsh([`. '${MODULE.replace(/\\/g, '/')}'`, `$x = Test-AlertSuppressionGrace -Sig 'web(8801) 未监听' -StateFile '${sf}' -GraceMinutes 20`].join('\n'));
    const st = JSON.parse(readFileSync(stateFile, 'utf8'));
    const k = Object.keys(st.alerts)[0];
    // 上周一次部署留下的旧锚 + 上次看见也在 60 分钟前 ⇒ 今天正常换流的第一个 3 分钟窗口
    // 必须被当成**新一轮**继续抑制;若按旧锚直接判超期,就是每次部署都寄一封假告警。
    st.alerts[k].firstTs = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    st.alerts[k].lastSend = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    writeFileSync(stateFile, JSON.stringify(st), 'utf8');
    const { out, status } = pwsh([
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$y = Test-AlertSuppressionGrace -Sig 'web(8801) 未监听' -StateFile '${sf}' -GraceMinutes 20`,
      `Write-Output ("{0}|{1}|{2}" -f $y.Suppressed, $y.Decision, $y.ElapsedMinutes)`,
    ].join('\n'));
    requireShell(out); assert.equal(status, 0, out);
    const line = out.split(/\r?\n/).find((l) => l.includes('|'));
    const [sup, dec, elapsed] = line.split('|');
    assert.equal(sup, 'True', `隔了一个窗口的新轮被误判超期: ${line}`);
    assert.equal(dec, 'grace-reopened', `重新起锚的判定名不对: ${line}`);
    assert.ok(Number(elapsed) < 1, `锚点没有重写到本轮: ${line}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T12 抑制档案读不懂 ⇒ 不抑制并点名原因(把没判写成"已抑制"等于哑弹)', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json');
    writeFileSync(stateFile, '{ 这不是 JSON', 'utf8');
    const { out, status } = pwsh([
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$x = Test-AlertSuppressionGrace -Sig 'ai(8803) 未监听' -StateFile '${stateFile.replace(/\\/g, '/')}' -GraceMinutes 20`,
      `Write-Output ("{0}|{1}|{2}" -f $x.Suppressed, $x.Decision, $x.Note.Contains('不按预期现象抑制'))`,
    ].join('\n'));
    requireShell(out); assert.equal(status, 0, out);
    assert.equal(out.split(/\r?\n/).find((l) => l.includes('|')), 'False|undetermined|True', `未判定处理错: ${out}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T13 grace 与去重共用一份档案但互不顶账(否则抑制会把真告警的窗口吃掉)', () => {
  const scratch = mkScratch('alert-dedup');
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/');
    const script = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${stateFile}'`,
      `$g = Test-AlertSuppressionGrace -Sig '同一条身份' -StateFile $sf -GraceMinutes 20`,
      `$d = Test-AlertDueByIdentity -Sig '同一条身份' -StateFile $sf -RepeatHours 4`,
      `$g2 = Test-AlertSuppressionGrace -Sig '同一条身份' -StateFile $sf -GraceMinutes 20`,
      `Write-Output ("{0}|{1}|{2}" -f $d.Decision, $g2.Decision, $d.Due)`,
    ].join('\n');
    const { out, status } = pwsh(script);
    requireShell(out); assert.equal(status, 0, out);
    const line = out.split(/\r?\n/).find((l) => l.includes('|'));
    // grace 的写入不得让真告警被判"窗口内已寄过";而两侧各写各的 ⇒ 第二次 grace 仍在窗内
    assert.equal(line, 'due-new|grace-window|True', `两把账互相顶掉了: ${line}`);
  } finally {
    rmScratch(scratch);
  }
});

test('T14 反向源码锁:监控侧不得再回到"无条件 return",且必须真调用到期出口', () => {
  const src = readFileSync(join(repoRoot, 'deploy', 'win', 'ihui-monitor.ps1'), 'utf8');
  assert.ok(
    /Test-AlertSuppressionGrace\s+-Sig\s+\$sig/.test(src),
    'ihui-monitor.ps1 没在抑制分支里调用到期出口(函数在、没人调 = 这条机制等于没有)'
  );
  assert.ok(/\$g\.Suppressed/.test(src), 'ihui-monitor.ps1 没按 Suppressed 分流,到期与窗内走同一条路');
  // 旧形态:`if ($diag.Contains('[部署重启中-预期现象]')) {` 之后**直接** Add-Content + return,
  // 中间没有任何到期判定。这条反向锁防的是"下一次有人把分支改回一刀切"。
  const block = src.match(/if \(\$diag\.Contains\('\[部署重启中-预期现象\]'\)\) \{[\s\S]{0,900}?\n  \}/);
  assert.ok(block, '找不到"预期现象"抑制分支本体(改结构时请连这条锁一起改,别让它静默失效)');
  assert.ok(block[0].includes('Test-AlertSuppressionGrace'), `抑制分支里没有到期判定: ${block[0].slice(0, 200)}`);
  // 宽限分钟必须可由 env 覆写,而不是硬编码在服务里(与本仓"告警窗口由 env 决定"同一条口径)
  assert.ok(/IHUI_MONITOR_EXPECTED_WINDOW_GRACE_MIN/.test(src), '宽限窗写死在代码里,现场无法调速');
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

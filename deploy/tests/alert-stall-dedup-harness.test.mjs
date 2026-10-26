// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 「切流受阻类告警」抑制终态的镜像测试(deploy/tests)
// =============================================================================
// 立因(2026-10-21 现读,同一型第二次):IHUI-API 因 Fastify 重复路由在 boot 期抛错,
// 登录全量 500 持续 45 分钟,部署环两轮都判出 `api=fail` 并写下
// 「FAIL 回滚后健康仍异常,需人工介入」,而**一封邮件都没有寄出**。
// 根因在 `Test-AlertSuppressionGrace` 的"距上次已超一个窗 ⇒ 重新起锚"那一支:
// 部署环的真实节奏(构建 + 门禁 8 轮 ≈ 20 分钟,外加最小间隔 30 分钟)**恒大于** 15 分钟的
// 宽限窗,于是每一轮都把锚推到"现在"、elapsed 归零 ⇒ `escalated` 那一支结构上永远到不了,
// 最后成功切流把整段"清偿"抹平。账面上看:抑制有上限、上限永不触发。
// (与 2026-09-29 那 2 小时 39 分被"预期现象"永久掩掉是同一条禁令的两种写法:
//  抑制必须有终态,而"有终态"必须是**可达**的终态。)
//
// 第二层立因同样重要:本 harness 之前**没有 .test.mjs 包装**(同目录
// health-gate-verdict / deploy-lock-liveness / svc-pg-readiness 三件都有)⇒ 没人跑它。
// 于是里面那条 9c 从"有人往 `-m $m` 与 `-Stall` 之间插进 `-Detail $Detail`"那天起就一直红,
// 红话还指控"Fail 未标记"——**指控错了东西,而且永远没人看见**。本次一并补上。
//
// 跑法:node --test deploy/tests/alert-stall-dedup-harness.test.mjs
// =============================================================================
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const DEPLOY = join(REPO, 'deploy', 'win', 'ihui-deploy.ps1')
const MODULE = join(REPO, 'deploy', 'win', 'alert-dedup.ps1')
const HARNESS = join(HERE, 'alert-stall-dedup-harness.ps1')

function findPwsh() {
  const cands = [process.env.PWSH_PATH, 'C:/Program Files/PowerShell/7/pwsh.exe', 'C:/Program Files (x86)/PowerShell/7/pwsh.exe'].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

// §22c:折窗算法本体只有一份(在 alert-dedup.ps1 里),本档一律通过跑它来验,不复制第二份。

test('T0 前置:harness 与模块都在位(取不到就判未判定,不判绿)', () => {
  assert.ok(existsSync(HARNESS), 'harness 不在位')
  assert.ok(existsSync(MODULE), 'alert-dedup.ps1 不在位')
  assert.ok(existsSync(DEPLOY), 'ihui-deploy.ps1 不在位')
  assert.ok(findPwsh(), '未判定:取不到 powershell 7 ⇒ 不能据此判绿(§0.3)')
})

test('T1 判据本体:harness 必须零 FAIL 且退出码为 0', () => {
  const pwsh = findPwsh()
  const r = spawnSync(pwsh, ['-NoProfile', '-File', HARNESS], { encoding: 'utf8', windowsHide: true, timeout: 300_000 })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  const m = out.match(/pass=(\d+)\s+fail=(\d+)/)
  assert.ok(m, `harness 没打印计数行 ⇒ 它可能崩在半路。输出头:\n${out.slice(0, 500)}`)
  const [, p, f] = m
  assert.equal(Number(f), 0, `harness 有 ${f} 条 FAIL(通过 ${p} 条):\n${out}`)
  assert.ok(Number(p) >= 58, `用例数掉到 ${p} 条(<58)⇒ 覆盖面在缩水;2026-10-26 现读 58 条,少一条就得问是谁摘的`)
  assert.equal(r.status, 0, `harness 退出码 ${r.status} 而非 0`)
})

test('T2 装车证明:主脚本真的调用这三件(否则上面全绿只是模块自洽)', () => {
  const s = readFileSync(DEPLOY, 'utf8')
  assert.match(s, /alert-dedup\.ps1/, '主脚本不再 dot-source alert-dedup.ps1 ⇒ 抑制与清偿双双成孤儿')
  assert.match(s, /Test-AlertSuppressionGrace[^\r\n]*-Stall/, '宽限窗调用没标切流类 ⇒ 锚点永不退休')
  assert.match(s, /Clear-AlertStallIdentities -StateFile \$AlertNotifyStateFile/, '成功切流处没接清偿 ⇒ 同一身份会按 4h 窗无限重发')
})

test('T3 覆盖面锁:生产节奏那一档(两轮间隔 > 窗)必须在 harness 里', () => {
  const h = readFileSync(HARNESS, 'utf8')
  assert.match(h, /BackdateWholeGrace/, '缺"整段回拨"夹具 ⇒ 又只剩 30 秒间隔那种形状,escalated 永不被测到')
  assert.match(h, /BackdateWholeGrace \$sigStall 23/, '缺"间隔 23 分钟 > 15 分钟窗"这一档 ⇒ 今天这根因回到无人值守状态')
  assert.match(h, /10a 隔 23 分钟的下一轮/, '缺 10a 断言 ⇒ 抑制又变成无终态的永久豁免')
  assert.match(h, /10d 非切流类同形状仍按新一轮起锚/, '缺 10d 反证 ⇒ 改动可能越界,把 2026-10-10 修过的假阳放回来')
})

test('T4 回归锁:抑制档案读不出时不得被当成"已抑制"(undetermined 不静音)', () => {
  const mod = readFileSync(MODULE, 'utf8')
  assert.match(mod, /Decision = 'undetermined'[\s\S]{0,240}Suppressed = \$false|Suppressed = \$false[\s\S]{0,240}Decision = 'undetermined'/, '读不出档案必须**照常告警**;把它读成"抑制中"就是 2026-09-29 那 2h39m 的形态')
})

test('T5 反向锁:harness 里那条按行扫描确实有牙(不是恒真装饰)', () => {
  const h = readFileSync(HARNESS, 'utf8')
  assert.match(h, /9c-反证/, '按行属性扫描必须自带反例,否则 9c 只是换了个会骗人的写法')
})

// 阳性对照(变异自证,离线):把模块里"重新起锚"那一支的门控摘掉(恢复成 2026-10-21 之前的形状),
// harness 的 10a 必须当场翻红 —— 否则这条修复没有回归锁,只是"我今天没坏"。
// 做法:复制模块与 harness 到临时目录,改副本、跑副本,不碰服务的活文件(部署环每 ~85 秒重读磁盘)。
test('T6 变异自证:摘掉 -Stall 门控 ⇒ 10a 必须翻红(证明这枚锁有牙)', () => {
  const pwsh = findPwsh()
  const mod = readFileSync(MODULE, 'utf8')
  const gated = "} elseif ((-not $Stall) -and (($now - $lastSeen).TotalMinutes -gt $GraceMinutes)) {"
  assert.equal(mod.split(gated).length - 1, 1, '锚点命中不是恰好 1 处 ⇒ 本自证的形状前提已不成立,先重新读源码')
  const scratch = join(mkdtempSync(resolve(REPO, '.ihui-agent', 'tmp', 'alert-grace-mutation-')), 'mut')
  const mutMod = join(scratch, 'alert-dedup.ps1')
  const mutHar = join(scratch, 'alert-stall-dedup-harness.ps1')
  try {
    mkdirSync(scratch, { recursive: true })
    writeFileSync(mutMod, mod.replace(gated, "} elseif (($now - $lastSeen).TotalMinutes -gt $GraceMinutes) {"), 'utf8')
    // harness 原样复制,只把模块路径与部署脚本路径指到可变副本
    const har = readFileSync(HARNESS, 'utf8')
    const q = (p) => p.replace(/\\/g, '\\\\')
    const patched = har
      .replace("param([string]$ModulePath = (Join-Path $PSScriptRoot '..\\win\\alert-dedup.ps1'))", `param([string]$ModulePath = '${q(mutMod)}')`)
      .replace("$src = Get-Content (Join-Path $PSScriptRoot '..\\win\\ihui-deploy.ps1') -Raw", `$src = Get-Content '${q(DEPLOY)}' -Raw`)
      .replace("$tmp = Join-Path ([System.IO.Path]::GetTempPath()) 'ihui-alert-dedup-test-state.json'", "$tmp = Join-Path ([System.IO.Path]::GetTempPath()) 'ihui-alert-dedup-mutation-state.json'")
    assert.notEqual(patched, har, 'harness 的三处改锚一处都没生效 ⇒ 跑的是原件,本自证不成立')
    writeFileSync(mutHar, patched, 'utf8')
    const r = spawnSync(pwsh, ['-NoProfile', '-File', mutHar], { encoding: 'utf8', windowsHide: true, timeout: 300_000 })
    const out = `${r.stdout || ''}\n${r.stderr || ''}`
    assert.notEqual(r.status, 0, '变异臂仍然退出 0 ⇒ 10a 那组断言是恒真的,今天的修复没有回归锁')
    assert.match(out, /FAIL 10a/, `变异臂应当打翻 10a 那一族,实得:\n${out.slice(0, 600)}`)
  } finally {
    rmSync(resolve(scratch, '..'), { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

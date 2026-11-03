// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 族级窗口测试(2026-11-03 立) —— 三个此前完全无族策略覆盖的信封口:
//   ihui-monitor / credential-health / ihui-deployloop。
// 钉住四件事,每族各跑一遍(不复制判据,全部经真实现跑出来断言):
//   T1 真故障首封必达(first ⇒ send;策略/状态读不到也 send,方向只许更响)
//   T2 同族第二封被压(commit 后 1h ⇒ suppress,且计数落盘)
//   T3 跨 24h 恢复(commit 后 24h+1min ⇒ send/window-expired)
//   T4 不同族不互相误伤(commit 甲族,乙族仍 first/send)
// 另钉:
//   T5 监视器的族名只取 URL host+path —— query/状态翻面必须折成同一族,不同 host 根路径不并族
//   T6 部署告警的族名只到类别 —— 同类别不同病因合族,不同类别不并族
//   T7 PowerShell 桥(base64 传中文)真调共享判据:check → commit → check → 异族
//   T8 凭据巡检:失效与恢复分族,且接线顺序(族窗口在 deliver 前、只在该封送达后记账)
//   T9 策略表合并不回退:本次新增 3 条 + 另一席刚加的最后两条必须同时在位
//   T10 策略条目 cooldownMs 必须是 24h,且 reviewBy 未过期(否则整个窗口静默失效)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  commitAlertFamilyDelivery,
  credentialAlertFamily,
  decideAlertFamilyWindow,
  readAlertFamilyState,
} from '../lib/alert-family-gate.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const POLICY = join(repoRoot, 'scripts', 'data', 'alert-delivery-policy.json')
const MONITOR = join(repoRoot, 'deploy', 'win', 'ihui-monitor.ps1')
const DEPLOY = join(repoRoot, 'deploy', 'win', 'ihui-deploy.ps1')
const DEDUP = join(repoRoot, 'deploy', 'win', 'alert-dedup.ps1')
const GATE = join(repoRoot, 'scripts', 'lib', 'alert-family-gate.mjs')
const CREDENTIAL = join(repoRoot, 'scripts', 'check-credential-health.mjs')

// 三族的真名前缀与族名都取自真实调用方(见各文件 Get-MonitorAlertFamily / Get-DeployAlertFamily /
// credentialAlertFamily),不是测试里另起的名字 —— 名字一改,这里必须跟着红。
const FAMILIES = [
  '监控告警:地址=aizhs.top/api/health',
  '凭据巡检:类别=credential-fail',
  '部署告警:类别=build-failed',
]
const HOUR = 3600000
const T0 = Date.parse('2026-11-03T00:00:00Z')

function withState(fn) {
  const dir = mkScratch('alert-family-gate-')
  try {
    return fn(join(dir, 'state.json'), dir)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
}

function findShell() {
  const cands = [
    process.env.SystemRoot
      ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : null,
    'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    'C:/Program Files/PowerShell/7/pwsh.exe',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}
const SHELL = findShell()
const UTF8_PREAMBLE = '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; '

function ps(command, timeout = 120000) {
  assert.ok(SHELL, '找不到 PowerShell 可执行文件,测试无法判定')
  const r = spawnSync(
    SHELL,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', UTF8_PREAMBLE + command],
    { encoding: 'utf8', timeout, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  assert.equal(r.status, 0, `PowerShell 失败: ${String(r.stderr || r.stdout || r.error)}`)
  return String(r.stdout || '')
}

// 从真文件按大括号配平抽函数体(§22c 镜像测试的既有手法)。函数体内的字符串/注释
// 刻意不含花括号 —— 否则提取器与测试用的不是同一段源码,锁就锁歪了。
function extractFunction(file, name) {
  const src = readFileSync(file, 'utf8')
  const start = src.indexOf(`function ${name} {`)
  assert.ok(start >= 0, `${file} 里找不到 function ${name}`)
  let depth = 0
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  assert.fail(`${name} 大括号不配平`)
}

function psQuote(p) {
  return `'${p.replace(/'/g, "''")}'`
}

// T1 首封必达:三族都必须 send/first,且拿到的上限真是 24h
test('T1 真故障首封必达(三族均为 send/first,上限 24h)', () => {
  for (const family of FAMILIES) {
    withState((stateFile) => {
      const r = decideAlertFamilyWindow({ family, stateFile, nowMs: T0 })
      assert.equal(r.action, 'send', `${family} 首封被压`)
      assert.equal(r.why, 'first')
      assert.equal(r.cooldownMs, 24 * HOUR)
    })
  }
})

// T2 同族第二封被压 + 计数
test('T2 同族第二、第三封被压且计数落盘', () => {
  for (const family of FAMILIES) {
    withState((stateFile) => {
      assert.equal(decideAlertFamilyWindow({ family, stateFile, nowMs: T0 }).action, 'send')
      assert.equal(commitAlertFamilyDelivery({ family, stateFile, nowMs: T0 }).ok, true)
      const second = decideAlertFamilyWindow({ family, stateFile, nowMs: T0 + HOUR })
      assert.equal(second.action, 'suppress', `${family} 第二封没被压`)
      assert.equal(second.why, 'window-hit')
      assert.equal(second.count, 1)
      const third = decideAlertFamilyWindow({ family, stateFile, nowMs: T0 + 2 * HOUR })
      assert.equal(third.action, 'suppress')
      assert.equal(third.count, 2)
      const state = readAlertFamilyState(stateFile)
      assert.equal(state.families[family].n, 2, '抑制计数没有落盘')
    })
  }
})

// T3 跨 24h 恢复
test('T3 跨 24h 恢复(24h+1min ⇒ send/window-expired)', () => {
  for (const family of FAMILIES) {
    withState((stateFile) => {
      commitAlertFamilyDelivery({ family, stateFile, nowMs: T0 })
      const r = decideAlertFamilyWindow({ family, stateFile, nowMs: T0 + 24 * HOUR + 60000 })
      assert.equal(r.action, 'send', `${family} 跨 24h 没恢复`)
      assert.equal(r.why, 'window-expired')
    })
  }
})

// T4 不同族不互相误伤(同前缀内的不同 path/类别也必须分槽)
test('T4 不同族不互相误伤', () => {
  withState((stateFile) => {
    commitAlertFamilyDelivery({ family: FAMILIES[0], stateFile, nowMs: T0 })
    const otherUrl = decideAlertFamilyWindow({
      family: '监控告警:地址=bsm.aizhs.top/',
      stateFile,
      nowMs: T0 + HOUR,
    })
    assert.equal(otherUrl.action, 'send')
    assert.equal(otherUrl.why, 'first')
    assert.equal(
      decideAlertFamilyWindow({ family: FAMILIES[1], stateFile, nowMs: T0 + HOUR }).action,
      'send',
    )
    assert.equal(
      decideAlertFamilyWindow({ family: FAMILIES[2], stateFile, nowMs: T0 + HOUR }).action,
      'send',
    )
    // 反证:同族仍在窗口内
    assert.equal(decideAlertFamilyWindow({ family: FAMILIES[0], stateFile, nowMs: T0 + HOUR }).action, 'suppress')
  })
})

// T5 监视器族名:URL 只取 host+path
test('T5 监视器族名只取 host+path(query/状态翻面合族,不同 host 不并族)', () => {
  assert.ok(SHELL)
  const dir = mkScratch('alert-family-monitor-')
  try {
    const cmd = [
      `. ${psQuote(DEDUP)}`,
      extractFunction(MONITOR, 'Get-MonitorAlertIdentity'),
      extractFunction(MONITOR, 'Get-MonitorAlertFamily'),
      `$cases = @(
        'https://aizhs.top/api/health?x=1&t=2 → 档=访问异常(连续2次确认)',
        'https://aizhs.top/api/health → 档=ERR',
        'https://aizhs.top/api/health → 档=访问异常(连续3次确认)',
        'https://bsm.aizhs.top/ → 档=访问异常',
        'https://aizhs.top/ → 档=访问异常',
        'web(8801) 未监听',
        'api(8802) 未监听',
        '磁盘剩余 档=lt1GB 卷=D:',
        '磁盘剩余 档=lt1GB 卷=C:'
      )`,
      `foreach ($c in $cases) { Get-MonitorAlertFamily -Item $c }`,
    ].join('; ')
    const lines = ps(cmd)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    assert.equal(lines.length, 9, `族名输出行数不对: ${lines.join(' || ')}`)
    const [q1, q2, q3, bsm, root, web, api, diskD, diskC] = lines
    assert.equal(q1, '监控告警:地址=aizhs.top/api/health')
    assert.equal(q2, q1, 'query 不同被拆成新族')
    assert.equal(q3, q1, '状态/确认次数翻面被拆成新族')
    assert.notEqual(bsm, root, '不同 host 的根路径被并成同一族')
    assert.match(web, /web\(<n>\)/)
    assert.notEqual(web, api, '不同端口被并成同一族')
    assert.match(diskD, /卷=D:/)
    assert.notEqual(diskD, diskC, '不同盘卷被并成同一族')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// T6 部署族名:已知类只到类别;generic 保留病因(不同真故障不得并族)
test('T6 部署族名:已知类同级合族,generic 不同病因分族', () => {
  assert.ok(SHELL)
  const cmd = [
    `. ${psQuote(DEDUP)}`,
    `$a = Get-AlertIdentitySig -Message '生产部署失败:健康检查未通过' -Reason 'health-failed'`,
    `$b = Get-AlertIdentitySig -Message '生产部署失败:健康检查未通过' -Reason 'health-failed timeout'`,
    `$c = Get-AlertIdentitySig -Message '构建失败: 编译报错' -Reason 'build-failed'`,
    `$d = Get-AlertIdentitySig -Message '未知失败 A' -Reason 'fingerprint-a'`,
    `$e = Get-AlertIdentitySig -Message '未知失败 B' -Reason 'fingerprint-b'`,
    `[pscustomobject]@{ a = (Get-DeployAlertFamily -Sig $a); b = (Get-DeployAlertFamily -Sig $b); c = (Get-DeployAlertFamily -Sig $c); d = (Get-DeployAlertFamily -Sig $d); e = (Get-DeployAlertFamily -Sig $e) } | ConvertTo-Json -Compress`,
  ].join('; ')
  const out = JSON.parse(ps(cmd).trim().split(/\r?\n/).pop())
  assert.match(out.a, /^部署告警:类别=generic\|骨架=生产部署失败:健康检查未通过\|病因=/)
  assert.notEqual(out.a, out.b, '同骨架不同病因被并成同一族(会吞掉真新故障,D3 硬不变量)')
  assert.equal(out.c, '部署告警:类别=build-failed')
  assert.notEqual(out.c, out.a, '不同类别被并成同一族')
  assert.notEqual(out.d, out.e, '不同 generic 骨架被并成同一族')
})

// T7 PowerShell 桥:base64 中文真调共享判据
test('T7 PS 桥 check→commit→check→异族', () => {
  assert.ok(SHELL)
  const dir = mkScratch('alert-family-bridge-')
  try {
    const stateFile = join(dir, 'state.json')
    const family = '监控告警:地址=aizhs.top/api/health'
    const cmd = [
      `. ${psQuote(DEDUP)}`,
      `$node = ${psQuote(process.execPath)}`,
      `$sf = ${psQuote(stateFile)}`,
      `$fam = ${psQuote(family)}`,
      `$r1 = Test-AlertFamilyWindow -Family $fam -RepoRoot ${psQuote(repoRoot)} -StateFile $sf -NodeExe $node`,
      `$r2 = Confirm-AlertFamilyDelivery -Family $fam -RepoRoot ${psQuote(repoRoot)} -StateFile $sf -NodeExe $node`,
      `$r3 = Test-AlertFamilyWindow -Family $fam -RepoRoot ${psQuote(repoRoot)} -StateFile $sf -NodeExe $node`,
      `$r4 = Test-AlertFamilyWindow -Family '监控告警:地址=bsm.aizhs.top/' -RepoRoot ${psQuote(repoRoot)} -StateFile $sf -NodeExe $node`,
      `[pscustomobject]@{ a1 = $r1.Action; ok2 = $r2.Ok; a3 = $r3.Action; a4 = $r4.Action; e1 = $r1.Error; e2 = $r2.Error } | ConvertTo-Json -Compress`,
    ].join('; ')
    const out = JSON.parse(ps(cmd).trim().split(/\r?\n/).pop())
    assert.equal(out.e1, '')
    assert.equal(out.a1, 'send')
    assert.equal(out.ok2, true, `commit 失败: ${out.e2}`)
    assert.equal(out.a3, 'suppress', 'PS 桥没有命中同族窗口')
    assert.equal(out.a4, 'send', 'PS 桥把不同族也压住了')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// T8 凭据巡检:族名分族 + 接线顺序
test('T8 凭据巡检失效/恢复分族,且族窗口在 deliver 前、只在送达后记账', () => {
  assert.notEqual(credentialAlertFamily({ recovered: true }), credentialAlertFamily({ recovered: false }))
  assert.equal(credentialAlertFamily({ recovered: true }), '凭据巡检:类别=recovered')
  assert.equal(credentialAlertFamily({ recovered: false }), '凭据巡检:类别=credential-fail')
  const src = readFileSync(CREDENTIAL, 'utf8')
  const gateAt = src.indexOf('decideAlertFamilyWindow({ family })')
  const deliverAt = src.indexOf('d = await deliver(title, desp, severity, mailAlertId)')
  const commitAt = src.indexOf('commitAlertFamilyDelivery({ family })')
  assert.ok(gateAt > 0, 'maybeAlert 没有调用族窗口')
  assert.ok(deliverAt > gateAt, '族窗口不在 deliver 之前(压住期间会登记逐项状态)')
  assert.ok(commitAt > deliverAt, '族窗口记账不在送达之后(未送达也会吃 24h 窗口)')
})

// T9 策略表合并不回退
test('T9 策略表同时保留本次 3 条与另一席最后新增的条目', () => {
  const entries = JSON.parse(readFileSync(POLICY, 'utf8'))
  const ids = new Set(entries.map((e) => e.id))
  for (const id of [
    'monitor-alert-family',
    'credential-health-alert-family',
    'deployloop-alert-family',
    // 另一席刚写的两条;合并不慎覆盖时,这里会先红
    'ops-patrol-red',
    'root-guard-manifest-drift',
  ]) {
    assert.ok(ids.has(id), `策略表丢了条目 ${id}`)
  }
})

// T10 条目参数:24h + 未过期
test('T10 三条族策略都是 24h 且 reviewBy 未过期', () => {
  const entries = JSON.parse(readFileSync(POLICY, 'utf8'))
  const today = new Date().toISOString().slice(0, 10)
  const map = new Map(entries.map((e) => [e.id, e]))
  for (const [id, prefix] of [
    ['monitor-alert-family', '监控告警:'],
    ['credential-health-alert-family', '凭据巡检:'],
    ['deployloop-alert-family', '部署告警:'],
  ]) {
    const e = map.get(id)
    assert.ok(e, `缺条目 ${id}`)
    assert.equal(e.prefix, prefix)
    assert.equal(e.cooldownMs, 24 * HOUR)
    assert.ok(e.reviewBy >= today, `${id} 的 reviewBy 已过期(${e.reviewBy} < ${today})`)
    assert.ok(e.reason && e.evidence && e.owner, `${id} 缺 reason/evidence/owner`)
  }
})

// T11 fail-open:无策略/状态读不懂/策略过期都必须照发
test('T11 无策略条目、状态读不懂、策略过期 ⇒ 一律 fail-open', () => {
  withState((stateFile) => {
    const noPolicy = decideAlertFamilyWindow({ family: '其它告警:类别=unknown', stateFile, nowMs: T0 })
    assert.equal(noPolicy.action, 'send')
    assert.equal(noPolicy.why, 'no-policy')

    writeFileSync(stateFile, '{半截', 'utf8')
    const broken = decideAlertFamilyWindow({ family: FAMILIES[0], stateFile, nowMs: T0 })
    assert.equal(broken.action, 'send', '状态读不懂时被压住了')
    assert.equal(broken.why, 'state-undetermined')
  })
  withState((stateFile, dir) => {
    const expiredPolicy = join(dir, 'policy.json')
    writeFileSync(
      expiredPolicy,
      JSON.stringify([
        {
          id: 'expired-test',
          prefix: '监控告警:',
          cooldownMs: 24 * HOUR,
          reason: '测试用',
          owner: 'test',
          reviewBy: '2026-01-01',
        },
      ]),
      'utf8',
    )
    commitAlertFamilyDelivery({ family: FAMILIES[0], stateFile, nowMs: T0 })
    const r = decideAlertFamilyWindow({
      family: FAMILIES[0],
      stateFile,
      policyFile: expiredPolicy,
      nowMs: T0 + HOUR,
    })
    assert.equal(r.action, 'send', '策略过期后仍被压住')
    assert.equal(r.why, 'policy-expired')
  })
})

// T12 接线顺序:族窗口必须早于各发信器自己的去重登记,记账必须晚于送达
test('T12 监视器/部署口的接线顺序(族窗口先于去重,记账晚于送达)', () => {
  const monitor = readFileSync(MONITOR, 'utf8')
  const mg = monitor.indexOf('Test-AlertFamilyWindow -Family $fam')
  const md = monitor.indexOf('$due = Test-AlertDue -Sig $isig')
  const ms = monitor.indexOf('$familyVerdict = Send-MailAlert')
  const mc = monitor.indexOf('Confirm-AlertFamilyDelivery -Family $f')
  assert.ok(mg > 0, '监视器没有调用族窗口')
  assert.ok(mg < md, '监视器族窗口晚于 Test-AlertDue(压住期会登记 4h 槽)')
  assert.ok(ms > md, '监视器送达点找不到')
  assert.ok(mc > ms, '监视器族首封记账不在送达之后')

  const deploy = readFileSync(DEPLOY, 'utf8')
  const dg = deploy.indexOf('Test-AlertFamilyWindow -Family $family')
  const dd = deploy.indexOf('$due = Test-AlertDueByIdentity -Sig $dedupSig')
  const ds = deploy.indexOf('$mailOk = Send-EmailNotify')
  const dc = deploy.indexOf('Confirm-AlertFamilyDelivery -Family $family')
  assert.ok(dg > 0, '部署口没有调用族窗口')
  assert.ok(dg < dd, '部署口族窗口晚于 Test-AlertDueByIdentity(压住期会登记 4h 槽)')
  assert.ok(ds > dd, '部署口送达点找不到')
  assert.ok(dc > ds, '部署口族首封记账不在送达之后')
})

// T13 判据只有一份实现:gate 必须 import 既有 policy 库,不得自带前缀表
test('T13 族窗口复用 alert-delivery-policy,不另造匹配表', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/alert-delivery-policy\.mjs'/)
  assert.match(src, /matchAlertDeliveryPolicy/)
  assert.ok(!src.includes('"prefix"') && !src.includes("'prefix'"), 'gate 自带前缀表 ⇒ 另造一套')
})

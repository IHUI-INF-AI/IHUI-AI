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
//  T9  「按预期现象抑制」必须有终态(2026-09-29 补,修我自己的缺陷):API 崩溃循环连续 2 小时 39 分
//      期间每轮诊断都落 `[部署重启中-预期现象]`(部署环每轮重建即刷新"最近构建"),
//      无条件 return 等于永久豁免,而永久豁免的症状就是安静。
//  T9-T13 钉住 Test-AlertSuppressionGrace 的五条分支:窗内抑制(理由带持续分钟)/ 到期升级 /
//      断窗后重新起锚(修噪声不得造出新噪声)/ 档案读不懂 ⇒ 不抑制 / grace 与去重共用一份档案
//      但互不顶账。T14 是反向源码锁:监控侧不得再回到"无条件 return",且必须真调用该出口。
//      两条变异各自实测翻红过(把到期判据短路 ⇒ T10 红;把监控分支改回无条件 return ⇒ T14 红),
//      还原后 13/13 且两个文件 sha1 与变异前逐字相同。
//  T16 时间戳的三种书写形态(Z / ±hh:mm / 裸)必须解析成同一个时刻,且写回档案时一律带时区
//      —— 2026-10-11 的实测根因:`ConvertFrom-Json` 自动把 ISO 串转成 DateTime,而旧写法接着用
//      `[string]` 转回文本,区域格式不带时区 ⇒ UTC 墙钟被当本地墙钟(本机差 8 小时),4h 窗口与
//      20min 宽限全都算错。T6/T10 那两根红就是它,生产档案里当场有坏值。
//  T17 源码锁:上述规范化只许经 ConvertTo-AlertInstant / ConvertTo-AlertTimestampText 这一对出口,
//      四个边界函数必须真调用它,且函数体内不得再出现 `[string]`/`[datetime]` 裸转时间戳。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const MODULE = join(repoRoot, 'deploy', 'win', 'alert-dedup.ps1')

// 解释器必须给绝对路径:本仓记过「裸 powershell 不在 PATH」这一坑(服务身份与交互终端的
// PATH 不同),spawnSync 找不到可执行文件时返回的是 status=null 而不是报错 ——
// 拿 null 去 assert.equal(status, 0) 只会得到一句 "null !== 0",看不出是根本没跑起来。
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

/**
 * 取证面前置:强制子进程 stdout 走 UTF-8。
 * 本机控制台码页是 GBK —— 不设这一步时,PowerShell 输出的中文到了 node 就是 mojibake,
 * 于是**任何针对中文文案的断言永不命中**。2026-10-16 实测:T15 报"抑制行没写身份"、T16 报
 * "Z形态 没落进 4h 窗口",而手工带上这一步复跑,模块写出的 `身份=997cb218a0014f85` 与三条
 * window-hit 全部原样在位 ⇒ 两条红是尺子坏了,不是判据坏了。
 * 同 §5d 那条"凡读回来继续用的值,先设 UTF8 再取"。由 T18 从行为上钉住它(删掉前置必红)。
 */
const UTF8_PREAMBLE = '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; '

function pwsh(cmd, env = {}) {
  if (!SHELL) {
    return {
      out: '未判定:找不到 PowerShell 可执行文件(候选路径都不在位)',
      status: null,
      missingShell: true,
    }
  }
  const r = spawnSync(SHELL, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', UTF8_PREAMBLE + cmd], {
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, ...env },
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.error) return { out: `派生失败: ${r.error.message}`, status: null }
  return { out: (r.stdout || '') + (r.stderr || ''), status: r.status }
}

function requireShell(out) {
  if (out && out.missingShell) {
    assert.fail(
      '本机取不到 PowerShell 可执行文件 ⇒ 本测试**未判定**,不得当作通过(把没跑写成跑过是本仓最高频失效型)',
    )
  }
}

// T1/T2/T3 共用一次跑批:交替两签名 + 各自窗口
test('T1 两条措辞交替时各自守着自己的窗口(旧单槽实现正是被这一型打穿)', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/')
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
    ].join('\n')
    const { out, status } = pwsh(script)
    requireShell(out)
    assert.equal(status, 0, `pwsh 非零退出: ${out}`)
    const [decisions, dues] = out.split(/\r?\n/).filter((l) => l.includes('|'))
    // 两条措辞各寄第一封(各自是新身份),随后各自命中自己的窗口 ⇒ 都不再寄
    assert.equal(decisions, 'due-new|due-new|window-hit|window-hit', `交替判定错: ${out}`)
    assert.equal(dues, 'False|False', `窗口内仍判寄: ${out}`)
  } finally {
    rmScratch(scratch)
  }
})

test('T2/T3 同身份窗口内不重寄、到点必重寄且正文带持续时长', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/')
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
    ].join('\n')
    const { out, status } = pwsh(script)
    requireShell(out)
    assert.equal(status, 0, out)
    const line = out.split(/\r?\n/).find((l) => l.includes('|'))
    assert.equal(line, 'due-new|due-repeat|True|True', `重发判定错: ${out}`)
  } finally {
    rmScratch(scratch)
  }
})

test('T4 状态文件读不懂 ⇒ 照旧寄并点名原因(绝不静默当"已寄过")', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json')
    writeFileSync(stateFile, '{ 这不是 JSON', 'utf8')
    const script = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$x = Test-AlertDueByIdentity -Sig '真故障' -StateFile '${stateFile.replace(/\\/g, '/')}' -RepeatHours 4`,
      `Write-Output ("{0}|{1}|{2}" -f $x.Due, $x.Decision, $x.Note.Contains('去重状态不可用'))`,
    ].join('\n')
    const { out, status } = pwsh(script)
    requireShell(out)
    assert.equal(status, 0, out)
    assert.equal(
      out.split(/\r?\n/).find((l) => l.includes('|')),
      'True|undetermined|True',
      `未判定处理错: ${out}`,
    )
  } finally {
    rmScratch(scratch)
  }
})

test('T5 状态文件不存在 = 首寄(不算未判定)', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'nope.json').replace(/\\/g, '/')
    const script = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$x = Test-AlertDueByIdentity -Sig '首封' -StateFile '${stateFile}' -RepeatHours 4`,
      `Write-Output ("{0}|{1}|{2}" -f $x.Due, $x.Decision, [string]::IsNullOrEmpty($x.Note))`,
    ].join('\n')
    const { out, status } = pwsh(script)
    requireShell(out)
    assert.equal(status, 0, out)
    assert.equal(
      out.split(/\r?\n/).find((l) => l.includes('|')),
      'True|due-new|True',
      `首寄判定错: ${out}`,
    )
  } finally {
    rmScratch(scratch)
  }
})

test('T6 旧单槽格式被迁成一条历史记录,而不是整表作废', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json')
    const recent = new Date(Date.now() - 60 * 1000).toISOString()
    writeFileSync(
      stateFile,
      JSON.stringify({
        sig: '刚寄过的那条',
        sigTs: recent,
        sigFirstTs: recent,
        repeatNo: 0,
        lastSend: recent,
      }),
      'utf8',
    )
    const script = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$x = Test-AlertDueByIdentity -Sig '刚寄过的那条' -StateFile '${stateFile.replace(/\\/g, '/')}' -RepeatHours 4`,
      `Write-Output ("{0}|{1}" -f $x.Due, $x.Decision)`,
    ].join('\n')
    const { out, status } = pwsh(script)
    requireShell(out)
    assert.equal(status, 0, out)
    // 60 秒前寄过、窗口 4h ⇒ 必须判"窗口内",否则旧格式一迁就全员重发
    assert.equal(
      out.split(/\r?\n/).find((l) => l.includes('|')),
      'False|window-hit',
      `旧格式迁移错: ${out}`,
    )
  } finally {
    rmScratch(scratch)
  }
})

test('T7 模块不得要求 PS7(加载失败的表现是监控静默不发信)', () => {
  const src = readFileSync(MODULE, 'utf8')
  // 只认**真正生效的 pragma 行**(行首 #requires)。整文匹配会把模块头注里那句
  // "本模块刻意不写 `#requires -Version 7`"读成违规 —— 说明性文字里逐字写出被禁序列
  // 会反噬判据自己,本仓记过不止一次(守门 131 的注释形态同族)。
  const pragmaLine = src.split(/\r?\n/).find((l) => /^\s*#requires\b/i.test(l))
  assert.equal(
    pragmaLine,
    undefined,
    `alert-dedup.ps1 顶部有 PS7 pragma,会让它在未要求 7 的监控侧加载失败: ${pragmaLine}`,
  )
  // 而两个调用方都必须真把它 dot-source 进来 —— 函数在、没人调用 = 没有这道机制
  const monitor = readFileSync(join(repoRoot, 'deploy', 'win', 'ihui-monitor.ps1'), 'utf8')
  const deploy = readFileSync(join(repoRoot, 'deploy', 'win', 'ihui-deploy.ps1'), 'utf8')
  assert.ok(/alert-dedup\.ps1/.test(monitor), 'ihui-monitor.ps1 没有加载 alert-dedup.ps1')
  assert.ok(/alert-dedup\.ps1/.test(deploy), 'ihui-deploy.ps1 没有加载 alert-dedup.ps1')
  assert.ok(/Test-AlertDueByIdentity/.test(monitor), 'ihui-monitor.ps1 没在用分槽去重出口')
  assert.ok(/Test-AlertDueByIdentity/.test(deploy), 'ihui-deploy.ps1 没在用分槽去重出口')
})

test('T9 首轮与窗内续轮都抑制,但理由必须带"已连续几分钟"(抑制不是静默)', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/')
    const script = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${stateFile}'`,
      `$a = Test-AlertSuppressionGrace -Sig 'api(8802) 未监听' -StateFile $sf -GraceMinutes 20`,
      `$b = Test-AlertSuppressionGrace -Sig 'api(8802) 未监听' -StateFile $sf -GraceMinutes 20`,
      `Write-Output ("{0}|{1}|{2}|{3}" -f $a.Suppressed, $a.Decision, $b.Suppressed, $b.Note.Contains('上限 20 分钟'))`,
    ].join('\n')
    const { out, status } = pwsh(script)
    requireShell(out)
    assert.equal(status, 0, `pwsh 非零退出: ${out}`)
    assert.equal(
      out.split(/\r?\n/).find((l) => l.includes('|')),
      'True|grace-window|True|True',
      `窗内抑制判定错: ${out}`,
    )
  } finally {
    rmScratch(scratch)
  }
})

test('T10 连续抑制到期 ⇒ 不再抑制并落回发信路径(这一条就是 09-29 那 2.5 小时的缺口)', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json')
    const sf = stateFile.replace(/\\/g, '/')
    // 先正常跑一轮起锚,再把锚点时刻改到 25 分钟前(不等真实时间 —— 等时间的测试
    // 在 CI 上会被跳过或被拉长,而这一型判据的失效表现是"安静")。
    const first = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$x = Test-AlertSuppressionGrace -Sig 'api(8802) 未监听' -StateFile '${sf}' -GraceMinutes 20`,
      `Write-Output ("{0}|{1}" -f $x.Suppressed, $x.Decision)`,
    ].join('\n')
    const r1 = pwsh(first)
    requireShell(r1.out)
    assert.equal(r1.status, 0, r1.out)
    assert.equal(
      r1.out.split(/\r?\n/).find((l) => l.includes('|')),
      'True|grace-window',
      `起锚那轮就该抑制: ${r1.out}`,
    )

    const st = JSON.parse(readFileSync(stateFile, 'utf8'))
    const keys = Object.keys(st.alerts)
    assert.equal(
      keys.length,
      1,
      `起锚后档案里应只有一条 grace 记录,实得 ${keys.length} 条: ${JSON.stringify(st)}`,
    )
    st.alerts[keys[0]].firstTs = new Date(Date.now() - 25 * 60 * 1000).toISOString()
    st.alerts[keys[0]].lastSend = new Date(Date.now() - 1 * 60 * 1000).toISOString()
    writeFileSync(stateFile, JSON.stringify(st), 'utf8')

    const second = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$y = Test-AlertSuppressionGrace -Sig 'api(8802) 未监听' -StateFile '${sf}' -GraceMinutes 20`,
      `Write-Output ("{0}|{1}|{2}|{3}" -f $y.Suppressed, $y.Decision, $y.ElapsedMinutes, $y.Note.Contains('不再按预期现象抑制'))`,
    ].join('\n')
    const r2 = pwsh(second)
    requireShell(r2.out)
    assert.equal(r2.status, 0, r2.out)
    const line = r2.out.split(/\r?\n/).find((l) => l.includes('|'))
    // ElapsedMinutes 必须 >20 且 <30(25 分钟锚点 + 本轮间隔):量到的时长要真是量出来的,
    // 写死一个数就等于把"持续多久"这一维重新变成散文。
    const [sup, dec, elapsed, hasNote] = line.split('|')
    assert.equal(sup, 'False', `到期仍在抑制: ${line}`)
    assert.equal(dec, 'escalated', `到期判定名不对: ${line}`)
    assert.ok(Number(elapsed) >= 24 && Number(elapsed) < 30, `持续分钟不是量出来的: ${line}`)
    assert.equal(hasNote, 'True', `升级理由没写进 Note: ${line}`)
  } finally {
    rmScratch(scratch)
  }
})

test('T11 断满一个窗口后重新起锚(修噪声不得造出新噪声)', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json')
    const sf = stateFile.replace(/\\/g, '/')
    pwsh(
      [
        `. '${MODULE.replace(/\\/g, '/')}'`,
        `$x = Test-AlertSuppressionGrace -Sig 'web(8801) 未监听' -StateFile '${sf}' -GraceMinutes 20`,
      ].join('\n'),
    )
    const st = JSON.parse(readFileSync(stateFile, 'utf8'))
    const k = Object.keys(st.alerts)[0]
    // 上周一次部署留下的旧锚 + 上次看见也在 60 分钟前 ⇒ 今天正常换流的第一个 3 分钟窗口
    // 必须被当成**新一轮**继续抑制;若按旧锚直接判超期,就是每次部署都寄一封假告警。
    st.alerts[k].firstTs = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    st.alerts[k].lastSend = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    writeFileSync(stateFile, JSON.stringify(st), 'utf8')
    const { out, status } = pwsh(
      [
        `. '${MODULE.replace(/\\/g, '/')}'`,
        `$y = Test-AlertSuppressionGrace -Sig 'web(8801) 未监听' -StateFile '${sf}' -GraceMinutes 20`,
        `Write-Output ("{0}|{1}|{2}" -f $y.Suppressed, $y.Decision, $y.ElapsedMinutes)`,
      ].join('\n'),
    )
    requireShell(out)
    assert.equal(status, 0, out)
    const line = out.split(/\r?\n/).find((l) => l.includes('|'))
    const [sup, dec, elapsed] = line.split('|')
    assert.equal(sup, 'True', `隔了一个窗口的新轮被误判超期: ${line}`)
    assert.equal(dec, 'grace-reopened', `重新起锚的判定名不对: ${line}`)
    assert.ok(Number(elapsed) < 1, `锚点没有重写到本轮: ${line}`)
  } finally {
    rmScratch(scratch)
  }
})

test('T12 抑制档案读不懂 ⇒ 不抑制并点名原因(把没判写成"已抑制"等于哑弹)', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json')
    writeFileSync(stateFile, '{ 这不是 JSON', 'utf8')
    const { out, status } = pwsh(
      [
        `. '${MODULE.replace(/\\/g, '/')}'`,
        `$x = Test-AlertSuppressionGrace -Sig 'ai(8803) 未监听' -StateFile '${stateFile.replace(/\\/g, '/')}' -GraceMinutes 20`,
        `Write-Output ("{0}|{1}|{2}" -f $x.Suppressed, $x.Decision, $x.Note.Contains('不按预期现象抑制'))`,
      ].join('\n'),
    )
    requireShell(out)
    assert.equal(status, 0, out)
    assert.equal(
      out.split(/\r?\n/).find((l) => l.includes('|')),
      'False|undetermined|True',
      `未判定处理错: ${out}`,
    )
  } finally {
    rmScratch(scratch)
  }
})

test('T13 grace 与去重共用一份档案但互不顶账(否则抑制会把真告警的窗口吃掉)', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/')
    const script = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${stateFile}'`,
      `$g = Test-AlertSuppressionGrace -Sig '同一条身份' -StateFile $sf -GraceMinutes 20`,
      `$d = Test-AlertDueByIdentity -Sig '同一条身份' -StateFile $sf -RepeatHours 4`,
      `$g2 = Test-AlertSuppressionGrace -Sig '同一条身份' -StateFile $sf -GraceMinutes 20`,
      `Write-Output ("{0}|{1}|{2}" -f $d.Decision, $g2.Decision, $d.Due)`,
    ].join('\n')
    const { out, status } = pwsh(script)
    requireShell(out)
    assert.equal(status, 0, out)
    const line = out.split(/\r?\n/).find((l) => l.includes('|'))
    // grace 的写入不得让真告警被判"窗口内已寄过";而两侧各写各的 ⇒ 第二次 grace 仍在窗内
    assert.equal(line, 'due-new|grace-window|True', `两把账互相顶掉了: ${line}`)
  } finally {
    rmScratch(scratch)
  }
})

test('T14 反向源码锁:监控侧不得再回到"无条件 return",且必须真调用到期出口', () => {
  const src = readFileSync(join(repoRoot, 'deploy', 'win', 'ihui-monitor.ps1'), 'utf8')
  assert.ok(
    /Test-AlertSuppressionGrace\s+-Sig\s+\$sig/.test(src),
    'ihui-monitor.ps1 没在抑制分支里调用到期出口(函数在、没人调 = 这条机制等于没有)',
  )
  assert.ok(
    /\$g\.Suppressed/.test(src),
    'ihui-monitor.ps1 没按 Suppressed 分流,到期与窗内走同一条路',
  )
  // 旧形态:`if ($diag.Contains('[部署重启中-预期现象]')) {` 之后**直接** Add-Content + return,
  // 中间没有任何到期判定。这条反向锁防的是"下一次有人把分支改回一刀切"。
  const block = src.match(
    /if \(\$diag\.Contains\('\[部署重启中-预期现象\]'\)\) \{[\s\S]{0,900}?\n  \}/,
  )
  assert.ok(block, '找不到"预期现象"抑制分支本体(改结构时请连这条锁一起改,别让它静默失效)')
  assert.ok(
    block[0].includes('Test-AlertSuppressionGrace'),
    `抑制分支里没有到期判定: ${block[0].slice(0, 200)}`,
  )
  // 宽限分钟必须可由 env 覆写,而不是硬编码在服务里(与本仓"告警窗口由 env 决定"同一条口径)
  assert.ok(/IHUI_MONITOR_EXPECTED_WINDOW_GRACE_MIN/.test(src), '宽限窗写死在代码里,现场无法调速')
})

test('T8 条目数封顶(无上限 ⇒ 状态文件随签名数无限增长)', () => {
  const scratch = mkScratch('alert-dedup')
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/')
    // 必须造**多于** MaxEntries 的身份才能证明封顶在工作:12 条只验出"没封顶也是 12",
    // 那是一条恒绿的断言(本仓对"永远绿的断言与永远红的同样没用"记过多次)。
    const lines = [
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${stateFile}'`,
      `1..70 | ForEach-Object { Test-AlertDueByIdentity -Sig ("身份" + $_) -StateFile $sf -RepeatHours 4 | Out-Null }`,
      `$j = Get-Content $sf -Raw | ConvertFrom-Json`,
      `Write-Output ("count=" + @($j.alerts.PSObject.Properties).Count + " version=" + $j.version)`,
    ]
    const { out, status } = pwsh(lines.join('\n'))
    requireShell(out)
    assert.equal(status, 0, out)
    assert.match(out, /count=50 version=2/, `未封顶或版本不对: ${out}`)
  } finally {
    rmScratch(scratch)
  }
})

test('T15 抑制行必须写出"压住的是哪件事"(只补出处,判定一字不动)', () => {
  // 立因:2026-09-29 现读 `deploy-loop.log` 里「ALERT 同身份失败告警本轮跳过」一天 232 条,
  // 而行内不写身份 ⇒ "这 232 条一共压住了几件不同的故障"从日志结构上判不出来(§5e"失败必须响"
  // 的另一半:**抑制也必须可审计**)。本例同时钉住"不得顺手改判定" —— 旧行有 `Due/Decision/Key`,
  // 新行只是多了 `身份=<16hex>` 与 `摘要=<签名前 60 字>`,三者必须与补出处之前完全同形。
  const scratch = mkScratch('alert-dedup-note')
  try {
    const stateFile = join(scratch, 'state.json').replace(/\\/g, '/')
    const longSig = '远端分叉需人工收敛 —— 已连续第 39 轮,阈值 5 轮;' + '补'.repeat(80)
    const lines = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${stateFile}'`,
      `$first = Test-AlertDueByIdentity -Sig '${longSig}' -StateFile $sf -RepeatHours 4`,
      `$second = Test-AlertDueByIdentity -Sig '${longSig}' -StateFile $sf -RepeatHours 4`,
      `Write-Output ("D1=" + $first.Decision + " D2=" + $second.Decision)`,
      `Write-Output ("due=" + $second.Due + " keylen=" + $second.Key.Length + " keymatch=" + ($second.Key -match '^[0-9a-f]{16}$'))`,
      `Write-Output ("note=" + ($second.Note -replace '\\s+', ' '))`,
    ]
    const { out, status } = pwsh(lines.join('\n'))
    requireShell(out)
    assert.equal(status, 0, `pwsh 非零退出: ${out}`)
    // 判定面:首封 due-new、次封 window-hit,且窗口内 Due 仍是 false(补出处不得改变任何一条裁决)
    assert.match(out, /D1=due-new D2=window-hit/, `判定被改动了: ${out}`)
    assert.match(out, /due=False keylen=16 keymatch=True/, `去重键形态变了: ${out}`)
    // 出处面:身份 = 那 16 位键(可与另一条跳过行逐字对上,于是"压住了几件事"可数)
    assert.match(out, /身份=[0-9a-f]{16}/, `抑制行没写身份: ${out}`)
    assert.match(out, /摘要=/, `抑制行没写可读摘要: ${out}`)
    // 摘要必须有上限(否则一条 500 字的告警会把日志撑爆)
    const snippet = out.split(/\r?\n/).find((l) => l.startsWith('note=')) || ''
    assert.ok(snippet.length < 220, `抑制行长度失控(摘要未截断):${snippet.length} 字符`)
  } finally {
    rmScratch(scratch)
  }
})

test('T18 取证面自证:子进程中文必须原样回到 node(码页前置被删时本套件的中文断言会全体假红)', () => {
  // 为什么住在这里而不是只写进注释:2026-10-16 的 T15/T16 就是被"GBK 码页 + 中文断言"打红的,
  // 当时判据与模块都是对的,坏的是尺子。尺子坏了必须自己喊 —— 删掉 pwsh() 里的 UTF-8 前置,本条先红。
  const sentinel = '身份=abc123 抑制可审计'
  const r = pwsh(`Write-Output ('${sentinel}')`)
  requireShell(r.out)
  assert.equal(r.status, 0, `pwsh 非零退出: ${r.out}`)
  assert.ok(
    r.out.includes(sentinel),
    `中文没能原样回来(实得 ${JSON.stringify(String(r.out).slice(0, 120))})⇒ 取证面码页坏了;` +
      '此时 T15/T16 一类中文断言的"红"不构成判据结论,先修尺子再谈判据',
  )
})

// T16 / T17 由 2026-10-11 的一次实测逼出,根因与 T6/T10 那两根红是同一个,不是两个缺陷:
// `ConvertFrom-Json` 会把 ISO 串**自动转成 DateTime**(Z⇒Utc、+08:00⇒Local、裸⇒Unspecified),
// 而模块原先在档案边界上用 `[string]$x` 把它又转回文本 —— `[string]` 走当前区域格式
// (本机 `10/11/2026 17:31:30`),**区域格式不带时区** ⇒ UTC 墙钟被当成本地墙钟,在 +08:00 的
// 这台机上整整差 8 小时;而 4h 重发窗口与 20min 抑制宽限就是拿这个差值算的。
// 生产档案 `deploy\win\.alert-notify-state.json` 当场就带着两种坏值(裸 ISO 与区域串),
// 所以这一型不是夹具现象。T16 钉行为,钉不住就回到散文;T17 钉边界写法,防止有人在下一个
// 站点又抄一份 `[string]`。
test('T16 档案里三种时间戳书写形态必须解析成同一个时刻,写回去必须带时区', () => {
  const scratch = mkScratch('alert-dedup-tz')
  try {
    const sf = join(scratch, 'state.json').replace(/\\/g, '/')
    const script = [
      `$ErrorActionPreference='Stop'`,
      `. '${MODULE.replace(/\\/g, '/')}'`,
      `$sf = '${sf}'`,
      `$t = (Get-Date).AddMinutes(-30)`,
      // 同一个时刻的三种书写:外部生产者(node/python 的 toISOString)、PowerShell 自己、
      // 以及本缺陷自己写坏过的那种裸串。第三种按本地墙钟解释(它已无法自证出处)。
      `$z = $t.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')`,
      `$off = $t.ToString('yyyy-MM-ddTHH:mm:ss.fffzzz')`,
      `$bare = $t.ToString('yyyy-MM-ddTHH:mm:ss.fff')`,
      `$sigs = 'Z形态','偏移形态','裸形态'`,
      `$text = @{ 'Z形态' = $z; '偏移形态' = $off; '裸形态' = $bare }`,
      `$alerts = [ordered]@{}`,
      `foreach ($s in $sigs) {`,
      `  $k = Get-AlertDedupKey -Sig $s`,
      `  $v = $text[$s]`,
      `  $alerts[$k] = [ordered]@{ sigTs = $v; firstTs = $v; repeatNo = 0; lastSend = $v; label = $s; stall = $false }`,
      `}`,
      `[System.IO.File]::WriteAllText($sf, (ConvertTo-Json @{ version = 2; alerts = $alerts } -Depth 5), (New-Object System.Text.UTF8Encoding($false)))`,
      `Write-Output ("ZONE=" + (Get-Date).ToString('zzz'))`,
      // 判定面:三条都必须落在 4h 窗口内 ⇒ window-hit。旧写法会把 Z 那条读成 8 小时前 ⇒ due-repeat。
      `foreach ($s in $sigs) {`,
      `  $x = Test-AlertDueByIdentity -Sig $s -StateFile $sf -RepeatHours 4`,
      `  Write-Output ("$s=" + $x.Decision)`,
      `}`,
      // 写回面:宽限出口一定会落盘,所以用它验证"档案里不允许再出现不带时区的串"。
      // 它用的是 `grace:` 前缀的另一个键 ⇒ 原来三条只能经"读出→再写回"这条路回来,正是本判据要的地方。
      // 而且必须按**盘上原文**判:ConvertFrom-Json 会把 ISO 串又转成 DateTime,拿 `[string]` 读回来
      // 得到的是区域格式 —— 那正是本缺陷在生产档案里留下的形态,用它当 oracle 等于让尺子重犯被测的病。
      `Test-AlertSuppressionGrace -Sig 'Z形态' -StateFile $sf -GraceMinutes 60 | Out-Null`,
      `$raw = [System.IO.File]::ReadAllText($sf)`,
      `$seen = 0`,
      `$bad = 0`,
      `foreach ($m in [regex]::Matches($raw, '"(sigTs|firstTs|lastSend)":\\s*"([^"]*)"')) {`,
      `  $seen++`,
      `  $val = $m.Groups[2].Value`,
      `  if ($val -and -not ($val -match '(Z|[+-]\\d{2}:\\d{2})$')) { $bad++ }`,
      `}`,
      `Write-Output ("SEEN=" + $seen)`,
      `Write-Output ("BAD=" + $bad)`,
    ].join('\n')
    const { out, status } = pwsh(script)
    requireShell(out)
    assert.equal(status, 0, `pwsh 非零退出: ${out}`)
    const lines = out.split(/\r?\n/)
    const zone = (lines.find((l) => l.startsWith('ZONE=')) || 'ZONE=?').slice(5)
    // 如实登记这一维的覆盖边界:主机偏移为 ±00:00 时 Z 形态与本地形态同值,T16 的判定面失去鉴别力
    // (写回面仍在)。所以偏移打进了每一条断言的措辞里 —— 拿绿之前先看它。
    for (const s of ['Z形态', '偏移形态', '裸形态']) {
      assert.match(
        lines.join('\n'),
        new RegExp(`${s}=window-hit`),
        `${s} 没落进 4h 窗口(主机偏移 ${zone}): ${out}`,
      )
    }
    // 阳性对照:扫描必须真看到字段,否则 "BAD=0" 可能只是"一条都没匹配上"(把没量写成量过)。
    const seen = Number((lines.find((l) => l.startsWith('SEEN=')) || 'SEEN=0').slice(5))
    assert.ok(seen >= 12, `盘上只扫到 ${seen} 个时间戳字段,不足以证明这一维被看过: ${out}`)
    const bad = Number((lines.find((l) => l.startsWith('BAD=')) || 'BAD=-1').slice(4))
    assert.equal(bad, 0, `档案里存在不带时区的时间戳 ⇒ [string] 中转回来了(偏移 ${zone}): ${out}`)
  } finally {
    rmScratch(scratch)
  }
})

test('T17 源码锁:时间戳进出档案只能经那一对规范化出口,不得再抄 [string]/[datetime] 裸转', () => {
  const src = readFileSync(MODULE, 'utf8')
  const fn = (name) => {
    const at = src.indexOf(`function ${name} {`)
    assert.ok(at >= 0, `模块里找不到 ${name}(整条锁失去对象)`)
    const next = src.indexOf('\nfunction ', at + 1)
    return src.slice(at, next < 0 ? src.length : next)
  }
  // 两个出口必须在位,且不是"定义了没人调"—— 本仓最高频失效型就是"机制在、没接线"。
  assert.match(
    src,
    /function ConvertTo-AlertInstant \{/,
    '缺 ConvertTo-AlertInstant(丢时区那一型没有出口)',
  )
  assert.match(src, /function ConvertTo-AlertTimestampText \{/, '缺 ConvertTo-AlertTimestampText')
  // 四个边界函数都必须真调用它们(读两处 + 写一处 + 两个判定函数)。
  for (const name of [
    'Read-AlertDedupState',
    'Write-AlertDedupState',
    'Test-AlertDueByIdentity',
    'Test-AlertSuppressionGrace',
  ]) {
    assert.match(
      fn(name),
      /ConvertTo-Alert/,
      `${name} 没有经规范化出口处理时间戳 ⇒ 那一型会从这里重新长回来`,
    )
  }
  // 反向:边界上的裸转换写法不得回来。只搜四个函数体,不搜注释/头注(散文里解释旧写法是证据,不是违规)。
  const bodies = [
    'Read-AlertDedupState',
    'Write-AlertDedupState',
    'Test-AlertDueByIdentity',
    'Test-AlertSuppressionGrace',
  ]
    .map((n) => fn(n))
    .join('\n')
  const code = bodies
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n')
  assert.doesNotMatch(
    code,
    /(sigTs|firstTs|lastSend)\s*=\s*\[string\]/,
    '档案边界又出现 [string] 直转时间戳(丢时区的正是这一步)',
  )
  assert.doesNotMatch(
    code,
    /\[datetime\]\$(e|entry|p|obj)\.?(Value\.)?(sigTs|firstTs|lastSend)/,
    '档案边界又出现 [datetime] 裸 cast',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

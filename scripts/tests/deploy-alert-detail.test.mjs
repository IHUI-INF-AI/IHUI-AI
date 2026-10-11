// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:deploy/win/ihui-deploy.ps1 的 Invoke-FailNotify 新增 $Detail 通道(AGENTS §5e-1 出口①)。
//
// 为什么必须**真跑**而不是静态正则:这一改动的全部风险都在"明细会不会被折进告警身份"上 ——
// 那是一条行为性质(同身份两条明细 ⇒ 只许寄一封),用源码字符串断言只能证明"这行字在",
// 证明不了它在 PowerShell 里真的那么走(§22c:镜像测试只复读实现就是复读机)。所以这里
// 把函数体原样抠出来,dot-source **真的** alert-dedup.ps1(去重判据不复制第二份),只桩掉
// Log / Send-EmailNotify 两个出口,然后用真状态文件跑四臂。
//
// 四条臂各钉一件事:
//   D1 同身份、不同明细 ⇒ 只寄一封(把明细折进签名就是 48h/47 封那一型的复活)
//   D2 明细确实进了正文,且多行被归一成一行可读形态
//   D3 不同原因 ⇒ 各自一封(去重不是将错就错的静默)
//   D4 超长明细 ⇒ 截断必须**带标记**(静默切掉的尾巴读起来像"明细就这么多")
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const DEPLOY = join(repoRoot, 'deploy', 'win', 'ihui-deploy.ps1')
const DEDUP = join(repoRoot, 'deploy', 'win', 'alert-dedup.ps1')
const SRC = readFileSync(DEPLOY, 'utf8')

function findShell() {
  const cands = [
    'C:/Program Files/PowerShell/7/pwsh.exe',
    process.env.SystemRoot
      ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : null,
  ].filter(Boolean)
  for (const c of cands) {
    try {
      readFileSync(c)
      return c
    } catch {
      /* 换机/重装后这条路径可以不存在;下一候选 */
    }
  }
  return null
}
const SHELL = findShell()

/** 从源码里抠出整个函数定义:起点到下一个顶格 `function `(与另两道门同用的取法)。 */
function extractFn(name) {
  const start = SRC.indexOf(`function ${name} {`)
  assert.ok(start >= 0, `ihui-deploy.ps1 里找不到 function ${name}`)
  const next = SRC.indexOf('\nfunction ', start + 1)
  assert.ok(next > start, `${name} 之后找不到下一个顶格 function ⇒ 取法失效`)
  return SRC.slice(start, next)
}

function runHarness(sents) {
  const dir = mkScratch('alert-detail')
  try {
    const stateFile = join(dir, 'notify-state.json').replace(/\\/g, '/')
    const undel = join(dir, 'undelivered.json').replace(/\\/g, '/')
    // 明细里的换行用 `-join [Environment]::NewLine` 造,不做字符串转义:
    // PowerShell 的引号规则与 JS 的模板串混写最容易出错(§26 那条"中文/转义被吃掉"同族)。
    const calls = sents
      .map((s) => {
        const parts = s.detail.split('\n').map((x) => `'${x.replace(/'/g, "''")}'`)
        return `Invoke-FailNotify -m '${s.m}' -Detail (@(${parts.join(',')}) -join [Environment]::NewLine) -Stall`
      })
      .join('\n')
    const harness = `
$ErrorActionPreference = 'Stop'
. '${DEDUP.replace(/\\/g, '/')}'
$AlertNotifyStateFile = '${stateFile}'
$AlertUndelFile = '${undel}'
$StallAlertGraceMinutes = 0
$FailAlertRepeatHours = 4
$script:sent = @()
function Log { param([string]$m) }
function Send-EmailNotify { param([string]$subject, [string]$text) $script:sent += $text; return $true }
${extractFn('Invoke-FailNotify')}
${calls}
# 明细/正文都含中文,而 PowerShell 往 stdout 写会按**控制台码页**(本机 GBK)编码 —— node 按
# UTF-8 解就拿到乱码,判据会把"正文里明明有明细"读成"没有"(AGENTS §26 那条"中文出参被码页
# 吃掉"的同型陷阱,方向是读取侧)。所以逐条 ConvertTo-Json 落文件:newline 在 JSON 里被转义,
# 一行一封,node 侧 JSON.parse 取回原字符。
$outFile = '${join(dir, 'mails.jsonl').replace(/\\/g, '/')}'
foreach ($t in $script:sent) { ($t | ConvertTo-Json -Compress) | Out-File -FilePath $outFile -Append -Encoding utf8 }
`
    const f = join(dir, 'harness.ps1')
    writeFileSync(f, harness, 'utf8')
    const r = spawnSync(SHELL, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', f], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (r.status !== 0) {
      assert.fail(
        `harness 没跑成(rc=${r.status}):\nstdout:${(r.stdout || '').slice(-800)}\nstderr:${(r.stderr || '').slice(-800)}`,
      )
    }
    const raw = readFileSync(join(dir, 'mails.jsonl'), 'utf8')
    return raw
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
  } finally {
    rmScratch(dir)
  }
}

test('D1/D2 同身份不同明细只寄一封,而明细确实进了正文', { skip: !SHELL && '未判定:找不到 PowerShell' }, () => {
  const bodies = runHarness([
    { m: 'REASON-A', detail: 'PROJECT_PLAN.md\nnode scripts/heal-worktree-tracked.mjs --align-drift --dry-run' },
    { m: 'REASON-A', detail: 'AGENTS.md' },
  ])
  assert.equal(bodies.length, 1, `同身份两条明细寄了 ${bodies.length} 封 ⇒ 明细被折进了签名(48h/47 封那一型复活)`)
  assert.match(bodies[0], /挡路明细:/, '正文里没有明细段 ⇒ $Detail 根本没进邮件')
  assert.match(bodies[0], /PROJECT_PLAN\.md \| node scripts/, '多行明细必须归成一读到底的形态(而不是被换行吃掉)')
  assert.doesNotMatch(bodies[0], /AGENTS\.md/, '第二封本就不该寄出 ⇒ 它的明细不得出现在任何正文里')
})

test('D3 不同原因各自成身份(去重不等于压掉新故障)', { skip: !SHELL && '未判定:找不到 PowerShell' }, () => {
  const bodies = runHarness([
    { m: 'REASON-A', detail: 'x' },
    { m: 'REASON-B', detail: 'y' },
  ])
  assert.equal(bodies.length, 2, '两个不同原因必须各寄一封(§5e 无总量封顶)')
})

test('D4 超长明细截断必须带可见标记', { skip: !SHELL && '未判定:找不到 PowerShell' }, () => {
  const long = 'Z'.repeat(1500)
  const bodies = runHarness([{ m: 'REASON-LONG', detail: long }])
  assert.equal(bodies.length, 1)
  assert.ok(!bodies[0].includes(long), '超长明细整块塞进正文 ⇒ 封顶判据没生效')
  assert.match(bodies[0], /已截断/, '静默切尾会把"后面还有清单"读成"清单就这么多"(本仓禁条)')
})

test('D5 反向源码锁:明细绝不进签名', () => {
  const fn = extractFn('Invoke-FailNotify')
  const sigLine = fn.split(/\r?\n/).find((l) => l.trim().startsWith('$sig ='))
  assert.ok(sigLine, '找不到签名赋值行 ⇒ 身份判据换了形态,本锁必须重新设计而不是放过')
  assert.doesNotMatch(sigLine, /\$Detail/, `$sig 里出现了 $Detail ⇒ 明细参与身份:${sigLine.trim()}`)
  assert.match(fn, /\$detailBlock/, '签名之外必须真有明细进正文的那一步')
  const fail = extractFn('Fail')
  assert.match(fail, /Invoke-FailNotify[^\n]*-Detail/, 'Fail 没把明细转发下去 ⇒ 唯一的挡路现场拿不到明细')
  assert.match(
    SRC,
    /Fail "git merge --ff-only 失败:有未提交文件与本次要更新的路径重叠[^\n]*-Detail \$wipDetail/,
    '挡住 ff 这一格必须真的带上明细(判据在、调用点没有 = 没有)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

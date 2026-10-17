// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试脚本需要输出诊断信息 */
/**
 * deploy-migrate-exitcode.test.mjs — 部署链迁移判定回归(2026-09-26 票,离线)
 *
 * 钉住 deploy/win/ihui-deploy.ps1 迁移段的三类缺陷(全部离线取证,绝不真跑部署脚本、
 * 不跑 db:migrate、不连库、不碰服务):
 *  ① migrate 退出码非 0 而后续 psql 返回 0 ⇒ 必须判失败。旧顺序(`& pnpm db:migrate` →
 *     两次原生 psql → 才读 `$LASTEXITCODE`)在判定点读到的是 psql 的 0,失败也打"完成"。
 *  ② `$pend = $null`(psql 不可达 / DATABASE_URL 未设 / 输出非数字 / journal 缺失…)⇒
 *     判"无法判定",不得出现"完成"字样(`$null -gt 0` 为假,旧写法直落完成分支)。
 *  ③ 超时 ⇒ TIMEOUT,既走 Note-MigrateFailure 记账又标注"未判定",不改写退出码语义。
 *  ④ 变异:把"取码即存"退回原位(捕获行挪到 psql 之后、读 $LASTEXITCODE)⇒ ① 必红 ——
 *     证明判序不是恒真,旧顺序确实会被读到 0 并判成完成(阳性对照)。
 *
 * 两把尺子互补:
 *  - 判序尺(JS):逐行解析 Invoke-DbMigrate 的**真实源码**,模拟"$LASTEXITCODE 随原生调用
 *    演变"的时间线,回答"判定点真正读到的是哪个值"。只对源码判,不执行任何 PS。
 *  - 判据尺(pwsh):从真实 .ps1 里**抽出**纯函数 Get-MigrateOutcome 的源码文本,在临时目录
 *    造一个只含该函数的 harness.ps1 用假数据跑(§22c:不复制实现,import 即抽取)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// 被测源文件路径。默认取仓库工作树那份;IHUI_DEPLOY_PS1_PATH 只为"改前/改后对照跑"
// 提供显式指向(例如指向 HEAD blob 的导出的副本),指向不存在的文件 ⇒ 当场判红,
// 绝不静默回落到默认路径(§0.3:取不到输入就是未判定,不得冒判"验过了")。
const PS1_PATH = process.env.IHUI_DEPLOY_PS1_PATH
  ? resolve(process.env.IHUI_DEPLOY_PS1_PATH)
  : join(ROOT, 'deploy', 'win', 'ihui-deploy.ps1')
assert.ok(existsSync(PS1_PATH), `被测 .ps1 不存在: ${PS1_PATH}`)
const src = readFileSync(PS1_PATH, 'utf8')

// ─── 通用小工具(只服务本测试;不 import 生产逻辑,故不存在镜像漂移)─────────────

/** 去掉整行注释后的代码行(本 .ps1 迁移段没有行尾注释参与判序,刻意不做 inline 剥离) */
function codeLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => ({ raw: l, t: l.trim() }))
    .filter(({ t }) => t.length > 0 && !t.startsWith('#'))
    .map(({ raw }) => raw)
}

/** 从 `function <name> {` 起做括号配平抽取(跳过 # 行注释、双引号串与单引号串)
 *  为什么必须同时跟踪单引号:Invoke-DbMigrate 原有一行 `.Trim('"',"'")` —— 单引号串里
 *  夹一个裸 `"`。只认双引号的状态机会把它当字符串开头,整行 `{`/`}` 计数错位,
 *  抽取越界把后面的 seed 段(含合法的 `if ($LASTEXITCODE ...)`)吞进判定面。第一版就栽在这。 */
function extractFunction(source, name) {
  const header = new RegExp(`function ${name} \\{`)
  const m = header.exec(source)
  assert.ok(m, `未找到 function ${name} —— 判据被摘线即红(函数在而没挂上 = 没有)`)
  let i = m.index + m[0].length - 1 // 指向 '{'
  let depth = 0
  let inDQ = false // "..."(反引号转义)
  let inSQ = false // '...'(单引号 doubling 转义)
  for (; i < source.length; i += 1) {
    const c = source[i]
    if (inDQ) {
      if (c === '`') i += 1
      else if (c === '"') inDQ = false
      continue
    }
    if (inSQ) {
      if (c === "'") {
        if (source[i + 1] === "'") i += 1
        else inSQ = false
      }
      continue
    }
    if (c === '#') {
      while (i < source.length && source[i] !== '\n') i += 1
      continue
    }
    if (c === '"') inDQ = true
    else if (c === "'") inSQ = true
    else if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) return source.slice(m.index, i + 1)
    }
  }
  assert.fail(`function ${name} 括号不配平 —— 文件语法已坏`)
}

// ─── 判序尺:解析真实源码,回答"判定点读到的值来自哪一步" ─────────────────────────

/**
 * 模拟 Invoke-DbMigrate 区域里 $LASTEXITCODE 的生命周期。
 * migCode = db:migrate 自身的退出码;psqlCode = 之后每次原生 psql 的退出码。
 * 返回"最终喂给判定(migrate 结果)的值"。
 */
function simulateMigVerdictFeed(regionText, { migCode, psqlCode }) {
  let live = null // $LASTEXITCODE 的当前值
  let captured = null // $migExit 的当前值
  let feed = null // 判定点真正读到的值
  for (const line of codeLines(regionText)) {
    if (/Invoke-MigrateWithBudget/.test(line) || /&\s*"[^"]*pnpm\.cmd".*db:migrate/.test(line)) {
      live = migCode // 原生 migrate 刚跑完(封装内部/直调同理)
    } else if (/\$migExit\s*=/.test(line)) {
      if (/\$mig\.Exit/.test(line)) captured = migCode // 封装返回值:取码即存,不经活变量
      else if (/\$LASTEXITCODE/.test(line)) captured = live // 活变量捕获:值取决于此刻是谁最后跑过
    } else if (/Get-PendingMigrationCount|Test-MigrateOrphans/.test(line)) {
      live = psqlCode // 原生 psql 覆写 $LASTEXITCODE
    } else if (/-MigExit/.test(line)) {
      if (/\$migExit/.test(line)) feed = captured
      else if (/\$LASTEXITCODE/.test(line)) feed = live
    } else if (/if\s*\(\s*\$LASTEXITCODE\s*-eq\s*0\s*\)/.test(line)) {
      feed = live // 旧形态:判定直读活变量
    }
  }
  return feed
}

const region = extractFunction(src, 'Invoke-DbMigrate')
const regionCode = codeLines(region).join('\n')

test('① migrate 退出码非 0 而后续 psql 返回 0 ⇒ 判定值必须是 1(非 0)', () => {
  const feed = simulateMigVerdictFeed(region, { migCode: 1, psqlCode: 0 })
  assert.equal(feed, 1, '判定点读到的必须是 migrate 自己的 1,而不是后来 psql 的 0')
})

test('①阳性对照:旧顺序(判定直读 $LASTEXITCODE)在同样时间线下读到 0 ⇒ 判成完成', () => {
  // 构造旧形态:去掉取码即存、判定点直读活变量
  const oldStyle = [
    '$migOut = & "D:\\DevEnv\\tools\\npm-global\\pnpm.cmd" run db:migrate 2>&1 | Out-String',
    '$pend = Get-PendingMigrationCount',
    'if (Test-MigrateOrphans) { }',
    'if ($LASTEXITCODE -eq 0) { Ok "db:migrate 完成(exit 0)" }',
  ].join('\n')
  const feed = simulateMigVerdictFeed(oldStyle, { migCode: 1, psqlCode: 0 })
  assert.equal(feed, 0, '旧顺序喂给判定的就是 psql 的 0 —— 这一条不成立说明模拟器是恒真的假尺子')
})

test('④变异:把"取码即存"退回原位 ⇒ ① 必红(判定点读到 psql 的 0)', () => {
  // 最小变异:删掉诞生处捕获行,在 outcome 判定前插回旧位置($LASTEXITCODE 已被 psql 覆写)
  const mutated = region
    .split(/\r?\n/)
    .filter((l) => !/\$migExit = \$mig\.Exit/.test(l))
    .map((l) => (/^\s*\$outcome = Get-MigrateOutcome/.test(l) ? '        $migExit = $LASTEXITCODE\n' + l : l))
    .join('\n')
  assert.notEqual(mutated, region, '变异没有生效 —— 夹具失效,不许拿它当证据')
  const feed = simulateMigVerdictFeed(mutated, { migCode: 1, psqlCode: 0 })
  assert.equal(feed, 0, '退回原位后判定读到的是 psql 的 0 ⇒ ① 的红由"feed 必须=1"这条断言当场给出')
})

test('②判定面源码纪律:Invoke-DbMigrate 代码行里 0 次 $LASTEXITCODE;"完成"只出现在 OK 分支', () => {
  assert.equal(
    (regionCode.match(/\$LASTEXITCODE/g) || []).length,
    0,
    '迁移段判定不得再碰活变量 $LASTEXITCODE(它在段内会被 psql 覆写两次)',
  )
  const doneHits = (regionCode.match(/db:migrate 完成/g) || []).length
  assert.equal(doneHits, 1, '"db:migrate 完成"在判定面只能出现一次(多写一处 = 多一条冒充路径)')
  const doneLine = codeLines(region).find((l) => l.includes('db:migrate 完成'))
  assert.match(doneLine.trim(), /^Ok /, '唯一那次"完成"必须挂在 Ok 上,且在 OK 分支内')
  assert.match(regionCode, /'OK'\s*\{[\s\S]*?db:migrate 完成[\s\S]*?\}/, '完成字样必须位于 switch 的 OK 分支')
})

test('④b变异:UNDET/TIMEOUT 分支不得带回"完成"字样(判不了与超时都不得冒充成功)', () => {
  for (const branch of ['UNDET', 'TIMEOUT']) {
    const m = new RegExp(`'${branch}' \\{([\\s\\S]*?)\\n {12}\\}`).exec(regionCode)
    assert.ok(m, `找不到 '${branch}' 分支`)
    assert.doesNotMatch(m[1], /完成/, `'${branch}' 分支的输出面不得含"完成"`)
  }
  const t = /'TIMEOUT' \{([\s\S]*?)\n {12}\}/.exec(regionCode)
  assert.match(t[1], /Note-MigrateFailure/, '超时按既有失败记账器记账(不得静默继续)')
  assert.match(t[1], /未判定/, '超时必须注明"未判定"(没有可信退出码,不改写退出码语义)')
  const u = /'UNDET' \{([\s\S]*?)\n {12}\}/.exec(regionCode)
  assert.match(u[1], /PendingMigrationReason/, 'UNDET 分支必须打印取不到的原因')
})

// ─── 判据尺:抽出纯函数在 pwsh 里跑假数据(§22c:抽取真实源码,不复制实现)───────

function resolvePwsh() {
  const candidates = ['C:\\Program Files\\PowerShell\\7\\pwsh.exe', 'pwsh', 'powershell.exe']
  for (const c of candidates) {
    if (c.includes(':') && !existsSync(c)) continue
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    const probe = spawnSync(c, ['-NoProfile', '-Command', 'exit 0'], { windowsHide: true, timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] })
    if (probe.status === 0) return c
  }
  assert.fail('本机找不到可用的 PowerShell —— AGENTS §27 要求 pwsh 7 在位;不得静默跳过本组用例')
}

test('①②③判据行为:Get-MigrateOutcome 在假数据下给出 FAIL/UNDET/TIMEOUT/OK/PEND,且活变量覆写实证', () => {
  const fnSrc = extractFunction(src, 'Get-MigrateOutcome')
  const scratch = mkScratch('deploy-mig-exitcode')
  try {
    // §27: .ps1 用 UTF-8 with BOM 写,中文注释不参与执行但保持文件形态与主脚本一致
    const harness = [
      '$ErrorActionPreference = \'Stop\'',
      fnSrc,
      '$out = @()',
      '$out += "R1=" + (Get-MigrateOutcome -MigExit 1 -Pending 0)',
      '$out += "R2=" + (Get-MigrateOutcome -MigExit 0 -Pending $null)',
      '$out += "R3=" + (Get-MigrateOutcome -MigExit 0 -Pending 0 -TimedOut)',
      '$out += "R4=" + (Get-MigrateOutcome -MigExit 0 -Pending 0)',
      '$out += "R5=" + (Get-MigrateOutcome -MigExit 0 -Pending 3)',
      '$out += "R6=" + (Get-MigrateOutcome -MigExit 7 -Pending $null -TimedOut)',
      '$global:LASTEXITCODE = 1',
      '$cap = $LASTEXITCODE',
      '$global:LASTEXITCODE = 0',
      '$out += "CAP=$cap"',
      '$out += "OLD=" + $(if ($LASTEXITCODE -eq 0) { "DONE" } else { "FAIL" })',
      '$out += "NEW=" + (Get-MigrateOutcome -MigExit $cap -Pending 0)',
      '$out | ForEach-Object { Write-Output $_ }',
      '',
    ].join('\r\n')
    const file = join(scratch, 'harness.ps1')
    writeFileSync(file, '\ufeff' + harness)
    const res = spawnSync(resolvePwsh(), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe']
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    })
    assert.equal(res.status, 0, `harness 必须跑通:stderr=${res.stderr}`)
    const got = Object.fromEntries(
      res.stdout
        .split(/\r?\n/)
        .filter((l) => l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    )
    assert.equal(got.R1, 'FAIL', '①migrate 非 0 而 pending=0 ⇒ 必须 FAIL(psql 的 0 不改判)')
    assert.equal(got.R2, 'UNDET', '②pending 判不了 ⇒ 既非完成也非失败')
    assert.equal(got.R3, 'TIMEOUT', '③超时 ⇒ TIMEOUT(优先于一切,不冒充退出码)')
    assert.equal(got.R4, 'OK', '对照:exit 0 且 pending=0 才允许 OK')
    assert.equal(got.R5, 'PEND', 'exit 0 但仍有待应用 ⇒ PEND(跑过没应用完)')
    assert.equal(got.R6, 'TIMEOUT', '超时优先于非 0 码:不得把"没拿到码"说成失败码 7')
    assert.equal(got.CAP, '1', '取码即存后,后续覆写不改已存值')
    assert.equal(got.OLD, 'DONE', '活变量正证:晚读 $LASTEXITCODE 的旧判法在同样覆写下判成 DONE(缺陷可复现)')
    assert.equal(got.NEW, 'FAIL', '同时间线下新判法判 FAIL —— 修复与缺陷的唯一差别就是捕获时机')
  } finally {
    rmScratch(scratch)
  }
})

test('有界等待与预算出口在位:默认 180s、env 覆写、生效值打印、超时杀整树', () => {
  assert.match(src, /return 180/, '默认预算 180s 必须在位')
  assert.match(src, /IHUI_DEPLOY_MIGRATE_TIMEOUT_SEC/, 'env 覆写出口必须在位')
  assert.match(src, /WaitForExit\(\$BudgetSec \* 1000\)/, '有界等待必须真用预算值')
  assert.match(src, /taskkill \/PID \$migProc\.Id \/T \/F/, '超时必须杀整树(pnpm.cmd 派生 node/psql)')
  const budgetLogIdx = regionCode.indexOf('硬预算=')
  const callIdx = regionCode.indexOf('Invoke-MigrateWithBudget -BudgetSec')
  assert.ok(budgetLogIdx >= 0 && budgetLogIdx < callIdx, '生效预算值必须在调用**之前**打进日志(账后可读)')
})

// ─── 身份稳定性尺(2026-10-26 票 G-43 第②格,离线静态)──────────────────────────
//
// 钉住的失效型:超时那一格的 reason 里写了生效预算 ${migBudgetSec}s。reason 同时进**两层身份**
// —— Note-MigrateFailure 自己 12h 窗那层 `$sig = "$reason|pend=$pendTier"`,以及
// Invoke-FailNotify 4h 分槽那层(它按传进来的 $m 重算,而 $m 由含 reason 的 $migMsg 拼成)。
// ⇒ env IHUI_DEPLOY_MIGRATE_TIMEOUT_SEC 改一次,两层同时换身份、两扇去重双双失效(同
// ihui-monitor.ps1 磁盘格 / 本文件上面的实时条数那一型)。
// 口径:身份只由**从真实源码抽出的模板**驱动(§22c 不复制实现,抽取即 import);
// 模板里出现本尺子认不出的变量 ⇒ 判"未建模"直接红,不许当常量放过。

function extractVarTemplates(noteFnSrc) {
  const lines = codeLines(noteFnSrc)
  const layer1 = lines.find((l) => /^\s*\$sig = "\$reason\|pend=/.test(l))
  assert.ok(layer1, 'Note-MigrateFailure 的 12h 层签名模板($sig = "$reason|pend=$pendTier")不见了 —— 摘线即红')
  const msg = lines.find((l) => /^\s*\$migMsg = "/.test(l))
  assert.ok(msg, 'Note-MigrateFailure 的告警文案行($migMsg = "…")不见了 —— 它就是 4h 层算身份的那段字')
  return {
    layer1Tpl: /(\$sig = "([^"]*)")/.exec(layer1)[2],
    msgTpl: /\$migMsg = "([^"]*)"/.exec(msg)[1],
  }
}

/** 按 vars 表把模板里的 PowerShell 插值展开;展开后仍残留 `$` ⇒ 判"未建模"(不记绿也不记红之外的第三种,直接fail) */
function expand(tpl, vars) {
  let out = tpl
  for (const [k, v] of Object.entries(vars)) out = out.split(`\${${k}}`).join(v).split(`$${k}`).join(v)
  assert.match(out, /^[^$]*$/, `身份模板留有未建模的插值,本尺子判不了(不得当常量放过): ${out}`)
  return out
}

function timeoutReasonLiteral(codeText) {
  const br = /'TIMEOUT' \{([\s\S]*?)\n {12}\}/.exec(codeText)
  assert.ok(br, '找不到 TIMEOUT 分支')
  const call = br[1].split('\n').find((l) => /Note-MigrateFailure/.test(l))
  assert.ok(call, 'TIMEOUT 分支必须走 Note-MigrateFailure 记账')
  const reason = /-reason "([^"]*)"/.exec(call)
  assert.ok(reason, 'TIMEOUT 那记调用必须显式给 -reason(身份类就写在这里)')
  return { reason: reason[1], call }
}

function failNotifyLayer2(fnSrc, mText) {
  // 4h 层的身份规则从 Invoke-FailNotify 源码抽:$sig = ($m -replace '\s+', ' ').Trim()
  const rule = codeLines(fnSrc).find((l) => /^\s*\$sig = \(\$m -replace/.test(l))
  assert.ok(rule, "Invoke-FailNotify 的分槽身份规则($sig = ($m -replace '\\s+', ' ').Trim())不见了 —— 摘线即红")
  assert.match(rule, /-replace '\\s\+', ' '\)\.Trim\(\)/, '4h 层身份 = 空白归一 + 去首尾空白,规则变了本尺子必须同步')
  return mText.replace(/\s+/g, ' ').trim()
}

test('⑤身份稳定性:超时那一格的两层签名在 migBudgetSec 取不同值时必须逐字节相同', () => {
  const noteFn = extractFunction(src, 'Note-MigrateFailure')
  const { layer1Tpl, msgTpl } = extractVarTemplates(noteFn)
  const { reason, call } = timeoutReasonLiteral(regionCode)
  const budgets = ['180', '60', '300', '1'] // env 覆写前后的候选生效值(档位无关,只验身份不吃它)
  const layer1 = budgets.map((b) => expand(layer1Tpl, { reason: expand(reason, { migBudgetSec: b }), pendTier: 'TIER' }))
  const layer2 = budgets.map((b) =>
    failNotifyLayer2(extractFunction(src, 'Invoke-FailNotify'), expand(msgTpl, { reason: expand(reason, { migBudgetSec: b }), pendTier: 'TIER' })),
  )
  assert.ok(new Set(layer1).size === 1, `12h 层身份随 migBudgetSec 漂移(${new Set(layer1).size} 种)⇒ env 一改就换身份,去重失效`)
  assert.ok(new Set(layer2).size === 1, `4h 层身份随 migBudgetSec 漂移(${new Set(layer2).size} 种)⇒ 同上,两层双双失效`)
  assert.doesNotMatch(reason, /\$/, '超时那一格的 reason 不得含任何插值 —— 身份只留固定类')
  assert.match(reason, /未判定/, '固定类仍须写明"未判定"(AGENTS 0.3:超时不得冒充失败或成功)')
  // 实时数值必须**只进正文**:它得出现在 -RealtimeDetail 实参上,并在 Note-MigrateFailure 里
  // 只被 -Detail 那条路消费(写进 $sig 或 $migMsg 就是把刚修好的那一格原地复原)。
  assert.match(call, /-RealtimeDetail "[^"]*\$\{migBudgetSec\}s/, '生效预算数值必须经 -RealtimeDetail 传给正文')
  const rtLines = codeLines(noteFn).filter((l) => /RealtimeDetail/.test(l))
  assert.ok(rtLines.length > 0, '$RealtimeDetail 在 Note-MigrateFailure 里无人消费 = 参数是死的(正文照样看不到数值)')
  for (const l of rtLines) {
    assert.doesNotMatch(l, /\$sig = |\$migMsg = /, `$RealtimeDetail 混进了身份面: ${l.trim()}`)
  }
  assert.match(noteFn, /-Detail \$migDetail|-Detail "[^"]*\$RealtimeDetail/, '$RealtimeDetail 必须经 -Detail 进正文')
})

test('⑤阳性对照:把预算数值写回 reason(改前形态)⇒ 同一尺子必须量出两层身份漂移', () => {
  // 夹具 = 改前那行 reason 逐字(HEAD 面 deploy/win/ihui-deploy.ps1 的 TIMEOUT 调用),
  // 用来证明 ⑤ 不是恒真:判据换了形态,尺子当场翻脸。
  const oldReason = '超时 ${migBudgetSec}s(未判定,无退出码)'
  const noteFn = extractFunction(src, 'Note-MigrateFailure')
  const { layer1Tpl, msgTpl } = extractVarTemplates(noteFn)
  const budgets = ['180', '60']
  const layer1 = budgets.map((b) => expand(layer1Tpl, { reason: expand(oldReason, { migBudgetSec: b }), pendTier: 'TIER' }))
  const layer2 = budgets.map((b) =>
    failNotifyLayer2(extractFunction(src, 'Invoke-FailNotify'), expand(msgTpl, { reason: expand(oldReason, { migBudgetSec: b }), pendTier: 'TIER' })),
  )
  assert.notEqual(layer1[0], layer1[1], '旧形态下 12h 层身份必须随预算变 —— 不变说明本尺子恒真(假尺子)')
  assert.notEqual(layer2[0], layer2[1], '旧形态下 4h 层身份同样必须变(两层同时失效才是当初那 84 封的成因)')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

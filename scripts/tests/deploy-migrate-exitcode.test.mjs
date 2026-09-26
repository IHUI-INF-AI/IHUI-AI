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
const PS1_PATH = join(ROOT, 'deploy', 'win', 'ihui-deploy.ps1')
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
    const probe = spawnSync(c, ['-NoProfile', '-Command', 'exit 0'], { windowsHide: true, timeout: 20000 })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

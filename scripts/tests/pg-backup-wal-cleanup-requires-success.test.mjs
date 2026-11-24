// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 过期 WAL 只许在「本轮备份成功」之后删除(DBG-82)。
//
// 旧形态:调度器 Run-Backup 在成功分支和失败分支之后无条件 Remove-Item,
// 备份连续失败仍删 7 天前归档,PITR 链被拆掉。
// 本文件钉三件事,且不启动 ihui-pg-backup-scheduler.ps1、不连库、不删归档:
//   ① 谓词本身:本轮成功才允许删。用抽出来的函数在 pwsh 里跑。
//   ② 接线:$roundOk 默认 $false,只在 exit 0 分支置真;Remove-Item 在该谓词门内。
//      失败分支写「过期归档全部保留」,且不读 $script:BackupOk
//      (那个标志在连续 4 次失败、放弃本轮时会被拨回 $true,只表示改回 03:00)。
//   ③ 失败仍可见:退出码非 0 与 catch 仍把 $script:BackupOk 置 $false。
//
// 运行:node --test scripts/tests/pg-backup-wal-cleanup-requires-success.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REL = join('deploy', 'win', 'ihui-pg-backup-scheduler.ps1')
const SRC = readFileSync(join(REPO, REL), 'utf8')

/** 剥 PowerShell 注释。字符串里的 # 保留,避免把「写下禁令」当成代码。 */
function stripPwshComments(text) {
  const noBlock = text.replace(/<#[\s\S]*?#>/g, '')
  let out = ''
  let quote = null
  for (let i = 0; i < noBlock.length; i += 1) {
    const ch = noBlock[i]
    if (quote) {
      out += ch
      if (quote === '"' && ch === '`') {
        out += noBlock[i + 1] ?? ''
        i += 1
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      out += ch
      continue
    }
    if (ch === '#') {
      while (i < noBlock.length && noBlock[i] !== '\n') i += 1
      out += '\n'
      continue
    }
    out += ch
  }
  return out
}

const CODE = stripPwshComments(SRC)

function matchingBrace(code, openIdx) {
  let depth = 0
  let quote = null
  for (let i = openIdx; i < code.length; i += 1) {
    const ch = code[i]
    if (quote) {
      if (quote === '"' && ch === '`') {
        i += 1
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function extractFunction(code, name) {
  const start = code.indexOf(`function ${name}`)
  if (start < 0) return null
  const open = code.indexOf('{', start)
  const close = matchingBrace(code, open)
  if (open < 0 || close < 0) return null
  return { text: code.slice(start, close + 1), start, end: close }
}

function armAt(code, re) {
  const m = re.exec(code)
  if (!m) return null
  const open = m.index + m[0].lastIndexOf('{')
  const close = matchingBrace(code, open)
  if (close < 0) return null
  let elseBody = null
  let elseStart = -1
  let elseEnd = -1
  const rest = code.slice(close + 1)
  const elseM = /^\s*else\s*\{/.exec(rest)
  if (elseM) {
    elseStart = close + 1 + elseM.index
    const elseOpen = close + 1 + elseM[0].lastIndexOf('{')
    elseEnd = matchingBrace(code, elseOpen)
    if (elseEnd < 0) return null
    elseBody = code.slice(elseOpen + 1, elseEnd)
  }
  return {
    ifBody: code.slice(open + 1, close),
    elseBody,
    ifStart: open,
    ifEnd: close,
    elseStart,
    elseEnd,
  }
}

const EXIT_IF = /if\s*\(\$LASTEXITCODE\s*-eq\s*0\)\s*\{/
const CLEAN_IF = /if\s*\(Test-WalArchiveCleanupAllowed\s+-RoundSucceeded\s+\$roundOk\)\s*\{/
const CASES = [
  { ok: false, want: false },
  { ok: true, want: true },
]

function runPredicate(fnSource) {
  assert.ok(fnSource && fnSource.length < 800, '抽出来的谓词不像一个纯函数')
  assert.doesNotMatch(
    fnSource,
    /Remove-Item|Get-ChildItem|pg_archives|pg_dump|Start-Sleep|Write-Log|backupScript|Invoke-|Start-Process/,
    '谓词里出现删除/枚举归档/跑备份 ⇒ 测试拒绝执行它',
  )
  const caseLiteral = CASES.map((c) => (c.ok ? '$true' : '$false')).join(',')
  const script = [
    "$ErrorActionPreference = 'Stop'",
    fnSource,
    `$cases = @(${caseLiteral})`,
    'foreach ($c in $cases) {',
    '  $got = Test-WalArchiveCleanupAllowed -RoundSucceeded $c',
    '  Write-Output ("{0} {1}" -f ([int][bool]$c), ([int][bool]$got))',
    '}',
  ].join('\n')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `谓词未跑起来 status=${r.status} stderr=${r.stderr || r.error}`)
  const rows = String(r.stdout || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [ok, got] = line.trim().split(/\s+/).map(Number)
      return { ok: ok === 1, got: got === 1 }
    })
  assert.equal(rows.length, CASES.length, `谓词输出行数不对:\n${r.stdout}`)
  return rows
}

function assess(code) {
  const failed = []
  const pred = extractFunction(code, 'Test-WalArchiveCleanupAllowed')
  if (!pred) failed.push('predicate-missing')
  else if (!/return \[bool\]\$RoundSucceeded\b/.test(pred.text)) failed.push('predicate-formula')

  const run = extractFunction(code, 'Run-Backup')
  if (!run) return [...new Set(failed.concat('run-backup-missing'))]
  const body = run.text
  const falseHits = body.split('$roundOk = $false').length - 1
  const trueHits = body.split('$roundOk = $true').length - 1
  if (falseHits !== 1) failed.push('round-ok-default-deny')
  if (trueHits !== 1) failed.push('round-ok-not-only-on-success')

  const tryM = /\btry\s*\{/.exec(body)
  const falseAt = body.indexOf('$roundOk = $false')
  if (!tryM || falseAt < 0 || falseAt > tryM.index) failed.push('round-ok-default-deny')

  const exitIf = armAt(body, EXIT_IF)
  if (!exitIf) failed.push('exit-branch-missing')
  else {
    if (!exitIf.ifBody.includes('$roundOk = $true')) failed.push('round-ok-not-only-on-success')
    if (!exitIf.ifBody.includes('$script:BackupOk = $true')) failed.push('success-flag-missing')
    if (!exitIf.elseBody || !exitIf.elseBody.includes('$script:BackupOk = $false')) {
      failed.push('fail-flag-missing')
    }
    if (exitIf.elseBody && exitIf.elseBody.includes('$roundOk = $true')) {
      failed.push('round-ok-not-only-on-success')
    }
  }

  const catchM = /\bcatch\s*\{/.exec(body)
  if (!catchM) failed.push('fail-flag-missing')
  else {
    const catchOpen = catchM.index + catchM[0].lastIndexOf('{')
    const catchClose = matchingBrace(body, catchOpen)
    const callAt = body.indexOf('Test-WalArchiveCleanupAllowed')
    if (catchClose < 0 || !body.slice(catchOpen + 1, catchClose).includes('$script:BackupOk = $false')) {
      failed.push('fail-flag-missing')
    }
    if (catchClose >= 0 && body.slice(catchOpen + 1, catchClose).includes('$roundOk = $true')) {
      failed.push('round-ok-not-only-on-success')
    }
    if (callAt < 0 || catchClose < 0 || callAt < catchClose) failed.push('cleanup-before-result')
  }

  if (!/Test-WalArchiveCleanupAllowed\s+-RoundSucceeded\s+\$roundOk/.test(body)) failed.push('call-site')
  if (/Test-WalArchiveCleanupAllowed\s+-RoundSucceeded\s+\$script:BackupOk/.test(code)) {
    failed.push('call-site')
  }

  const gate = armAt(body, CLEAN_IF)
  if (!gate) failed.push('gate-count')
  else {
    const second = CLEAN_IF.exec(body.slice(gate.ifEnd + 1))
    if (second) failed.push('gate-count')
    if (
      !gate.ifBody.includes('Remove-Item') ||
      !gate.ifBody.includes("Join-Path $DevEnvRoot 'pg_archives'") ||
      !gate.ifBody.includes('AddDays(-7)') ||
      !gate.ifBody.includes('WAL 归档:清理')
    ) {
      failed.push('delete-ungated')
    }
    if (
      !gate.elseBody ||
      !gate.elseBody.includes('过期归档全部保留') ||
      gate.elseBody.includes('Remove-Item') ||
      gate.elseBody.includes('Get-ChildItem') ||
      gate.elseBody.includes('WAL 归档:清理')
    ) {
      failed.push('hold-silent')
    }
    let at = 0
    let removals = 0
    while ((at = body.indexOf('Remove-Item', at)) >= 0) {
      removals += 1
      if (at < gate.ifStart || at > gate.ifEnd) failed.push('delete-outside-gate')
      at += 'Remove-Item'.length
    }
    if (removals === 0) failed.push('delete-ungated')
    const childAt = body.indexOf('Get-ChildItem')
    if (childAt < 0 || childAt < gate.ifStart || childAt > gate.ifEnd) failed.push('delete-ungated')
  }

  if (!code.includes('连续 4 次重试仍失败')) failed.push('retry-removed')
  return [...new Set(failed)]
}

test('谓词:本轮失败不许删过期 WAL,本轮成功才许删', () => {
  const fn = extractFunction(CODE, 'Test-WalArchiveCleanupAllowed')
  assert.ok(fn, '谓词函数不在调度器里')
  const rows = runPredicate(fn.text)
  for (let i = 0; i < CASES.length; i += 1) {
    assert.equal(rows[i].ok, CASES[i].ok)
    assert.equal(rows[i].got, CASES[i].want, `本轮成功=${CASES[i].ok} 时期望 ${CASES[i].want} 实际 ${rows[i].got}`)
  }
})

test('变异:谓词改成恒真后,失败用例必须被同一把尺子判成会删', () => {
  const fn = extractFunction(CODE, 'Test-WalArchiveCleanupAllowed')
  const mutated = fn.text.replace(/return \[bool\]\$RoundSucceeded\b/, 'return $true')
  assert.notEqual(mutated, fn.text, '夹具自证:恒真变异没有改到谓词')
  const rows = runPredicate(mutated)
  const failedRound = rows.find((r) => r.ok === false)
  assert.equal(failedRound.got, true, '恒真变异后失败轮仍返回 false ⇒ 测试没有真的执行抽出的函数')
  assert.equal(
    CASES.find((c) => c.ok === false).want,
    false,
  )
})

test('接线:过期 WAL 删除问本轮成功,失败保留归档且重试节奏还在', () => {
  assert.deepEqual(assess(CODE), [], `原面必须全绿,实际假在:${assess(CODE).join(',')}`)
})

test('变异:摘门 / 摘保留说明 / 默认改成允许 / 门外再删,同一把尺子必须翻假', () => {
  const base = assess(CODE)
  assert.deepEqual(base, [])

  const ungated = CODE.replace(CLEAN_IF, 'if ($true) {')
  assert.notEqual(ungated, CODE, '夹具自证:摘门变异没有改到文本')
  assert.ok(assess(ungated).includes('gate-count'), `摘门后仍可能判绿:${assess(ungated).join(',')}`)

  const gate = armAt(CODE, CLEAN_IF)
  assert.ok(gate && gate.elseStart >= 0 && gate.elseEnd > gate.elseStart)
  const silent = CODE.slice(0, gate.elseStart) + CODE.slice(gate.elseEnd + 1)
  assert.ok(assess(silent).includes('hold-silent'), `保留说明被摘后仍判绿:${assess(silent).join(',')}`)

  const allowByDefault = CODE.replace('$roundOk = $false', '$roundOk = $true')
  assert.notEqual(allowByDefault, CODE, '夹具自证:默认允许变异没有改到文本')
  assert.ok(
    assess(allowByDefault).includes('round-ok-default-deny'),
    `默认改成允许后仍判绿:${assess(allowByDefault).join(',')}`,
  )

  const leaked = `${CODE.slice(0, gate.elseEnd + 1)}\nRemove-Item $f.FullName -Force\n${CODE.slice(gate.elseEnd + 1)}`
  assert.ok(
    assess(leaked).includes('delete-outside-gate'),
    `成功门外再删仍判绿:${assess(leaked).join(',')}`,
  )
})

test('脚本只做语法解析,不执行备份、不删归档', () => {
  const ps1 = join(REPO, REL).replace(/'/g, "''")
  const script = [
    "$ErrorActionPreference = 'Stop'",
    '$errs = $null',
    '$tok = $null',
    `$null = [System.Management.Automation.Language.Parser]::ParseFile('${ps1}', [ref]$tok, [ref]$errs)`,
    'if ($errs -and $errs.Count -gt 0) {',
    '  $errs | ForEach-Object { Write-Output $_.ToString() }',
    '  exit 1',
    '}',
    "Write-Output 'PARSE_OK'",
  ].join('\n')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `语法解析失败:\n${r.stdout}\n${r.stderr}`)
  assert.match(String(r.stdout), /PARSE_OK/)
  assert.doesNotMatch(String(r.stdout) + String(r.stderr), /备份完成|WAL 归档:清理|Remove-Item/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

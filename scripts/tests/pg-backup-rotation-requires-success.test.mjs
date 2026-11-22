// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 备份轮转只许在「本轮导出成功」之后删旧档(DBG-81)。
//
// 旧形态:7 天 cutoff 的 Remove-Item 排在导出循环之后,不看 $failures。
// 本轮 pg_dump 全失败仍按 cutoff 删过期档,连续失败会把最后一份可用备份删光。
// 本文件钉三件事,且不启动 ihui-pg-backup.ps1、不连库:
//   ① 谓词本身:导出成功数 > 0 且失败数 = 0 才允许删;用抽出来的函数在 pwsh 里跑。
//   ② 接线:本地与云侧两处过期删除都在 if ($roundExportOk) 内,失败分支把旧档保留写进日志。
//   ③ 失败仍可见:轮转判断之后仍走 Send-FailureAlert + exit 1。云侧复制不进这道删除门。
//
// 运行:node --test scripts/tests/pg-backup-rotation-requires-success.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REL = join('deploy', 'win', 'ihui-pg-backup.ps1')
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
  return code.slice(start, close + 1)
}

function rotationGates(code) {
  const gates = []
  const re = /if\s*\(\$roundExportOk\)\s*\{/g
  let m = re.exec(code)
  while (m) {
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
    gates.push({
      ifBody: code.slice(open + 1, close),
      elseBody,
      ifStart: open,
      ifEnd: close,
      elseStart,
      elseEnd,
    })
    m = re.exec(code)
  }
  return gates
}

const CASES = [
  { ok: 0, fail: 2, want: false },
  { ok: 0, fail: 1, want: false },
  { ok: 1, fail: 1, want: false },
  { ok: 2, fail: 1, want: false },
  { ok: 0, fail: 0, want: false },
  { ok: 1, fail: 0, want: true },
  { ok: 3, fail: 0, want: true },
]

function runPredicate(fnSource) {
  assert.ok(fnSource && fnSource.length < 800, '抽出来的谓词不像一个纯函数')
  assert.doesNotMatch(
    fnSource,
    /Remove-Item|Get-ChildItem|Copy-Item|pg_dump|Invoke-|Start-Process|Send-/,
    '谓词里出现删除/导出/发信 ⇒ 测试拒绝执行它',
  )
  const caseLiteral = CASES.map((c) => `@(${c.ok},${c.fail})`).join(',')
  const script = [
    "$ErrorActionPreference = 'Stop'",
    fnSource,
    `$cases = @(${caseLiteral})`,
    'foreach ($c in $cases) {',
    '  $got = Test-BackupRotationAllowed -ExportOkCount $c[0] -FailureCount $c[1]',
    '  Write-Output ("{0} {1} {2}" -f $c[0], $c[1], ([int][bool]$got))',
    '}',
  ].join('\n')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const r = spawnSync(
    'pwsh.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    { encoding: 'utf8', windowsHide: true, timeout: 30_000 },
  )
  assert.equal(r.status, 0, `谓词未跑起来 status=${r.status} stderr=${r.stderr || r.error}`)
  const rows = String(r.stdout || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [ok, fail, got] = line.trim().split(/\s+/).map(Number)
      return { ok, fail, got: got === 1 }
    })
  assert.equal(rows.length, CASES.length, `谓词输出行数不对:\n${r.stdout}`)
  return rows
}

function assess(code) {
  const failed = []
  const fn = extractFunction(code, 'Test-BackupRotationAllowed')
  if (!fn) failed.push('predicate-missing')
  else if (!/return \(\(\$ExportOkCount -gt 0\) -and \(\$FailureCount -eq 0\)\)/.test(fn)) {
    failed.push('predicate-formula')
  }
  if (!/\$exportOkCount = 0/.test(code)) failed.push('counter-init')
  const dumpAt = code.indexOf('& $pgDump')
  const incAt = [...code.matchAll(/\$exportOkCount\+\+/g)].map((m) => m.index)
  if (incAt.length !== 2 || dumpAt < 0 || incAt.some((i) => i < dumpAt)) failed.push('counter-increments')
  const untilContinue = (marker) => {
    const at = code.indexOf(marker)
    if (at < 0) return ''
    const cont = code.indexOf('continue', at + marker.length)
    return cont < 0 ? code.slice(at) : code.slice(at, cont)
  }
  if (!untilContinue('$failures += "pg_dump $db"').includes('$failures += "pg_dump $db"')) {
    failed.push('dump-fail-marker')
  }
  if (untilContinue('$failures += "pg_dump $db"').includes('$exportOkCount++')) failed.push('count-on-dump-fail')
  if (!untilContinue('$failures += "复核 $db"').includes('$failures += "复核 $db"')) failed.push('verify-fail-marker')
  if (untilContinue('$failures += "复核 $db"').includes('$exportOkCount++')) failed.push('count-on-verify-fail')
  if (
    !/\$roundExportOk = Test-BackupRotationAllowed -ExportOkCount \$exportOkCount -FailureCount \$failures\.Count/.test(
      code,
    )
  ) {
    failed.push('call-site')
  }
  const gates = rotationGates(code)
  if (!gates || gates.length !== 2) failed.push('gate-count')
  else {
    const [local, cloud] = gates
    if (!local.ifBody.includes('删除过期档') || !/Remove-Item/.test(local.ifBody)) failed.push('local-delete-ungated')
    if (!local.ifBody.includes('[OK] 本地保留')) failed.push('local-ok-not-in-success')
    if (
      !local.elseBody ||
      !local.elseBody.includes('旧档全部保留') ||
      !local.elseBody.includes('$failures') ||
      !local.elseBody.includes('$holdWhy') ||
      local.elseBody.includes('[OK] 本地保留')
    ) {
      failed.push('local-hold-silent')
    }
    if (!cloud.ifBody.includes('删除云侧过期档') || !/Remove-Item/.test(cloud.ifBody)) {
      failed.push('cloud-delete-ungated')
    }
    if (!cloud.ifBody.includes('Join-Path $backupDir $f.Name')) failed.push('cloud-keep-if-local-remains')
    if (
      !cloud.elseBody ||
      !cloud.elseBody.includes('云侧旧档全部保留') ||
      !cloud.elseBody.includes('$failures') ||
      !cloud.elseBody.includes('$holdWhy')
    ) {
      failed.push('cloud-hold-silent')
    }
    if (local.ifBody.includes('Copy-Item') || cloud.ifBody.includes('Copy-Item')) failed.push('copy-gated')
    const pendingAt = code.indexOf('LastWriteTime -ge $cutoff')
    const inside = (at, g) => at > g.ifStart && at < g.ifEnd
    if (pendingAt < 0 || gates.some((g) => inside(pendingAt, g))) failed.push('copy-window-moved')
    if (!(cloud.ifStart > local.ifEnd)) failed.push('gate-order')
  }
  if (!code.includes('Copy-Item $f.FullName')) failed.push('copy-removed')
  if (!code.includes('Remove-Item -LiteralPath $outFile')) failed.push('partial-outfile-cleanup-removed')
  if (!/\$retentionDays = 7/.test(code)) failed.push('retention-window')
  const alertAt = code.indexOf('Send-FailureAlert -Reason "本轮备份有')
  const exitAt = alertAt < 0 ? -1 : code.indexOf('exit 1', alertAt)
  if (alertAt < 0 || exitAt < 0 || exitAt - alertAt > 500) failed.push('failure-not-visible')
  if (gates && gates.length === 2 && alertAt >= 0 && alertAt < gates[1].ifEnd) failed.push('alert-before-rotation')
  if (!/\$holdWhy = if \(\$failures\.Count -gt 0\)/.test(code)) failed.push('hold-reason')
  return failed
}

test('谓词:全失败、部分失败、零导出都不许删;有成功且零失败才许删', () => {
  const fn = extractFunction(CODE, 'Test-BackupRotationAllowed')
  const rows = runPredicate(fn)
  for (let i = 0; i < CASES.length; i += 1) {
    assert.equal(rows[i].ok, CASES[i].ok)
    assert.equal(rows[i].fail, CASES[i].fail)
    assert.equal(
      rows[i].got,
      CASES[i].want,
      `导出成功=${CASES[i].ok} 失败=${CASES[i].fail} 时期望 ${CASES[i].want} 实际 ${rows[i].got}`,
    )
  }
})

test('变异:谓词改成恒真后,全失败用例必须被同一把尺子判成会删', () => {
  const fn = extractFunction(CODE, 'Test-BackupRotationAllowed')
  const mutated = fn.replace(
    /return \(\(\$ExportOkCount -gt 0\) -and \(\$FailureCount -eq 0\)\)/,
    'return $true',
  )
  assert.notEqual(mutated, fn, '夹具自证:恒真变异没有改到谓词')
  const rows = runPredicate(mutated)
  const allFail = rows.find((r) => r.ok === 0 && r.fail === 2)
  assert.equal(allFail.got, true, '恒真变异后全失败仍返回 false ⇒ 测试没有真的执行抽出的函数')
  assert.equal(CASES.find((c) => c.ok === 0 && c.fail === 2).want, false)
})

test('接线:两处过期删除都问本轮成功,失败保留旧档且事后仍告警退出', () => {
  assert.deepEqual(assess(CODE), [], `原面必须全绿,实际假在:${assess(CODE).join(',')}`)
})

test('变异:摘掉轮转门 / 摘掉保留说明,同一把尺子必须翻假', () => {
  const base = assess(CODE)
  assert.deepEqual(base, [])

  const ungated = CODE.replace(/if\s*\(\$roundExportOk\)\s*\{/g, 'if ($true) {')
  assert.notEqual(ungated, CODE, '夹具自证:摘门变异没有改到文本')
  assert.ok(assess(ungated).includes('gate-count'), `摘门后仍可能判绿:${assess(ungated).join(',')}`)

  const gates = rotationGates(CODE)
  assert.ok(gates && gates[0].elseStart >= 0 && gates[0].elseEnd > gates[0].elseStart)
  const silentLocal = CODE.slice(0, gates[0].elseStart) + CODE.slice(gates[0].elseEnd + 1)
  assert.ok(
    assess(silentLocal).includes('local-hold-silent'),
    `本地保留说明被摘后仍判绿:${assess(silentLocal).join(',')}`,
  )

  const silentCloud = CODE.slice(0, gates[1].elseStart) + CODE.slice(gates[1].elseEnd + 1)
  assert.ok(
    assess(silentCloud).includes('cloud-hold-silent'),
    `云侧保留说明被摘后仍判绿:${assess(silentCloud).join(',')}`,
  )
})

test('脚本只做语法解析,不执行备份', () => {
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
  const r = spawnSync(
    'pwsh.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    { encoding: 'utf8', windowsHide: true, timeout: 30_000 },
  )
  assert.equal(r.status, 0, `语法解析失败:\n${r.stdout}\n${r.stderr}`)
  assert.match(String(r.stdout), /PARSE_OK/)
  assert.doesNotMatch(String(r.stdout) + String(r.stderr), /备份完成|pg_dump/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-process-exit-attribution — 子进程退出归因三态守门(G-998115,b76-08a)。
 *
 * 判据(对标上游 zcodeAgentProcessManager.ts:128-142,668-687,1215-1275):
 *   1. Host 主动回收必须写 terminationIntent{kind: expected|watchdog_recycle},
 *      且**首次 cleanup 原因不可被后续幂等回收改写**(首因锁定);
 *   2. exit 时按 `terminationKind ?? unexpected` 归因 —— 判据不接受"非零 code 即异常":
 *      signal crash 与 agent 自行 exit 0 都是非预期;
 *   3. 归因 = unexpected ⇒ stderr tail 升为 error 级日志,恰 1 条;
 *   4. tail 采集:先脱敏再限长(≤20 行,单行 ≤1000 字符),退出前等 stderr drain。
 *
 * 用法:
 *   node scripts/check-process-exit-attribution.mjs --self-test   # 自测(夹具子进程真跑)
 *   node scripts/check-process-exit-attribution.mjs               # 门本体(源形态检查)
 *
 * 本脚本不接提交链(§12f:接链由守门持有人统一做)。
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TAIL_MAX_LINES = 20
const TAIL_MAX_LINE_CHARS = 1000

// ───────────────────────── 参照实现(与生产同判据) ─────────────────────────

/** 三类凭据形状先脱敏(赋值式 / Bearer·Basic 式 / 裸 sk- 式);Bearer 先于赋值式。 */
export function redactDiagnosticText(text) {
  let out = String(text ?? '')
  out = out.replace(/\b(bearer|basic)\s+(\S+)/gi, (_m, scheme) => `${scheme} [REDACTED]`)
  out = out.replace(
    /\b(api[-_]?key|authorization|cookie|credential|password|secret|token)\b["']?(\s*[=:]\s*)(\S+)/gi,
    (_m, key, sep) => `${key}${sep}[REDACTED]`,
  )
  out = out.replace(/\bsk-[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
  return out
}

/** 尾巴采集:先脱敏、再取末 20 行、单行限 1000。 */
export function boundedRedactedTail(stderr) {
  const redacted = redactDiagnosticText(String(stderr ?? ''))
  const allLines = redacted.split(/\r?\n/)
  const lines = allLines
    .slice(-TAIL_MAX_LINES)
    .map((l) => (l.length > TAIL_MAX_LINE_CHARS ? `${l.slice(0, TAIL_MAX_LINE_CHARS)}…[truncated:true]` : l))
  return { lines, lineCount: allLines.length }
}

/**
 * 归因记录器:首因锁定 —— 首次 cleanup 写入后,后续幂等回收调用不得改写。
 */
export class TerminationIntent {
  #kind = null
  #locked = false
  /** 宿主 cleanup 写入意图;已锁定 ⇒ 本调用 no-op(不改写)。 */
  mark(kind) {
    if (this.#locked) return this.#kind
    this.#kind = kind
    this.#locked = true
    return this.#kind
  }
  /** exit 时的最终归因:没有宿主意图 ⇒ unexpected(且就此锁定,同样不可改写)。 */
  settle() {
    if (this.#kind === null) this.mark('unexpected')
    return this.#kind
  }
  get kind() {
    return this.#kind
  }
}

// ───────────────────────── 夹具(两条成对用例共用) ─────────────────────────

/** 夹具子进程:向 stderr 打 30 行,第 25 行含 Authorization: Bearer <20+ 字符>。 */
const FIXTURE_SCRIPT = `
for (let i = 1; i <= 30; i++) {
  const line = i === 25
    ? 'Authorization: Bearer abcd1234efgh5678ijkl'
    : 'diagnostic line ' + i;
  process.stderr.write(line + '\\n');
}
process.exit(0);
`

/** 跑夹具子进程,收集完整 stderr(resolve 于 close = stderr 已 drain)。 */
function runFixtureChild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', FIXTURE_SCRIPT], {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    })
    const stderrChunks = []
    child.stderr.on('data', (c) => stderrChunks.push(c))
    child.once('close', (code) => resolve({ code, stderr: Buffer.concat(stderrChunks).toString('utf8') }))
    child.once('error', reject)
  })
}

// ───────────────────────── 自测:两条成对用例 ─────────────────────────

export async function selfTest() {
  const failures = []
  const check = (cond, msg) => {
    if (!cond) failures.push(msg)
  }

  // ── 用例 ①:宿主不做任何 kill ⇒ 归因=unexpected,error 级日志恰 1 条 ──
  {
    const intent = new TerminationIntent() // 宿主不 mark ⇒ 无意图
    const errorLogs = []
    const { code, stderr } = await runFixtureChild()
    // 宿主等待 stderr drain 已由 close 事件保证(waitForStderrDrain 等价)
    const attribution = intent.settle()
    check(attribution === 'unexpected', `① 归因应为 unexpected,实得 ${attribution}`)
    check(code === 0, `① 夹具子进程应自行 exit 0,实得 ${code}(自行 exit 0 也是非预期,不得因 code=0 折成 expected)`)
    const tail = boundedRedactedTail(stderr)
    check(tail.lines.length <= TAIL_MAX_LINES, `① tail 行数应 ≤20,实得 ${tail.lines.length}`)
    check(tail.lineCount >= 30, `① lineCount 应记录原始行数(30),实得 ${tail.lineCount}`)
    for (const [i, line] of tail.lines.entries()) {
      check(line.length <= TAIL_MAX_LINE_CHARS + 14, `① 第 ${i + 1} 行超限(${line.length} 字符)`)
    }
    const joined = tail.lines.join('\n')
    check(!/Bearer\s+abcd1234/i.test(joined), '① Bearer 凭据必须被替换(先脱敏再限长)')
    check(joined.includes('[REDACTED]'), '① 脱敏占位符必须出现')
    check(joined.includes('diagnostic line 30'), '① tail 应保留末行(line 30)')
    check(!joined.includes('diagnostic line 9\n'), '① tail ≤20 行 ⇒ 首部行(line 9)不应在')
    // error 级日志:归因 unexpected ⇒ 恰 1 条(once 守卫,重复重放不得再发第二条)
    let errorLogEmitted = 0
    const onceish = (fn) => () => {
      if (errorLogEmitted) return
      errorLogEmitted += 1
      fn()
    }
    const emitErrorLog = onceish(() => errorLogs.push(`[error] exit attribution=${intent.settle()}`))
    emitErrorLog()
    emitErrorLog() // 幂等重放不得产生第二条
    check(errorLogs.length === 1, `① error 级日志应恰 1 条,实得 ${errorLogs.length}`)
    check(errorLogEmitted === 1, `① 日志发射应被 once 守卫压成 1 次,实得 ${errorLogEmitted}`)
  }

  // ── 用例 ②:宿主以 watchdog_recycle 意图回收 ⇒ 二次 cleanup 不得改成 expected ──
  {
    const intent = new TerminationIntent()
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
    })
    // 首次 cleanup:watchdog_recycle(宿主主动回收)
    intent.mark('watchdog_recycle')
    try {
      child.kill('SIGKILL')
    } catch {
      /* 已退:忽略 */
    }
    // 后续幂等回收(误写 expected)不得改写首因
    intent.mark('expected')
    intent.mark('watchdog_recycle')
    await new Promise((resolve) => child.once('close', resolve))
    const attribution = intent.settle()
    check(
      attribution === 'watchdog_recycle',
      `② 归因必须保持 watchdog_recycle(首因锁定),实得 ${attribution}`,
    )
    check(attribution !== 'expected', '② 归因不得被后续第二次 cleanup 洗成 expected')
  }

  return failures
}

// ───────────────────────── 门本体:生产面源形态检查 ─────────────────────────

function sourceChecks() {
  const failures = []
  const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
  const must = (rel, patterns) => {
    const src = read(rel)
    for (const [pat, why] of patterns) {
      if (!pat.test(src)) failures.push(`${rel}: 缺少 ${pat} —— ${why}`)
    }
  }
  const forbid = (rel, patterns) => {
    const src = read(rel)
    for (const [pat, why] of patterns) {
      const m = src.match(pat)
      if (m) failures.push(`${rel}: 出现 ${pat} —— ${why}`)
    }
  }
  must('apps/cli/src/subagents/worker-pool.ts', [
    [/terminationKind \?\? 'unexpected'/, 'exit 归因必须按 terminationKind ?? unexpected'],
    [/setTerminationKind\(/, '归因写入必须走首因锁定出口'],
    [/watchdog_recycle/, 'watchdog 回收必须写 watchdog_recycle'],
    [/redactDiagnosticText\(/, '诊断尾巴必须先脱敏'],
    [/boundedRedactedTail\(/, 'error 级日志的 tail 必须走 boundedRedactedTail'],
    [/readableEnded/, 'error 日志必须等 stderr drain(waitForStderrDrain 等价)'],
  ])
  forbid('apps/cli/src/subagents/worker-pool.ts', [
    [/terminationKindLocked = false;\s*\n\s*entry\.terminationKind/, '首因锁定标志不得在 exit 后被重置'],
  ])
  must('apps/api/src/services/transcode-service.ts', [
    [/terminationKindLocked/, 'cancel 归因必须首因锁定'],
    [/'expected'/, '宿主 cancel 必须写 expected'],
    [/redactTail\(/, 'ffmpeg stderr 尾巴必须先脱敏再限长'],
  ])
  must('apps/api/src/services/terminal-service.ts', [
    [/terminationKindLocked/, 'PTY 回收归因必须首因锁定'],
    [/markTerminationKind\(entry, entry\.terminationKind \?\? 'unexpected'\)/, 'handlePtyExit 必须按 ?? unexpected 归因'],
  ])
  must('apps/ai-service/app/services/command_streamer.py', [
    [/watchdog_recycle/, '超时回收必须写 watchdog_recycle'],
    [/"terminationKind": termination_kind or "unexpected"/, 'exit 事件必须带归因位'],
  ])
  return failures
}

// ───────────────────────── CLI ─────────────────────────

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const isSelfTest = process.argv.includes('--self-test')
  const run = async () => {
    const srcFailures = sourceChecks()
    const behaviorFailures = isSelfTest ? await selfTest() : []
    return [...srcFailures, ...behaviorFailures]
  }
  run()
    .then((failures) => {
      if (failures.length > 0) {
        console.error(`[check-process-exit-attribution]${isSelfTest ? ' --self-test' : ''} FAIL:`)
        for (const f of failures) console.error(`  ✗ ${f}`)
        process.exit(1)
      }
      console.log(`[check-process-exit-attribution]${isSelfTest ? ' --self-test' : ''}: all green`)
    })
    .catch((e) => {
      console.error('[check-process-exit-attribution] crashed:', e)
      process.exit(1)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

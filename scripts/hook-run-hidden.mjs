#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/* eslint-disable no-console -- CLI wrapper needs to report dispatch/layer failures */
/**
 * hook-run-hidden.mjs — Windows Script Host free hook dispatcher.
 *
 * ROOT FIX (2026-11-26): the host running this repository has no WSH
 * (`wscript.exe` is absent), so every `.husky/*` line that used
 * `wscript //nologo scripts/hook-run-hidden.vbs ...` exited 127 before any gate
 * started. safe-commit attributed 127 to `not-ours` and landed commits with
 * --no-verify, i.e. the entire gate chain had silently stopped running.
 *
 * This wrapper keeps the original contract without WSH:
 *   - GUI-free dispatch: node is started by the hook's own sh process (which
 *     already owns a console), and the grandchild inherits it; `windowsHide`
 *     is set so no extra console window is allocated.
 *   - stdout/stderr go to a per-run file under
 *     `.ihui-agent/state/hook-logs/<logname>/`, then are appended to the
 *     canonical `<logname>.log` through an atomic mkdir lock (same merge
 *     shape as the retired vbs wrapper, so tail/rotation readers stay valid).
 *   - the wrapped process exit code is propagated untouched, including 75
 *     (interrupted / retryable push gate).
 *   - log-layer failures are recorded in hook-log-layer.log and NEVER turn a
 *     green hook red or swallow the wrapped exit code.
 *
 * USAGE: node scripts/hook-run-hidden.mjs <logname> <script> [args...]
 */
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOG_ROOT = join(REPO_ROOT, '.ihui-agent/state/hook-logs')

/** Log-layer diagnostics must never alter the hook's own exit status. */
function layerNote(line) {
  try {
    mkdirSync(LOG_ROOT, { recursive: true })
    appendFileSync(join(LOG_ROOT, 'hook-log-layer.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* deliberately swallowed: log layer is not a gate */
  }
}

/** Atomic mkdir lock with bounded synchronous wait (no WSH, no async race). */
function acquireLock(lockDir) {
  const buf = new Int32Array(new SharedArrayBuffer(4))
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      mkdirSync(lockDir)
      return true
    } catch {
      Atomics.wait(buf, 0, 0, 10)
    }
  }
  return false
}

/**
 * Dispatch one hook body.
 * @returns {number} the wrapped process exit code
 */
export function runHookBody(argv) {
  const [logName, script, ...args] = argv
  if (!logName || !script) {
    console.error('[hook-run-hidden] usage: <logname> <script> [args...]')
    return 2
  }
  // Path traversal in a logname would let a hook write outside hook-logs/.
  if (/[\\/]/.test(logName) || logName.includes('..') || logName.startsWith('.')) {
    console.error(`[hook-run-hidden] illegal logname: ${logName}`)
    return 2
  }

  let runDir
  let runPath
  let fd
  try {
    mkdirSync(LOG_ROOT, { recursive: true })
    runDir = join(LOG_ROOT, logName)
    mkdirSync(runDir, { recursive: true })
    runPath = join(runDir, `wsh-${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}.log`)
    fd = openSync(runPath, 'wx')
    writeSync(fd, `[${new Date().toISOString()}] ${logName} :: ${script} ${args.join(' ')}\n`)
  } catch (error) {
    layerNote(`log=deferred open-failed ${logName}: ${error?.message ?? error}`)
    // The gate still runs; losing the log must not lose the verdict.
    runPath = null
  }

  const target = resolve(REPO_ROOT, script)
  let result
  let spawnError = null
  try {
    result = spawnSync(process.execPath, [target, ...args], {
      cwd: REPO_ROOT,
      windowsHide: true,
      stdio: fd === undefined ? 'ignore' : ['inherit', fd, fd],
      env: process.env,
    })
  } catch (error) {
    spawnError = error
  }

  let rc = 75 // signal / spawn failure = interrupted, retryable (never a false green)
  if (!spawnError && typeof result?.status === 'number') rc = result.status
  if (fd !== undefined) {
    try {
      if (spawnError) writeSync(fd, `[hook-run-hidden] spawn failed: ${spawnError.message}\n`)
      writeSync(fd, `[hook-run-hidden] rc=${rc}\n`)
      closeSync(fd)
    } catch (error) {
      layerNote(`log=deferred close-failed ${logName}: ${error?.message ?? error}`)
    }
  }

  if (runPath) {
    const lockDir = join(LOG_ROOT, `.lock-${logName}`)
    let locked = false
    try {
      locked = acquireLock(lockDir)
      if (!locked) throw new Error('lock timeout')
      appendFileSync(join(LOG_ROOT, `${logName}.log`), readFileSync(runPath))
    } catch (error) {
      layerNote(`log=deferred merge-failed ${logName} ${runPath}: ${error?.message ?? error}`)
    } finally {
      if (locked) {
        try {
          rmSync(lockDir, { recursive: true, force: true })
        } catch (error) {
          layerNote(`log=deferred unlock-failed ${logName}: ${error?.message ?? error}`)
        }
      }
    }
  }
  return rc
}

/** Self-test: exit-code propagation, log landing, and path-traversal rejection. */
function selfTest() {
  const cases = [
    ['exit 0', 'process.exit(0)', 0],
    ['exit 1', 'process.exit(1)', 1],
    ['exit 2', 'process.exit(2)', 2],
    ['exit 75', 'process.exit(75)', 75],
  ]
  const dir = mkdtempSync(join(tmpdir(), 'hook-run-hidden-'))
  const target = join(dir, 'fixture.mjs')
  const logName = `selftest-${process.pid}`
  let bad = 0
  try {
    for (const [name, body, want] of cases) {
      writeFileSync(target, `${body}\n`)
      const got = runHookBody([logName, target])
      const ok = got === want
      if (!ok) bad += 1
      console.log(`${ok ? 'OK' : 'FAIL'} ${name}: want=${want} got=${got}`)
    }
    const canonical = join(LOG_ROOT, `${logName}.log`)
    const text = existsSync(canonical) ? readFileSync(canonical, 'utf8') : ''
    const hasTrailer = text.includes('rc=75')
    if (!hasTrailer) bad += 1
    console.log(`${hasTrailer ? 'OK' : 'FAIL'} canonical log carries rc=75 trailer`)
    const traversal = runHookBody(['../escape', target]) === 2
    if (!traversal) bad += 1
    console.log(`${traversal ? 'OK' : 'FAIL'} path traversal in logname rejected`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    try {
      rmSync(join(LOG_ROOT, logName), { recursive: true, force: true })
      rmSync(join(LOG_ROOT, `${logName}.log`), { force: true })
    } catch {
      /* best-effort cleanup of self-test artifacts */
    }
  }
  console.log(bad === 0 ? 'self-test 全通过' : `self-test 失败 ${bad} 项`)
  return bad === 0 ? 0 : 1
}

if (process.argv[2] === '--self-test') {
  process.exit(selfTest())
} else {
  process.exit(runHookBody(process.argv.slice(2)))
}

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 提交侧推送门求值 worker。
 *
 * 由 post-commit 后台唤起（detached，不占用户的提交路径），对当前 HEAD 的完整树
 * 跑 13 道推送门 + 文档数字门 + i18n 审计；全部通过后签发 push receipt。
 *
 * 硬约束：
 *   - 只在工作树与 HEAD 完全一致（且运行前后都不漂移）时签发；
 *   - 不使用任何 HUSKY_SKIP_* / GUARDIAN 缓存捷径，逐门真跑；
 *   - 任一阻塞门 rc≠0、门集合不齐、HEAD 中途漂移 ⇒ 不签发，推送侧自动回落真跑门。
 */

import { appendFileSync, existsSync, mkdirSync, mkdtempSync, openSync, closeSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { gitRaw } from './face-reader.mjs'
import {
  issueReceipt,
  gatherContext,
  lockPath,
  markerPath,
  receiptDir,
  receiptPath,
  removeFileQuietly,
  resolveRootFromModule,
} from './push-receipt.mjs'

const root = resolveRootFromModule(import.meta.url)
const RUNNER_TIMEOUT_MS = 15 * 60 * 1000
const DOC_TIMEOUT_MS = 5 * 60 * 1000
const I18N_TIMEOUT_MS = 5 * 60 * 1000
const MAX_LOOP = 3

function log(message) {
  try {
    const dir = join(root, '.ihui-agent/state/hook-logs')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'push-receipt-worker.log'), `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    /* 日志失败不影响签发 */
  }
}

function tail(text, n = 8) {
  const lines = String(text || '').trim().split(/\r?\n/)
  return lines.slice(-n).join('\n')
}

function acquireLock() {
  const p = lockPath(root)
  mkdirSync(receiptDir(root), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(p, 'wx')
      writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
      closeSync(fd)
      return { ok: true, path: p }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      if (attempt === 0) {
        try {
          if (Date.now() - statSync(p).mtimeMs > 30 * 60 * 1000) unlinkSync(p)
        } catch {
          /* 忽略 */
        }
      }
    }
  }
  return { ok: false }
}

function worktreeClean() {
  return gitRaw(['status', '--porcelain'], root).trim() === ''
}

function buildRunnerEnv(timingFile) {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (key.startsWith('HUSKY_SKIP_')) delete env[key]
  }
  delete env.PUSH_SCOPE_FILES
  // 本 worker 的求值面是**完整 HEAD 树**(凭据 policy=full-head-face),必须显式申明,
  // 不能让 47p 因为"拿不到 push scope"去猜整面(2026-11-09:那条路曾把水印写进 190 个无关文件)。
  delete env.PUSH_SCOPE_MANIFEST
  delete env.PUSH_NO_FILE_FACE
  delete env.PUSH_NO_FILE_FACE_BASIS
  env.GUARDIAN_NO_CACHE = '1'
  env.IHUI_GATE_FAST = '0'
  env.GUARDIAN_TIMING_FILE = timingFile
  return env
}

function runNode(script, args, env, timeoutMs) {
  const started = Date.now()
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  })
  return {
    rc: typeof r.status === 'number' ? r.status : null,
    signal: r.signal || null,
    error: r.error ? String(r.error.message || r.error) : null,
    durationMs: Date.now() - started,
    stdout: typeof r.stdout === 'string' ? r.stdout : '',
    stderr: typeof r.stderr === 'string' ? r.stderr : '',
  }
}

function readTimingRows(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  if (!Array.isArray(raw.rows)) throw new Error('timing 文件无 rows')
  return raw.rows
}

function main() {
  const lock = acquireLock()
  if (!lock.ok) {
    log('另一个 worker 正在运行，本次跳过')
    return 0
  }

  let marker = null
  try {
    for (let round = 0; round < MAX_LOOP; round += 1) {
      const headCtx = gatherContext(root, '')
      const head = headCtx.headSha

      // 已有凭据且与当前 HEAD/tree/远端基线一致 ⇒ 不必重跑。
      const existing = receiptPath(root, head)
      if (existsSync(existing)) {
        try {
          const r = JSON.parse(readFileSync(existing, 'utf8'))
          if (r.commitSha === head && r.treeSha === headCtx.treeSha && r.remoteBase === headCtx.originMainSha) {
            log(`HEAD=${head.slice(0, 12)} 已有凭据，跳过`)
            return 0
          }
        } catch {
          /* 损坏凭据当作不存在 */
        }
      }

      if (!worktreeClean()) {
        log(`HEAD=${head.slice(0, 12)} 工作树不干净，拒绝签发凭据（推送侧会回落真跑门）`)
        return 2
      }

      marker = markerPath(root, head)
      mkdirSync(receiptDir(root), { recursive: true })
      writeFileSync(marker, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), 'utf8')
      log(`开始求值 HEAD=${head.slice(0, 12)} tree=${headCtx.treeSha.slice(0, 12)}`)

      const timingFile = join(receiptDir(root), `run-${head.slice(0, 12)}-${Date.now()}.json`)
      // 显式全量面清单:face=full 让水印门 47p 打印"本次为显式全量面"并判整张 HEAD 树,
      // 而不是因为 PUSH_SCOPE_FILES 被删掉就走"拿不到范围"的未判定分支。
      const fullFaceDir = mkdtempSync(join(tmpdir(), 'ihui-push-full-face-'))
      const fullFaceManifest = join(fullFaceDir, 'files.txt')
      writeFileSync(fullFaceManifest, '# ihui-push-scope/v1 face=full\n', 'utf8')
      const gateEnv = buildRunnerEnv(timingFile)
      gateEnv.PUSH_SCOPE_MANIFEST = fullFaceManifest
      const gateRun = runNode('scripts/guardian-runner.mjs', ['--push-gate', '--no-cache', '--timing'], gateEnv, RUNNER_TIMEOUT_MS)
      rmSync(fullFaceDir, { recursive: true, force: true })
      log(`门批量 rc=${gateRun.rc} signal=${gateRun.signal} 用时 ${gateRun.durationMs}ms(面=显式全量 HEAD 树)`)

      if (gateRun.rc !== 0) {
        log(`门批量未通过，不签发凭据。stderr 尾部:\n${tail(gateRun.stderr)}`)
        removeFileQuietly(timingFile)
        return gateRun.rc === 2 || gateRun.signal ? 2 : 1
      }

      let rows
      try {
        rows = readTimingRows(timingFile)
      } catch (error) {
        log(`timing 读取失败: ${String(error?.message || error)}`)
        removeFileQuietly(timingFile)
        return 2
      }
      removeFileQuietly(timingFile)
      if (rows.length !== 13) {
        log(`逐门结果行数=${rows.length} ≠ 13，不签发凭据`)
        return 1
      }

      const afterGates = gatherContext(root, '')
      if (afterGates.headSha !== head || afterGates.treeSha !== headCtx.treeSha || afterGates.originMainSha !== headCtx.originMainSha) {
        log('HEAD/远端基线在门运行期间漂移，丢弃本轮结果，重试最新 HEAD')
        removeFileQuietly(marker)
        marker = null
        continue
      }
      if (!worktreeClean()) {
        log('门运行期间工作树被改写，丢弃本轮结果')
        removeFileQuietly(marker)
        marker = null
        continue
      }

      const env = buildRunnerEnv('')
      const docRun = runNode('scripts/check-doc-numbers.mjs', ['--strict', '--push'], env, DOC_TIMEOUT_MS)
      log(`文档数字门 rc=${docRun.rc} 用时 ${docRun.durationMs}ms`)
      if (docRun.rc !== 0) {
        log(`文档数字门未通过，不签发凭据。stdout 尾部:\n${tail(docRun.stdout)}`)
        removeFileQuietly(marker)
        marker = null
        return 1
      }

      const i18nRun = runNode('scripts/scan-dead-i18n-keys.mjs', ['--dry-run'], env, I18N_TIMEOUT_MS)
      // i18n 是非阻塞审计：只记录 rc，不参与准入。
      log(`i18n 审计 rc=${i18nRun.rc} 用时 ${i18nRun.durationMs}ms`)

      const finalCtx = gatherContext(root, '')
      if (finalCtx.headSha !== head || finalCtx.treeSha !== headCtx.treeSha || finalCtx.originMainSha !== headCtx.originMainSha) {
        log('签发前 HEAD/远端基线再次漂移，重试最新 HEAD')
        removeFileQuietly(marker)
        marker = null
        continue
      }

      const gateRows = rows.map((row) => ({
        id: String(row.id),
        script: row.script,
        args: row.args,
        mode: row.mode,
        rc: typeof row.rc === 'number' ? row.rc : null,
        durationMs: row.ms,
        cached: row.cached === true,
      }))
      gateRows.push({
        id: '173p',
        script: 'check-doc-numbers.mjs',
        args: ['--strict', '--push'],
        mode: 'blocking',
        rc: docRun.rc,
        durationMs: docRun.durationMs,
      })
      gateRows.push({
        id: 'i18n',
        script: 'scan-dead-i18n-keys.mjs',
        args: ['--dry-run'],
        mode: 'advisory',
        rc: i18nRun.rc === null ? 0 : i18nRun.rc,
        durationMs: i18nRun.durationMs,
      })

      const issued = issueReceipt({ root, ctx: finalCtx, gateRows })
      if (!issued.ok) {
        log(`签发失败: ${issued.code}${issued.detail ? ` (${issued.detail})` : ''}`)
        return 1
      }
      log(`凭据已签发: ${issued.path}`)
      return 0
    }
    log('HEAD 连续漂移超过重试上限，放弃本轮签发')
    return 2
  } finally {
    if (marker) removeFileQuietly(marker)
    removeFileQuietly(lock.path)
  }
}

process.exitCode = main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

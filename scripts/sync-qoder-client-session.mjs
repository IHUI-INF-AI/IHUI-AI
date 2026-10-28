// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 客户端会话定期回灌(2026-10-28 立)—— 客户端为主策略的取数端。
 *
 * 链路:本机 Qoder 登录态(apps/api/scripts/qoder-capture.ps1 解密 auth.v1.dat)→
 * stdin JSON → apps/api/scripts/relay-qoder-session-sync.ts(tsx,判据 + 只写凭证列)。
 * 由 apps/api/src/workers/relay-account-pool-worker.ts 的 `qoder-session-sync` 定时任务
 * 每 10 分钟派发;也可人工跑:
 *
 *   node scripts/sync-qoder-client-session.mjs [--dry-run] [--json]
 *
 * 为什么需要它:Qoder 的 deviceToken/refresh 会轮换 refreshToken,池与客户端共用同一枚
 * rt —— 客户端轮换后池内旧票就永久失效(刷新失败 3 次即被摘除)。回灌把客户端新票
 * 同步进池,与 Trae 自 2026-10-24 起的形态一致。
 *
 * 判据(同票不写 / 池内更新不写 / 客户端更新才写)在 ts 脚本内,本文件只做提取与编排,
 * 不复制第二份规则(§0.6)。退出码:0 全部处理完(含 skip)/ 1 落库失败 / 2 未判定
 * (本机没有 Qoder 客户端 / 解密失败 / tsx 缺失)。
 *
 * 安全:令牌只在两个进程的管道里流动,任何输出都不含凭据明文。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const SYNC_TS = path.join(API_DIR, 'scripts', 'relay-qoder-session-sync.ts')
const CAPTURE_PS1 = path.join(API_DIR, 'scripts', 'qoder-capture.ps1')

export function parseArgs(argv) {
  const options = { dryRun: false, json: false, help: false, error: null }
  for (const a of argv) {
    if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else options.error = `未知参数: ${a}`
  }
  return options
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')

/** 捕获结果 → 同步脚本的 stdin 载荷(纯函数,测试锁形状;绝不带凭据以外的东西)。 */
export function buildPayload(sessions, meta) {
  const accounts = (Array.isArray(sessions) ? sessions : [])
    .map((s) => {
      const uid = str(s?.uid)
      const token = str(s?.accessToken)
      if (!uid || !token) return null
      const refreshToken = str(s?.refreshToken)
      const expiresAt = str(s?.expiresAt)
      const refreshExpiresAt = str(s?.refreshTokenExpiresAt)
      const deviceId = str(s?.deviceId)
      const machineId = str(s?.machineId)
      const machineToken = str(s?.machineToken)
      const machineCode = str(s?.machineCode)
      const machineType = str(s?.machineType)
      const version = str(s?.version)
      return {
        uid,
        token,
        ...(refreshToken ? { refreshToken } : {}),
        ...(expiresAt ? { expiresAt } : {}),
        ...(refreshExpiresAt ? { refreshTokenExpiresAt: refreshExpiresAt } : {}),
        ...(deviceId ? { deviceId } : {}),
        ...(machineId ? { machineId } : {}),
        // Cosy-* 设备头族:缺了 refresh 会被上游拒(2026-10-23 真机实证)
        ...(machineToken ? { machineToken } : {}),
        ...(machineCode ? { machineCode } : {}),
        ...(machineType ? { machineType } : {}),
        ...(version ? { version } : {}),
      }
    })
    .filter(Boolean)
  return { providerCode: 'qoder', accounts, meta: meta ?? {} }
}

function resolveTsx() {
  for (const candidate of [
    path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/** 跑 qoder-capture.ps1(pwsh 7+),stdout 即 { sessions:[…] } */
function captureSessions() {
  const r = spawnSync(
    'pwsh',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', CAPTURE_PS1],
    {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      // §12g:不吃 stdin ⇒ 首通道 ignore;要回读 JSON ⇒ stdout 管道
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 120_000,
    },
  )
  if (r.error || r.status !== 0) {
    const why = r.error?.message ?? `exit ${r.status}`
    return {
      sessions: null,
      error: `本机捕获失败(${why}): ${String(r.stderr ?? '')
        .trim()
        .slice(0, 200)}`,
    }
  }
  try {
    const parsed = JSON.parse(String(r.stdout ?? '').trim())
    const sessions = parsed?.sessions
    if (!Array.isArray(sessions)) return { sessions: null, error: '捕获输出缺 sessions[]' }
    return { sessions, error: null }
  } catch (e) {
    return {
      sessions: null,
      error: `捕获输出不是合法 JSON: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

function runSyncTs(payloadText, dryRun) {
  const tsx = resolveTsx()
  if (!tsx) {
    return Promise.resolve({
      code: 2,
      json: null,
      error: '未找到 tsx(apps/api/node_modules/tsx);先在仓根 pnpm install',
    })
  }
  const args = [tsx, SYNC_TS, '--stdin', '--json']
  if (dryRun) args.push('--dry-run')
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: API_DIR,
      windowsHide: true,
      // 带输入必须三段全接管(AGENTS §12g)
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), 120_000)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ code: 2, json: null, error: e.message })
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      // stdout 可能混有 db 连接等噪音行 ⇒ 逐行找可解析的 JSON 汇总
      let json = null
      for (const line of stdout.split(/\r?\n/)) {
        const t = line.trim()
        if (!t.startsWith('{')) continue
        try {
          json = JSON.parse(t)
        } catch {
          /* 不是汇总行,继续找 */
        }
      }
      resolve({
        code: signal ? 2 : (code ?? 2),
        json,
        error: json
          ? null
          : (stderr || `退出码 ${code ?? '?'}${signal ? ` 信号 ${signal}` : ''}`).slice(0, 300),
      })
    })
    child.stdin.write(payloadText)
    child.stdin.end()
  })
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n`)
    return 2
  }
  if (parsed.help) {
    process.stdout.write(
      '用法: node scripts/sync-qoder-client-session.mjs [--dry-run] [--json]\n' +
        '读取本机 Qoder 登录态并回灌号池(客户端为主策略的取数端;判据在 apps/api/scripts/relay-qoder-session-sync.ts)。\n',
    )
    return 0
  }

  const captured = captureSessions()
  if (captured.error) {
    process.stderr.write(`❌ 提取失败(未判定): ${captured.error}\n`)
    return 2
  }
  const payload = buildPayload(captured.sessions, {
    count: captured.sessions.length,
    editions: captured.sessions.map((s) => str(s?.edition)).filter(Boolean),
  })
  process.stderr.write(
    `提取: ${payload.accounts.length} 条可用会话` +
      `(uid=${payload.accounts.map((a) => String(a.uid).slice(0, 8)).join(',') || '-'})\n`,
  )
  if (payload.accounts.length === 0) {
    process.stderr.write('❌ 没有可回灌的会话(缺 uid/token)⇒ 未判定\n')
    return 2
  }

  const result = await runSyncTs(JSON.stringify(payload), parsed.dryRun)
  if (result.error) {
    process.stderr.write(`❌ 同步失败(未判定): ${result.error}\n`)
    return 2
  }
  if (parsed.json && result.json) {
    process.stdout.write(`${JSON.stringify(result.json)}\n`)
  } else if (result.json) {
    const s = result.json
    process.stderr.write(
      `回灌完成: applied=${s.applied} skipped=${s.skipped} missing=${s.missing} failed=${s.failed}${s.dryRun ? '(dry-run 未写)' : ''}\n`,
    )
    for (const r of s.rows ?? []) {
      process.stderr.write(
        `  ${r.uid} ${r.decision}${r.applied ? ' ✓已写' : ''}${r.error ? ` (${r.error})` : ''}\n`,
      )
    }
  }
  return result.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export const __test__ = { parseArgs, buildPayload }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

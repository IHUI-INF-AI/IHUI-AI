// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包客户端会话回灌(2026-11-26 补缺)—— 客户端→号池的取数端。
 *
 * 链路:本机 Cookies 库(lib/doubao-auth-extract.mjs)→ 服务端验票(lib/doubao-account-info.mjs)
 * → stdin JSON → apps/api/scripts/relay-doubao-session-sync.ts(整包 cookiesEnc 落库)。
 * 每 10 分钟由 worker 的 doubao-session-sync 派发;也可人工运行:
 *
 *   node scripts/sync-doubao-client-session.mjs [--dry-run] [--json] [--all-profiles]
 *                                                [--profile=Default] [--uid=<池行uid>]
 *
 * 豆包适配器没有 refreshToken,票轮换只能由桌面客户端完成;没有这条腿,永久保活/自动签到
 * 都只是在旧 cookies 上空转。验票非 accepted 一律不写,避免把死票回灌进池。
 *
 * 退出码:0 全部处理完(含 skip)/ 1 落库失败 / 2 未判定。
 * 安全:凭据只在两个进程的管道里流动,输出不含票明文。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveTsxCli } from './lib/tsx-cli.mjs'
import { DB_WRITE_TIMEOUT_MS, stageFailureText } from './lib/sync-stage-timeouts.mjs'
import { listProductPids } from './lib/trae-client-process.mjs'
import { CLIENT_IMAGES } from './local-login.mjs'
import { __test__ as traeSyncTest } from './sync-trae-client-session.mjs'
import { extractDoubaoAccounts, candidateUserDataDirs } from './lib/doubao-auth-extract.mjs'
import { verifyDoubaoSession } from './lib/doubao-account-info.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const SYNC_TS = path.join(API_DIR, 'scripts', 'relay-doubao-session-sync.ts')
const DOUBAO_PRODUCT = (CLIENT_IMAGES.doubao ?? ['Doubao'])[0]

export function parseArgs(argv) {
  const options = {
    dryRun: false,
    json: false,
    help: false,
    allProfiles: false,
    profile: '',
    uid: '',
    error: null,
  }
  const bad = (msg) => {
    if (!options.error) options.error = msg
  }
  for (const a of argv) {
    if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else if (a === '--all-profiles') options.allProfiles = true
    else if (a.startsWith('--profile=')) options.profile = a.slice('--profile='.length).trim()
    else if (a.startsWith('--uid=')) {
      options.uid = a.slice('--uid='.length).trim()
      if (!options.uid) bad('--uid= 需要一个池内 uid')
    } else if (a === '--') continue
    else bad(`未知参数: ${a}`)
  }
  if (options.allProfiles && options.profile) bad('--all-profiles 与 --profile= 互斥')
  return options
}

/** 启动进入哪个 Chromium profile:读 Local State.profile.last_used,读不到回落 Default */
export function readLastUsedProfile(userDataDirs = candidateUserDataDirs(), env = process.env) {
  const dirs = Array.isArray(userDataDirs) ? userDataDirs : [userDataDirs]
  for (const dir of dirs) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, 'Local State'), 'utf8'))
      const last = typeof j?.profile?.last_used === 'string' ? j.profile.last_used.trim() : ''
      if (last) return last
    } catch {
      /* 下一个候选目录 */
    }
  }
  return env.DOUBAO_PROFILE || 'Default'
}

/**
 * 客户端此刻是否持有会话:三态 true/false/null(进程腿)。
 * 验票已单独做,这里只回答「此刻有没有客户端在轮换」用于心跳,不用进程在跑冒充票有效。
 */
export function probeDoubaoClientActive(env = process.env, pids = listProductPids(DOUBAO_PRODUCT, env)) {
  if (pids === null) return null
  return pids.length > 0
}

/**
 * 提取结果 + 验票结果 → 落库 stdin 载荷(纯函数,测试零真 cookie 零真网络)。
 * verifications:Map<uid, {verdict, reason, mobile}>;只有 accepted 能进写库载荷。
 */
export function buildPayload(extracted, verifications, uid = '', heartbeatAt = null) {
  const named = String(uid ?? '').trim()
  const accounts = []
  const rejected = []
  const undetermined = []
  for (const a of Array.isArray(extracted?.accounts) ? extracted.accounts : []) {
    if (!a || typeof a !== 'object') continue
    const key = String(a.uid ?? '')
    const v = verifications instanceof Map ? verifications.get(key) : verifications?.[key]
    const verdict = String(v?.verdict ?? 'undetermined')
    if (verdict !== 'accepted') {
      ;(verdict === 'rejected' ? rejected : undetermined).push({
        uid: key || '(unknown)',
        reason: String(v?.reason ?? 'no-verification'),
      })
      continue
    }
    const cookies = Array.isArray(a.cookies) ? a.cookies : []
    if (cookies.length === 0) {
      undetermined.push({ uid: key || '(unknown)', reason: 'cookies-empty' })
      continue
    }
    accounts.push({
      uid: key,
      name: String(a.name ?? '豆包本机'),
      ...(typeof v.mobile === 'string' && v.mobile ? { phone: v.mobile } : {}),
      token: String(a.token ?? ''),
      cookies,
      ...(named ? { targetUid: named } : {}),
    })
  }
  let uidError = null
  if (named) {
    if (accounts.length !== 1)
      uidError = `点名 --uid=${named},但验票通过的本机会话有 ${accounts.length} 条 ⇒ 认不出这条会话属于谁,拒不回灌`
  }
  return {
    providerCode: 'doubao',
    accounts: uidError ? [] : accounts,
    ...(typeof heartbeatAt === 'string' && heartbeatAt ? { clientActiveAt: heartbeatAt } : {}),
    meta: {
      count: accounts.length,
      uid: named || null,
      uidError,
      rejected,
      undetermined,
    },
  }
}

function runSyncTs(payloadText, dryRun) {
  const tsx = resolveTsxCli(ROOT)
  if (!tsx) {
    return Promise.resolve({
      code: 2,
      json: null,
      error: '未找到 tsx(apps/api/node_modules/tsx);先在仓根 pnpm install',
    })
  }
  const args = [tsx, SYNC_TS, '--stdin', '--json', '--provider=doubao']
  if (dryRun) args.push('--dry-run')
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: API_DIR,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, DB_WRITE_TIMEOUT_MS)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ code: 2, json: null, error: e.message })
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
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
          : stageFailureText({ timedOut, signal, code, stderr, limitMs: DB_WRITE_TIMEOUT_MS }).slice(
              0,
              300,
            ),
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
      '用法: node scripts/sync-doubao-client-session.mjs [--dry-run] [--json] [--all-profiles]' +
        ' [--profile=Default] [--uid=<池行uid>]\n' +
        '读取本机豆包 Cookies,服务端验票后把整包 cookiesEnc 回灌号池。\n',
    )
    return 0
  }

  let extracted
  try {
    extracted = await extractDoubaoAccounts({
      profile: parsed.allProfiles ? undefined : parsed.profile || readLastUsedProfile(),
      allProfiles: parsed.allProfiles,
      fetchPhone: false,
    })
  } catch (e) {
    process.stderr.write(
      `❌ 提取失败(未判定): [${e?.code ?? 'extract-failed'}] ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }

  const verifications = new Map()
  for (const a of extracted.accounts) {
    try {
      const v = await verifyDoubaoSession(a.cookies)
      verifications.set(a.uid, v)
      process.stderr.write(
        `验票 uid=${a.uid} cookies=${a.cookies.length} verdict=${v.verdict}` +
          `${v.mobile ? ` mobile=${v.mobile}` : ''}${v.reason ? ` [${v.reason}]` : ''}\n`,
      )
    } catch (e) {
      verifications.set(a.uid, {
        verdict: 'undetermined',
        reason: e instanceof Error ? e.message : String(e),
        mobile: null,
      })
    }
  }

  const clientActive = probeDoubaoClientActive(process.env)
  const heartbeatAt = traeSyncTest.heartbeatOf(clientActive, new Date().toISOString())
  const payload = buildPayload(extracted, verifications, parsed.uid, heartbeatAt)
  if (payload.meta.uidError) {
    process.stderr.write(`❌ ${payload.meta.uidError}(未判定)\n`)
    return 2
  }
  process.stderr.write(
    `提取: ${extracted.accounts.length} 条会话` +
      ` 验票通过=${payload.accounts.length}` +
      ` 拒绝=${payload.meta.rejected.length}` +
      ` 未判定=${payload.meta.undetermined.length}` +
      `${payload.clientActiveAt ? ' 心跳=已记' : ' 心跳=未带'}\n`,
  )
  if (payload.accounts.length === 0) {
    process.stderr.write('❌ 没有服务端认可的豆包会话 ⇒ 未判定,拒绝回灌\n')
    return 2
  }

  const result = await runSyncTs(JSON.stringify(payload), parsed.dryRun)
  if (result.error) {
    process.stderr.write(`❌ 同步失败(未判定): ${result.error}\n`)
    return 2
  }
  if (parsed.json && result.json) process.stdout.write(`${JSON.stringify(result.json)}\n`)
  else if (result.json) {
    const s = result.json
    process.stderr.write(
      `回灌完成: applied=${s.applied} skipped=${s.skipped} missing=${s.missing} ` +
        `imported=${s.imported} 心跳=${s.heartbeat ?? 0} failed=${s.failed}` +
        `${s.dryRun ? '(dry-run 未写)' : ''}\n`,
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

export const __test__ = {
  parseArgs,
  readLastUsedProfile,
  probeDoubaoClientActive,
  buildPayload,
  heartbeatOf: traeSyncTest.heartbeatOf,
  SYNC_TS,
}

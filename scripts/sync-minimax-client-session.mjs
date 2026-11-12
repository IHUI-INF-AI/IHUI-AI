// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax Code(mcode)客户端会话定期回灌(2026-10-31 立)—— 第四条客户端会话回灌腿的取数端。
 *
 * 链路:本机 mcode 登录态(scripts/lib/minimax-auth-extract.mjs,明文 auth.json)→ stdin JSON →
 * apps/api/scripts/relay-minimax-session-sync.ts(tsx,判据 + 只写凭证列 + 证据上恢复健康态)。
 * 由 apps/api/src/workers/relay-account-pool-worker.ts 的 `minimax-session-sync` 定时任务
 * 每 10 分钟派发;也可人工跑:
 *
 *   node scripts/sync-minimax-client-session.mjs [--dry-run] [--json] [--uid=<池行uid>]
 *
 * 为什么需要它:mcode 会轮换 accessToken/refreshToken,池里那枚票是导入时的快照;而
 * minimax 适配器刻意不实现 refreshToken(刷新端点无公开文档)⇒ 不回灌就永久 down。
 *
 * 身份:mcode 记录没有 uid 字段,池内 uid 是导入期按 `recordKey+token` 哈希出来的(随票旋转
 * 而变);而 `recordKey` 是「本机会话槽名」不是账号身份(2026-11-06 实测:池内三枚 minimax
 * 行的 recordKey 逐字节全等,一台机只有一个会话槽)⇒ 默认只把 recordKey 随载荷带上,由 ts 侧
 * 认「这个槽」;人工切号/切回必须用 `--uid=` 点名目标行,认行规则一份都不在这里写(§0.6 单源)。
 * 退出码:0 全部处理完(含 skip)/ 1 落库失败 / 2 未判定
 * (本机无 mcode 会话 / 会话文件解析失败 / tsx 缺失 / 点名时本机不止一条会话)。
 *
 * 安全:令牌只在两个进程的管道里流动,任何输出都不含凭据明文(只报 recordKey 尾、区域、到期)。
 */
import { resolveTsxCli } from './lib/tsx-cli.mjs'
// 登录态腿单源 = 提取器(auth-state.json 直扫;退出后 auth.json 可能已删,state 还在)
import { readMinimaxAuthState, RENEWING_STATUSES } from './lib/minimax-auth-extract.mjs'
// 落库段窗口与失败身份判据单源(§0.6):三条同型腿不各写一份 120_000
import { DB_WRITE_TIMEOUT_MS, stageFailureText } from './lib/sync-stage-timeouts.mjs'
import { listProductPids } from './lib/trae-client-process.mjs'
import { __test__ as traeSyncTest } from './sync-trae-client-session.mjs'
// 映像名清单单源 = scripts/local-login.mjs 的 CLIENT_IMAGES(写回腿与心跳探测共用一张表,
// 换发行版时只改那一处;本层不写第二份候选名,§0.6)
import { CLIENT_IMAGES } from './local-login.mjs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const SYNC_TS = path.join(API_DIR, 'scripts', 'relay-minimax-session-sync.ts')
const EXTRACTOR = path.join(ROOT, 'scripts', 'lib', 'minimax-auth-extract.mjs')

export function parseArgs(argv) {
  const options = { dryRun: false, json: false, help: false, uid: '', error: null }
  // 第一个错就停(报最后一个会把「--uid 没支持」念成「auto:aaaa 没支持」,把人引偏)
  const bad = (msg) => {
    if (!options.error) options.error = msg
  }
  for (const a of argv) {
    if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else if (a.startsWith('--uid=')) {
      options.uid = str(a.slice('--uid='.length))
      // 给了空值 = 想点名却没说点谁:当场拒,不静默退回 recordKey 认行
      if (!options.uid) bad('--uid= 需要一个池内 uid(人工切号后点名回灌目标行)')
    } else if (a === '--')
      continue // pnpm 透传的裸分隔符,不是参数
    else bad(`未知参数: ${a}`)
  }
  return options
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')

/** 本机 mcode 客户端映像名(单源派生自 CLIENT_IMAGES.minimax,本层不另立清单) */
export const MINIMAX_PRODUCTS = Object.freeze([...(CLIENT_IMAGES.minimax ?? [])])

/**
 * 客户端此刻在不在跑 —— 进程腿(三态绝不并桶,§0.3):true=任一在跑;false=都不在;
 * null=探测失败。
 */
function probeProcessRunning(env) {
  let unknown = false
  for (const product of MINIMAX_PRODUCTS) {
    const pids = listProductPids(product, env)
    if (pids === null) {
      unknown = true
      continue
    }
    if (pids.length > 0) return true
  }
  return unknown ? null : false
}

/**
 * 「客户端在续期吗」三态合判(纯函数,进程腿 × 登录态腿,单测直打矩阵)。
 *
 * 立因(机主定案:退出登录也要永久保活):旧探测只看进程 —— 退出登录后 mcode 进程
 * 通常还跑着 ⇒ 恒 true ⇒ 永久保活档无限让位 ⇒ 池侧永不接管、票到期即死。
 * 现在登录态(auth-state.json,退出后 state 仍在、auth.json 可能已删)是第一判据:
 *   - authenticated/refreshing(可续):进程在跑/探测未知 ⇒ true(让位,顶掉客户端
 *     不可逆);明确没在跑 ⇒ false(客户端无人轮换 ⇒ 池接管);
 *   - 其他死态(anonymous/logging_out/expired/error…)⇒ false(客户端手里已没票);
 *   - 无证据(state 读不到):明确没在跑 ⇒ false;auth.json 明确无双全记录 ⇒ false;
 *     在跑/未知 且 有票或全无证据 ⇒ null(未判定,宁让位不误接管,计划 §2)。
 * @param {true|false|null} running 进程腿三态
 * @param {{status?: string|null, hasRecords?: boolean|null}} state 登录态腿
 */
export function minimaxClientVerdict(running, state) {
  const status = typeof state?.status === 'string' && state.status ? state.status : null
  const hasRecords =
    state?.hasRecords === true || state?.hasRecords === false ? state.hasRecords : null

  if (status && RENEWING_STATUSES.has(status)) return running === false ? false : running
  if (status) return false // 明确死态:客户端手里已没票,接管
  if (running === false) return false // 没登录态证据但在跑腿明确没在跑 ⇒ 无人轮换
  if (hasRecords === false) return false // 有 auth 形状但 0 条双全 ⇒ 客户端没票可轮换
  return null // 在跑/未知 且 有票或全无证据 ⇒ 未判定(宁让位不误接管,计划 §2)
}

/**
 * 客户端「在续期」合判 = 进程腿 × 登录态腿(2026-11-12 立,三态绝不并桶,§0.3)。
 * @param {{status?: string|null, hasRecords?: boolean|null}} [authState] 测试注入;缺省当场读本机
 */
export function probeMinimaxClientActive(env = process.env, authState) {
  const state = authState === undefined ? readMinimaxAuthState() : authState
  return minimaxClientVerdict(probeProcessRunning(env), state)
}

/** 记录键的人读短名(leveldb 键分隔符后的账号哈希尾 8 位;非凭据) */
export function recordKeyLabel(recordKey) {
  const key = str(recordKey)
  if (!key) return '(无 recordKey)'
  const tail = key.split('\u0000').pop() ?? key
  return `rk:…${tail.slice(-8)}`
}

/**
 * 提取结果 → 同步脚本的 stdin 载荷(纯函数,测试锁形状)。
 * 只搬「凭据 + 身份 + 溯源」三族键:记录原样明文直通会把无关键一路带进 extraMetadata,
 * 而本腿只需要能落 token 面与认出是哪枚号。expiresAt 由 expiresAtMs 折成 ISO(ts 侧首选它)。
 *
 * `uid` = 操作者点名回灌目标行(人工切号/切回用)。一台机只有一个 mcode 会话槽,
 * recordKey 认到的是「槽」不是「账号」⇒ 只有恰有一条会话时才允许点名;多条会话
 * 点一行无法判定这条会话属于谁,一律落到 meta.uidError 由调用方拒(§0.3 不猜)。
 */
export function buildPayload(extracted, uid = '', heartbeatAt = null, clientAuthStatus = null) {
  const accounts = (Array.isArray(extracted?.accounts) ? extracted.accounts : [])
    .map((a) => {
      const accessToken = str(a?.accessToken)
      if (!accessToken) return null
      const refreshToken = str(a?.refreshToken)
      const expiresAtMs =
        typeof a?.expiresAtMs === 'number' && Number.isFinite(a.expiresAtMs) ? a.expiresAtMs : null
      const expiresAt = expiresAtMs === null ? '' : new Date(expiresAtMs).toISOString()
      const region = str(a?.region)
      const recordKey = str(a?.recordKey)
      const clientId = str(a?.clientId)
      const audience = str(a?.audience)
      const tokenType = str(a?.tokenType)
      const loginEpoch = str(a?.loginEpoch)
      const sourcePath = str(a?.sourcePath)
      const scopes = Array.isArray(a?.scopes)
        ? a.scopes.filter((s) => typeof s === 'string' && s !== '')
        : []
      return {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        ...(expiresAtMs === null ? {} : { expiresAtMs, expiresAt }),
        ...(region ? { region } : {}),
        ...(recordKey ? { recordKey } : {}),
        ...(clientId ? { clientId } : {}),
        ...(audience ? { audience } : {}),
        ...(tokenType ? { tokenType } : {}),
        ...(loginEpoch ? { loginEpoch } : {}),
        ...(sourcePath ? { sourcePath } : {}),
        ...(scopes.length > 0 ? { scopes } : {}),
      }
    })
    .filter(Boolean)
  const meta = extracted?.meta ?? {}
  const named = str(uid)
  let uidError = null
  if (named) {
    if (accounts.length === 1) accounts[0] = { ...accounts[0], uid: named }
    else
      uidError = `点名 --uid=${named},但本机有 ${accounts.length} 条会话 ⇒ 认不出这条会话属于哪一行,拒不回灌`
  }
  return {
    providerCode: 'minimax',
    accounts,
    // 心跳只在量到「客户端在跑/探测未知」时带上;拿不到时刻就不带(不带 ≠ false,§0.3)
    ...(typeof heartbeatAt === 'string' && heartbeatAt ? { clientActiveAt: heartbeatAt } : {}),
    // 登录态(auth-state.json 的 status;null=无证据不带)—— ts 侧据此在死态时跳过
    // 凭据写回与心跳(退出登录后 auth.json 可能仍在,照写会把死票推进池)
    ...(clientAuthStatus ? { clientAuthStatus } : {}),
    meta: {
      count: accounts.length,
      skipped: typeof meta.skipped === 'number' ? meta.skipped : 0,
      uid: named || null,
      uidError,
      roots: Array.isArray(meta.roots) ? meta.roots.map((r) => str(r?.root)).filter(Boolean) : [],
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
        // 超时是一等读数:旧形态 `stderr || 退出码/信号` 会被 ts 脚本常态打的 db 噪音顶掉,
        // 于是「本方等死它」与「它自己崩了」在账面上是同一句话(§0.3 两桶必须分开)。
        error: json
          ? null
          : stageFailureText({
              timedOut,
              signal,
              code,
              stderr,
              limitMs: DB_WRITE_TIMEOUT_MS,
            }).slice(0, 300),
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
      '用法: node scripts/sync-minimax-client-session.mjs [--dry-run] [--json] [--uid=<池行uid>]\n' +
        '读取本机 MiniMax Code(mcode)登录态并回灌号池(客户端为主策略的取数端;' +
        '判据在 apps/api/scripts/relay-minimax-session-sync.ts)。\n' +
        '--uid: 人工切号/切回后点名要写回的那一行(一台机只有一个 mcode 会话槽,' +
        'recordKey 只认得到槽、认不到账号 ⇒ 切过号必须点名)。默认不带 = 无人值守节拍,' +
        '按 recordKey 镜像运营池那一行。\n',
    )
    return 0
  }

  const { extractMinimaxAccounts } = await import(pathToFileURL(EXTRACTOR).href)
  let extracted
  try {
    extracted = await extractMinimaxAccounts()
  } catch (e) {
    process.stderr.write(
      `❌ 提取失败(未判定): [${e?.code ?? 'extract-failed'}] ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }

  // 登录态第一读(与进程腿合判;退出登录后 state 仍在,auth.json 可能已删)
  const authState = readMinimaxAuthState()
  const clientActive = probeMinimaxClientActive(process.env, authState)
  const heartbeatAt = traeSyncTest.heartbeatOf(clientActive, new Date().toISOString())
  const payload = buildPayload(extracted, parsed.uid, heartbeatAt, authState.status)
  if (payload.meta.uidError) {
    process.stderr.write(`❌ ${payload.meta.uidError}(未判定)\n`)
    return 2
  }
  if (parsed.uid) process.stderr.write(`点名回灌目标行: uid=${parsed.uid}\n`)
  // 指纹按 recordKey 取(不按数组下标 —— 丢弃过记录时下标会错位,报出别人的指纹比不报更坏)
  const fingerprintByKey = new Map(
    (Array.isArray(extracted?.meta?.sessions) ? extracted.meta.sessions : []).map((s) => [
      str(s?.recordKey),
      str(s?.tokenFingerprint),
    ]),
  )
  const lines = payload.accounts.map(
    (a) =>
      `${recordKeyLabel(a.recordKey)} 区域=${a.region ?? '-'} 到期=${a.expiresAt ?? '-'} ` +
      `指纹=${fingerprintByKey.get(str(a.recordKey)) || '-'}(access ${a.accessToken.length}B / ` +
      `refresh ${a.refreshToken ? `${a.refreshToken.length}B` : '缺'})`,
  )
  process.stderr.write(
    `提取: ${payload.accounts.length} 条可用会话` +
      `${payload.meta.skipped > 0 ? `(跳过 ${payload.meta.skipped} 条双缺记录)` : ''}` +
      ` 登录态=${authState.status ?? '无证据'}` +
      `${payload.clientActiveAt ? ` 心跳=已记(${payload.clientActiveAt})` : ' 心跳=未带(客户端未跑)'}\n`,
  )
  for (const line of lines) process.stderr.write(`  ${line}\n`)
  if (payload.accounts.length === 0) {
    process.stderr.write('❌ 没有可回灌的会话(缺 accessToken)⇒ 未判定\n')
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
      `回灌完成: applied=${s.applied} skipped=${s.skipped} missing=${s.missing} ` +
        `imported=${s.imported ?? 0} revived=${s.revived ?? 0} failed=${s.failed}` +
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
  buildPayload,
  recordKeyLabel,
  probeMinimaxClientActive,
  minimaxClientVerdict,
  MINIMAX_PRODUCTS,
  // 心跳时刻判据单源 = Trae 腿(本层不复算,§22c)
  heartbeatOf: traeSyncTest.heartbeatOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

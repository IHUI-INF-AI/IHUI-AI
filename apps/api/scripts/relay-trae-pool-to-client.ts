// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 号池 → 本机 Trae 客户端「自动回写」(2026-11-21 立)。
//
// 立因:Trae 的 ExchangeToken 每次刷新都轮换 refreshToken。客户端关掉后由号池接管续期,
// 池内票会前进;客户端下次启动仍握着旧 rt ⇒ 可能直接进入未登录态。手工通道已有
// (POST /admin/relay/accounts/:id/login-local),但不可能要求机主常开客户端或每次手点。
//
// 本脚本补的就是这一环:客户端**没在跑**时,把池内最新票写回客户端 storage.json,
// 让下次启动直接是登录态。客户端在跑一律不动(运行中写盘会被内存态覆写,且会顶掉本机)。
//
// 判据单源:
// - 客户端进程三态 = scripts/lib/trae-client-process.mjs 的 listProductPids;
// - 永久保活登记 = relay-account-pool-scheduler 的 keepAliveForeverOf;
// - 模板/最小会话 = relay-local-login 的 buildMinimalTraeTemplate;
// - 写盘/备份/原子写 = scripts/trae-login-local.mjs(本脚本只构造载荷)。
//
//   node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/relay-trae-pool-to-client.ts [--dry-run] [--json]
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config } from 'dotenv'

const HERE = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolve(HERE, '..')
const ROOT = resolve(HERE, '..', '..', '..')
const WRITE_SCRIPT = resolve(ROOT, 'scripts', 'trae-login-local.mjs')
const SPAWN_TIMEOUT_MS = 90_000

// .env 必须早于服务模块导入(建连/加密读环境)
config({ path: resolve(API_DIR, '.env') })

const { and, eq } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { dbRead } = await import('../src/db/index.js')
const { decryptAccountCredentials } = await import('../src/services/relay-account-pool-service.js')
const { buildMinimalTraeTemplate } = await import('../src/services/relay-local-login.js')
const { keepAliveForeverOf } = await import('../src/services/relay-account-pool-scheduler.js')
const clientProcess = await import(
  pathToFileURL(resolve(ROOT, 'scripts', 'lib', 'trae-client-process.mjs')).href
)
const extractor = await import(
  pathToFileURL(resolve(ROOT, 'scripts', 'lib', 'trae-auth-extract.mjs')).href
)

const dryRun = process.argv.includes('--dry-run')
const asJson = process.argv.includes('--json')

/** 三态:true=在跑 / false=没在跑 / null=探测失败(未知)。未知按「在跑」让位。 */
function clientRunning(): boolean | null {
  let unknown = false
  for (const product of clientProcess.TRAE_PRODUCTS as string[]) {
    const pids = clientProcess.listProductPids(product) as number[] | null
    if (pids === null) {
      unknown = true
      continue
    }
    if (pids.length > 0) return true
  }
  return unknown ? null : false
}

/** 本机当前信封里的账号;没有/解不开 ⇒ null(不猜) */
function readClientAccount(): Record<string, unknown> | null {
  try {
    const extracted = extractor.extractTraeAccount()
    const account = extracted?.accounts?.[0]
    return account && typeof account === 'object' ? account : null
  } catch {
    return null
  }
}

function writeClient(
  payload: Record<string, unknown>,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [WRITE_SCRIPT, '--stdin', '--json'], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const out: Buffer[] = []
    const err: Buffer[] = []
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* 已退出 */
      }
      finish(() => reject(new Error(`写回脚本超时(${SPAWN_TIMEOUT_MS}ms)`)))
    }, SPAWN_TIMEOUT_MS)
    child.stdout.on('data', (c: Buffer) => out.push(c))
    child.stderr.on('data', (c: Buffer) => err.push(c))
    child.on('error', (e) => finish(() => reject(e)))
    child.on('close', (code) =>
      finish(() =>
        resolvePromise({
          code,
          stdout: Buffer.concat(out).toString('utf8'),
          stderr: Buffer.concat(err).toString('utf8'),
        }),
      ),
    )
    child.stdin.end(JSON.stringify(payload))
  })
}

const running = clientRunning()
if (running !== false) {
  const reason = running === null ? 'client-probe-unknown' : 'client-running'
  console.log(asJson ? JSON.stringify({ ok: true, skipped: reason }) : `skip: ${reason}`)
  process.exit(0)
}

const clientAccount = readClientAccount()
const rows = (
  await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(and(eq(aiRelayAccountPool.providerCode, 'trae'), eq(aiRelayAccountPool.isEnabled, true)))
).filter(keepAliveForeverOf)

const results: Array<Record<string, unknown>> = []
for (const row of rows) {
  const uid = row.uid ?? ''
  if (clientAccount && String(clientAccount.uid ?? '') !== uid) {
    results.push({ uid, skipped: 'client-other-account' })
    continue
  }
  const creds = decryptAccountCredentials(row)
  if (clientAccount && clientAccount.token === creds.token) {
    results.push({ uid, skipped: 'in-sync' })
    continue
  }
  const stored = creds.secrets.sessionTemplate
  const template =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : buildMinimalTraeTemplate(row)
  const payload = {
    uid,
    token: creds.token,
    refreshToken: creds.refreshToken ?? undefined,
    expiresAt: row.tokenExpiresAt?.toISOString(),
    refreshExpiresAt: row.refreshExpiresAt?.toISOString(),
    sessionTemplate: template,
    deviceId: row.deviceId ?? undefined,
    deviceKeyPem:
      typeof creds.secrets.deviceKeyPem === 'string' ? creds.secrets.deviceKeyPem : undefined,
    devicePubPem:
      typeof creds.secrets.devicePubPem === 'string' ? creds.secrets.devicePubPem : undefined,
    // 客户端没在跑:写完不拉起(下次由机主自己启动,打开即登录态)
    restartClient: false,
  }
  if (dryRun) {
    results.push({ uid, applied: false, reason: 'dry-run' })
    continue
  }
  try {
    const outcome = await writeClient(payload)
    results.push({ uid, applied: outcome.code === 0, exitCode: outcome.code })
  } catch (e) {
    results.push({
      uid,
      applied: false,
      error: e instanceof Error ? e.message.slice(0, 160) : 'unknown',
    })
  }
}

const failed = results.filter((r) => r.applied === false && r.skipped === undefined).length
const summary = { ok: failed === 0, running, results }
console.log(
  asJson
    ? JSON.stringify(summary)
    : `pool→client: ${results.map((r) => `${r.uid}:${r.skipped ?? (r.applied ? 'written' : 'failed')}`).join(', ') || 'no-target'}`,
)
process.exit(failed === 0 ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

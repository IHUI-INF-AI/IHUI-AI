// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay:pool-snapshot-sync —— 号池 → 本机快照库同步器(2026-10-31 立,机主需求)。
 *
 * 需求原话:"项目程序里的自己账号下已经存好的账号都可以跟着我们程序的账号直接一键切号,
 * 而不是非要在本电脑上登录过才可以"。此前一键切号候选 = 本机快照库(登录过才有),
 * 号池(ai_relay_account_pool, provider=workbuddy)里存着的账号 token 不会出现在列表。
 *
 * 原理:号池行解密(decryptField,密钥在本机 .env)后构造 WorkBuddy auth 快照
 * (对齐实机 jwt 明文快照键集 —— 该形状客户端已实切验证),写 `workbuddy-desktop.pool-<uid>.info`
 * 进快照库 ⇒ relay-account-switch 的候选面即 = 号池账号 ∪ 本机登录过的账号。
 *  - **归属射程(2026-10-31 机主令)**:只同步「本机归属」名下的账号 —— 归属配置 =
 *    `~/.wb-switch/pool-owner`(一行 users.id);设了 ⇒ 只拉 ownerUserId=该值的个人池
 *    (机主令:"我自己填入号池的账号只能跟着我的账号走,不能让别的用户看到使用");
 *    未设 ⇒ 沿用全局池(owner IS NULL)旧行为。可见性由转发选号的 owner 过滤保证
 *    (relay-account-forwarder:个人池绝不服务他人请求),本同步器只对齐同一射程。
 *  - 固定名:同账号重复同步覆盖同一文件(派生件不堆积);名字排序 'p'>'2' ⇒ pool 件恒视作
 *    最新,展示去重时号池票胜出(号池 token 由调度器刷新,比本机旧快照新鲜)。
 *  - domain:extraMetadata.domain 优先;缺失按 resolveRealm('')='cn' ⇒ copilot.tencent.com
 *    (与 workbuddy-protocol 的 CN chat base 同一把尺子,不抄第二份)。
 *  - 安全:token 只在内存;快照文件与既有 .info 同敏感级(本地明文);输出永不回显 token/手机号明文。
 *  - 默认 dry-run;--apply 才写盘;库不可达 ⇒ exit 2 未判定,不冒绿(§0.3)。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defaultSwitchPaths, maskPhone } from './relay-account-switch.js'
// 纯函数模块(只依赖 node:crypto),静态 import 安全
import { resolveRealm } from '../src/services/upstream-adapters/workbuddy-protocol.js'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

/** 号池行同步所需的最小投影(解密后的明文 token 只在内存流转) */
export interface PoolAccountInput {
  uid: string
  /** 展示名(号池 name,通常是手机号;输出面一律打码) */
  name: string
  token: string
  refreshToken: string | null
  tokenExpiresAt: Date | null
  refreshExpiresAt: Date | null
  /** 号池 extraMetadata.domain 原始值(可空;缺失走 resolveRealm('')='cn') */
  domain: string | null
}

/** pool 快照固定名(文件名安全化:非 [A-Za-z0-9-] 一律 '_';不进任何输出/日志) */
export function poolSnapshotName(uid: string): string {
  return `workbuddy-desktop.pool-${uid.replace(/[^A-Za-z0-9-]/g, '_')}.info`
}

/**
 * 本机归属配置(2026-10-31 机主令):`~/.wb-switch/pool-owner` 一行 users.id。
 * 设了 ⇒ 只同步该 owner 的个人池;文件不存在/空 ⇒ null(沿用全局池 owner IS NULL 旧行为)。
 * 值不进任何输出/日志(users.id 非机密,但没必要外显)。
 */
export function resolvePoolOwner(home = homedir()): string | null {
  try {
    const raw = readFileSync(join(home, '.wb-switch', 'pool-owner'), 'utf8').trim()
    return raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

/**
 * 构造 auth 快照正文(纯函数)。键集对齐实机 jwt 明文快照(2026-10-31 取证,
 * tests/relay-pool-snapshot-sync.test.ts 钉住);形状为明文 token —— 客户端对
 * 明文 jwt 形态的 auth 文件已实切验证可用(快照库现存 jwt 形态快照)。
 */
export function buildPoolSnapshot(input: PoolAccountInput, now: Date): string {
  const realm = resolveRealm(input.domain ?? '')
  // global 一律写完整形态 www.workbuddy.ai(裸域 'workbuddy.ai' 规范化);
  // cn 保持号池原值(如 copilot.tencent.com / www.workbuddy.cn),缺失落 CN chat base
  const domain =
    realm === 'global'
      ? 'www.workbuddy.ai'
      : input.domain && input.domain.length > 0
        ? input.domain
        : 'copilot.tencent.com'
  const nowMs = now.getTime()
  const expMs = input.tokenExpiresAt?.getTime() ?? nowMs
  const refreshMs = input.refreshExpiresAt?.getTime() ?? expMs
  const auth = {
    accessToken: input.token,
    domain,
    expiresAt: expMs,
    expiresIn: Math.max(0, Math.round((expMs - nowMs) / 1000)),
    lastRefreshTime: nowMs - 60_000,
    notBeforePolicy: 0,
    refreshExpiresAt: refreshMs,
    refreshExpiresIn: Math.max(0, Math.round((refreshMs - nowMs) / 1000)),
    scope: 'openid profile email',
    sessionState: '',
    tokenType: 'Bearer',
    refreshToken: input.refreshToken ?? '',
  }
  const account = {
    uid: input.uid,
    nickname: input.name,
    phoneNumber: '',
    type: 'personal',
    lastLogin: true,
    isCreator: false,
    isAdmin: false,
    pluginEnabled: true,
    deployStatus: { statusCode: 0, statusMsg: '', detailMsg: '' },
    accountType: '',
    sso: { domain: '', domainModifiedTimes: 0 },
    idp: '',
    areaInfoComplete: false,
    oneidAccountId: '',
    isCurrentOneIdEnterprise: false,
    isCurrentOneIdPersonal: true,
    isFirstLogin: false,
  }
  return JSON.stringify({ account, accounts: [account], allAccounts: [account], auth }, null, 2)
}

export interface SyncDeps {
  /** 注入账号集(测试);缺省连号池拉取并解密 */
  accounts?: PoolAccountInput[]
  /** 注入快照库目录(测试);缺省本机 defaultSwitchPaths().backupsDir */
  backupsDir?: string
  now?: Date
  /** 写盘开关;缺省 false = dry-run 只算不写(§0.8:默认档不动实盘) */
  apply?: boolean
  /** 注入归属 owner(users.id;测试用);缺省读 ~/.wb-switch/pool-owner */
  owner?: string | null
  /** 注入 home(pool-owner 文件解析基准;测试用) */
  home?: string
}

export interface SyncOutcome {
  synced: number
  unchanged: number
  decryptFailures: number
  written: string[]
}

/**
 * 语义指纹:只取号池决定字段(token/refresh/domain/到期/uid/昵称)。
 * expiresIn/refreshExpiresIn/lastRefreshTime 是随同步时刻现算的相对派生量,
 * 不参与比对 —— 否则每次跑 now 不同 ⇒ 内容恒微变,unchanged 永不命中(幂等失真)。
 */
function snapshotFingerprint(body: string): string {
  try {
    const j = JSON.parse(body) as { auth?: Record<string, unknown>; account?: Record<string, unknown> }
    const a = j.auth ?? {}
    const acc = j.account ?? {}
    return JSON.stringify([
      a['accessToken'],
      a['refreshToken'],
      a['domain'],
      a['expiresAt'],
      a['refreshExpiresAt'],
      acc['uid'],
      acc['nickname'],
    ])
  } catch {
    return body
  }
}

/** 连号池拉取 workbuddy 账号并解密(dotenv 必须早于 config 依赖模块导入 —— 先例同款) */
export async function fetchPoolWorkbuddyAccounts(owner?: string | null): Promise<{
  accounts: PoolAccountInput[]
  decryptFailures: number
}> {
  const { config: dotenvConfig } = await import('dotenv')
  dotenvConfig({ path: resolvePath(API_DIR, '.env') })
  const { and, eq, isNull } = await import('drizzle-orm')
  const { aiRelayAccountPool } = await import('@ihui/database')
  const { decryptField } = await import('../src/utils/crypto.js')
  const { db } = await import('../src/db/index.js')
  // 归属射程与转发选号同尺(2026-10-31 机主令):owner 设了 ⇒ 个人池;null ⇒ 全局池(旧行为)
  const ownerCond =
    owner !== undefined && owner !== null
      ? eq(aiRelayAccountPool.ownerUserId, owner)
      : isNull(aiRelayAccountPool.ownerUserId)
  const rows = await db
    .select({
      uid: aiRelayAccountPool.uid,
      name: aiRelayAccountPool.name,
      tokenEnc: aiRelayAccountPool.tokenEnc,
      refreshTokenEnc: aiRelayAccountPool.refreshTokenEnc,
      tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
      refreshExpiresAt: aiRelayAccountPool.refreshExpiresAt,
      extraMetadata: aiRelayAccountPool.extraMetadata,
    })
    .from(aiRelayAccountPool)
    .where(
      and(
        ownerCond,
        eq(aiRelayAccountPool.providerCode, 'workbuddy'),
        eq(aiRelayAccountPool.isEnabled, true),
      ),
    )
  const accounts: PoolAccountInput[] = []
  let decryptFailures = 0
  for (const r of rows) {
    try {
      const meta =
        r.extraMetadata && typeof r.extraMetadata === 'object' && !Array.isArray(r.extraMetadata)
          ? (r.extraMetadata as Record<string, unknown>)
          : {}
      accounts.push({
        uid: r.uid,
        name: r.name,
        token: decryptField(r.tokenEnc),
        refreshToken: r.refreshTokenEnc ? decryptField(r.refreshTokenEnc) : null,
        tokenExpiresAt: r.tokenExpiresAt,
        refreshExpiresAt: r.refreshExpiresAt,
        domain: typeof meta['domain'] === 'string' ? (meta['domain'] as string) : null,
      })
    } catch {
      decryptFailures++
    }
  }
  return { accounts, decryptFailures }
}

export async function syncPoolSnapshots(deps: SyncDeps = {}): Promise<SyncOutcome> {
  const now = deps.now ?? new Date()
  const apply = deps.apply ?? false
  const backupsDir = deps.backupsDir ?? defaultSwitchPaths(homedir()).backupsDir
  let accounts: PoolAccountInput[]
  let decryptFailures: number
  if (deps.accounts) {
    accounts = deps.accounts
    decryptFailures = 0
  } else {
    const owner = deps.owner ?? resolvePoolOwner(deps.home)
    const fetched = await fetchPoolWorkbuddyAccounts(owner)
    accounts = fetched.accounts
    decryptFailures = fetched.decryptFailures
  }
  const outcome: SyncOutcome = { synced: 0, unchanged: 0, decryptFailures, written: [] }
  for (const a of accounts) {
    const body = buildPoolSnapshot(a, now)
    const dest = join(backupsDir, poolSnapshotName(a.uid))
    if (existsSync(dest) && snapshotFingerprint(readFileSync(dest, 'utf8')) === snapshotFingerprint(body)) {
      outcome.unchanged++
      continue
    }
    if (!apply) {
      // dry-run:只计"待写",不动实盘
      outcome.synced++
      continue
    }
    // 原子写:临时名 → rename(与 applySwitch 同款;目录缺失自动建;临时残留无害,下次覆盖)
    mkdirSync(backupsDir, { recursive: true })
    const tmp = `${dest}.syncing-${now.getTime()}.tmp`
    writeFileSync(tmp, body)
    renameSync(tmp, dest)
    outcome.synced++
    outcome.written.push(dest)
  }
  return outcome
}

export async function syncMain(argv: string[], deps: SyncDeps = {}): Promise<number> {
  const apply = argv.includes('--apply') || (deps.apply ?? false)
  // 2026-10-31 安全强化第 10 批顺手清:局部 `now` 在本函数从未被读取(TS6133,
  // bcaf7f58d2 引入);真正消费方是 syncPoolSnapshots,deps.now 已随 {...deps}
  // 原样透传,本层不需要再落地一份。
  let outcome: SyncOutcome
  try {
    outcome = await syncPoolSnapshots({ ...deps, apply })
  } catch (e) {
    console.error(
      `号池不可达/查询失败(未判定,本机快照不受影响): ${e instanceof Error ? e.message : String(e)}`,
    )
    return 2
  }
  const n = outcome.synced + outcome.unchanged
  const owner = deps.owner ?? resolvePoolOwner(deps.home)
  console.log(
    `号池 workbuddy 账号(归属=${owner ? `owner ${owner.slice(0, 8)}… 个人池` : '全局池'}) ${n} 个(同步 ${outcome.synced} / 未变化 ${outcome.unchanged} / 解密失败 ${outcome.decryptFailures})`,
  )
  // 展示面:uid 只取尾 4、name 打码 —— 永不回显 token 与手机号明文
  if (deps.accounts) {
    for (const a of deps.accounts) {
      const exp = a.tokenExpiresAt ? a.tokenExpiresAt.toISOString().slice(0, 16) : '?'
      const shown = maskPhone(a.name) ?? a.name
      console.log(`  uid尾4=${a.uid.slice(-4)}  ${shown}  令牌过期=${exp}`)
    }
  }
  if (!apply) {
    console.log(`(dry-run,${outcome.synced} 份待写盘;加 --apply 落地)`)
    return 0
  }
  console.log(
    `已同步到快照库: ${deps.backupsDir ?? defaultSwitchPaths(homedir()).backupsDir}(pool-*.info 为号池派生件,固定名覆盖)`,
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // 直执行收尾 process.exit(先例同款,relay-qoder-session-sync):db 池 keep-alive 不挂进程
  syncMain(process.argv.slice(2)).then(
    (rc) => process.exit(rc),
    (e) => {
      console.error(`❌ ${e instanceof Error ? e.message : String(e)}`)
      process.exit(2)
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

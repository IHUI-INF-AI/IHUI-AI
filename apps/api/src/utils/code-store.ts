// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 验证码存储与校验工具,供 auth / users 等路由共享。
 *
 * 为什么不再是一个进程内 Map(2026-10-22 迁移):
 *  线上换流是 stop/start,同一时刻只有一个 api 实例在跑,但**一次部署会把 5 分钟窗口内
 *  已经发出的验证码全部作废** —— 那批用户点过"发送"、收到过短信,回来却一律"验证码已过期",
 *  只能重发。文件头原来那句"生产应迁移 Redis"就是这个欠账。
 *  现在:Redis 为主存,Redis 不可用时回退进程内 Map(与 services/account-lockout.ts 同范式),
 *  降级这件事必须喊出来,不得静默 —— 静默回退等于把"多实例下码不同源"这个缺陷又藏回去。
 */
import IORedis, { type Redis } from 'ioredis'
import { sql } from 'drizzle-orm'
import { config } from '../config/index.js'
import { generateNumericCode } from './crypto-random.js'
import { logger } from './logger.js'
import { db } from '../db/index.js'

export interface CodeEntry {
  code: string
  expiresAt: number
  sentAt: number
}

/** 默认有效期 5 分钟 —— 与登录/找回密码/改绑三枚已过审模板的文案一致。 */
export const CODE_TTL_MS = 5 * 60 * 1000
/** 注册模板 SMS_491200014 的文案写"10分钟内有效"(云侧已过审,不可单方面改文案),
 *  所以这一档的实现必须真给 10 分钟,否则用户在第 6~10 分钟输入会被判过期。
 *  对齐方向是"实现服从已公示的文案承诺",不是反过来放宽其他三档。 */
export const CODE_TTL_REGISTER_MS = 10 * 60 * 1000

export const CODE_RESEND_INTERVAL_MS = 60 * 1000 // 60 秒内不可重发

const KEY_PREFIX = 'code:'
/** 错码尝试计数键。上限 5 次 —— 6 位码在 5 分钟内只靠路由限流兜底时,
 *  「新增调用点忘配 rateLimit」就等于无限枚举;计数放在存储旁边,判据不再依赖调用方。 */
const ATTEMPT_PREFIX = 'code:attempts:'
const MAX_VERIFY_ATTEMPTS = 5
/** bypass 表查询失败只告警一次,避免每个请求刷一行日志。 */
let bypassWarned = false
/** 比对 + 删除一步做完。分两步写会引入"两个请求同时校验同一枚都通过"的窗口:
 *  进程内 Map 时代靠单线程天然免疫,换到 Redis 就不免疫了。 */
const CONSUME_SCRIPT = `
local v = redis.call('GET', KEYS[1])
if not v then return 0 end
local e = cjson.decode(v)
if e.code ~= ARGV[1] then return 0 end
if e.expiresAt <= tonumber(ARGV[2]) then return 0 end
redis.call('DEL', KEYS[1])
return 1
`

let redisClient: Redis | null = null
let redisInitFailed = false

function getRedis(): Redis | null {
  if (redisClient) return redisClient
  if (redisInitFailed) return null
  try {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
      // 必须关:默认 true 时 Redis 不可达的命令会**排队挂死**而不是立刻报错,
      // 于是下面所有 catch ⇒ 内存兜底 这条路根本走不到,"降级"是纸面的。
      // 2026-10-22 实测:把 REDIS_URL 指到死端口,契约测试整轮挂住不返回。
      enableOfflineQueue: false,
      commandTimeout: 2000,
    })
    redisClient.on('error', (err) => {
      logger.error('[code-store] redis error,已回退进程内存储', {
        error: String(err?.message ?? err),
      })
    })
    redisClient.on('ready', () => {
      logger.info('[code-store] redis 已连接,验证码走共享存储')
    })
    const quit = (): void => {
      redisClient?.quit().catch(() => {
        /* ignore */
      })
    }
    process.once('SIGTERM', quit)
    process.once('SIGINT', quit)
  } catch (e) {
    redisInitFailed = true
    redisClient = null
    logger.error('[code-store] redis 初始化失败,本进程全程用内存存储', {
      error: String((e as Error)?.message ?? e),
    })
  }
  return redisClient
}

/** 仅供测试与"重启后重新尝试连接"的逃生用:清掉初始化失败标记。 */
export function resetCodeStoreClientForTests(): void {
  redisInitFailed = false
}

/** 进程内降级存储。Redis 不可用时才走这里 —— 多实例部署下它不等价于共享存储。 */
const fallbackStore = new Map<string, CodeEntry>()

/** 生成 6 位数字验证码(密码学安全)。 */
export function generateCode(): string {
  // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成短信验证码,
  // Math.random 可预测 -> 攻击者可暴力枚举接管账号
  return generateNumericCode(6)
}

/** 存入一枚新发出的验证码。key = phone 或 email(与 verifyCode 的 identifier 一致)。 */
export async function putCodeEntry(identifier: string, entry: CodeEntry): Promise<void> {
  const ttlMs = Math.max(1000, entry.expiresAt - entry.sentAt)
  fallbackStore.set(identifier, entry)
  // 新码从零开始计数:上一枚码的失败次数不能追到新码上(否则用户重取后只剩 1 次机会)
  await clearAttempts(identifier)
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(KEY_PREFIX + identifier, JSON.stringify(entry), 'PX', ttlMs)
  } catch (e) {
    logger.error('[code-store] 写入 redis 失败,本轮仅内存可见', {
      error: String((e as Error)?.message ?? e),
    })
  }
}

export async function getCodeEntry(identifier: string): Promise<CodeEntry | null> {
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get(KEY_PREFIX + identifier)
      if (raw) {
        const parsed = JSON.parse(raw) as CodeEntry
        if (typeof parsed?.code === 'string' && parsed.expiresAt > Date.now()) return parsed
        return null
      }
      // Redis 在线但查无 ⇒ 以 Redis 为准(内存里可能是上一实例留下的陈旧副本)
      fallbackStore.delete(identifier)
      return null
    } catch (e) {
      logger.error('[code-store] 读 redis 失败,回退内存', {
        error: String((e as Error)?.message ?? e),
      })
    }
  }
  const mem = fallbackStore.get(identifier)
  if (!mem) return null
  if (mem.expiresAt <= Date.now()) {
    fallbackStore.delete(identifier)
    return null
  }
  return mem
}

/** 当前活动尝试计数(仅内存档;Redis 档由脚本保证 TTL)。 */
interface AttemptRecord {
  count: number
  expiresAt: number
}
const attemptStore = new Map<string, AttemptRecord>()

const BUMP_ATTEMPT_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return n
`

async function bumpAttempts(identifier: string, ttlMs: number): Promise<number> {
  const now = Date.now()
  const ttl = Math.max(1000, ttlMs)
  const redis = getRedis()
  if (redis) {
    try {
      return (await redis.eval(
        BUMP_ATTEMPT_SCRIPT,
        1,
        ATTEMPT_PREFIX + identifier,
        String(ttl),
      )) as number
    } catch (e) {
      logger.error('[code-store] 尝试计数失败,回退内存', {
        error: String((e as Error)?.message ?? e),
      })
    }
  }
  const mem = attemptStore.get(identifier)
  if (!mem || mem.expiresAt <= now) {
    attemptStore.set(identifier, { count: 1, expiresAt: now + ttl })
    return 1
  }
  mem.count += 1
  return mem.count
}

/** 达上限:码与计数一起作废,避免「计数满了但码还在」被继续消耗。 */
async function purgeCodeAndAttempts(identifier: string): Promise<void> {
  fallbackStore.delete(identifier)
  attemptStore.delete(identifier)
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(KEY_PREFIX + identifier, ATTEMPT_PREFIX + identifier)
  } catch (e) {
    logger.error('[code-store] 作废验证码失败', {
      error: String((e as Error)?.message ?? e),
    })
  }
}

async function clearAttempts(identifier: string): Promise<void> {
  attemptStore.delete(identifier)
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(ATTEMPT_PREFIX + identifier)
  } catch {
    // 清不掉只影响下一枚码的宽容度,不阻塞校验
  }
}

/**
 * 固定码后门的环境开关名。**必须显式写成 `SMS_TEST_BYPASS=true` 才可能开门**。
 *
 * 为什么坐两道门(2026-10-26 根治):生产 .env 长期是 `NODE_ENV=development`,
 * 只凭档位判定等于把后门交给一行配置;而库里的 bypass 行随时可能被重新激活。
 * 现在必须「development 档 + 显式 flag」同时成立才查表,缺一则表都不碰:
 *  - 生产 .env 不写该变量 ⇒ 后门死透,即便有人插入 active 行、即便 NODE_ENV 仍是 development;
 *  - 本地测试要用固定码 ⇒ 自己显式打开,并接受启动告警。
 */
const BYPASS_ENV_KEY = 'SMS_TEST_BYPASS'

function isFixedCodeBypassArmed(): boolean {
  return config.isDevelopmentRuntime === true && process.env[BYPASS_ENV_KEY] === 'true'
}

if (config.isDevelopmentRuntime === true && process.env[BYPASS_ENV_KEY] === 'true') {
  logger.warn('[code-store] 固定验证码后门已由 SMS_TEST_BYPASS=true 显式开启', {
    env: BYPASS_ENV_KEY,
    note: '生产环境严禁设置该变量',
  })
}

/**
 * 校验验证码:匹配且未过期时返回 true 并删除该验证码(一次性使用)。
 *
 * 测试 bypass(双重门,见 isFixedCodeBypassArmed):
 * - 必须 `config.isDevelopmentRuntime === true` **且** `SMS_TEST_BYPASS=true`,缺一不查表;
 * - 旧判据只看 NODE_ENV ⇒ 部署链把 NODE_ENV 写成 development 时,生产库里的
 *   bypass 行直接成为固定码后门(2026-10-26 实测:生产 .env 第 1 行即 development);
 * - bypass 名单由 test_verify_code_bypass 表驱动,生产库应保持 is_active=false。
 *
 * @param identifier phone 或 email(与发送时存入的 key 一致)
 */
export async function verifyCode(identifier: string, code: string): Promise<boolean> {
  if (isFixedCodeBypassArmed()) {
    try {
      const result = await db.execute(sql`
        SELECT 1 FROM "test_verify_code_bypass"
        WHERE "identifier" = ${identifier}
          AND "fixed_code" = ${code}
          AND "is_active" = true
        LIMIT 1
      `)
      if (Array.isArray(result) && result.length > 0) {
        return true
      }
    } catch (e) {
      // 表不存在或查询失败时降级到存储校验(不阻塞登录流程),但必须留痕
      if (!bypassWarned) {
        bypassWarned = true
        logger.warn('[code-store] bypass 表查询失败,按正常验证码流程处理', {
          error: String((e as Error)?.message ?? e),
        })
      }
    }
  }

  const redis = getRedis()
  if (redis) {
    try {
      const consumed = (await redis.eval(
        CONSUME_SCRIPT,
        1,
        KEY_PREFIX + identifier,
        code,
        String(Date.now()),
      )) as number
      fallbackStore.delete(identifier)
      if (consumed === 1) {
        await clearAttempts(identifier)
        return true
      }
      // 错码:码仍在则记一次尝试;达上限直接作废该码,后续校验只能重新取码
      const stillThere = await redis.get(KEY_PREFIX + identifier)
      if (stillThere) {
        const attempts = await bumpAttempts(identifier, CODE_TTL_MS)
        if (attempts >= MAX_VERIFY_ATTEMPTS) await purgeCodeAndAttempts(identifier)
      }
      return false
    } catch (e) {
      logger.error('[code-store] 原子消费脚本失败,回退内存校验', {
        error: String((e as Error)?.message ?? e),
      })
    }
  }

  const entry = fallbackStore.get(identifier)
  if (!entry || entry.code !== code || entry.expiresAt <= Date.now()) {
    if (entry) {
      const attempts = await bumpAttempts(identifier, entry.expiresAt - Date.now())
      if (attempts >= MAX_VERIFY_ATTEMPTS) await purgeCodeAndAttempts(identifier)
    }
    return false
  }
  fallbackStore.delete(identifier)
  await clearAttempts(identifier)
  return true
}

/** 测试出口(§22c):判据与生产同源,测试不得复制一份。
 *  两档后端(Redis / 内存兜底)必须过同一套断言 —— 把 REDIS_URL 指到死端口即可量到兜底档。 */
export const __test__ = {
  /** 清空两面。测试用例之间必须互不残留。 */
  async reset(): Promise<void> {
    fallbackStore.clear()
    attemptStore.clear()
    const redis = getRedis()
    if (!redis) return
    const keys: string[] = []
    let cursor = '0'
    try {
      do {
        const [next, batch] = (await redis.scan(
          cursor,
          'MATCH',
          `${KEY_PREFIX}*`,
          'COUNT',
          200,
        )) as [string, string[]]
        cursor = next
        keys.push(...batch)
      } while (cursor !== '0')
      if (keys.length) await redis.del(...keys)
    } catch {
      // 清不干净只影响测试隔离,不该让 beforeEach 抛错把整轮用例顶死
    }
  },
  /** 只看"在不在",不消费 —— 用于断言"一次性删除"与"错码不消费"。 */
  async exists(identifier: string): Promise<boolean> {
    const redis = getRedis()
    if (redis) {
      try {
        return (await redis.exists(KEY_PREFIX + identifier)) === 1
      } catch {
        /* 落到内存判 */
      }
    }
    const mem = fallbackStore.get(identifier)
    return Boolean(mem && mem.expiresAt > Date.now())
  },
  /** 当前这一轮实际用的是共享存储还是进程内兜底 —— 断言"我测的是哪一档"。
   *  必须量 `status === 'ready'`:`new IORedis()` 只要构造出来就返回对象,
   *  连不上的客户端也算"有",那样两档读数会长得一模一样,等于没自证。 */
  backend(): 'redis' | 'memory' {
    const r = getRedis()
    return r && r.status === 'ready' ? 'redis' : 'memory'
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

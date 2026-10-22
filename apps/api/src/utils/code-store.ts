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

/**
 * 校验验证码:匹配且未过期时返回 true 并删除该验证码(一次性使用)。
 *
 * 测试 bypass(仅 NODE_ENV !== 'production'):
 * - 先查 test_verify_code_bypass 表,命中且 code 匹配 → true(不消耗内存 code)
 * - bypass 名单由该表驱动(仅本地/CI seed 占位开发账号,真实账号标识不入仓库)
 * - 生产环境永远走真实验证码流程,且生产库此表保持 is_active=false
 *
 * @param identifier phone 或 email(与发送时存入的 key 一致)
 */
export async function verifyCode(identifier: string, code: string): Promise<boolean> {
  // 测试 bypass:仅非生产环境,admin 账号固定验证码 123456
  if (process.env.NODE_ENV !== 'production') {
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
    } catch {
      // 表不存在或查询失败时降级到存储校验(不阻塞登录流程)
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
      return consumed === 1
    } catch (e) {
      logger.error('[code-store] 原子消费脚本失败,回退内存校验', {
        error: String((e as Error)?.message ?? e),
      })
    }
  }

  const entry = fallbackStore.get(identifier)
  if (!entry || entry.code !== code || entry.expiresAt <= Date.now()) {
    return false
  }
  fallbackStore.delete(identifier)
  return true
}

/** 测试出口(§22c):判据与生产同源,测试不得复制一份。
 *  两档后端(Redis / 内存兜底)必须过同一套断言 —— 把 REDIS_URL 指到死端口即可量到兜底档。 */
export const __test__ = {
  /** 清空两面。测试用例之间必须互不残留。 */
  async reset(): Promise<void> {
    fallbackStore.clear()
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

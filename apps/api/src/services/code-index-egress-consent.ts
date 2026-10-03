// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「代码语义索引出域」用户选择的镜像模块(2026-10-03 数据出域合规整改)。
 *
 * 这个开关之前是**假开关**:隐私页 `settings/privacy/page.tsx` 写
 * `codeIndexEgressOptOut` 进 `user_preferences`,而全仓没有任何一处读它 ——
 * 真正的闸门在另一个进程(`apps/ai-service`)的 `.data/code_index_consent.json`
 * 里。用户点完开关,后端**零变化**。
 *
 * 为什么这里有"缓存",以及为什么它不是 `raw-retention-optout.ts` 的翻版
 * ------------------------------------------------------------------
 * `raw-retention-optout.ts` 的"内存缓存 + 启动预热"之所以成立,是因为**写入口与
 * 读入口在同一个进程**(api 的设置路由写完库立刻更新本进程内存),进程内读不到脏值。
 *
 * 本模块的读入口(闸门)在 **ai-service**,是另一个进程。照搬那个形态会得到一个
 * "看起来有缓存、实际上 ai-service 永远看不到"的假接线 —— 用户点完开关,ai-service
 * 的 `_code_index_egress_allowed` 读的还是它自己那份 `.data` 里的旧值。
 *
 * 所以这里的内存缓存**不承担"给闸门读"这个职责**(它做不到),只承担两件事:
 *   1. 让 api 自己知道"我上次推给 ai-service 的是什么",用于幂等与排障;
 *   2. 让启动预热能只推"需要推的用户",而不是把全表推一遍。
 *
 * 真正让闸门看到用户选择的,是 `pushConsentToAiService()` 那一次 HTTP 调用:
 * 走 ai-service 的**端点级用户身份**(`Depends(require_request_user_id)`,
 * 与 `routers/mcp.py`、`app/api/memory.py` 同一把钥匙),由
 * `aiServiceFetch(request, ...)` 透传该用户自己的 JWT。
 *
 * 为什么不是共享密钥(`AI_CALLBACK_SECRET` + `X-Internal-Secret`)
 * ----------------------------------------------------------
 * 那一版实现过并**实测跑不通**:`app/core/jwt_auth.py` 的 `JWTAuthMiddleware` 是
 * BaseHTTPMiddleware,在**路由处理函数之前**执行,没有 `Authorization: Bearer`
 * 就直接 401 —— 共享密钥压根没机会跑到。要让它过去必须把本路径挂进
 * `JWT_PUBLIC_PATHS` 全局白名单,而白名单是匿名的:等于允许任何人给任意用户
 * 写"已授权代码出域"。用户 JWT 方案不是妥协,是**更强**的:身份由已验签的 token
 * 决定,用户只能改自己的状态,body 里自称 user_id 也无效。
 *
 * 启动自愈为什么不在本模块
 * ----------------------
 * "ai-service 容器重建 ⇒ .data 丢失"这个洞由 **ai-service 自己的 lifespan**
 * 补(直读 `user_preferences`,见 `code_index_consent.preload_opt_outs_from_db`)。
 * 启动期没有"某个用户"的 JWT 可用 —— 系统 token 的 sub 是 `system-worker`,
 * 身份对不上;让 api 猜"该重推给谁"也不如让 ai-service 自己读库可靠。
 *
 * 极性(全仓最容易搞反的一处,故在此显式钉住)
 * --------------------------------------
 * - 偏好键 `codeIndexEgressOptOut`:**opt-out**,`true` = 用户要求**阻止**代码出域。
 * - ai-service 同意表 `granted`:**opt-in**,`true` = **允许**出域。
 * - 两者极性**相反**。转换只发生在本模块与 `code_index_consent.apply_user_opt_out`
 *   两处,且都写成显式分支,不做 `!value` 之类的隐式取反。
 * - `optedOut=false` 推过去后,ai-service 会**清除该用户的表态**(回到"未表态"),
 *   **不是** `grant()`。理由见 `code_index_consent.apply_user_opt_out` 的 docstring。
 *
 * ⚠ 一个刻意的例外:`isCodeIndexEgressOptedOut()` 返回"用户是否选择了阻止"这个
 * **opt-out 语义**,不返回"是否允许出域"。api 侧没有任何地方拿它去放行什么 ——
 * 它只用于排障日志与测试断言。让它返回 `granted` 语义会制造一个"api 侧也有闸门"的
 * 假象,而真正的闸门在 ai-service。
 */

import type { FastifyRequest } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userPreferences } from '@ihui/database'
import { logger } from '../utils/logger.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

/**
 * 隐私设置分组(与 settings-routes.ts 里 findUserPreferences(userId,'privacy')
 * 的第二个实参同值 —— 那一列在表里叫 `group`,别按 "category" 去找)。
 */
const GROUP_PRIVACY = 'privacy'
/** 隐私设置里的键名(前端 PrivacyPrefs 用的同一个键,opt-out 语义)。 */
const KEY_CODE_INDEX_EGRESS_OPT_OUT = 'codeIndexEgressOptOut'

/** ai-service 同意同步端点(前缀 /api,见 ai-service main.py 的 include_router)。 */
const SYNC_PATH = '/api/code-index-consent/sync'

/** 推送超时(ms)。设置页是用户手动操作,不能因为 ai-service 慢就把它挂住。 */
const PUSH_TIMEOUT_MS = 3000

/**
 * userId → 该用户是否选择了「阻止代码语义索引出发」(opt-out 语义)。
 * **只缓存 true**;false 走"未选择"这一档,不占条目(与 raw-retention-optout 同款,
 * 因为"未选择"是绝大多数用户的常态,缓存它没有信息量)。
 *
 * 这份缓存**不承担"给闸门读"这个职责**(它做不到:闸门在另一个进程),只用于
 * 排障与"我上次推给 ai-service 的是什么"的自查。
 */
const optedOutCache = new Set<string>()

/**
 * 推送结果的可观测计数。**不参与任何判定**。
 *
 * 存在的唯一理由:同意闸在另一个进程,推送失败是"用户以为关了、实际没关"的唯一
 * 故障形态,而它**不会**以异常的形式冒到设置路由的调用方面前(我们刻意不让设置保存
 * 失败,见 setCodeIndexEgressOptOut)。没有这个计数,这类故障就完全不可见。
 */
const pushStats = { attempted: 0, succeeded: 0, failed: 0 }

/** 推送失败时的原因(最近一次),供排障端点/日志读取。 */
let lastPushError: string | null = null

/**
 * 该用户是否已选择「不建代码语义索引」(opt-out 语义,true = 阻止出域)。
 *
 * 纯同步、无 IO。**注意本函数不是闸门**,只用于排障与测试 ——
 * 真正的闸门是 ai-service 的 `code_index_consent.has_consent`。
 * 想知道"代码到底会不会外发",问的是 ai-service,不是这里。
 */
export function isCodeIndexEgressOptedOut(userId: string | null | undefined): boolean {
  if (!userId) return false
  return optedOutCache.has(userId)
}

/** 推送统计快照(只读副本)。供排障端点与测试断言用。 */
export function getConsentSyncStats(): {
  attempted: number
  succeeded: number
  failed: number
  lastError: string | null
} {
  return { ...pushStats, lastError: lastPushError }
}

/**
 * 把一个用户的开关状态推给 ai-service(让它更新自己的同意表)。
 *
 * 身份:透传**该用户自己的 JWT**(`aiServiceFetch` 会自动带 `request` 的
 * Authorization 头),ai-service 侧用 `require_request_user_id` 取 user_id。
 * 因此本函数**必须**拿到 Fastify request —— 拿不到就不能推(系统 token 的
 * sub 是 `system-worker`,与目标用户对不上,推了会被 ai-service 记成别人的决定
 * 或直接 401)。这不是"缺功能",是"宁可不推,不可推错人"。
 *
 * 不抛异常:推送失败**不应该**让"保存隐私设置"整体失败(库里那份才是权威)。
 * 但必须记 error —— 见 pushStats 的注释。
 */
async function pushConsentToAiService(
  request: FastifyRequest | null,
  userId: string,
  optedOut: boolean,
): Promise<boolean> {
  if (!request) {
    // 无 request 上下文(理论上设置路由一定会传):不推,并留下可观测痕迹。
    // 绝不用系统 token 顶替 —— 那会把决定记到 system-worker 名下。
    lastPushError = '缺少 request 上下文,跳过推送(ai-service 需按用户 JWT 归属)'
    pushStats.attempted += 1
    pushStats.failed += 1
    logger.error('[code-index-egress-consent] 缺少 request 上下文,跳过同步', { userId })
    return false
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS)
  pushStats.attempted += 1
  try {
    // 走 aiServiceFetch:它负责透传 Authorization + traceparent,我们不自己拼头
    // (与仓库其它出站调用同一入口,少一处"忘了带 token"的形态)。
    const res = await aiServiceFetch(request, SYNC_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opted_out: optedOut, source: 'user_settings' }),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`ai-service 返回 ${res.status}`)
    }
    pushStats.succeeded += 1
    lastPushError = null
    logger.info('[code-index-egress-consent] 已同步到 ai-service', { userId, optedOut })
    return true
  } catch (e) {
    pushStats.failed += 1
    lastPushError = e instanceof Error ? e.message : String(e)
    // 库里那份仍然是对的,且 ai-service 启动自愈会从库里补回(见
    // code_index_consent.preload_opt_outs_from_db)—— 所以这里不是"数据丢了",
    // 是"闸门在本次推送前不反映用户选择"。这个区别决定了它只是 warn 级的关注点,
    // 但必须留痕:这是"用户以为关了、实际还开着"唯一的可观测点。
    logger.error('[code-index-egress-consent] 同步到 ai-service 失败,闸门暂不反映该选择', {
      userId,
      optedOut,
      err: e as Error,
    })
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 记录/清除某用户的「阻止代码索引出域」选择,并落库 + 推送 ai-service。
 *
 * 这是**唯一**写入口:设置页 `PUT /settings/privacy` 改完立即调它。
 * 不在设置路由里直接 upsertUserPreference,是为了不出现"库改了但闸门没改"的窗口
 * (那个窗口里用户以为自己已关闭,实际还在出域 —— 这类假开关比没有更糟)。
 *
 * 推送失败不抛:调用方(设置路由)不因 ai-service 不可达而让整次保存失败。
 * 依据是"库里那份才是权威,且 ai-service 启动自愈会从库里补回";但失败会被
 * `getConsentSyncStats()` 记录,不是静默的。
 */
export async function setCodeIndexEgressOptOut(
  request: FastifyRequest,
  userId: string,
  optedOut: boolean,
): Promise<void> {
  if (!userId) return
  if (optedOut) optedOutCache.add(userId)
  else optedOutCache.delete(userId)
  try {
    // 复合键 upsert(userId + group + key 唯一):先查后写,不用 onConflictDoUpdate ——
    // 这条路径不在热路径(用户手动改设置),两次查询的代价可以接受,而
    // onConflictDoUpdate 的列名写法更容易出错。与 raw-retention-optout 同款。
    const existing = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(
        and(
          eq(userPreferences.userId, userId),
          eq(userPreferences.group, GROUP_PRIVACY),
          eq(userPreferences.key, KEY_CODE_INDEX_EGRESS_OPT_OUT),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(userPreferences)
        .set({ value: optedOut ? 'true' : 'false' })
        .where(eq(userPreferences.id, existing[0]!.id))
    } else {
      await db.insert(userPreferences).values({
        userId,
        group: GROUP_PRIVACY,
        key: KEY_CODE_INDEX_EGRESS_OPT_OUT,
        value: optedOut ? 'true' : 'false',
      })
    }
  } catch (e) {
    // 落库失败要记 error:这意味着重启后该选择会丢失(推送也白推了),
    // 属于需要人知道的事。不阻断设置操作。
    logger.error('[code-index-egress-consent] 落库失败,重启后该选择将丢失', {
      userId,
      optedOut,
      err: e as Error,
    })
  }
  // 推送放在落库之后:让 ai-service 拿到的永远是"已经记下来的"选择,
  // 而不是一条可能根本没存住的意图。
  await pushConsentToAiService(request, userId, optedOut)
}

/**
 * 启动时预热:把已选择「阻止」的用户读进内存(**仅供排障**,不推 ai-service)。
 *
 * 为什么不再重推 ai-service(与 raw-retention-optout 的关键差异)
 * -----------------------------------------------------------
 * `raw-retention-optout.ts` 的预热必须"重建内存缓存",因为**它的读入口就在本进程**
 * (计费热路径的 `buildRawTextColumns`)。本模块的读入口在 **ai-service**,api 侧的
 * 缓存对它**没有任何性能意义** —— 预热重建它不会让闸门快一分。
 *
 * 闸门状态的启动自愈由 **ai-service 自己的 lifespan** 负责:直读 `user_preferences`
 * 把已 opt-out 的用户重新登记(`code_index_consent.preload_opt_outs_from_db`)。
 * 为什么不由本模块推:启动期没有"某个用户"的 JWT 可用(系统 token 的 sub 是
 * `system-worker`,身份对不上),让 api 猜"该重推给谁"也不如让 ai-service 自己读库可靠。
 *
 * 那本模块为什么还留这个 preload?因为它让 `isCodeIndexEgressOptedOut()` 在进程
 * 刚起来时就是**对的** —— 否则排障时它对每个用户都返回 false,会把"没预热"
 * 误读成"这些用户没选阻止"。它服务的是**可观测性**,不是闸门。
 *
 * 幂等:可重复调用。读库失败不抛 —— 预热失败只是让排障视图不完整,不该让服务起不来。
 */
export async function preloadCodeIndexEgressOptOuts(): Promise<void> {
  try {
    const rows = await db
      .select({ userId: userPreferences.userId, value: userPreferences.value })
      .from(userPreferences)
      .where(
        and(
          eq(userPreferences.group, GROUP_PRIVACY),
          eq(userPreferences.key, KEY_CODE_INDEX_EGRESS_OPT_OUT),
        ),
      )
    optedOutCache.clear()
    for (const r of rows) {
      const row = r as { userId?: string; value?: string | null }
      if (!row.userId) continue
      // 只认字面量 "true"(与全仓其它布尔开关同一口径)
      if (row.value === 'true') optedOutCache.add(row.userId)
    }
    logger.info('[code-index-egress-consent] 预热完成(仅排障视图,闸门自愈在 ai-service)', {
      count: optedOutCache.size,
    })
  } catch (e) {
    logger.error('[code-index-egress-consent] 预热失败,排障视图将不完整(不影响闸门)', {
      err: e as Error,
    })
  }
}

/** 仅测试用:清空缓存与统计。 */
export function resetCodeIndexEgressCacheForTests(): void {
  optedOutCache.clear()
  pushStats.attempted = 0
  pushStats.succeeded = 0
  pushStats.failed = 0
  lastPushError = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

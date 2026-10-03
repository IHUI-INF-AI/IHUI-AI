// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「数据不留存」用户选择的内存缓存(2026-10-03 数据出域合规整改立)。
 *
 * 为什么需要它
 * ------------
 * `buildRawTextColumns` 决定"这一行 LLM 调用记录是否落 prompt/response 原文",
 * 它在**计费热路径**上,每笔模型调用都会走一次。要在这里判"该用户是否已选择
 * 不留存",最自然的做法是查 DB —— 但那会给每次计费加一次查询,而且这条路径
 * 出错会直接影响计费(比"多存了原文"严重得多)。故用内存缓存承载这个判断。
 *
 * 缓存为什么不会"读到脏值"
 * ----------------------
 * 只有一个写入口(`setRawRetentionOptOut`),且它同时做两件事:更新内存 + 落库。
 * 二者都在同一个函数里完成,不存在"库已改而内存未改"的中间态;进程重启后
 * `preloadRawRetentionOptOuts()` 从库里一次性重建,重建前的读一律按
 * **默认保留原文**(fail-safe 方向的选择见下)。
 *
 * 为什么"重启重建前"选默认保留而不是默认不留存
 * ---------------------------------------------
 * 两个方向都有代价:默认保留 = 用户的选择在重启窗口内没生效(多留了几天原文);
 * 默认不留存 = 计费/排障侧突然没有原文可看,且行为会随重启**跳变**。
 * 选前者,因为:(1) 它是现状行为,不会引入新的意外;(2) 重建是启动时一次性动作,
 * 窗口以秒计;(3) 反方向的"行为跳变"会让计费对账出现无法解释的空洞,那是更贵的
 * 故障。**关键是这个方向与本仓其他 fail-closed 闸门相反,故在此显式留档** ——
 * 免得下一个来"统一口径"的人把它改反。
 *
 * 未在本模块出现的用户 = 未选择 = 按默认留存。这与"用户未表态"是一致的。
 */

import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userPreferences } from '@ihui/database'
import { logger } from '../utils/logger.js'

/**
 * 隐私设置分组(与 settings-routes.ts 里 findUserPreferences(request.userId,'privacy')
 * 的第二个实参同值 —— 那一列在表里叫 `group`,别按"category"去找)。
 */
const GROUP_PRIVACY = 'privacy'
/** 隐私设置里的键名(前端 PrivacyPrefs 用的同一个键)。 */
const KEY_RAW_RETENTION_OPT_OUT = 'llmRawRetentionOptOut'

/** userId → 是否选择"不留存 LLM 调用原文"。只缓存 true,false 走缺省不存。 */
const optOutCache = new Set<string>()
let preloaded = false

/**
 * 该用户是否已选择"不落 LLM 调用原文"。
 *
 * 未预加载完成(preload 未跑)时一律返回 false(=按默认留存),理由见文件头。
 * 纯同步、无 IO —— 它在计费热路径上,不能等 DB。
 */
export function isRawRetentionOptedOut(userId: string | null | undefined): boolean {
  if (!userId) return false
  if (!preloaded) {
    // 预热未完成时,宁可按现状行为(留存)也不阻塞计费;preload 会在启动时补齐。
    return false
  }
  return optOutCache.has(userId)
}

/**
 * 记录/清除某用户的"不留存原文"选择,并落库。
 *
 * 这是**唯一**写入口:设置页 PUT /settings/privacy 改完立即调它,保证
 * "库与内存一致"。不在设置路由里直接 upsertUserPreference,是为了不出现
 * "库改了但内存没改"的窗口(那个窗口里用户以为自己已关闭,实际还在留存)。
 */
export async function setRawRetentionOptOut(
  userId: string,
  optedOut: boolean,
): Promise<void> {
  if (!userId) return
  if (optedOut) optOutCache.add(userId)
  else optOutCache.delete(userId)
  // 标记为已预热:即便 preload 因故失败,单用户的显式操作也应立即生效
  preloaded = true
  try {
    // 复合键 upsert(userId + group + key 唯一):先查后写,不用 onConflictDoUpdate ——
    // 这条路径不在热路径(用户手动改设置),两次查询的代价可以接受,而
    // onConflictDoUpdate 的列名写法更容易出错。
    const existing = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(
        and(
          eq(userPreferences.userId, userId),
          eq(userPreferences.group, GROUP_PRIVACY),
          eq(userPreferences.key, KEY_RAW_RETENTION_OPT_OUT),
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
        key: KEY_RAW_RETENTION_OPT_OUT,
        value: optedOut ? 'true' : 'false',
      })
    }
  } catch (e) {
    // 落库失败不阻断设置操作(内存已生效,本进程内行为正确);但必须记 error ——
    // 这意味着重启后该选择会丢失,属于需要人知道的事。
    logger.error('[raw-retention-optout] 落库失败,重启后该选择将丢失', {
      userId,
      optedOut,
      err: e as Error,
    })  }
}

/**
 * 启动时预热:把已选择"不留存"的用户读进内存。
 *
 * 幂等:可重复调用(测试里反复调用很方便)。读库失败时不抛 —— 预热失败只是
 * 让所有用户暂时按"默认留存"处理,不该让服务起不来。
 */
export async function preloadRawRetentionOptOuts(): Promise<void> {
  try {
    const rows = await db
      .select({ userId: userPreferences.userId, value: userPreferences.value })
      .from(userPreferences)
      .where(eq(userPreferences.group, GROUP_PRIVACY))
    optOutCache.clear()
    for (const r of rows) {
      const row = r as { userId?: string; value?: string | null }
      if (!row.userId) continue
      // 只认字面量 "true"(与全仓其它布尔开关同一口径)
      if (row.value === 'true') optOutCache.add(row.userId)
    }
    preloaded = true
    logger.info('[raw-retention-optout] 预热完成', { count: optOutCache.size })
  } catch (e) {
    preloaded = true // 标记完成:否则每次调用都重走这里
    logger.error('[raw-retention-optout] 预热失败,本进程按默认留存处理', {
      err: e as Error,
    })
  }
}

/** 仅测试用:清空缓存与预热标记。 */
export function resetRawRetentionOptOutCacheForTests(): void {
  optOutCache.clear()
  preloaded = false
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

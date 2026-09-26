// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 连接注册表的迟到回调安全出口(2026-09-26 竞态根治票)。
 *
 * 故障型:同一 key 的旧连接被新连接顶替(重连)后,旧连接**天然迟到**的
 * close/error/清理回调如果按 key 去删,就会把替代品从表里拆掉 ——
 * 表现为"明明连上了却收不到推送",且不报错。
 *
 * 本模块把"按 key 收尾"的三条件收敛为结构保证:
 *  ① 删除必须按**对象身份**(removeIfSame / removeIfDead),key 下的值不是"我"就不动;
 *  ② key 仅在其值集**变空的同一次操作里**才被摘除(空集 ⇒ 结构上不存在替代品);
 *  ③ 按 userId 共享的窗口(速率桶)只在该用户在本插件**最后一条**连接释放后才清
 *     (releaseUserConnectionSlots),迟到回调不得假设"这个 key 现在还是我"。
 *
 * 如实登记:ws-chat / ws-tasks 的连接表是 Map<key, Set<conn>>(多路复用,
 * 同 key 不互相替换),所以本模块**不提供 replace()** —— 那里没有替换语义,
 * 造一个没有调用方的 replace() 就是为产物而产物。真正的暴露面是上述 ①③。
 */

/** 按对象身份从 table[key] 的值集里移除 value;仅当移除真的发生且集合变空时摘 key。
 *  @returns 是否移除了一个成员(false = 该身份不在表里,迟到回调不是我的账,不动 key) */
export function removeIfSame<K, V>(table: Map<K, Set<V>>, key: K, value: V): boolean {
  const values = table.get(key)
  if (!values || !values.has(value)) return false
  values.delete(value)
  if (values.size === 0) table.delete(key)
  return true
}

/**
 * 只移除被判为"死"的值(僵尸 socket 兜底清理用),key 下任何活值都不得被带走;
 * 值集变空才摘 key。谓词自身抛错时:此前已移除的照常生效、key 不受影响 ——
 * 本函数不存在"整 key 删除"的代码路径,判据失败不会升级成拆替代品。
 * @returns 实际移除的成员数
 */
export function removeIfDead<K, V>(
  table: Map<K, Set<V>>,
  key: K,
  valueIsDead: (value: V) => boolean,
): number {
  const values = table.get(key)
  if (!values) return 0
  let removed = 0
  for (const v of Array.from(values)) {
    if (valueIsDead(v)) {
      values.delete(v)
      removed++
    }
  }
  if (values.size === 0) table.delete(key)
  return removed
}

/** 与 WsUserConnectionLimiter 的用法面结构兼容(不 import 插件层,避免反向依赖) */
export interface UserConnectionCounter {
  release(userId: string): void
  currentCount(userId: string): number
}
/** 与 WsRateLimiter 的用法面结构兼容 */
export interface UserRateWindow {
  reset(key: string): void
}

/**
 * 连接关闭时对"按 userId 共享的两份状态"做安全收尾:
 * 先释放本连接的槽位,再**仅当**该用户已无活跃连接时才清速率窗口。
 * 旧形态是无条件 `rateLimiter.reset(userId)`:旧连接迟到的 close 会把重连后的
 * 新连接正在累积的滑动窗口整桶抹掉(防洪限流退化为"断线重连即重置")。
 * @returns 是否清除了速率窗口
 */
export function releaseUserConnectionSlots(deps: {
  limiter: UserConnectionCounter
  rateLimiter: UserRateWindow
  userId: string
}): boolean {
  deps.limiter.release(deps.userId)
  if (deps.limiter.currentCount(deps.userId) === 0) {
    deps.rateLimiter.reset(deps.userId)
    return true
  }
  return false
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 唯一的批量写结果出口:affected 必须由库确认的集合(update ... returning / 归属预查询命中集)
// 推出,不得由请求侧自算 —— 否则"改了 0 行"与"改成功"返回完全同形,是静默失真。
// 三处批量写(role authUser cancelAll/selectAll、demand-square batch-review、
// chat conversations batch)一律走这里,missedIds 逐条点名未命中的 id;各写各的必然漂移。

/** 去空白(仅字符串)/ 去重,保留输入顺序。 */
export function dedupeIds<T extends string | number>(ids: readonly T[]): T[] {
  const seen = new Set<T>()
  const out: T[] = []
  for (const id of ids) {
    if (typeof id === 'string' && id.trim() === '') continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

// G-815986(2026-09-30 立):**空集合参数必须在任何 IO 之前拒绝**,不能"空着也往下走"。
//
// 上游同族事故的写法是"空 Set ⇒ filter 保留全部并静默成功",调用方无法区分
// 「撤销全部」与「没有目标」(出处 `adapters/src/storage/workspace-hook-trust-store.ts:209-216`)。
// 我方这条链上的实际形态不同,但病是同一个:实测 drizzle 0.45 把 `inArray(col, [])` 渲染成
// 合法 SQL 里的 `false`(不是 `in ()`,所以不报错),于是"一个 id 都没解析出来"的请求
// 仍然发出一条命中 0 行的 DELETE,并回 `deleted: 0` —— 与"确实有目标、目标不存在"在账面上同形,
// 而且为一次根本不该发生的写付了一次 round-trip。
//
// 所以拒绝点只有这一处,且**必须**在调用方拿它之前不发生任何 DB/网络/文件 IO:
// 它是纯函数(不 import 任何存储层),这一条不是风格问题 —— 判"有没有先拒"的唯一办法是
// 让它结构上不可能先查(与守门 134 的"计数要取库确认集"是同一条纪律的另一半)。
//
// 与守门 134 的分工:134 判**计数诚实性**(affected 不得由请求侧自算),本段判
// **空入参静默成功**。互补不重叠:134 不会因为 requested 为空而喊红。

/** 空目标的机器可读码:调用方回 400 时带上它,前端才不必去比中文措辞。 */
export const EMPTY_BATCH_TARGET_CODE = 'EMPTY_BATCH_TARGET'

export type BatchTargetGuard<T extends string | number> =
  | { readonly ok: true; readonly ids: T[] }
  | { readonly ok: false; readonly code: string; readonly message: string }

/**
 * 批量写的入站闸:先把 id 集归一(去空白 + 去重,复用 `dedupeIds`,不得再抄一份),
 * 归一后为空 ⇒ **拒绝**,并给出机器可读的 code 与点名参数的措辞。
 *
 * 为什么不让它"回一个空结果"而是"拒绝":票面两条出路都合法("空 id 集必须显式回
 * requestedIds: [], affected: 0(或直接拒)"),但**路由侧回 200 会让"什么都没做"读起来像
 * "做完了"**;而 400 + `EMPTY_BATCH_TARGET` 是唯一能把"没有目标"说出口的形状。
 * 需要走"显式回空结果"那条出路的调用方,自己拿 `ok:false` 分支去构造即可,判据仍在这一个出口上。
 *
 * @param requested 请求侧原始 id 数组(未去重、未去空白)
 * @param field 参数名,只用于措辞(不参与判定)
 */
export function guardBatchTargets<T extends string | number>(
  requested: readonly T[],
  field: string,
): BatchTargetGuard<T> {
  const ids = dedupeIds(requested)
  if (ids.length === 0) {
    return {
      ok: false,
      code: EMPTY_BATCH_TARGET_CODE,
      message: `${field} 归一后为空:本次没有任何目标,拒绝发起批量写(与"有目标但一条都没命中"是两件事)`,
    }
  }
  return { ok: true, ids }
}

export interface BatchWriteOutcome<T extends string | number> {
  readonly requestedIds: T[]
  readonly affected: number
  readonly missedIds: T[]
}

/** requested 先去重;affected = 去重后 requested 中被 confirmed 命中的个数;missedIds = 未命中(保留顺序)。 */
export function batchWriteOutcome<T extends string | number>(
  requested: readonly T[],
  confirmed: Iterable<T>,
): BatchWriteOutcome<T> {
  const requestedIds = dedupeIds(requested)
  // 空 requested ⇒ 直接给出显式空结果,**不去消费 confirmed**。
  // 今天所有调用方传的都是数组,少这一步行为完全相同;留这一格是因为 confirmed 的
  // 类型是 `Iterable` —— 一旦有人把"待迭代的库侧游标/懒生成器"接进来,这里就会为一次
  // 根本没有目标的请求真去把数据拉完。判据不许靠"调用方恰好传的是数组"这种巧合成立。
  if (requestedIds.length === 0) {
    return { requestedIds, affected: 0, missedIds: [] }
  }
  const confirmedSet = new Set(confirmed)
  const missedIds: T[] = []
  let affected = 0
  for (const id of requestedIds) {
    if (confirmedSet.has(id)) affected += 1
    else missedIds.push(id)
  }
  return { requestedIds, affected, missedIds }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-704(2026-09-29 立)「值等价即不写」所用的等深比较器 —— 全仓唯一实现。
 *
 * 为什么需要它:高频 SSE 写入位(如 `apps/web/src/hooks/use-chat/send-message.ts` 每 800ms
 * 写一次的 `meta.usage`、done 事件写的 memoryUpdates)每帧都**新造**一个对象交给 store,store
 * 于是无条件产出新 state;订阅它的 effect 再回写 store ⇒ store→effect→set→store 自环 + 重渲染
 * 风暴(即票面说的"回声写")。修法只有一条:写入前先比值,等价就**连对象都不重建**直接返回原
 * state。而"比值"这件事必须由**一处**实现负责(AGENTS §3 共享层优先;本仓记过多次"两处算同一
 * 件事必漂移"),端内不得各写一份 `JSON.stringify(a) === JSON.stringify(b)` 之类的近似品。
 *
 * 语义边界 —— 失效方向一律取"保守 ⇒ 判不等 ⇒ 照写",绝不把"判不出"写成"等价":
 *  - 原始类型走 `Object.is`:NaN 与 NaN 算等价(否则每帧 NaN 都会重写),不做自造规则。
 *  - 数组:长度 + 逐元素,**顺序敏感**(顺序不同即不等 ⇒ 照写,绝不把"换了序"当成"没变")。
 *  - 纯对象(原型为 `Object.prototype` 或 `null`):键集合 + 逐值,**键序无关**。
 *  - Date / Map / Set / 类实例 / 函数 / 符号:只按引用比,引用不同即判不等。
 *    本域实际载荷(meta.usage、notices.items)都是 SSE 派生的 JSON 形状,不落这一档;真落进来
 *    时的表现是"少省一次写",而不是"漏一次写"—— 这是刻意选择的失效方向(漏写=数据不落地)。
 *  - 超深(> `MAX_RECORD_COMPARE_DEPTH`)判不等:同理,栈溢出与"把没判写成判过了"都比省一次写贵。
 */

/** 递归深度上限:超过即判不等。meta/notices 的真实形状都在个位数层,取 64 是"绝不误判等价"的余量。 */
export const MAX_RECORD_COMPARE_DEPTH = 64

/** 是否为可按键对账的纯对象(排除数组、Date、Map/Set、类实例、null)。 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

function equalValues(a: unknown, b: unknown, depth: number): boolean {
  // 同引用 / 同原始值(NaN 与 NaN 由 Object.is 认等价)
  if (Object.is(a, b)) return true
  if (depth > MAX_RECORD_COMPARE_DEPTH) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    const xs: readonly unknown[] = a
    const ys: readonly unknown[] = b
    if (xs.length !== ys.length) return false
    return xs.every((item, i) => equalValues(item, ys[i], depth + 1))
  }
  // 一侧是数组而另一侧不是 ⇒ 形状不同(不猜"数组当对象比")
  if (Array.isArray(a) || Array.isArray(b)) return false

  if (!isPlainRecord(a) || !isPlainRecord(b)) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && equalValues(a[key], b[key], depth + 1),
  )
}

/**
 * 两个记录形状的值是否**逐字段等深**相等(键序无关,值顺序敏感)。
 *
 * 用途:写入 store 前先问这一句,返回 true 时调用方必须**原样返回旧 state**(不重建对象、
 * 不产生新引用),否则订阅侧照样收到一次变更 —— 那才是本函数存在的全部理由。
 */
export function areRecordValuesEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  return equalValues(a, b, 0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * canonical JSON 序列化的**唯一实现**(86F 第②半,2026-09-28 立)。
 *
 * 立因:此前 `apps/api/src/services/audit-log-service.ts`(HMAC 链哈希输入)与
 * `apps/api/src/services/siem-exporter.ts`(导出签名载荷)各藏一份私有
 * `canonicalStringify`,行为在 JSON 值域上逐字节等价、仅在 JSON 域外分支
 * (`undefined` 输入)分叉 —— 两处实现必漂移是本仓记过最多次的失败型,86F 票面
 * 判据点名"生产面声明处 ≤1"。本层收口成一份,两处改 import;反向锁由
 * `apps/api/tests/canonical-single-source.test.ts` 钉死。
 *
 * **JSON 域内行为 = 原 audit-log-service 私有版逐字节**(链上存量 current_hash
 * 全部由那一版算出,域内不变即不断链)。
 * **JSON 域外分支已按 DBG-24/DBG-20129(2026-11-11)修正**:原实现对 Date 落
 * `"{}"`、对 undefined 返回 primitive undefined(类型撒谎 ⇒ `Buffer.from(undefined)`
 * 崩溃)、循环引用无限递归栈溢出 —— 作为 HMAC 审计链/SIEM 签名单源缺防御。
 * 两消费面真实输入(链 8 字段数组、导出信封)均来自 PG/JSONB 读出值,JSON 域内
 * 不存在这些形态,故修正不触碰存量哈希。新契约见函数 JSDoc。
 */

/**
 * 递归排序对象 key 的 JSON 序列化,保证同一逻辑值在任意 key 顺序下得到同一串。
 *
 * 契约(DBG-24/DBG-20129 收口,对任意 unknown 输入防御):
 * - null / number / boolean / string ⇒ `JSON.stringify` 逐字(含 NaN/Infinity→'null');
 * - 数组 ⇒ 保序逐项递归;成员 undefined/function/Symbol ⇒ `null`(同 JSON.stringify);
 * - 对象 ⇒ key 升序、逐项递归;值为 undefined/function/Symbol 的成员整键丢弃
 *   (同 JSON.stringify);
 * - Date(及任何带 `toJSON` 的对象)⇒ 同 JSON.stringify(toJSON → ISO 串),不再落 `"{}"`;
 * - 顶层 undefined/function/Symbol ⇒ `'null'`(JSON.stringify 此时返回非字符串,
 *   本函数契约恒为 string,故以 'null' 兜底);
 * - BigInt ⇒ 十进制字符串表示(JSON.stringify 直接抛 TypeError,单源出口须防御);
 * - 循环引用 ⇒ 抛受控 `TypeError`(替代原先的无限递归栈溢出)。
 */
export function canonicalStringify(value: unknown): string {
  return canonicalize(value, new Set<object>())
}

function canonicalize(value: unknown, path: Set<object>): string {
  if (value === null) return 'null'
  const t = typeof value
  if (t === 'undefined' || t === 'function' || t === 'symbol') return 'null'
  if (t === 'bigint') return JSON.stringify(String(value))
  if (t !== 'object') return JSON.stringify(value)
  const obj = value as object
  if (path.has(obj)) {
    throw new TypeError('canonicalStringify: 检测到循环引用,无法规范化序列化')
  }
  path.add(obj)
  try {
    if (typeof (obj as { toJSON?: unknown }).toJSON === 'function') return JSON.stringify(obj)
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => canonicalize(item, path)).join(',') + ']'
    }
    const record = obj as Record<string, unknown>
    const keys = Object.keys(record)
      .sort()
      .filter((k) => {
        const v = record[k]
        const vt = typeof v
        return v !== undefined && vt !== 'function' && vt !== 'symbol'
      })
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(record[k], path)).join(',') + '}'
  } finally {
    path.delete(obj)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

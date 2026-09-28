// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
 * **行为 = 原 audit-log-service 私有版逐字,不是"更正确"的版本**:
 * 链上存量行的 current_hash 全部由那一版算出,合一若顺手"修"任何分支
 * (如把 `undefined` 归成 `'null'`),重算哈希即与存量断裂 —— 那是行为变更,
 * 与"两处并一处"是两件事,后者需要独立的迁移判据,不在本票。
 * `undefined` 分支返回 `JSON.stringify(undefined)`(JS undefined 而非字符串)
 * 是原版的既有形态:实际两消费面(链哈希 8 字段数组、导出信封)的输入都来自
 * PG/JSONB 读出值,JSON 域内不存在 `undefined`,该分支不可达 —— 如实保留,
 * 不静默修正,也不据"不可达"把它当已修。
 */

/**
 * 递归排序对象 key 的 JSON 序列化,保证同一逻辑值在任意 key 顺序下得到同一串。
 *
 * - 非对象(null / number / boolean / string)⇒ `JSON.stringify`;
 * - 数组 ⇒ 保序逐项递归;
 * - 对象 ⇒ key 升序、逐项递归(嵌套对象同样排序)。
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}'
}

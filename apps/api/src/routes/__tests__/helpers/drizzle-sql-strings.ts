// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 夹具正确性修复(2026-11-08):drizzle 的 `sql` 模板把插值**裸放**进
 * SQL.queryChunks(见 drizzle-orm/sql/sql.js:`queryChunks.push(param2, ...)`),
 * 而不是包成 Param。旧版夹具只从对象的 `.value` 取参数,对裸字符串插值恒取到
 * 0 个参数 —— 于是"SQL 到底绑的是哪个 userId"这类断言会变成假绿/假红。
 * 本工具收齐三种形态:裸字符串、StringChunk.value 数组、对象上的 .value。
 * 仅测试用,不参与生产代码;与业务断言无关,不是为了让某条断言变绿。
 */

export function collectSqlStringValues(node: unknown, out: string[] = [], depth = 0): string[] {
  if (typeof node === 'string') {
    out.push(node)
    return out
  }
  if (depth > 6 || node === null || typeof node !== 'object') return out
  const record = node as Record<string, unknown>
  if (typeof record.value === 'string') out.push(record.value)
  for (const value of Object.values(record)) collectSqlStringValues(value, out, depth + 1)
  return out
}

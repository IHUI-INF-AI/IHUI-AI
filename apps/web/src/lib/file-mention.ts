// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 行内文件名引用解析(2026-11-14 立,对标 DSH dsh-client-ui-deliverables 的
 * `producedFileMentions`)。
 *
 * DSH 的判据是「事实优先、歧义即惰性」:
 * - 只在本轮真实产出/交付过的路径里解析,不按后缀或 cwd 猜;
 * - 精确路径命中,或 basename 唯一命中,才算可点;
 * - 同一 basename 命中多个目标 ⇒ 不可点;未知 token ⇒ 不可点。
 *
 * 这里刻意保持纯函数(无 React、无 store、无 IO),让单测能锁住歧义与路径归一。
 */

export interface FileMentionTarget {
  /** 原始路径(用于打开文件与 title),保留首次出现的写法 */
  path: string
  /** 展示标签:文件名 */
  label: string
}

/** 路径末段;正反斜杠都吃。 */
export function fileMentionBasename(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx === -1 ? norm : norm.slice(idx + 1)
}

/**
 * 在给定路径集合里解析一个行内 code 值。
 *
 * @param value 行内 code 的文本(模型写的路径或文件名)
 * @param paths 本轮产出/交付路径(可重复、可含正反斜杠)
 * @returns 唯一命中时返回目标;空值、未知、歧义一律 undefined
 */
export function resolveFileMention(
  value: string,
  paths: readonly string[],
): FileMentionTarget | undefined {
  const needle = value.replace(/\\/g, '/').trim()
  if (!needle) return undefined

  // 线性去重:第一次出现的写法即 canonical(与 DSH 的 first-seen order 一致)。
  const unique = new Map<string, string>()
  for (const raw of paths) {
    const path = raw.trim()
    if (!path) continue
    const key = path.replace(/\\/g, '/')
    if (!unique.has(key)) unique.set(key, path)
  }

  const matches = new Set<string>()
  for (const [key, path] of unique) {
    if (key === needle || fileMentionBasename(key) === needle) matches.add(path)
  }
  if (matches.size !== 1) return undefined

  const path = matches.values().next().value as string
  return { path, label: fileMentionBasename(path) }
}

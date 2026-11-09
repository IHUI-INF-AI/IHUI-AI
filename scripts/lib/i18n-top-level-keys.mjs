// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语言包顶层键的「只差大小写」冲突扫描(纯函数,无 IO)。
 *
 * 为什么单独一层:JSON.parse 之后 `checkIn` 与 `checkin` 是**两个不同的键**,都能正常
 * 取到值,所以重复键门与 parity 门都不会响;但人的记忆分不清大小写,`t('checkin.x')`
 * 写错一个字母就会在 UI 上回显裸键名。这类冲突必须按**字节级原文**判(顶层键的位置
 * 也来自原文,便于指名到行),与 check-i18n-keys 的「同层重复 key」同一判定面。
 *
 * 只扫**顶层**:`businessCard.title` 与 `businesscard.foo` 属于不同命名空间,才是
 * 真正会「取错文案」的那一层;嵌套层的键有父命名空间限定,冲突不会跨命名空间串味。
 */

/** 顶层键:语言包固定 2 空格缩进,嵌套层至少 4 空格。 */
const TOP_LEVEL_KEY_RE = /^ {2}"((?:\\.|[^"\\])*)"\s*:/u

function decodeKey(raw) {
  try {
    return JSON.parse(`"${raw}"`)
  } catch {
    return raw
  }
}

/**
 * 从语言包原文里列出顶层键及其行号(1 基)。
 * @param {string} text
 * @returns {Array<{ key: string, line: number }>}
 */
export function listTopLevelKeys(text) {
  const out = []
  const lines = text.split(/\r?\n/u)
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TOP_LEVEL_KEY_RE)
    if (m) out.push({ key: decodeKey(m[1]), line: i + 1 })
  }
  return out
}

/**
 * 把「只差大小写」的顶层键分组。
 * @param {Array<{ key: string, line: number }>} entries
 * @returns {Array<{ lower: string, keys: Array<{ key: string, line: number }> }>}
 */
export function findCaseConflicts(entries) {
  const byLower = new Map()
  for (const entry of entries) {
    const lower = entry.key.toLowerCase()
    if (!byLower.has(lower)) byLower.set(lower, [])
    byLower.get(lower).push(entry)
  }
  const conflicts = []
  for (const [lower, keys] of byLower) {
    // 完全同名(同一大小写)由「同层重复 key」门负责,这里只报大小写差异。
    if (keys.length < 2) continue
    if (new Set(keys.map((k) => k.key)).size < keys.length) continue
    conflicts.push({ lower, keys })
  }
  return conflicts
}

/**
 * 一步到位:语言包原文 → 大小写冲突列表。
 * @param {string} text
 */
export function findCaseConflictsInText(text) {
  return findCaseConflicts(listTopLevelKeys(text))
}

/** 冲突的可读描述(门与测试共用,避免两处措辞漂移)。 */
export function describeCaseConflict(conflict) {
  return conflict.keys.map((k) => `"${k.key}"@L${k.line}`).join(' / ')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

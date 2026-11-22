// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 附属原生运行时的版本选择。
 *
 * 按平台各有一份清单，每条含版本、最低应用版本、下载地址、哈希、大小、发布时间。
 * 选不中必须具名说明为什么，不得回退成「没有更新」或「用第一条」：
 * 平台键缺失、条目读不出来、应用版本比不出来，都是未判定。
 */

const VERSION_SEGMENT = '(0|[1-9]\\d{0,15})'
const VERSION_RE = new RegExp(`^${VERSION_SEGMENT}\\.${VERSION_SEGMENT}\\.${VERSION_SEGMENT}$`)
const SHA256_RE = /^[0-9a-f]{64}$/

function fail(reason) {
  return { ok: false, reason, pick: null }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** 三段非负整数。前导零、缺段、多段都比不出来，返回 null。 */
function parseVersion(value) {
  if (typeof value !== 'string') return null
  const match = VERSION_RE.exec(value)
  if (!match) return null
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (parts.some((part) => !Number.isSafeInteger(part))) return null
  return parts
}

/** 负数 = a 更旧，0 = 相同，正数 = a 更新。调用方必须先 parseVersion。 */
function compareVersion(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

function parsePublishedAt(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

function isSize(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isHttpsUrl(value) {
  return typeof value === 'string' && value.startsWith('https://')
}

/**
 * 读一条清单。任一字段不合法就整条作废（跳过），不把缺字段补成默认值。
 * @returns {{ row: object, version: number[], minAppVersion: number[], publishedAt: number } | null}
 */
function readRow(row) {
  if (!isPlainObject(row)) return null
  const version = parseVersion(row.version)
  const minAppVersion = parseVersion(row.minAppVersion)
  const publishedAt = parsePublishedAt(row.publishedAt)
  if (!version || !minAppVersion || publishedAt === null) return null
  if (!isHttpsUrl(row.url)) return null
  if (typeof row.sha256 !== 'string' || !SHA256_RE.test(row.sha256)) return null
  if (!isSize(row.size)) return null
  return { row, version, minAppVersion, publishedAt }
}

/**
 * @param {unknown} feed
 * @param {string} osArch
 * @param {string} appVersion
 * @returns {{ ok: true, reason: 'selected', pick: object } | { ok: false, reason: string, pick: null }}
 */
export function selectRuntime(feed, osArch, appVersion) {
  if (!isPlainObject(feed) || !isPlainObject(feed.platforms)) return fail('feed-unmeasured')
  if (!Object.hasOwn(feed.platforms, osArch)) return fail('platform-absent')

  const list = feed.platforms[osArch]
  if (!Array.isArray(list)) return fail('rows-unreadable')
  if (list.length === 0) return fail('platform-empty')

  const readable = []
  for (const item of list) {
    const parsed = readRow(item)
    if (parsed) readable.push(parsed)
  }
  if (readable.length === 0) return fail('rows-unreadable')

  const app = parseVersion(appVersion)
  if (!app) return fail('version-unmeasured')

  const compatible = readable.filter((entry) => compareVersion(entry.minAppVersion, app) <= 0)
  if (compatible.length === 0) return fail('none-compatible')

  let best = compatible[0]
  for (let i = 1; i < compatible.length; i++) {
    const current = compatible[i]
    const later = current.publishedAt > best.publishedAt
    const sameTimeNewer =
      current.publishedAt === best.publishedAt && compareVersion(current.version, best.version) > 0
    if (later || sameTimeNewer) best = current
  }

  return { ok: true, reason: 'selected', pick: { ...best.row } }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

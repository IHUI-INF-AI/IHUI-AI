// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 应用更新检测判据层(2026-11-17 立,对标 qoder2api-hub 的 `GET /update/check`)。
 *
 * 对照程序是自更新的开源单进程,所以它把「本机版本 vs GitHub 最新 release」做成端点,
 * 看板据此亮「有新版本」徽标。本仓此前只有公告表的版本号(那是**内容**版本,
 * 不是**程序**版本),缺的正是这一层。
 *
 * 三条纪律:
 * - **取不到 ≠ 最新**。任何失败(repo 未配、网络不通、无 release、解析失败)一律
 *   `has_update = null` + `reason` 点名,绝不返回 false 冒充「已经是最新」。
 * - **比较是纯判据**,不碰网络:版本串归一后逐段数值比较,`v` 前缀/多余空格不影响结论。
 * - **预发布不参与升级提示**:GitHub 的 `prerelease`/`draft` 不算「最新 release」,
 *   否则每次预发布都会让全体用户看到升级提示。
 */

/** 检测结果(对外 JSON 用 snake_case,与 /v1 其余面同风格)。 */
export interface UpdateCheckResult {
  /** 是否成功判定了「有没有更新」;false 时 has_update 必为 null */
  determined: boolean
  current: string
  latest: string | null
  has_update: boolean | null
  release_url: string | null
  release_name: string | null
  checked_at: string
  /** 未判定原因(取不到远端/无 release/版本非法);判定成功时省略 */
  reason?: string
}

/** 版本串归一:去空白与 `v`/`V` 前缀;空串返回 ''。 */
export function normalizeVersion(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/^[vV]/, '').trim()
}

/**
 * 版本比较(纯判据)。返回 1 / 0 / -1;任一侧非法(空串、全非数字段)返回 null。
 *
 * 逐段按数值比,段数不等时缺段按 0 补(`1.2` 与 `1.2.0` 相等)。
 * 段内非纯数字(如 `1.2.3-beta.1`)只取数字前缀(`3`),后缀视为不重要 ——
 * 与对照「只判主版本是否更新」的用途一致。
 */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseVersionParts(normalizeVersion(a))
  const pb = parseVersionParts(normalizeVersion(b))
  if (!pa || !pb) return null
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va > vb) return 1
    if (va < vb) return -1
  }
  return 0
}

/** 解析成数字段;先切掉 `-prerelease` / `+build` 后缀。首段不可解析 ⇒ null。 */
function parseVersionParts(v: string): number[] | null {
  const core = (v.split(/[-+]/)[0] ?? '').trim()
  if (!core) return null
  const segs = core.split('.')
  const nums: number[] = []
  for (const seg of segs) {
    const m = /^[0-9]+/.exec(seg.trim())
    if (!m) return null
    nums.push(Number(m[0]))
  }
  return nums.length > 0 ? nums : null
}

/** GitHub release 的最小形状(只取判据需要的字段)。 */
export interface ReleaseLike {
  tag_name?: unknown
  html_url?: unknown
  name?: unknown
  draft?: unknown
  prerelease?: unknown
}

/**
 * 由「当前版本 + GitHub release 对象」判定更新结论(纯判据,零 IO)。
 *
 * `release` 传 null 表示「远端没有可用 release」—— 与「取不到」同属未判定,
 * 因为本仓确实可能一个 release 都没发;此时不能告诉用户「已是最新」。
 */
export function decideUpdate(
  currentRaw: string,
  release: ReleaseLike | null,
  at: Date = new Date(),
): UpdateCheckResult {
  const current = normalizeVersion(currentRaw)
  const base: UpdateCheckResult = {
    determined: false,
    current: current || currentRaw,
    latest: null,
    has_update: null,
    release_url: null,
    release_name: null,
    checked_at: at.toISOString(),
  }

  if (!current) return { ...base, reason: '本机版本为空,无法比较' }
  if (!release || typeof release !== 'object') {
    return { ...base, reason: '远端没有可用 release' }
  }
  if (release.draft === true || release.prerelease === true) {
    return { ...base, reason: '最新条目是 draft/pre-release,不计入升级提示' }
  }
  const tag = normalizeVersion(typeof release.tag_name === 'string' ? release.tag_name : '')
  if (!tag) return { ...base, reason: 'release 缺少 tag_name' }

  const cmp = compareVersions(current, tag)
  if (cmp === null) return { ...base, reason: `版本无法比较:${current} vs ${tag}` }

  return {
    determined: true,
    current,
    latest: tag,
    has_update: cmp < 0,
    release_url: typeof release.html_url === 'string' ? release.html_url : null,
    release_name: typeof release.name === 'string' ? release.name : null,
    checked_at: at.toISOString(),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

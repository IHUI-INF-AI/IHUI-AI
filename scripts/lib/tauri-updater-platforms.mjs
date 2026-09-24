// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * tauri-updater-platforms.mjs — Tauri v2 updater「平台键 → { signature, url }」映射的
 * 纯判据(无 IO、无副作用),是两处消费链的唯一真相源:
 *
 *   1. scripts/generate-latest-json.mjs —— CI 发版时从 Release 的 *.sig 生成
 *      GitHub latest.json(feed 端点第二项);
 *   2. scripts/resolve-desktop-download.mjs —— 生成入库快照
 *      apps/web/src/config/desktop-feed.generated.ts 的 updaterPlatforms 字段,
 *      供 apps/web 的 /desktop-feed.json 与 /api/desktop-feed 两条站点 feed 直接输出。
 *
 * 平台判定必须走本文件,不得在端内/脚本内二次实现 —— 历史上站点 feed 曾自己
 * `find(a => /Windows/i.test(a.format))` 拼 Windows 单键,导致 mac/linux 永远没有更新。
 *
 * Tauri v2 事实(判据依据,勿"顺手优化"):
 *   - 签名对象是**平台专属可更新产物**:macOS = `.app.tar.gz`(+`.sig`),
 *     Linux = `.AppImage` / deb / rpm(+`.sig`),Windows = NSIS `.exe`(+`.sig`)。
 *   - `.dmg` **不是**可更新产物、没有配套 `.sig` → 永远不得充当 darwin 条目。
 *   - 空签名条目标对客户端是"下载后验签失败",比"没有更新"更糟 → 一律不输出。
 *   - Gitee 镜像的 mac/linux updater 资产实测 404(只有 Windows exe 在),
 *     故 darwin/linux 的 URL 只认 GitHub 直链;windows 允许 Gitee(国内可达)。
 */

/** 同平台多产物时的择优优先级(数值大者优先)。darwin 为单产物平台,保留首个。 */
export const PLATFORM_PRIORITY = {
  'windows-x86_64': { exe: 10, msi: 5 },
  'linux-x86_64': { AppImage: 10, deb: 7, rpm: 5 },
}

/** feed 输出的稳定键序(与 GitHub latest.json 四键形态一致,保证快照 diff 可读) */
export const UPDATER_PLATFORM_ORDER = [
  'windows-x86_64',
  'linux-x86_64',
  'darwin-x86_64',
  'darwin-aarch64',
]

/** 允许出现在 updater feed URL 里的 host(GitHub 资产直链 / Gitee release 直链) */
const ALLOWED_URL_HOSTS = new Set(['github.com', 'gitee.com'])

/** 允许使用 Gitee 直链的平台 —— 其余平台 Gitee 资产实测 404,一律拒收 */
const GITEE_ALLOWED_PLATFORMS = new Set(['windows-x86_64'])

/**
 * 根据 `.sig` 文件名推断 Tauri updater 平台标识 + 产物类型(kind)。
 * (自 scripts/generate-latest-json.mjs 原样迁入,行为不变。)
 * @param {string} sigName 以 .sig 结尾的签名资产名
 * @returns {{ platform: string, kind: string, alsoPlatforms?: string[] } | null}
 */
export function inferPlatform(sigName) {
  // Windows: exe.sig / msi.sig — 优先 NSIS exe(与 tauri-action updaterJsonPreferNsis
  // 语义一致),MSI 仅作无 exe 时的 fallback(MSI 需管理员权限且混用有已知坑)。
  if (sigName.endsWith('.exe.sig')) return { platform: 'windows-x86_64', kind: 'exe' }
  if (sigName.endsWith('.msi.sig')) return { platform: 'windows-x86_64', kind: 'msi' }
  // macOS: app.tar.gz.sig —— Universal 二进制(CI 用 --target universal-apple-darwin
  // 交叉编译)同时覆盖 Apple Silicon 与 Intel → 同一份签名/包写入双平台键。
  if (sigName.endsWith('.app.tar.gz.sig')) {
    if (sigName.includes('universal')) {
      return { platform: 'darwin-aarch64', kind: 'app', alsoPlatforms: ['darwin-x86_64'] }
    }
    if (sigName.includes('aarch64') || sigName.includes('arm64')) {
      return { platform: 'darwin-aarch64', kind: 'app' }
    }
    return { platform: 'darwin-x86_64', kind: 'app' }
  }
  // Linux: AppImage.sig / deb.sig / rpm.sig — 优先 AppImage(通用性最高)
  if (sigName.endsWith('.AppImage.sig')) return { platform: 'linux-x86_64', kind: 'AppImage' }
  if (sigName.endsWith('.deb.sig')) return { platform: 'linux-x86_64', kind: 'deb' }
  if (sigName.endsWith('.rpm.sig')) return { platform: 'linux-x86_64', kind: 'rpm' }
  return null
}

/**
 * 安装包文件名(不带 .sig)→ 平台推断。`.dmg` / `latest.json` / 裸 `.sig` 之外的
 * 非可更新产物一律返回 null —— 尤其是 dmg:**dmg 没有配套签名,永远不得进 feed**。
 * @param {string} name
 * @returns {{ platform: string, kind: string, alsoPlatforms?: string[] } | null}
 */
export function inferPlatformForPackage(name) {
  if (typeof name !== 'string' || name.length === 0) return null
  if (name.endsWith('.dmg')) return null
  return inferPlatform(name.endsWith('.sig') ? name : `${name}.sig`)
}

/**
 * 从安装包文件名提取 SemVer 版本号(如 "AI_0.1.44_x64-setup.exe" → "0.1.44")。
 * @param {string} assetName
 * @returns {string | null}
 */
export function extractVersion(assetName) {
  const m = assetName.match(/(\d+\.\d+\.\d+)/)
  return m ? m[1] : null
}

/**
 * 判断新产物是否应替换已有平台条目(自 generate-latest-json.mjs 原样迁入):
 *  1. 产物版本与 release 版本匹配的优先(release 可能混有历史版本残留);
 *  2. 版本匹配相同时按 PLATFORM_PRIORITY 择优;
 *  3. 单产物平台(如 darwin app)保留首个。
 * @param {string} platform
 * @param {string} newKind
 * @param {boolean} newVerMatch
 * @param {string | undefined} existingKind
 * @param {boolean | undefined} existingVerMatch
 * @returns {boolean}
 */
export function shouldReplacePlatform(platform, newKind, newVerMatch, existingKind, existingVerMatch) {
  if (!existingKind) return true
  if (newVerMatch !== existingVerMatch) return newVerMatch
  const priority = PLATFORM_PRIORITY[platform]
  if (!priority) return false
  return (priority[newKind] ?? 0) > (priority[existingKind] ?? 0)
}

/**
 * updater URL 白名单闸:必须 https、host ∈ {github.com, gitee.com},
 * 且 Gitee 直链仅允许出现在 windows-x86_64(mac/linux 的 Gitee 资产实测 404)。
 * 相对路径 / 占位符 / 未知 host 一律拒(宁缺平台键不出错链)。
 * @param {string} platform
 * @param {string} url
 * @returns {boolean}
 */
export function isUpdaterUrlAllowed(platform, url) {
  if (typeof url !== 'string' || url.length === 0) return false
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (!ALLOWED_URL_HOSTS.has(parsed.hostname)) return false
  if (parsed.hostname === 'gitee.com' && !GITEE_ALLOWED_PLATFORMS.has(platform)) return false
  return true
}

/**
 * 找出"某个平台键的归属**只由采集顺序决定**"的歧义。
 *
 * 为什么单独要这一步:`buildUpdaterPlatforms` 在同优先级(如两枚都是 `kind=exe`)时是
 * **保留首个**且不留痕迹,而这种情况在本仓真出现过 —— 2026-09-24 实测 Gitee 的
 * desktop-v0.1.44 同时挂着 CI 的 `AI_0.1.44_x64-setup.exe`(6,171,153) 与本机发版通道的
 * `智汇AI_0.1.44_x64-setup.exe`(6,020,276),两者签名不同,按 release 原序采集会把
 * windows 键锁到旧签名那条,而 feed 输出看起来完全正常。
 *
 * 判据严格镜像 buildUpdaterPlatforms(否则报的"保留/弃用"会与实得不符):
 *  - 因**优先级差**或**版本匹配差**被弃 → 那是择优,不报(AppImage>deb、新版压旧残留);
 *  - 平级(同 kind 优先级 ∧ 同 verMatch)而**签名不同** → 报;签名相同 = 同一份产物重复挂载,不报;
 *  - `alsoPlatforms`(universal 一次填双 darwin 键)对已有键是**无条件覆盖** → 只要覆盖了不同签名也报。
 *
 * @param {Array<{ name: string, url: string, signature?: string }>} entries
 * @param {{ version?: string }} [opts]
 * @returns {Array<{ platform: string, kept: string, dropped: string, keptUrl: string, droppedUrl: string }>}
 */
export function findPlatformAmbiguity(entries, opts = {}) {
  const { version } = opts
  /** @type {Record<string, { kind: string, verMatch: boolean, name: string, signature: string, url: string }>} */
  const winner = {}
  const ambiguous = []
  const report = (pf, cur, cand) => {
    if (cur.signature === cand.signature) return
    ambiguous.push({
      platform: pf,
      kept: cur.name,
      dropped: cand.name,
      keptUrl: cur.url,
      droppedUrl: cand.url,
    })
  }
  for (const entry of entries || []) {
    if (!entry || typeof entry.name !== 'string') continue
    const inferred = inferPlatformForPackage(entry.name)
    if (!inferred) continue
    const signature = typeof entry.signature === 'string' ? entry.signature.trim() : ''
    if (!signature) continue
    if (!allTargetsAllowed(inferred, entry.url)) continue
    const assetVersion = extractVersion(entry.name)
    const verMatch = version ? assetVersion === version : true
    const cand = { kind: inferred.kind, verMatch, name: entry.name, signature, url: entry.url }
    const ip = inferred.platform
    const cur = winner[ip]
    if (cur) {
      const replaces = shouldReplacePlatform(ip, cand.kind, verMatch, cur.kind, cur.verMatch)
      if (!replaces) {
        // 被弃:只有"平级并列"才是顺序决定的歧义;优先级/版本差属正常择优
        const prio = PLATFORM_PRIORITY[ip] || {}
        const tie = verMatch === cur.verMatch && (prio[cand.kind] ?? 0) === (prio[cur.kind] ?? 0)
        if (tie) report(ip, cur, cand)
        continue
      }
    }
    for (const pf of [ip, ...(inferred.alsoPlatforms || [])]) {
      // 与 builder 一致:主平台走上面的判据,alsoPlatforms 是无条件覆盖
      if (pf !== ip && winner[pf]) report(pf, winner[pf], cand)
      winner[pf] = cand
    }
  }
  return ambiguous
}

/** allTargets 的 host 白名单判定(buildUpdaterPlatforms 与本函数共用,避免两处口径漂移) */
function allTargetsAllowed(inferred, url) {
  const targets = [inferred.platform, ...(inferred.alsoPlatforms || [])]
  return targets.every((pf) => isUpdaterUrlAllowed(pf, url))
}

/**
 * 由候选安装包条目构建 feed 的 platforms 映射。
 * @param {Array<{ name: string, url: string, signature?: string }>} entries
 *   安装包资产条目(不含 .sig 后缀形态;name 为资产文件名)。
 * @param {{ version?: string }} [opts] release 版本号;提供时启用"版本匹配产物优先"排序。
 * @returns {Record<string, { signature: string, url: string }>} 键序按 UPDATER_PLATFORM_ORDER
 */
export function buildUpdaterPlatforms(entries, opts = {}) {
  const { version } = opts
  /** @type {Record<string, { signature: string, url: string }>} */
  const platforms = {}
  /** @type {Record<string, string>} */
  const platformKinds = {}
  /** @type {Record<string, boolean>} */
  const platformVerMatch = {}
  for (const entry of entries || []) {
    if (!entry || typeof entry.name !== 'string') continue
    const inferred = inferPlatformForPackage(entry.name)
    if (!inferred) continue
    const signature = typeof entry.signature === 'string' ? entry.signature.trim() : ''
    // 空签名一律不出键:客户端拿到无签名条目 = 下载后验签失败,比"没有更新"更糟
    if (!signature) continue
    const allTargets = [inferred.platform, ...(inferred.alsoPlatforms || [])]
    if (!allTargetsAllowed(inferred, entry.url)) continue
    const assetVersion = extractVersion(entry.name)
    const verMatch = version ? assetVersion === version : true
    if (
      !shouldReplacePlatform(
        inferred.platform,
        inferred.kind,
        verMatch,
        platformKinds[inferred.platform],
        platformVerMatch[inferred.platform],
      )
    ) {
      continue
    }
    for (const pf of allTargets) {
      platforms[pf] = { signature, url: entry.url }
      platformKinds[pf] = inferred.kind
      platformVerMatch[pf] = verMatch
    }
  }
  /** 稳定键序输出(快照 diff 可读、测试可预期) */
  const ordered = {}
  for (const key of UPDATER_PLATFORM_ORDER) {
    if (platforms[key]) ordered[key] = platforms[key]
  }
  return ordered
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

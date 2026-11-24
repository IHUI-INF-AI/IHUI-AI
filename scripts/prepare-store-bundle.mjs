#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * prepare-store-bundle.mjs — 各应用商店提交包生成器(2026-11-03 立)
 *
 * 为什么先做这个而不是先写上传器:国内各家商店(华为/小米/OPPO/vivo/荣耀/应用宝)与 ApkPure 的
 * 拒收/通报头号原因不是接口不通,而是**材料不同步** —— 包内声明了某个权限,而隐私政策与
 * "权限用途说明"里没有它(或反过来)。这类问题在真上架那天才暴露,而且每次都要重审。
 * 所以本器把"包内权限 ⇄ 权限用途 ⇄ 隐私政策条目"钉成**三方对账**,任一方缺项 ⇒ 拒绝产出,
 * 而不是先生成一个能过 dry-run 但会被商店打回的包。
 *
 * 取材面(全部现读,不复制第二份清单,§0.6):
 *   - 权限集合: apps/mobile-rn/app.json 的 expo.android.permissions
 *   - 用途说明: app.json 的 expo.plugins 与 app.config.js 的插件配置里各权限文案
 *                (cameraPermission/photosPermission/installPackagesPermission/…)
 *   - 收集信息与第三方 SDK: apps/mobile-rn/src/constants/privacyPolicy.ts 的 PRIVACY_POLICY_PARAGRAPHS
 *   - 提交物: scripts/lib/rn-release-credentials.mjs 的 androidArtifacts() 出口(不自拼路径)
 *
 * 落点: 只写 .ihui-agent/tmp/store-bundle/<vendor>/(§15 临时物纪律,不进仓库树、不含任何凭据)。
 *
 * 用法:
 *   node scripts/prepare-store-bundle.mjs                      # 对账 + 全厂商产出计划(dry-run)
 *   node scripts/prepare-store-bundle.mjs --write              # 真落临时目录
 *   node scripts/prepare-store-bundle.mjs --vendor huawei --write
 *   node scripts/prepare-store-bundle.mjs --json
 * 退出码: 0 对账通过并已产出 / 1 对账不过(点名缺哪一项)/ 2 未判定(取不到输入,不判成"没问题")
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { androidArtifacts, STATUS } from './lib/rn-release-credentials.mjs'
import { loadIdentity, checkIdentityConsistency, readAndroidAppLabel, IDENTITY_REL } from './lib/app-identity.mjs'

const ROOT = join(import.meta.dirname, '..')
const RN_DIR = join(ROOT, 'apps', 'mobile-rn')
const OUT_ROOT = join(ROOT, '.ihui-agent', 'tmp', 'store-bundle')

/**
 * 权限 → 所需用途说明键。
 * 这张表只负责"哪些权限必须有对应用途文案",文案本体仍从 app.json / app.config.js 现读 ——
 * 在此复制一份用途文字就会与配置漂移(§22c)。
 */
const PERMISSION_EVIDENCE_KEYS = Object.freeze({
  'android.permission.CAMERA': ['cameraPermission'],
  'android.permission.RECORD_AUDIO': ['cameraPermission', 'recordAudio'],
  'android.permission.READ_MEDIA_IMAGES': ['photosPermission'],
  'android.permission.READ_MEDIA_VIDEO': ['photosPermission'],
  'android.permission.READ_MEDIA_AUDIO': ['photosPermission', 'savePhotosPermission'],
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED': ['photosPermission'],
  'android.permission.READ_EXTERNAL_STORAGE': ['photosPermission'],
  'android.permission.WRITE_EXTERNAL_STORAGE': ['savePhotosPermission', 'photosPermission'],
  // 应用内整包更新:Android 8(API 26)起,拉起系统安装器的调用方必须持有该权限。
  // 用途键住在 app.config.js 的 withApkInstaller 插件配置里(详见该插件头注)。
  'android.permission.REQUEST_INSTALL_PACKAGES': ['installPackagesPermission'],
})

/**
 * normal 权限族(安装即得,不要求面向用户的逐条用途说明)。清单按 Android 官方权限保护级别整理;
 * 判"是否需要说明"必须分级,否则 INTERNET / VIBRATE 这类会把每个包都报成违规。
 */
export const NORMAL_PERMISSIONS = Object.freeze([
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_NETWORK_STATE',
  'android.permission.CHANGE_WIFI_STATE',
  'android.permission.VIBRATE',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.POST_NOTIFICATIONS',
])

/** 各家上架的**法定前置**:工信部信管〔2023〕105 号第九条 —— 分发平台不得为未备案 App 提供分发。 */
export const ICP_FILING_GATE =
  'App 备案(工信部信管〔2023〕105 号第九条:分发平台不得为未备案 App 提供分发;省级通管局约 20 个工作日发备案号)未在册 ⇒ 国内所有商店都无法上架,这是法律级前置,不是材料优化项'

/**
 * 厂商表:apiMode 分三档,**不许把"没核到官方出处"写成"有 API"**。
 *   verified    端点已从官方文档核实
 *   manual-only 官方只有网页后台(魅族/努比亚/应用汇/酷安;三星虽 API verified 但**注册新应用必须走网页**)
 *   unverified  找不到官方开发者入口 ⇒ 不接入链路,不写假通路(现无厂家落此档;档位保留给新厂商)
 * 百度系(91 助手/安卓市场)已于 2025-09-27 停服,直接不列。
 */
export const VENDOR_LIMITS = Object.freeze({
  google: { label: 'Google Play', briefMax: 80, fullMax: 4000, needsIcpFiling: false, needsCopyright: false, apiMode: 'verified' },
  huawei: { label: '华为 AppGallery', briefMax: 80, fullMax: 8000, needsIcpFiling: true, needsCopyright: true, apiMode: 'verified' },
  xiaomi: { label: '小米应用商店', briefMax: 200, fullMax: 4000, needsIcpFiling: true, needsCopyright: true, apiMode: 'verified' },
  oppo: { label: 'OPPO 软件商店', briefMax: 100, fullMax: 4000, needsIcpFiling: true, needsCopyright: true, apiMode: 'verified' },
  vivo: { label: 'vivo 应用商店', briefMax: 100, fullMax: 4000, needsIcpFiling: true, needsCopyright: true, apiMode: 'verified' },
  honor: { label: '荣耀应用市场', briefMax: 80, fullMax: 8000, needsIcpFiling: true, needsCopyright: true, apiMode: 'verified' },
  yyb: { label: '腾讯应用宝', briefMax: 120, fullMax: 4000, needsIcpFiling: true, needsCopyright: true, apiMode: 'verified' },
  samsung: { label: '三星 Galaxy Store', briefMax: 80, fullMax: 4000, needsIcpFiling: false, needsCopyright: false, apiMode: 'verified', firstPublishManual: true },
  meizu: { label: '魅族应用商店', briefMax: null, fullMax: null, needsIcpFiling: true, needsCopyright: true, apiMode: 'manual-only' },
  nubia: { label: '中兴/努比亚应用商店', briefMax: null, fullMax: null, needsIcpFiling: true, needsCopyright: true, apiMode: 'manual-only' },
  appchina: { label: '应用汇', briefMax: null, fullMax: null, needsIcpFiling: true, needsCopyright: true, apiMode: 'manual-only' },
  // 官方只有登录型开发者控制台 developer.apkpure.com(无公开提交 API);support@/business@ 是联系地址,
  // 邮件只能发"提交请求",不等于官方受理 —— 本仓的机器腿在 publish-stores,不在本表的 apiMode 里。
  apkpure: { label: 'ApkPure', briefMax: null, fullMax: null, needsIcpFiling: false, needsCopyright: false, apiMode: 'manual-only' },
})

const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

/**
 * 权限的权威面是 **prebuild 生成的 AndroidManifest.xml**,不是 app.json。
 * 实测 app.json 里没有 `android.permissions` 字段 —— 权限是 expo-camera / expo-media-library 等
 * config plugin 在 prebuild 时写进 manifest 的。拿声明面当"包内实际"会假阴性:以为只有配置那几条,
 * 而包里真装着 plugin 注入的额外权限(2026-11-03 首跑就是在这里取空,报成"取不到数组")。
 */
export function extractManifestPermissions(manifestText) {
  if (!manifestText) return { status: STATUS.UNJUDGED, perms: [], detail: 'AndroidManifest.xml 取不到(未 prebuild?)⇒ 包内权限面未知,不判对平' }
  // 必须按整条标签读:`tools:node="remove"` 条目里也写着同一个 android:name,
  // 只按 name 抓会把"已被摘除"的权限读成"包内仍在"(2026-11-08 实测 SYSTEM_ALERT_WINDOW 就是这样假红)。
  const pruned = []
  const perms = []
  for (const m of manifestText.matchAll(/<uses-permission\s+([^>]*?)\/?>/g)) {
    const attrs = m[1]
    const name = (attrs.match(/android:name\s*=\s*"([^"]+)"/) ?? [])[1]
    if (!name) continue
    if (/tools:node\s*=\s*["']remove["']/.test(attrs)) pruned.push(name)
    else perms.push(name)
  }
  if (!perms.length) {
    return {
      status: STATUS.UNJUDGED,
      perms: [],
      detail: `manifest 里枚举到 0 条实际 uses-permission${pruned.length ? `(另有 ${pruned.length} 条 tools:node="remove" 摘除标记)` : ''} ⇒ 判死不判绿(§0.3)`,
    }
  }
  return {
    status: STATUS.FOUND,
    perms,
    detail: `manifest 内 ${perms.length} 条实际 uses-permission${pruned.length ? `;已摘除标记 ${pruned.length} 条不计(${pruned.join(', ')})` : ''}`,
  }
}

/**
 * 三方对账:包内权限 ⊆ 有用途说明的权限;缺项点名。返回三态,不猜。
 * `extraEvidence` 承载 app.config.js 这类非 JSON 配置面的原文:自定义插件的用途键住在那里
 * (app.json 的插件配置会被 app.config.js 展开,两处都是声明面)。
 */
export function reconcilePermissions(appJson, privacyText, manifestText, extraEvidence = '') {
  const extracted = extractManifestPermissions(manifestText)
  if (extracted.status === STATUS.UNJUDGED) return { status: STATUS.UNJUDGED, detail: extracted.detail, gaps: [] }
  const perms = [...new Set(extracted.perms)]

  // 用途文案住在 plugins 的数组项里(形如 ['expo-camera',{cameraPermission:'…'}])。
  // 键名与文案值都要收:第一版只收值,于是 READ_MEDIA_IMAGES 永远"找不到用途键 photosPermission"
  // —— photosPermission 是**键**,不在任何字符串值里,那一版 16 条全报缺口,整片是假红。
  const collected = []
  const walk = (node) => {
    if (typeof node === 'string') collected.push(node)
    else if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { collected.push(k); walk(v) }
  }
  walk(appJson?.plugins ?? [])
  const blob = [collected.join('\n'), String(extraEvidence ?? '')].join('\n')

  const gaps = []
  const waived = []
  for (const p of perms) {
    // normal 权限安装即得,商店与通报都不要求逐条用户文案;拿它当缺口会把"能发"报成"处处缺材料"
    if (NORMAL_PERMISSIONS.includes(p)) {
      waived.push(p)
      continue
    }
    const keys = PERMISSION_EVIDENCE_KEYS[p]
    if (!keys) {
      gaps.push({ permission: p, why: 'dangerous/未知权限,表内无用途映射 ⇒ 需人工补(商店要求逐条说明用途)' })
      continue
    }
    if (!blob.trim()) gaps.push({ permission: p, why: 'plugins 里一条权限文案都没取到' })
    else if (!keys.some((k) => blob.includes(k))) gaps.push({ permission: p, why: `app.json 的 plugins 里找不到用途键 ${keys.join('/')}` })
  }

  // 隐私政策必须覆盖到"权限"这一层:没有该章节就等于商店要的"个人信息收集清单"缺件
  const privacyCoversPermissions = /权限/.test(privacyText ?? '')
  const status = gaps.length === 0 && privacyCoversPermissions ? STATUS.FOUND : gaps.length === 0 ? STATUS.UNJUDGED : STATUS.MISSING
  return {
    status,
    detail: `包内权限 ${perms.length} 条(manifest 面):需说明 ${perms.length - waived.length} 条,缺口 ${gaps.length} 处,normal 免说明 ${waived.length} 条;隐私政策${privacyCoversPermissions ? '含' : '缺'}权限章节`,
    gaps,
    waived,
    permissions: perms,
  }
}

/**
 * 第三方 SDK 的"声明 ⇄ 包内实证"双向对账。
 *
 * 为什么不做开放抽取:第一版从隐私政策正则抽 SDK 名,抽出 9 条里 6 条是散文碎片
 * ("上述第三方SDK""我们将不会初始化这些SDK")—— 名录是要逐家填进商店表单的表,
 * 混进碎片等于不可用。改为**观察表 + 逐项三态**:名单可枚举、每项都有明确的"在哪个面能证伪"。
 *
 * 两个方向都必须是缺陷(工信部与商店都按"政策与实际收集行为一致"双向判):
 *   漏声明(包里有、政策没写)  —— 更严重
 *   过度声明(政策写了、包里没有) —— 2026-11-03 实测到这型:政策大篇幅写"个推公共库SDK(Gtc)
 *   收集 IMEI/IMSI/MAC/应用列表",而 manifest / build.gradle / package.json 三面对 getui **零命中**
 *   ⇒ 要么政策陈旧该改,要么存在未登记的取数通道该查;两种都不该由发布链默默放过。
 * 证据面取不到的项一律 unjudged,不折成"没问题"也不折成"过度声明"(§0.3)。
 */
/**
 * 观察表。`truthFaces` 显式声明"**这个 SDK 若真集成,在哪些面必然留痕**"——
 * 没列进去的面不参与判"过度声明"。OkHttp 就是靠这一条区分开的:它由 react-native 内核带进
 * 依赖图,manifest / app 级 build.gradle / package.json 三面**结构上都没有它**,
 * 所以它只能判未判定;把它报成"过度声明"是替对方定罪,和当初把 404 HTML 读成"华为没开 API"同型。
 */
export const SDK_WATCHLIST = Object.freeze([
  { name: '个推公共库SDK(Gtc)', declared: /个推/, truthFaces: ['manifest', 'appGradle'], inManifest: /getui|gupush|push\.sdk/i, inGradle: /getui|push-?sdk/i, inPkgJson: /getui|@getui/i },
  { name: 'DCloud开发通用工具库', declared: /DCloud|通用工具库/, truthFaces: ['manifest', 'appGradle'], inManifest: /dcloud|uniapp/i, inGradle: /dcloud|uniapp/i, inPkgJson: /dcloud|uniapp/i },
  { name: 'OkHttp框架', declared: /OkHttp/i, truthFaces: [], inManifest: /okhttp/i, inGradle: /okhttp/i, inPkgJson: /okhttp/i },
])

export function reconcileSdks({ privacyText, manifestText, gradleText, pkgJsonText }) {
  if (!privacyText) return { status: STATUS.UNJUDGED, detail: '隐私政策文本取不到 ⇒ 名录无法判', rows: [] }
  const rows = []
  for (const s of SDK_WATCHLIST) {
    const declared = s.declared.test(privacyText)
    // 只有"该 SDK 真集成时必然留痕的那些面"都取得了,才允许判过度声明(见 truthFaces 注释)
    const faceText = { manifest: manifestText, appGradle: gradleText, pkgJson: pkgJsonText }
    const provable = (s.truthFaces ?? []).some((f) => !!faceText[f])
    const hits = [
      s.inManifest && manifestText && s.inManifest.test(manifestText),
      s.inGradle && gradleText && s.inGradle.test(gradleText),
      s.inPkgJson && pkgJsonText && s.inPkgJson.test(pkgJsonText),
    ].filter(Boolean)
    const present = hits.length > 0
    let verdict
    if (!provable) verdict = 'unjudged-face-cannot-prove'
    else if (declared && present) verdict = 'aligned'
    else if (declared && !present) verdict = 'declared-not-integrated'
    else if (!declared && present) verdict = 'integrated-not-declared'
    else verdict = 'not-applicable'
    rows.push({ sdk: s.name, declared, present, verdict })
  }
  const serious = rows.filter((r) => r.verdict === 'integrated-not-declared')
  const stale = rows.filter((r) => r.verdict === 'declared-not-integrated')
  const unknown = rows.filter((r) => r.verdict.startsWith('unjudged'))
  const status = serious.length ? STATUS.MISSING : stale.length ? STATUS.MISSING : unknown.length ? STATUS.UNJUDGED : STATUS.FOUND
  const detail = `观察表 ${rows.length} 项:对齐 ${rows.filter((r) => r.verdict === 'aligned').length},漏声明 ${serious.length},过度声明 ${stale.length},无法证明 ${unknown.length},不适用 ${rows.filter((r) => r.verdict === 'not-applicable').length}`
  return { status, detail, rows, serious, stale }
}

/** 文案长度对账:只报数与违规项,不截断内容(截断会造出与源不一致的对外文案)。 */
export function checkListingLimits(limits, listing) {
  if (!limits) return { status: STATUS.UNJUDGED, detail: '该厂商文案长度上限未核实 ⇒ 不判' }
  const rows = []
  for (const [field, cap] of [
    ['brief', limits.briefMax],
    ['full', limits.fullMax],
  ]) {
    if (cap === null || cap === undefined) continue
    const len = [...(listing[field] ?? '')].length
    rows.push({ field, len, cap, over: len > cap })
  }
  return {
    status: rows.some((r) => r.over) ? STATUS.MISSING : rows.length ? STATUS.FOUND : STATUS.UNJUDGED,
    detail: rows.map((r) => `${r.field}=${r.len}/${r.cap}${r.over ? ' ⚠超长' : ''}`).join(' ') || '该厂商无在册上限',
    rows,
  }
}

function loadInputs() {
  const appJson = JSON.parse(readFileSync(join(RN_DIR, 'app.json'), 'utf8')).expo ?? {}
  const privacyPath = join(RN_DIR, 'src', 'constants', 'privacyPolicy.ts')
  if (!existsSync(privacyPath)) throw new Error('privacyPolicy.ts 不存在')
  const raw = readFileSync(privacyPath, 'utf8')
  const company = (raw.match(/PRIVACY_POLICY_COMPANY\s*=\s*'([^']+)'/) ?? [])[1] ?? null
  const email = (raw.match(/PRIVACY_POLICY_EMAIL\s*=\s*'([^']+)'/) ?? [])[1] ?? null
  const effectDate = (raw.match(/PRIVACY_POLICY_EFFECTIVE_DATE\s*=\s*'([^']+)'/) ?? [])[1] ?? null
  const paragraphs = [...raw.matchAll(/text:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"))
  // 权限取自 prebuild 生成的 manifest(产物面),不取自 app.json —— 见 extractManifestPermissions 头注
  const manifestPath = join(RN_DIR, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
  const readIfExists = (q) => (existsSync(q) ? readFileSync(q, 'utf8') : null)
  const manifestText = readIfExists(manifestPath)
  const gradleText = readIfExists(join(RN_DIR, 'android', 'app', 'build.gradle'))
  const pkgJsonText = readIfExists(join(RN_DIR, 'package.json'))
  // 自定义插件的用途键(如 withApkInstaller 的 installPackagesPermission)住在 app.config.js,
  // 它是真正的 Expo 配置入口;不读它会把已声明的用途读成"缺映射"。
  const configText = readIfExists(join(RN_DIR, 'app.config.js'))
  return { appJson, privacyText: paragraphs.join('\n'), company, email, effectDate, manifestText, gradleText, pkgJsonText, configText, manifestPath: manifestPath.replace(/\\/g, '/') }
}

/** listing 文案:一律取自仓内既有事实(名称/主体/隐私生效日/包名),不新造宣传语。 */
export function buildListing(appJson, meta) {
  // 名称/包名只从身份真源取;app.json 只是派生面(对账在 main 里做,漂移即拒跑)。
  const title = meta?.identity?.displayName ?? appJson?.name ?? '未在册'
  const pkg = meta?.identity?.applicationId ?? appJson?.android?.package ?? '未在册'
  // 版本以**产物元数据**为准:构建期 IHUI_MOBILE_VERSION 会覆盖 displayVersion(见 app.config.js),
  // app.json 的 version 是基座值,实测本机 APK 0.0.19 而 app.json 仍是 0.0.12。
  // 商店与邮件都按包内 versionName 核对 ⇒ 取不到元数据时才回落到 app.json,并在值上留痕可辨。
  const artifactVersion = String(meta?.versionName ?? '').trim()
  return {
    title,
    // 邮件/表单通道按字段名取值:名称与 package 从 app.json 现读,版本优先取产物元数据(§0.6)
    appName: title,
    packageName: pkg,
    versionName: artifactVersion || String(appJson?.version ?? '未在册'),
    versionCode: Number.isInteger(meta?.versionCode) ? meta.versionCode : null,
    // 简述只用可核实的事实句:主体 + 平台定位来自 README/隐私政策的自述,不含比较级或承诺
    brief: `${title}(智汇AI)AI 对话与智能体平台,由${meta.company ?? '该主体'}提供。`,
    full: [`【${title}】`, 'AI 对话、智能体(Agent)与知识库应用能力;账号体系与 Web/桌面端互通。', '', '隐私政策生效日期:' + (meta.effectDate ?? '未在册'), '开发者主体:' + (meta.company ?? '未在册')].join('\n'),
    category: '工具',
    privacyPolicyUrl: 'https://aizhs.top/privacy',
    contact: meta.email ? { email: meta.email } : null,
    // APKPure 邮件通道要求"提交授权声明";按主体与包名派生,不新造权利主张。
    authorization: `开发者(${meta.company ?? '未在册'})确认:提交的 ${pkg} 为官方构建,授权 APKPure 在本平台展示与分发;APK 签名与提交函所列 SHA-256 一致。`,
    source: '本文件全部字段由 app.json、app.config.js 与 privacyPolicy.ts 现读派生;改文案请改这些源,不要在这里加分支(§0.6)。',
  }
}

/**
 * App 备案(工信部信管〔2023〕105 号)在册性 —— **具名台账驱动,不靠全文 grep**。
 * 登记处:scripts/data/app-icp-filing.json(缺文件 ⇒ 未判定;字段不齐 ⇒ 未判定)。
 * 2026-11-03 实测:仓内搜不到任何 ICP/App 备案号字符串,站点首页 HTML 也没抓到,
 * 而 apps/api/src/routes/algorithm-record.ts 自述"不再展示本平台的虚假备案号"
 * ⇒ 判定只能是 unjudged,不能读成"已备案",也不能读成"必然没备案"。
 * 但这一格必须参与折叠:needsIcpFiling 的商店在备案号未证时**不许报 ready** ——
 * 否则就是"账面 ready 而法律上发不了",正是本仓反复要防的那一型。
 */
export const ICP_FILING_LEDGER_REL = 'scripts/data/app-icp-filing.json'

export function resolveIcpFiling({ readLedger, env = process.env }) {
  const raw = env.IHUI_APP_ICP_FILING
  if (raw && raw.trim()) return { status: STATUS.FOUND, detail: `备案号来自 env(长度 ${raw.trim().length})`, filing: raw.trim() }
  let text = null
  try {
    text = readLedger?.(ICP_FILING_LEDGER_REL) ?? null
  } catch {
    text = null
  }
  if (text === null || text === undefined) return { status: STATUS.UNJUDGED, detail: `${ICP_FILING_LEDGER_REL} 不存在 ⇒ 备案在册性未判定(国内店因此不得读成 ready)`, filing: null }
  let j
  try {
    j = JSON.parse(text)
  } catch {
    return { status: STATUS.UNJUDGED, detail: `${ICP_FILING_LEDGER_REL} 不是合法 JSON ⇒ 未判定`, filing: null }
  }
  const num = String(j?.appFilingNumber ?? j?.icpNumber ?? '').trim()
  const authority = String(j?.authority ?? '').trim()
  if (!num || !authority || !j?.verifiedAt) return { status: STATUS.UNJUDGED, detail: `${ICP_FILING_LEDGER_REL} 字段不齐(需 appFilingNumber/icpNumber + authority + verifiedAt)⇒ 未判定`, filing: num || null }
  return { status: STATUS.FOUND, detail: `备案号在册(发证:${authority},核验:${j.verifiedAt})`, filing: num }
}

/**
 * 软著(计算机软件著作权登记证书 / 电子版权证书)在册性 —— 与备案同为法定前置,同表登记。
 * 判据只读 `scripts/data/app-store-credentials.json` 的 legalPrereqs.softwareCopyright(§0.6 单一真相源),
 * 不在这里另抄一份"我们有/没有软著"的散文。
 */
export const SOFTWARE_COPYRIGHT_GATE =
  '软著(计算机软件著作权登记证书/电子版权证书)未在册 ⇒ vivo 官方明写必传『电子版权证书或版权证明其一』、应用宝审核侧必传软著 ⇒ 接口层面就提交不过去'

export const COPYRIGHT_LEDGER_REL = 'scripts/data/app-store-credentials.json'

export function resolveSoftwareCopyright({ readLedger, env = process.env } = {}) {
  const raw = env.IHUI_SOFTWARE_COPYRIGHT
  if (raw && raw.trim()) return { status: STATUS.FOUND, detail: `软著编号来自 env(长度 ${raw.trim().length})`, certificateNumber: raw.trim() }
  let text = null
  try {
    text = readLedger?.(COPYRIGHT_LEDGER_REL) ?? null
  } catch {
    text = null
  }
  if (text === null || text === undefined) return { status: STATUS.UNJUDGED, detail: `${COPYRIGHT_LEDGER_REL} 取不到 ⇒ 软著在册性未判定`, certificateNumber: null }
  let j
  try {
    j = JSON.parse(text)
  } catch {
    return { status: STATUS.UNJUDGED, detail: `${COPYRIGHT_LEDGER_REL} 不是合法 JSON ⇒ 未判定`, certificateNumber: null }
  }
  const sc = j?.legalPrereqs?.softwareCopyright
  if (!sc) return { status: STATUS.UNJUDGED, detail: `${COPYRIGHT_LEDGER_REL} 无 legalPrereqs.softwareCopyright ⇒ 未判定`, certificateNumber: null }
  const st = String(sc.statusNow ?? '').trim()
  const num = String(sc.certificateNumber ?? '').trim()
  if (st === 'found' && num) return { status: STATUS.FOUND, detail: `软著在册(编号长度 ${num.length})`, certificateNumber: num }
  if (st === 'missing-evidence') return { status: STATUS.MISSING, detail: '软著不在册(登记处 missing-evidence)⇒ 国内店属于法定前置未落地', certificateNumber: num || null }
  return { status: STATUS.UNJUDGED, detail: `软著登记处 statusNow=${st || '(空)'} ⇒ 未判定`, certificateNumber: num || null }
}

export function buildPlan({ vendors = Object.keys(VENDOR_LIMITS), listing, reconcile, sdks, artifacts, privacyMeta, filing, copyright }) {
  const filingStatus = filing?.status ?? STATUS.UNJUDGED
  const copyrightStatus = copyright?.status ?? STATUS.UNJUDGED
  return vendors.map((v) => {
    const limits = VENDOR_LIMITS[v]
    const len = checkListingLimits(limits, listing)
    return {
      vendor: v,
      label: limits.label,
      // 折叠必须把资质算进去:国内店在备案/软著未证时最高只能到 unjudged,不许读成 ready
      status: limits.needsIcpFiling && filingStatus !== STATUS.FOUND ? fold(reconcile.status, sdks.status, artifacts.status, len.status, STATUS.UNJUDGED) : fold(reconcile.status, sdks.status, artifacts.status, len.status, filingStatus, limits.needsCopyright ? copyrightStatus : STATUS.FOUND),
      blockers: [
        ...(reconcile.status === STATUS.MISSING ? [reconcile.detail] : []),
        ...(len.status === STATUS.MISSING ? [`文案长度超限:${len.detail}`] : []),
        ...(artifacts.status !== STATUS.FOUND ? ['提交物缺失:' + artifacts.detail] : []),
        ...(sdks.serious?.length ? ['漏声明(包内有而隐私政策未写):' + sdks.serious.map((r) => r.sdk).join(', ')] : []),
        ...(sdks.stale?.length ? ['过度声明(政策写了而包内可证面查无):' + sdks.stale.map((r) => r.sdk).join(', ') + ' ⇒ 要么政策陈旧该改,要么存在未登记的取数通道该查'] : []),
        ...(limits.needsIcpFiling && filingStatus !== STATUS.FOUND ? [ICP_FILING_GATE, '备案在册性:' + filingStatus + ' — ' + (filing?.detail ?? '未取到备案台账(需 scripts/data/app-icp-filing.json 或 IHUI_APP_ICP_FILING)')] : []),
        ...(limits.needsCopyright && copyrightStatus !== STATUS.FOUND ? [SOFTWARE_COPYRIGHT_GATE, '软著在册性:' + copyrightStatus + ' — ' + (copyright?.detail ?? '未取到软著登记处(需 ' + COPYRIGHT_LEDGER_REL + '.legalPrereqs.softwareCopyright 或 IHUI_SOFTWARE_COPYRIGHT)')] : []),
        ...(limits.apiMode === 'manual-only' ? ['官方只有网页后台 ⇒ 无自动上传通路,材料包供人工提交使用'] : []),
        ...(limits.apiMode === 'unverified' ? ['未找到官方开发者入口/API 出处 ⇒ 不写入自动链路(把博客说法当官方,正是上一轮把 vivo 端点搞错的那类型错误)'] : []),
        ...(limits.firstPublishManual ? ['API 已核实但官方明写**不支持注册新应用**:首次上架必须走 Seller Portal 网页'] : []),
      ],
      files: {
        'listing.json': listing,
        'privacy-compliance.json': { permissions: reconcile.permissions ?? [], gaps: reconcile.gaps ?? [], thirdPartySdkReconciliation: sdks.rows, effectiveDate: privacyMeta.effectDate, company: privacyMeta.company },
        'manifest.json': { package: listing.packageName, artifacts: artifacts.value ?? [], sha256: (artifacts.value ?? []).map((a) => ({ kind: a.kind, path: a.path, sha256: existsSync(a.path) ? sha256File(a.path) : null })) },
      },
    }
  })
}

function fold(...states) {
  if (states.includes(STATUS.UNJUDGED)) return 'unjudged'
  if (states.includes(STATUS.MISSING)) return 'blocked'
  return 'ready'
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const write = argv.includes('--write')
  const vi = argv.indexOf('--vendor')
  const vendors = vi >= 0 ? [argv[vi + 1]] : Object.keys(VENDOR_LIMITS)

  let inputs
  try {
    inputs = loadInputs()
  } catch (e) {
    console.log(`未判定:输入取不到 —— ${String(e?.message).slice(0, 160)}`)
    return 2
  }
  const reconcile = reconcilePermissions(inputs.appJson, inputs.privacyText, inputs.manifestText, inputs.configText)
  // 身份真源对账:显示名/包名只认 scripts/data/app-identity.json,派生面(配置/资源/备案台账)不一致 ⇒ 拒跑
  let identity
  try {
    identity = loadIdentity()
  } catch (e) {
    console.log(`未判定:身份真源取不到 —— ${String(e?.message).slice(0, 160)}`)
    return 2
  }
  let ledger = null
  const ledgerPath = join(ROOT, 'scripts/data/app-icp-filing.json')
  if (existsSync(ledgerPath)) {
    try { ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) } catch { ledger = null }
  }
  const identityDrift = checkIdentityConsistency({ identity, appJson: inputs.appJson, androidLabel: readAndroidAppLabel(), ledger })
  if (identityDrift.length) {
    console.log('身份漂移,拒绝产出(改名的正确姿势是改 ' + IDENTITY_REL + ',再同步派生面):\n  - ' + identityDrift.join('\n  - '))
    return 1
  }
  const sdks = reconcileSdks({ privacyText: inputs.privacyText, manifestText: inputs.manifestText, gradleText: inputs.gradleText, pkgJsonText: inputs.pkgJsonText })
  const artifacts = androidArtifacts({ dir: join(RN_DIR, 'android', 'app', 'build', 'outputs') })
  // 版本取 apk 产物元数据(邮件/SHA-256 都是这份 APK 的);AAB 元数据只作诊断,不改 listing。
  const apkArtifact = (artifacts.value ?? []).find((a) => a.kind === 'apk') ?? null
  const listing = buildListing(inputs.appJson, {
    company: inputs.company,
    effectDate: inputs.effectDate,
    email: inputs.email,
    identity,
    versionName: apkArtifact?.versionName ?? null,
    versionCode: apkArtifact?.versionCode ?? null,
  })
  const filing = resolveIcpFiling({ readLedger: (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), "utf8") : null), env: process.env })
  const copyright = resolveSoftwareCopyright({ readLedger: (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : null), env: process.env })
  const plan = buildPlan({ vendors, listing, reconcile, sdks, artifacts, privacyMeta: { company: inputs.company, effectDate: inputs.effectDate }, filing, copyright })

  if (json) console.log(JSON.stringify({ identity, reconcile, sdks, artifacts, listing, filing, copyright, plan }, null, 2))
  else {
    console.log(`对账: ${reconcile.status} ${reconcile.detail}`)
    for (const g of reconcile.gaps ?? []) console.log(`   ⚠ ${g.permission} ⇒ ${g.why}`)
    console.log(`SDK 名录: ${sdks.status} ${sdks.detail}`)
    console.log(`提交物: ${artifacts.status} ${artifacts.detail}`)
    for (const p of plan) console.log(`\n[${p.status}] ${p.vendor.padEnd(9)} ${p.label}\n   ${p.blockers.length ? '待办:\n   - ' + p.blockers.join('\n   - ') : '材料与文案长度对账通过'}`)
    console.log(`\nSUMMARY vendors=${plan.length} ready=${plan.filter((p) => p.status === 'ready').length} blocked=${plan.filter((p) => p.status === 'blocked').length} unjudged=${plan.filter((p) => p.status === 'unjudged').length}`)
  }

  if (write) {
    if (reconcile.status === STATUS.MISSING) {
      console.log('拒绝落盘:权限与用途说明未对平(先补 app.json / 隐私政策,再产出,免得生成一个必被打回的包)')
      return 1
    }
    for (const p of plan) {
      const dir = join(OUT_ROOT, p.vendor)
      mkdirSync(dir, { recursive: true })
      for (const [name, data] of Object.entries(p.files)) writeFileSync(join(dir, name), JSON.stringify(data, null, 2), 'utf8')
      console.log(`已落 ${join('.ihui-agent/tmp/store-bundle', p.vendor).replace(/\\/g, '/')}(${Object.keys(p.files).length} 件)`)
    }
  }
  return reconcile.status === STATUS.MISSING ? 1 : plan.every((p) => p.status === 'ready') ? 0 : 2
}

export const __test__ = { loadInputs, extractManifestPermissions, reconcilePermissions, resolveIcpFiling, resolveSoftwareCopyright, ICP_FILING_GATE, SOFTWARE_COPYRIGHT_GATE, COPYRIGHT_LEDGER_REL, ICP_FILING_LEDGER_REL, NORMAL_PERMISSIONS, reconcileSdks, SDK_WATCHLIST, checkListingLimits, buildListing, buildPlan, VENDOR_LIMITS, PERMISSION_EVIDENCE_KEYS, STATUS, loadIdentity, checkIdentityConsistency, readAndroidAppLabel, IDENTITY_REL }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main() ?? 0)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

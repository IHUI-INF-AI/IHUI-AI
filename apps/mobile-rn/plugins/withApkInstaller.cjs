// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * withApkInstaller.cjs — 应用内整包更新所需的原生侧声明(2026-11-04 立)
 *
 * 立因(src/lib/apk-update.ts 的"下载完拉起系统安装器"这条腿):
 *   Android 8(API 26)起,`Intent.ACTION_VIEW` + `application/vnd.android.package-archive`
 *   这套"请求安装"的调用方**必须**持有 `android.permission.REQUEST_INSTALL_PACKAGES`,
 *   否则系统安装器直接拒绝,表现是点了更新什么也不发生 —— 不是崩溃、没有异常,最难排查的那一类。
 *   全仓此前零声明(2026-11-04 实测:app.json 无 expo.android.permissions、无插件注入、
 *   合并后 release manifest grep 为 0),所以要在这里补。
 *
 * 为什么必须走 plugin 而不是直接改 xml:`android/` 整目录在 .gitignore 内(Expo prebuild 生成物),
 * 直改既不进仓、也会被下一次 prebuild 洗掉 —— 与 withNativeInputChrome / withPermissionPruning
 * 同一口径。本插件只**增**一条权限,且幂等(已存在就不再追加,避免 prebuild 反复刷条目)。
 *
 * 与 withPermissionPruning 的关系:那一格只管"摘除"(默认集只有 SYSTEM_ALERT_WINDOW),
 * 不会与本条冲突;但若将来有人把 REQUEST_INSTALL_PACKAGES 误加进摘除集,这里会显式告警 ——
 * 摘掉它等于让"应用内更新"静默失效,而不能被当成一次普通清理。
 *
 * 安装侧的另外两块**不需要**本插件:
 *   · FileProvider:expo-file-system 的 android manifest 自带
 *     `${applicationId}.FileSystemFileProvider`(实测已声明),`getContentUriAsync` 正是用它;
 *   · 原生意图模块:expo-intent-launcher(`ExpoIntentLauncher.startActivity`);
 *     它自己的 manifest 是空的,所以权限只能由本插件补。
 */
const { withAndroidManifest } = require('@expo/config-plugins')

/** 应用内安装的唯一必需权限。 */
const REQUEST_INSTALL_PACKAGES = 'android.permission.REQUEST_INSTALL_PACKAGES'

const NAME = 'android:name'
const TOOLS_NODE = 'tools:node'

function ensurePermission(manifest) {
  const list = manifest['uses-permission'] ?? []
  const attr = (e) => e?.$?.[NAME] ?? e?.[NAME]
  // 被别的插件标了 tools:node="remove" ⇒ 本条会被 merger 摘掉,必须显式说出来,
  // 否则症状是"权限明明写了却不生效"(与 withPermissionPruning 的反向冲突)。
  const removal = list.find(
    (e) => attr(e) === REQUEST_INSTALL_PACKAGES && e?.$?.[TOOLS_NODE] === 'remove',
  )
  if (removal) {
    console.warn(
      `[withApkInstaller] 检测到 ${REQUEST_INSTALL_PACKAGES} 被标记为 tools:node="remove":` +
        '应用内安装会静默失效。请把它从权限摘除集里去掉。',
    )
    return { added: false }
  }
  if (list.some((e) => attr(e) === REQUEST_INSTALL_PACKAGES && e?.$?.[TOOLS_NODE] !== 'remove')) {
    return { added: false }
  }
  list.push({ $: { [NAME]: REQUEST_INSTALL_PACKAGES } })
  manifest['uses-permission'] = list
  return { added: true }
}

module.exports = function withApkInstaller(config) {
  return withAndroidManifest(config, (cfg) => {
    if (!cfg.modResults?.manifest) return cfg
    const { added } = ensurePermission(cfg.modResults.manifest)
    if (added) {
      // prebuild 期回执:这条权限是"商店需要用途说明"的那一类,补上了就要留痕
      console.info(
        `[withApkInstaller] 注入 ${REQUEST_INSTALL_PACKAGES}(应用内更新:下载 APK 后拉起系统安装器)`,
      )
    }
    return cfg
  })
}

module.exports.__test__ = { REQUEST_INSTALL_PACKAGES, ensurePermission }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Android 签名统一插件(2026-10-30 立,立因是"名不同 + 签名不同"逼得每次换包先卸载)。
 *
 * 病灶(本机实测指纹):
 *   · signingConfigs.debug → android/app/debug.keystore,SHA-256 FA:C6:17:45…
 *   · signingConfigs.release → ~/.android/ihui-release.keystore,CN=IHUI AI,SHA-256 62:B0:FF:0E…
 *   · dev client 走 assembleDebug ⇒ debug key;release 包走正式 key ⇒ 同一个应用两把 key。
 * Android 只允许「同包名 **且** 同签名」覆盖安装,于是 dev client 与 release 互相装不上,
 * 每次换包都得先卸载 —— 登录态跟着一起清零。
 *
 * 修法:debug 变体的签名也指向正式 keystore(`IHUI_RELEASE_*` 存在时),
 * 使**一个应用身份只有一把 key**;凭据缺失(CI / 新机器)时回退 debug.keystore,不阻断构建。
 * 包名不在这里动:唯一源是 app.json 的 `expo.android.package`,prebuild 会写进 applicationId,
 * 手工 sed 包名换不来覆盖安装(签名不同照样失败),只会多造一种不一致 —— 故本插件只做签名一件事。
 *
 * 为什么必须写成 plugin:apps/mobile-rn/android/ 整目录在 .gitignore 内(prebuild 产物),
 * 直改 build.gradle 下次 prebuild 即被洗掉(见仓根 .gitignore 该条注释,plugins/*.cjs 正是为此存在)。
 */
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// [IHUI signing-unify]'
const TARGET = 'signingConfig signingConfigs.debug'
const REPLACEMENT =
  "signingConfig(project.hasProperty('IHUI_RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug)"

module.exports = function withAndroidSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg
    const { contents } = cfg.modResults
    if (contents.includes(MARKER)) return cfg

    const at = contents.indexOf(TARGET)
    if (at < 0) {
      // 宁可炸掉也不静默放过:放过的结果是 debug 变体退回 debug key,
      // 于是"两把 key 互相装不上"这个已被消灭的问题会无声复活,而构建仍然成功。
      throw new Error(
        '[withAndroidSigning] build.gradle 中找不到 `signingConfig signingConfigs.debug`:' +
          'RN/Expo 模板可能已变更,请复核本插件再放行(拒绝静默退回两套签名)。',
      )
    }

    const lineStart = contents.lastIndexOf('\n', at) + 1
    const lineEnd = contents.indexOf('\n', at)
    const indent = contents.slice(lineStart, at)
    const patchedLines = [
      `${indent}${MARKER} debug 变体同样使用正式 keystore(见本插件头注释)`,
      `${indent}${REPLACEMENT}`,
    ].join('\n')

    cfg.modResults.contents = contents.slice(0, lineStart) + patchedLines + contents.slice(lineEnd)

    // 只告警不阻断:applicationId 由 app.json 派生,若已被人手工改过,
    // 说明"名不同"那条老毛病又回来了,但本次构建仍应按配置产出一个可用包。
    const pkg = config.android?.package
    if (pkg && !contents.includes(`applicationId '${pkg}'`)) {
      console.warn(
        `[withAndroidSigning] applicationId 与 app.json 的 package(${pkg})不一致:` +
          '包名唯一源是 app.json,请勿手改 build.gradle。',
      )
    }
    return cfg
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

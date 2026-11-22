// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * media3 钉版插件(2026-10-20 立,真机取证时实测的崩溃):
 *
 * react-native-video 6.19.2 的 `android/gradle.properties` 声明 `RNVideo_media3Version=1.8.0`,
 * 但它读的是 `safeExtGet('media3Version')`(rootProject.ext),本项目没有设这个 ext ⇒ 依赖图按
 * 其他模块的要求把 `androidx.media3:*` 解析到 1.9.0。1.9.0 改了 `DefaultAllocator` 的构造签名,
 * 而 RNV 的 `RNVLoadControl` 仍按 1.8.0 的签名调用 ⇒ 进播放器瞬间
 * `java.lang.NoSuchMethodError: No method <init>(...IZIZ)V`,FATAL,App 直接闪退。
 *
 * 现象隐蔽:全仓没有任何 UI 能到达 VideoPlayer(本次已接通),所以这个崩溃在真机上从没暴露过。
 *
 * 修法:prebuild 时把整个 `androidx.media3` 组钉回 RNV 期望的 1.8.0(与上游 gradle.properties 同源)。
 * 之所以做成插件而不是手改 `android/build.gradle`:后者是 prebuild 生成物、每次重建都会被覆盖。
 */
const { withProjectBuildGradle } = require('@expo/config-plugins')

const MARK = '// IHUI media3 pin'
const PIN_VERSION = '1.8.0'
const SNIPPET = `
${MARK}: react-native-video 期望 media3 ${PIN_VERSION};1.9.0 的 DefaultAllocator 构造签名变更会让
// RNVLoadControl 抛 NoSuchMethodError(进播放器即崩溃)。整组钉回上游声明版本。
allprojects {
    configurations.all {
        resolutionStrategy.eachDependency { d ->
            if (d.requested.group == 'androidx.media3') {
                d.useVersion '${PIN_VERSION}'
            }
        }
    }
}
`

module.exports = function withMedia3Pin(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg
    if (cfg.modResults.contents.includes(MARK)) return cfg
    cfg.modResults.contents += SNIPPET
    return cfg
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

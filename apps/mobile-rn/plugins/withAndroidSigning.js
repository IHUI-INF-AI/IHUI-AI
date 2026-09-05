// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Android release 签名 Config Plugin(mobile-rn 端)。
 *
 * 背景:android/ 目录是 Expo prebuild 生成物(不入库),直接手改 build.gradle 会在
 * `expo prebuild --clean` 后丢失。本 plugin 在 prebuild / EAS Build 时把 release 签名
 * 配置重新注入 android/app/build.gradle,幂等(检测标记,已注入则跳过)。
 *
 * 凭据链(均不入库,apps/mobile-rn/.gitignore 已排除):
 *   android/keystore.properties  → storeFile/storePassword/keyAlias/keyPassword
 *   android/keystore/            → ihui-release.keystore
 * 缺失凭据时 release 构建回退 debug 签名(保证 CI/新机器可出可安装包)。
 * 生成/更新 keystore:keytool -genkeypair -v -keystore android/keystore/ihui-release.keystore
 *   -alias ihui-release -keyalg RSA -keysize 2048 -validity 10000
 */
const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

/** 凭据加载块:插入到 `android {` 之前 */
const CRED_LOAD_BLOCK = `// [with-android-signing] 加载 release 签名凭据 (android/keystore.properties, 不入库)。
// 该文件与 keystore/ 已被 .gitignore 排除; 缺失时 release 构建回退 debug 签名,
// 保证无密钥环境(CI / 新机器)也能 assembleRelease 出可安装包。
def keystorePropsFile = new File(rootDir, 'keystore.properties')
def hasKeystoreProps = keystorePropsFile.exists()
def keystoreProps = new Properties()
if (hasKeystoreProps) {
    keystoreProps.load(new FileInputStream(keystorePropsFile))
}
`

/** release signingConfig 块:插入到 signingConfigs 内 debug 块之后 */
const RELEASE_SIGNING_CONFIG = `        // [with-android-signing] release 真签名 —— 凭据读 android/keystore.properties (不入库)。
        // 仅在 keystore.properties 存在时填充, 否则本块为空, release 回退 debug 签名
        // (见 buildTypes.release)。storeFile 相对 android 目录(keystore/ihui-release.keystore)。
        release {
            if (hasKeystoreProps) {
                storeFile new File(rootDir, keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
`

/** buildTypes.release 签名选择:插入到 `release {` 之后 */
const RELEASE_SIGNING_PICK = `            // [with-android-signing] 有凭据用 release 签名, 无凭据回退 debug(保证可安装)
            if (hasKeystoreProps) {
                signingConfig signingConfigs.release
            } else {
                signingConfig signingConfigs.debug
            }
`

/** android/app/build.gradle 中 signingConfigs 的 debug 块锚点(RN 标准模板,本仓未改) */
const DEBUG_SIGNING_ANCHOR = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`

function patchBuildGradle(content) {
  // 幂等:已有本 plugin 标记则视为已注入(prebuild 生成物理论上不会带标记,防御性兜底)
  if (content.includes('[with-android-signing]')) return content

  let out = content

  // 1) 凭据加载块:插到首个 `android {` 之前
  const androidIdx = out.indexOf('\nandroid {')
  if (androidIdx === -1) {
    throw new Error(
      '[with-android-signing] build.gradle 中未找到 `android {` 锚点,模板可能已变更,需人工检查',
    )
  }
  out = out.slice(0, androidIdx + 1) + CRED_LOAD_BLOCK + out.slice(androidIdx + 1)

  // 2) release signingConfig:插到 signingConfigs 的 debug 块之后
  if (!out.includes(DEBUG_SIGNING_ANCHOR)) {
    throw new Error(
      '[with-android-signing] build.gradle 中未找到 signingConfigs.debug 锚点,模板可能已变更,需人工检查',
    )
  }
  out = out.replace(DEBUG_SIGNING_ANCHOR, DEBUG_SIGNING_ANCHOR + RELEASE_SIGNING_CONFIG)

  // 3) buildTypes.release:在 `release {` 后注入签名选择(if/else)
  //    锚点限定 buildTypes 内的 release 块(RN 模板紧跟 Caution 注释)
  const releaseAnchor = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
`
  if (!out.includes(releaseAnchor)) {
    throw new Error(
      '[with-android-signing] build.gradle 中未找到 buildTypes.release 锚点,模板可能已变更,需人工检查',
    )
  }
  out = out.replace(releaseAnchor, releaseAnchor + RELEASE_SIGNING_PICK)

  return out
}

const withAndroidSigning = (config) => {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const gradlePath = path.join(mod.modRequest.platformProjectRoot, 'app', 'build.gradle')
      if (!fs.existsSync(gradlePath)) {
        // 尚未 prebuild 过(无 android 目录):跳过,下次 prebuild 时本 plugin 正常执行
        console.warn('[with-android-signing] android/app/build.gradle 不存在,跳过(未 prebuild?)')
        return mod
      }
      const content = fs.readFileSync(gradlePath, 'utf8')
      const patched = patchBuildGradle(content)
      if (patched !== content) {
        fs.writeFileSync(gradlePath, patched, 'utf8')
        console.log(
          '[with-android-signing] 已注入 release 签名配置(凭据读 android/keystore.properties)',
        )
      }
      return mod
    },
  ])
}

// expo config-plugins 返回的 mod 对象被冻结,不能直接挂属性;用包装函数承载导出
const plugin = (config) => withAndroidSigning(config)
// 导出供测试/验证脚本直接调用(不经 prebuild 也能验证注入逻辑)
plugin.patchBuildGradle = patchBuildGradle
module.exports = plugin

/**
 * Expo Config Plugin:修复 @react-native/gradle-plugin autolinking 生成的 PackageList.java
 * import 路径错误。
 *
 * 问题根因:
 *   expo 包的 android/build.gradle 设 `namespace "expo.core"`,但 expo 源代码
 *   (ExpoModulesPackage.kt)的实际包名是 `expo.modules`。@react-native/gradle-plugin
 *   的 autolinking 从 namespace 推导 import 路径,生成 `import expo.core.ExpoModulesPackage;`,
 *   导致编译时找不到符号。
 *
 * 修复方案:
 *   在 app/build.gradle 注入一个 afterEvaluate task,在 compileXxxJavaWithJavac
 *   执行前(doFirst)把 PackageList.java 中的 `expo.core.ExpoModulesPackage` 替换为
 *   `expo.modules.ExpoModulesPackage`。
 *
 * 不能直接改 expo namespace 的原因:
 *   expo-modules-core 的 namespace 也是 `expo.modules`,若把 expo 的 namespace 也改成
 *   `expo.modules`,两个包都会生成 `expo.modules.BuildConfig`,导致 dex merge 冲突
 *   (Type expo.modules.BuildConfig is defined multiple times)。
 */
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = 'fixExpoImport'

function withExpoImportFix(config) {
  return withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents
    if (gradle.includes(MARKER)) return mod

    const fixTask = `
// ============================================================================
// ${MARKER}: @react-native/gradle-plugin autolinking 从 expo build.gradle 的 namespace
// "expo.core" 推导 import 路径,但 expo 源代码实际包名是 "expo.modules"。
// 在 compileJavaWithJavac 之前修正生成的 PackageList.java import 路径。
// 不能改 expo namespace:expo-modules-core 的 namespace 也是 "expo.modules",
// 改了会导致 BuildConfig 重复定义(dex merge 冲突)。
// ============================================================================
project.afterEvaluate {
    tasks.matching { it.name ==~ /compile\\w*JavaWithJavac/ }.configureEach {
        doFirst {
            def f = file("$buildDir/generated/autolinking/src/main/java/com/facebook/react/PackageList.java")
            if (f.exists() && f.text.contains('expo.core.ExpoModulesPackage')) {
                f.text = f.text.replace('expo.core.ExpoModulesPackage', 'expo.modules.ExpoModulesPackage')
                println '[${MARKER}] fixed expo import: expo.core -> expo.modules'
            }
        }
    }
}
`

    mod.modResults.contents = gradle.replace(
      '// Apply static values from `gradle.properties` to the `android.packagingOptions`',
      fixTask + '\n// Apply static values from `gradle.properties` to the `android.packagingOptions`',
    )
    return mod
  })
}

module.exports = withExpoImportFix

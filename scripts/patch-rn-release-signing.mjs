#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​​‌​​‌‌​‌‌​⁠

/**
 * patch-rn-release-signing.mjs — mobile-rn release APK 签名配置幂等注入(2026-09-03 P2)
 *
 * 背景: apps/mobile-rn/android/ 是 Expo prebuild 生成物(.gitignore 忽略),
 *       `pnpm expo prebuild` 会重置 android/app/build.gradle, 使 release 真签名配置丢失。
 * 本脚本对 build.gradle 幂等注入三段配置(带 2026-09-03 P2 标记, 已注入则跳过):
 *   1. versionName 同步 apps/mobile-rn/package.json (node 解析), versionCode 支持 -PversionCode 覆盖
 *   2. signingConfigs.release —— 凭据读用户级 ~/.gradle/gradle.properties(IHUI_RELEASE_*), 不入库
 *   3. buildTypes.release 条件签名: 有 IHUI_RELEASE_STORE_FILE → release 签名, 否则回退 debug
 *
 * 用法: node scripts/patch-rn-release-signing.mjs        # 幂等注入
 *       node scripts/patch-rn-release-signing.mjs -f     # --force 先还原模板再注入(验注入路径)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = join(ROOT, 'apps', 'mobile-rn', 'android', 'app', 'build.gradle')

const MARK = '2026-09-03 P2' // 注入标记(三段共用, 幂等检测锚点)

// ---------- 注入段定义(锚 = Expo prebuild 模板原文; 注入 = 目标态) ----------
const SECTIONS = [
  {
    label: '版本号同步 (versionName ← package.json)',
    detect: (s) => s.includes('def appVersionName'),
    apply: (s) =>
      s.replace(
        "def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'\n\nandroid {",
        [
          "def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'",
          '',
          `// 版本号(${MARK}): versionName 同步 apps/mobile-rn/package.json, 与 JS 侧保持一致;`,
          '// versionCode 支持 -PversionCode=N 覆盖(脚本内自增), 缺省 1。',
          'def appVersionName = new File(',
          "    [\"node\", \"--print\", \"require('./package.json').version\"].execute(null, rootDir.getAbsoluteFile().getParentFile()).text.trim()",
          ')',
          '',
          'android {',
        ].join('\n')
      ),
  },
  {
    label: 'defaultConfig 版本号接入',
    detect: (s) => s.includes("versionCode (findProperty('versionCode')"),
    apply: (s) =>
      s.replace(
        '        versionCode 1\n        versionName "0.0.0"\n',
        "        versionCode (findProperty('versionCode') ?: '1').toString().toInteger()\n        versionName appVersionName\n"
      ),
  },
  {
    label: 'signingConfigs.release (凭据读 ~/.gradle)',
    detect: (s) => s.includes('project.hasProperty(\'IHUI_RELEASE_STORE_FILE\')') && /signingConfigs \{\n        debug \{[\s\S]*?release \{/.test(s),
    apply: (s) =>
      s.replace(
        [
          '    signingConfigs {',
          '        debug {',
          "            storeFile file('debug.keystore')",
          "            storePassword 'android'",
          "            keyAlias 'androiddebugkey'",
          "            keyPassword 'android'",
          '        }',
          '    }',
        ].join('\n'),
        [
          '    signingConfigs {',
          '        debug {',
          "            storeFile file('debug.keystore')",
          "            storePassword 'android'",
          "            keyAlias 'androiddebugkey'",
          "            keyPassword 'android'",
          '        }',
          `        // ${MARK}: release 真签名 —— 凭据读用户级 ~/.gradle/gradle.properties(IHUI_RELEASE_*),`,
          '        // keystore 在仓库外(~/.android/ihui-release.keystore), 两者均不入库。',
          '        // 未配置时本块为空, release 构建回退 debug 签名(见 buildTypes.release)。',
          '        release {',
          "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
          '                storeFile file(IHUI_RELEASE_STORE_FILE)',
          '                storePassword IHUI_RELEASE_STORE_PASSWORD',
          '                keyAlias IHUI_RELEASE_KEY_ALIAS',
          '                keyPassword IHUI_RELEASE_KEY_PASSWORD',
          '            }',
          '        }',
          '    }',
        ].join('\n')
      ),
  },
  {
    label: 'buildTypes.release 条件签名 (有凭据→release, 无→debug)',
    detect: (s) => s.includes('release {\n            // Caution! In production') && s.includes('if (project.hasProperty(\'IHUI_RELEASE_STORE_FILE\')) {\n                signingConfig signingConfigs.release'),
    apply: (s) =>
      s.replace(
        [
          '        release {',
          '            // Caution! In production, you need to generate your own keystore file.',
          '            // see https://reactnative.dev/docs/signed-apk-android.',
          '            signingConfig signingConfigs.debug',
        ].join('\n'),
        [
          '        release {',
          '            // Caution! In production, you need to generate your own keystore file.',
          '            // see https://reactnative.dev/docs/signed-apk-android.',
          "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
          '                signingConfig signingConfigs.release',
          '            } else {',
          '                // 无签名凭据(CI/新机器): 回退 debug 签名保证可安装, 生产上架前必须配置',
          '                signingConfig signingConfigs.debug',
          '            }',
        ].join('\n')
      ),
  },
]

function restoreTemplate(s) {
  // 把三段注入还原为 Expo prebuild 模板原文(供 -f 重注入验证)
  let t = s
  t = t.replace(
    [
      '',
      `// 版本号(${MARK}): versionName 同步 apps/mobile-rn/package.json, 与 JS 侧保持一致;`,
      '// versionCode 支持 -PversionCode=N 覆盖(脚本内自增), 缺省 1。',
      'def appVersionName = new File(',
      "    [\"node\", \"--print\", \"require('./package.json').version\"].execute(null, rootDir.getAbsoluteFile().getParentFile()).text.trim()",
      ')',
      '',
    ].join('\n'),
    ''
  )
  t = t.replace(
    "        versionCode (findProperty('versionCode') ?: '1').toString().toInteger()\n        versionName appVersionName\n",
    '        versionCode 1\n        versionName "0.0.0"\n'
  )
  const rel = [
    `        // ${MARK}: release 真签名 —— 凭据读用户级 ~/.gradle/gradle.properties(IHUI_RELEASE_*),`,
    '        // keystore 在仓库外(~/.android/ihui-release.keystore), 两者均不入库。',
    '        // 未配置时本块为空, release 构建回退 debug 签名(见 buildTypes.release)。',
    '        release {',
    "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
    '                storeFile file(IHUI_RELEASE_STORE_FILE)',
    '                storePassword IHUI_RELEASE_STORE_PASSWORD',
    '                keyAlias IHUI_RELEASE_KEY_ALIAS',
    '                keyPassword IHUI_RELEASE_KEY_PASSWORD',
    '            }',
    '        }',
    '    }',
  ].join('\n')
  t = t.replace(rel, '    }')
  const btr = [
    '        release {',
    '            // Caution! In production, you need to generate your own keystore file.',
    '            // see https://reactnative.dev/docs/signed-apk-android.',
    "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
    '                signingConfig signingConfigs.release',
    '            } else {',
    '                // 无签名凭据(CI/新机器): 回退 debug 签名保证可安装, 生产上架前必须配置',
    '                signingConfig signingConfigs.debug',
    '            }',
  ].join('\n')
  t = t.replace(btr, [
    '        release {',
    '            // Caution! In production, you need to generate your own keystore file.',
    '            // see https://reactnative.dev/docs/signed-apk-android.',
    '            signingConfig signingConfigs.debug',
  ].join('\n'))
  return t
}

// ---------- main ----------
if (!existsSync(TARGET)) {
  console.error(`build.gradle 不存在: ${TARGET} (请确认 apps/mobile-rn/android 已 prebuild)`)
  process.exit(1)
}

const force = process.argv.includes('-f')
let src = readFileSync(TARGET, 'utf8')

if (force) {
  src = restoreTemplate(src)
  console.log('[patch] -f: 已还原模板态, 走全量注入路径')
}

let changed = 0
for (const sec of SECTIONS) {
  if (sec.detect(src)) {
    console.log(`[patch] [skip] ${sec.label} (已注入)`)
    continue
  }
  const next = sec.apply(src)
  if (next === src) {
    console.error(`[patch] [FAIL] ${sec.label} —— 锚点未匹配, 模板结构可能已变, 请人工核对`)
    process.exit(1)
  }
  src = next
  changed++
  console.log(`[patch] [ok]   ${sec.label}`)
}

if (changed) {
  writeFileSync(TARGET, src, 'utf8')
  console.log(`[patch] 已写入 ${changed} 段 -> ${TARGET}`)
} else {
  console.log('[patch] 无需改动, build.gradle 已含全部 release 签名配置')
}

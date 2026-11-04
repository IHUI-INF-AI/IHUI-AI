#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *
 * ⚠️ 2026-09-15 修复: 第 1 段注入的 versionCode 表达式原先缺一层外层括号,
 *    Groovy 会把 `(expr).toString().toInteger()` 当成独立调用链, 使 `versionCode`
 *    退化为属性读取并读到 null → `Value is null` 配置阶段直接失败(整个 assembleRelease 不可用)。
 *    详见 SECTIONS[1].apply 内注释, 改动请勿简化括号。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = join(ROOT, 'apps', 'mobile-rn', 'android', 'app', 'build.gradle')

const MARK = '2026-09-03 P2' // 注入标记(三段共用, 幂等检测锚点)

/**
 * 签名纪律文案(2026-11-04 立,机主令"不允许再出现签名不一致的情况 彻底根治杜绝")。
 * 要堵的不是"debug 签名存在",而是"debug 签名静默可得":
 * 缺凭据时旧配置直接回落 signingConfigs.debug,产物证书是 CN=Android Debug,
 * 而 gradle 照样 BUILD SUCCESSFUL —— 装机当场 INSTALL_FAILED_UPDATE_INCOMPATIBLE,
 * 唯一"能装上"的出路是 uninstall,而那会清掉用户登录态(本仓明令禁止)。
 * 现在不显式给 -PallowDebugSigning 就在配置期失败;CI 要 dev 包必须自己声明。
 */
const SIGN_DISCIPLINE =
  'IHUI AI 签名纪律(2026-11-04 立):缺 IHUI_RELEASE_* 凭据 ⇒ 拒绝产出 debug.keystore 签名的包。' +
  ' 静默回落会让账面 BUILD SUCCESSFUL 而产物证书是 CN=Android Debug,装到正式签名机上' +
  ' 当场 INSTALL_FAILED_UPDATE_INCOMPATIBLE,而唯一"能装上"的出路 uninstall 会清掉登录态。' +
  ' 确需 dev 包(CI)请在 gradle 命令行显式加 -PallowDebugSigning=true,让签名身份由调用方声明而不是由缺件决定。'

/**
 * 取 buildTypes 段里某个 buildType 块的内容(不含大括号行)。
 * 旧 detect 写的是「buildTypes 段里出现过 signingConfig signingConfigs.release」,
 * 而 debug 块注入后同样含这一串 ⇒ 未注入的那一段会被已注入的兄弟段判成"已注入",
 * 于是注入器报 [skip]、盘上仍是回落形态。判据必须按块定位,不能按段内出现算。
 */
function buildTypeBlock(s, name) {
  const bt = s.indexOf('buildTypes {')
  if (bt < 0) return ''
  const open = new RegExp(`\\n {8}${name} \\{`)
  const m = open.exec(s.slice(bt))
  if (!m) return ''
  const start = bt + m.index + m[0].length
  const end = s.indexOf('\n        }', start)
  return end < 0 ? '' : s.slice(start, end)
}

/** 依次试多组锚点,命中即替换:同一目标态对应"模板原文 / 旧手改态 / 旧注入态"三种前像。 */
function replaceAny(src, pairs) {
  for (const [from, to] of pairs) {
    if (src.includes(from)) return src.replace(from, to)
  }
  return src
}

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
          // ⚠️ 必须让 appVersionName 保持 **String** 类型。
          // 曾写成 `new File([...].execute(...).text.trim())` —— 拿到的是 File 对象,
          // 而 AGP 的 versionName 是 Property<String>, File → String 转换失败被置为 null,
          // 抛 `IllegalArgumentException: Value is null`(行号指向 versionName 那一行)。
          // 2026-09-15 实测修复, 请勿再包 new File。
          'def appVersionName = ["node", "--print", "require(\'./package.json\').version"].execute(null, rootDir.getAbsoluteFile().getParentFile()).text.trim()',
          '',
          'android {',
        ].join('\n')
      ),
  },
  {
    label: 'defaultConfig 版本号接入',
    // detect 只认 findProperty('versionCode') 本身, 兼容 2026-09-15 前后的两种写法
    detect: (s) => s.includes("findProperty('versionCode')"),
    apply: (s) => {
      // 锚点必须对「当前版本号」不敏感。原先写死 `versionCode 1 / versionName "0.0.0"`,
      // 任何人手抬一次版本号(实测 build.gradle 已到 versionCode 5 / 0.0.4)这段注入就静默
      // 不再匹配 → build-mobile-rn-release.ps1 第 1 步直接 FAIL,整条出包流水线断。
      const m = /( {8})versionCode\s+(\d+)\r?\n( {8})versionName\s+"[^"]*"\r?\n/.exec(s)
      if (!m) {
        console.error('[patch] [FAIL] defaultConfig 版本号接入 —— 未匹配 versionCode/versionName 行,请人工核对模板结构')
        return s
      }
      // 兜底值沿用模板里现有的 versionCode,避免注入后默认值回退导致
      // adb install 报 INSTALL_FAILED_VERSION_DOWNGRADE(装过 5 再装 1 会被拒)。
      // ⚠️ 表达式必须保留**外层括号**:写成 `versionCode (expr).toString().toInteger()` 时
      //    Groovy 会把 `(expr).toString().toInteger()` 当独立调用链,versionCode 退化成属性
      //    读取 → null → Gradle 配置期抛 `IllegalArgumentException: Value is null`(2026-09-15 实测)。
      return s.replace(m[0], `${m[1]}versionCode((findProperty('versionCode') ?: '${m[2]}').toString().toInteger())\n${m[3]}versionName appVersionName\n`)
    },
  },
  {
    label: 'signingConfigs.release (凭据读 ~/.gradle)',
    // 判据放宽成「signingConfigs 段里已有 release 块」(2026-10-18):
    // 本机 build.gradle 已有一份生效的 release 签名(指向 apps/mobile-rn/credentials/release.keystore,
    // 存量 APK/AAB 就是这把证书签的)。此时再按模板锚点重注入必然匹配失败 ⇒ 整条出包链在第 1 步就断。
    // 已有 release 签名即视为"已配置",不再要求它必须读 IHUI_RELEASE_*。
    // 〔2026-10-27 修误报〕旧正则 `/signingConfigs \{[\s\S]{0,2000}?\n {8}release \{/` 会被
    // buildTypes.release 命中(prebuild 生成文件里它恰好也是 8 空格缩进、且必在 2000 字窗内)
    // ⇒ expo prebuild 后每轮必误判"已注入" ⇒ signingConfigs 里根本没 release 块,
    // gradle 配置期抛 `Could not get unknown property 'release' for SigningConfig container`。
    // 收窄:只在 signingConfigs 段与 buildTypes 段**之间**找 8 空格的 release 块。
    detect: (s) => {
      const start = s.indexOf('    signingConfigs {')
      const end = s.indexOf('    buildTypes {', start)
      if (start === -1 || end === -1) return false
      return /\n {8}release \{/.test(s.slice(start, end))
    },
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
    label: 'buildTypes.release 签名 (有凭据→release; 无凭据且未显式授权→配置期失败)',
    detect: (s) => buildTypeBlock(s, 'release').includes('allowDebugSigning'),
    apply: (s) =>
      replaceAny(s, [
        // 锚 1:Expo/RN prebuild 模板原文
        [
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
            "            } else if (!project.hasProperty('allowDebugSigning')) {",
            `                throw new GradleException('${SIGN_DISCIPLINE}')`,
            '            } else {',
            '                // 显式授权档(CI dev 包):产物名带 dev- 前缀、禁发布到 Release',
            '                signingConfig signingConfigs.debug',
            '            }',
          ].join('\n'),
        ],
        // 锚 2:2026-09-03 起的旧注入态(无凭据静默回落 debug,不报错)
        [
          [
            "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
            '                signingConfig signingConfigs.release',
            '            } else {',
            '                // 无签名凭据(CI/新机器): 回退 debug 签名保证可安装, 生产上架前必须配置',
            '                signingConfig signingConfigs.debug',
            '            }',
          ].join('\n'),
          [
            "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
            '                signingConfig signingConfigs.release',
            "            } else if (!project.hasProperty('allowDebugSigning')) {",
            `                throw new GradleException('${SIGN_DISCIPLINE}')`,
            '            } else {',
            '                // 显式授权档(CI dev 包):产物名带 dev- 前缀、禁发布到 Release',
            '                signingConfig signingConfigs.debug',
            '            }',
          ].join('\n'),
        ],
      ]),
  },
  {
    label: 'buildTypes.debug 签名 (signing-unify 收编进注入器; 无凭据且未显式授权→配置期失败)',
    // 2026-11-04 新增这一段。此前 debug 块那行"debug 变体也用正式 keystore"是手改进
    // apps/mobile-rn/android/app/build.gradle 的 —— 那是 Expo prebuild 生成物、gitignored,
    // 仓里 grep 不到任何出处,也没有还原/检测条目;任何人跑一次 expo prebuild 它就静默消失,
    // debug 变体当场回落 debug.keystore,而 gradle 仍是 BUILD SUCCESSFUL。
    // 实测后果:2026-11-04 拿一枚回落形态的旧 app-debug.apk 当"debug 必是 debug 签名"的证据,
    // 差点据此放弃热更通道并考虑 uninstall(会清登录态)。
    detect: (s) => buildTypeBlock(s, 'debug').includes('allowDebugSigning'),
    apply: (s) =>
      replaceAny(s, [
        // 锚 1:prebuild 模板原文
        [
          [
            '        debug {',
            '            signingConfig signingConfigs.debug',
            '        }',
          ].join('\n'),
          [
            '        debug {',
            '            // [IHUI signing-unify] debug 变体同样使用正式 keystore(由 patch-rn-release-signing.mjs 注入)',
            "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
            '                signingConfig signingConfigs.release',
            "            } else if (!project.hasProperty('allowDebugSigning')) {",
            `                throw new GradleException('${SIGN_DISCIPLINE}')`,
            '            } else {',
            '                // 显式授权档(CI dev 包):产物名带 dev- 前缀、禁发布到 Release',
            '                signingConfig signingConfigs.debug',
            '            }',
            '        }',
          ].join('\n'),
        ],
        // 锚 2:此前手改进生成物的 signing-unify 旧态(三元回落,缺凭据即静默出 debug 签名)
        [
          [
            '        debug {',
            '            // [IHUI signing-unify] debug 变体同样使用正式 keystore(见本插件头注释)',
            '            signingConfig(project.hasProperty(\'IHUI_RELEASE_STORE_FILE\') ? signingConfigs.release : signingConfigs.debug)',
            '        }',
          ].join('\n'),
          [
            '        debug {',
            '            // [IHUI signing-unify] debug 变体同样使用正式 keystore(由 patch-rn-release-signing.mjs 注入)',
            "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
            '                signingConfig signingConfigs.release',
            "            } else if (!project.hasProperty('allowDebugSigning')) {",
            `                throw new GradleException('${SIGN_DISCIPLINE}')`,
            '            } else {',
            '                // 显式授权档(CI dev 包):产物名带 dev- 前缀、禁发布到 Release',
            '                signingConfig signingConfigs.debug',
            '            }',
            '        }',
          ].join('\n'),
        ],
      ]),
  },
]

function restoreTemplate(s) {
  // 把三段注入还原为 Expo prebuild 模板原文(供 -f 重注入验证)
  let t = s
  // 2026-09-15: appVersionName 有新旧两种注入写法, 都要能还原 ——
  //   新: 单行 String(Gradle 里直接可用)
  //   旧: `new File(...)` 三行(返回 File 对象 → Property<String> 转换失败 → "Value is null")
  const VER_COMMENT = [
    `// 版本号(${MARK}): versionName 同步 apps/mobile-rn/package.json, 与 JS 侧保持一致;`,
    '// versionCode 支持 -PversionCode=N 覆盖(脚本内自增), 缺省 1。',
  ]
  for (const verBlock of [
    [
      '',
      ...VER_COMMENT,
      "def appVersionName = [\"node\", \"--print\", \"require('./package.json').version\"].execute(null, rootDir.getAbsoluteFile().getParentFile()).text.trim()",
      '',
    ].join('\n'),
    [
      '',
      ...VER_COMMENT,
      'def appVersionName = new File(',
      "    [\"node\", \"--print\", \"require('./package.json').version\"].execute(null, rootDir.getAbsoluteFile().getParentFile()).text.trim()",
      ')',
      '',
    ].join('\n'),
  ]) {
    t = t.replace(verBlock, '')
  }
  // 2026-09-15: 兼容还原"旧注入写法" —— 旧写法缺外层括号, 会让 Groovy 把 versionCode
  // 降级为属性读取并崩溃(详见 SECTIONS 内注释)。两种写法都要能还原。
  for (const injected of [
    "        versionCode((findProperty('versionCode') ?: '1').toString().toInteger())\n        versionName appVersionName\n",
    "        versionCode (findProperty('versionCode') ?: '1').toString().toInteger()\n        versionName appVersionName\n",
  ]) {
    t = t.replace(injected, '        versionCode 1\n        versionName "0.0.0"\n')
  }
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
  const btrOld = [
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
  const btrNew = [
    '        release {',
    '            // Caution! In production, you need to generate your own keystore file.',
    '            // see https://reactnative.dev/docs/signed-apk-android.',
    "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
    '                signingConfig signingConfigs.release',
    "            } else if (!project.hasProperty('allowDebugSigning')) {",
    `                throw new GradleException('${SIGN_DISCIPLINE}')`,
    '            } else {',
    '                // 显式授权档(CI dev 包):产物名带 dev- 前缀、禁发布到 Release',
    '                signingConfig signingConfigs.debug',
    '            }',
  ].join('\n')
  const btrTpl = [
    '        release {',
    '            // Caution! In production, you need to generate your own keystore file.',
    '            // see https://reactnative.dev/docs/signed-apk-android.',
    '            signingConfig signingConfigs.debug',
  ].join('\n')
  t = t.includes(btrNew) ? t.replace(btrNew, btrTpl) : t.replace(btrOld, btrTpl)
  // debug 段(2026-11-04 补):注入态与"此前手改进生成物"的旧 signing-unify 态都要还原回模板原文。
  // 少这一半,-f 就还原不干净 ⇒ 重注入时 detect 仍报"已注入","验注入路径"那一档会假绿。
  const dbgNew = [
    '        debug {',
    '            // [IHUI signing-unify] debug 变体同样使用正式 keystore(由 patch-rn-release-signing.mjs 注入)',
    "            if (project.hasProperty('IHUI_RELEASE_STORE_FILE')) {",
    '                signingConfig signingConfigs.release',
    "            } else if (!project.hasProperty('allowDebugSigning')) {",
    `                throw new GradleException('${SIGN_DISCIPLINE}')`,
    '            } else {',
    '                // 显式授权档(CI dev 包):产物名带 dev- 前缀、禁发布到 Release',
    '                signingConfig signingConfigs.debug',
    '            }',
    '        }',
  ].join('\n')
  const dbgHandEdit = [
    '        debug {',
    '            // [IHUI signing-unify] debug 变体同样使用正式 keystore(见本插件头注释)',
    "            signingConfig(project.hasProperty('IHUI_RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug)",
    '        }',
  ].join('\n')
  const dbgTpl = ['        debug {', '            signingConfig signingConfigs.debug', '        }'].join(
    '\n'
  )
  if (t.includes(dbgNew)) t = t.replace(dbgNew, dbgTpl)
  else if (t.includes(dbgHandEdit)) t = t.replace(dbgHandEdit, dbgTpl)
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

// ---------- gradle.properties 内存档(2026-10-29 实测) ----------
// 这个文件同样是 prebuild 生成物,模板给的是 `-Xmx2048m -XX:MaxMetaspaceSize=512m`。
// 本仓 40+ 原生模块 + KSP + lintVitalAnalyzeRelease 一起跑时,512m 元空间不够:
// 实测 `e: [ksp] java.lang.OutOfMemoryError: Metaspace` 直接把 daemon 打死,
// 外层只看到 "Gradle build daemon disappeared unexpectedly"(不点名 OOM,极易被读成随机崩溃)。
// 只抬高、不降低:已经比目标大的值原样保留(别的机器/别的模板给的更大档是合法的)。
const GRADLE_PROPS = join(ROOT, 'apps', 'mobile-rn', 'android', 'gradle.properties')
const NEED_XMX = 4096
const NEED_META = 2048

if (!existsSync(GRADLE_PROPS)) {
  console.error(`[patch] [FAIL] gradle.properties 不存在: ${GRADLE_PROPS} (prebuild 未完成?)`)
  process.exit(1)
}
const propsText = readFileSync(GRADLE_PROPS, 'utf8')
const jvmLine = /^org\.gradle\.jvmargs=.*$/m
const curLine = propsText.match(jvmLine)?.[0] ?? ''
const curXmx = Number(curLine.match(/-Xmx(\d+)m/)?.[1] ?? 0)
const curMeta = Number(curLine.match(/-XX:MaxMetaspaceSize=(\d+)m/)?.[1] ?? 0)
if (curXmx >= NEED_XMX && curMeta >= NEED_META) {
  console.log(`[patch] [skip] gradle.properties 内存档 (${curLine || '缺省'})`)
} else {
  const want = `org.gradle.jvmargs=-Xmx${NEED_XMX}m -XX:MaxMetaspaceSize=${NEED_META}m`
  const next = jvmLine.test(propsText)
    ? propsText.replace(jvmLine, want)
    : `${propsText.trimEnd()}\n${want}\n`
  writeFileSync(GRADLE_PROPS, next, 'utf8')
  console.log(`[patch] [ok]   gradle.properties 内存档 ${curLine || '(缺行)'} -> ${want}`)
}

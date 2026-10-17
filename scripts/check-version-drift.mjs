#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-version-drift.mjs — 「版本号必须自动」的结构守门(零网络、零凭据、纯文件对账)
 *
 * 立这一道门的因(2026-10-17):
 *   那天查出一条**已经静默存在四天**的线上事故 —— 下载页与更新器 feed 停在 0.1.54,
 *   而仓库早已发到 0.1.58。它有自动刷新机制,机制也确实每天在跑,但**每一次都被拒**:
 *   main 要求 status check「CI / lint-typecheck-test (push)」,而 GITHUB_TOKEN 推送产生的
 *   commit 不触发 workflow run ⇒ check 永远缺席 ⇒ GH006 拒收。于是每天产出一个失败 run,
 *   连续四天,没人看。
 *
 *   更早一点,安卓侧是另一副面孔:设置页写死 1.0.2、Demo 页写死 1.0.0、真实版本 0.0.5 ——
 *   三个号互相矛盾;而 Capacitor 壳干脆写死 `versionName "1.0"` 从不跟真实版本走。
 *
 *   两件事的共同点是:**代码里存在"看起来像版本号、但不由任何东西驱动"的字符串**。
 *   这种字符串不会报错、不会崩,只会在某天被用户发现"你这版本号怎么不对"。
 *   ⇒ 本守门的判据不是"版本号是多少",而是"**每个对外可见的版本号都必须能追溯到某个源头**"。
 *
 * 判据(任一不成立即 exit 1):
 *   A 桌面双写一致:tauri.conf.json 的 version === apps/desktop/package.json 的 version
 *     (桌面热修必须两处同笔 bump,这是仓库既有铁律,单独漏一侧就会发出版本号与包不符的包)
 *   B RN 原生版本可追溯:app.config.js 的 version 必须取自 IHUI_MOBILE_VERSION 或 package.json
 *   C RN 界面版本可追溯:src/lib/config.ts 的 APP_VERSION 必须取自
 *     EXPO_PUBLIC_IHUI_MOBILE_VERSION 或 package.json
 *   D Capacitor 壳不得写死:build.gradle 的 versionName/versionCode 不得是字面量
 *   E 下载页不得有"假号":web/mobile/extension/cli 四端不得写死语义版本字面量
 *   F 更新器 feed 必须走运行期解析(不得退回读静态快照)
 *   G 不得再出现 bot 裸 push 到 main 的 workflow 步骤(那条路是 GH006 死锁,只会制造假红)
 *   H 桌面安装包不得回到 offlineInstaller —— 那会把 ≈205MB 的 WebView2 运行时塞进包,
 *     使 exe 超过 Gitee 单文件 100MB 硬上限,国内用户从此拿不到 Windows 安装包
 *     (2026-10-17 实测:0.1.74 的 Gitee release 只有 .exe.sig、没有 .exe)。
 *
 * 用法:
 *   node scripts/check-version-drift.mjs           # 检查,失败 exit 1
 *   node scripts/check-version-drift.mjs --json     # 机器可读
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

/** 语义版本字面量(如 '1.0.0' / "0.0.5");用于识别"写死的版本号" */
const SEMVER_LITERAL = /['"]\d+\.\d+\.\d+(?:[-+][\w.-]+)?['"]/

function read(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return null
  return readFileSync(abs, 'utf-8')
}

function readJson(rel) {
  const txt = read(rel)
  if (txt === null) return null
  try {
    return JSON.parse(txt)
  } catch {
    return null
  }
}

/**
 * 纯判据集合:输入是"读到的文本/对象",输出是违规清单。
 * 抽成纯函数是为了让镜像测试能直接喂反例(见 scripts/tests/check-version-drift.test.mjs),
 * 而不是靠"改了源文件再跑一遍"这种会留下痕迹的验证方式。
 *
 * @param {{
 *   tauriConf: object|null, desktopPkg: object|null, appConfigJs: string|null,
 *   rnConfigTs: string|null, capGradle: string|null, downloadsConfig: string|null,
 *   feedRouteJs: string|null, feedRouteApi: string|null, workflows: Record<string,string>,
 * }} input
 * @returns {string[]} 违规描述;空数组 = 全部通过
 */
export function findVersionDrift(input) {
  const v = []
  const {
    tauriConf,
    desktopPkg,
    appConfigJs,
    rnConfigTs,
    capGradle,
    downloadsConfig,
    feedRouteJs,
    feedRouteApi,
    workflows,
  } = input

  // A 桌面双写一致
  const tauriV = tauriConf?.version
  const desktopV = desktopPkg?.version
  if (tauriV && desktopV && tauriV !== desktopV) {
    v.push(
      `A 桌面版本双写不一致:tauri.conf.json=${tauriV} 而 apps/desktop/package.json=${desktopV}` +
        '(热修必须两处同笔 bump,否则会发出"包版本 ≠ 界面版本"的包)',
    )
  }

  // B RN 原生版本可追溯
  if (appConfigJs !== null) {
    if (!/IHUI_MOBILE_VERSION/.test(appConfigJs)) {
      v.push('B app.config.js 未消费 IHUI_MOBILE_VERSION —— 版本号又变成人敲的死数字了')
    }
    if (!/pkg\.version/.test(appConfigJs)) {
      v.push('B app.config.js 缺 package.json 兜底(本地/未注入构建会拿不到版本号)')
    }
  }

  // C RN 界面版本可追溯
  if (rnConfigTs !== null) {
    if (!/EXPO_PUBLIC_IHUI_MOBILE_VERSION/.test(rnConfigTs)) {
      v.push('C src/lib/config.ts 的 APP_VERSION 未消费 EXPO_PUBLIC_IHUI_MOBILE_VERSION')
    }
    if (!/PKG_VERSION/.test(rnConfigTs)) {
      v.push('C src/lib/config.ts 缺 package.json 兜底')
    }
  }

  // D Capacitor 壳不得写死
  if (capGradle !== null) {
    if (/^\s*versionName\s+["']/m.test(capGradle)) {
      v.push('D mobile-cap build.gradle 的 versionName 又被写死成字面量了')
    }
    if (/^\s*versionCode\s+\d+\s*$/m.test(capGradle)) {
      v.push('D mobile-cap build.gradle 的 versionCode 又被写死成字面量了')
    }
  }

  // E 下载页不得有假号(只查四端版本字段,不查注释/兜底常量)
  if (downloadsConfig !== null) {
    for (const platform of ['web', 'mobile', 'extension', 'cli']) {
      const re = new RegExp(`${platform}:\\s*\\{[^}]*?version:\\s*${SEMVER_LITERAL.source}`, 's')
      if (re.test(downloadsConfig)) {
        v.push(
          `E downloads.config.ts 的 ${platform} 端又写死了版本号字面量(历史上写死 1.0.0 从未对过)`,
        )
      }
    }
  }

  // F 更新器 feed 必须走运行期解析
  for (const [name, src] of [
    ['app/desktop-feed.json/route.ts', feedRouteJs],
    ['app/api/desktop-feed/route.ts', feedRouteApi],
  ]) {
    if (src === null) continue
    if (!/resolveDesktopFeedForUpdater/.test(src)) {
      v.push(`F ${name} 未走 resolveDesktopFeedForUpdater —— 退回读静态快照即"发版不生效"复发`)
    }
  }

  // G 不得再有 bot 裸 push 到 main
  for (const [name, src] of Object.entries(workflows || {})) {
    if (src === null) continue
    // 判据:某一行出现 `git push` 且(a)后面没有参数(裸 push,落在默认分支上)
    //   或(b)参数里提到 main(origin main / HEAD:refs/heads/main 都是推 main)。
    // 不误伤:`git push origin HEAD:refs/heads/bot/foo` 这类推功能分支的写法。
    // 逐行而不是整篇正则 —— 单行形态(`run: git push origin main`)与块形态(`run: |` 后缩进)
    // 都要覆盖,用一条 `^\s*git push` 只能抓后者(实测漏判)。
    const offenders = src.split('\n').filter((line) => {
      const m = line.match(/(?:^|[\s;|&])git\s+push\b(.*)$/)
      if (!m) return false
      const rest = m[1].trim()
      return rest === '' || /\bmain\b/.test(rest)
    })
    if (offenders.length > 0) {
      v.push(
        `G ${name} 出现 bot 裸 push 到 main(${offenders.length} 处)—— 该路径在 protected main 上` +
          '恒被 GH006 拒(GITHUB_TOKEN 推送不触发 workflow ⇒ required check 永不出现),' +
          '只会制造每天一次的假红',
      )
    }
  }

  // H 桌面安装包不得回到 offlineInstaller(分发能力守门)
  //
  // 这一条守的不是"版本号"本身,而是**版本号背后的包还能不能被国内用户拿到**。
  // 立因是实测:2026-10-16 改成 offlineInstaller 后,exe 从 ~8MB 涨到 225,269,867 字节
  // (内嵌的 WebView2 运行时本机实测 214,131,448 字节),结构性超过 Gitee 单文件 100MB
  // 硬上限 ⇒ 0.1.74 的 Gitee release 里**只有 `.exe.sig`、没有 `.exe` 本体**,
  // 而 Windows 是国内主力平台。embedBootstrapper 只内嵌 ≈1.8MB 引导器,包回到 10MB 量级。
  //
  // 显式豁免(真要恢复"完全离线可装"时用):在 tauri.conf.json 的 `_comment` 同级写不下
  // (严格 schema),改为在本文件行内以 `ALLOW_OFFLINE_INSTALLER` 注明分发方案 —— 没有方案
  // 就豁免不成立,正是因为"离线可装"的代价是"国内下载不了",必须是有意识的选择。
  const mode = tauriConf?.bundle?.windows?.webviewInstallMode?.type
  if (mode === 'offlineInstaller') {
    v.push(
      'H bundle.windows.webviewInstallMode 回到 offlineInstaller —— 会把 ≈205MB 的 WebView2 ' +
        '运行时打进安装包,exe 结构性超过 Gitee 单文件 100MB 硬上限(实测 225,269,867 字节),' +
        '国内用户从此拿不到 Windows 安装包。改回前必须先给出替代分发方案(自建 CDN / 生产机中转),' +
        '并在此处行内注明 ALLOW_OFFLINE_INSTALLER + 方案。',
    )
  }

  return v
}

/** 从工作区读取全部输入(与 findVersionDrift 分离,便于测试注入) */
export function collectInputs() {
  const workflows = {}
  for (const name of [
    'sync-downloads.yml',
    'release-desktop.yml',
    'mobile-apk-build.yml',
    'mobile-ios-ipa-build.yml',
    'ci.yml',
  ]) {
    workflows[name] = read(join('.github', 'workflows', name))
  }
  return {
    tauriConf: readJson('apps/desktop/src-tauri/tauri.conf.json'),
    desktopPkg: readJson('apps/desktop/package.json'),
    appConfigJs: read('apps/mobile-rn/app.config.js'),
    rnConfigTs: read('apps/mobile-rn/src/lib/config.ts'),
    capGradle: read('apps/mobile-cap/android/app/build.gradle'),
    downloadsConfig: read('apps/web/src/config/downloads.config.ts'),
    feedRouteJs: read('apps/web/app/desktop-feed.json/route.ts'),
    feedRouteApi: read('apps/web/app/api/desktop-feed/route.ts'),
    workflows,
  }
}

export function main(argv = process.argv.slice(2)) {
  const JSON_OUT = argv.includes('--json')
  const violations = findVersionDrift(collectInputs())
  if (JSON_OUT) {
    process.stdout.write(
      `${JSON.stringify({ ok: violations.length === 0, violations }, null, 2)}\n`,
    )
  } else if (violations.length === 0) {
    process.stdout.write('[check-version-drift] PASS —— 每个对外可见的版本号都可追溯到源头\n')
  } else {
    process.stdout.write(`[check-version-drift] FAIL —— ${violations.length} 项漂移风险:\n`)
    for (const item of violations) process.stdout.write(`  ✗ ${item}\n`)
  }
  return violations.length === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

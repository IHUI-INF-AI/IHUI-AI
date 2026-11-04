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
 *   I 移动端双写一致:apps/mobile-rn/app.json 的 version === 同目录 package.json 的 version
 *     (2026-10-27 立,A 的移动端同型:app.config.js 未注入 IHUI_MOBILE_VERSION 时回落 package.json,
 *      两处漂开就等于"包内显示的版本号"落后;实测曾出现 0.0.6 / 0.0.8 / 0.0.7 三处各说一套)
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
 *   J 扩展端版本单一源头(2026-11-04 立):wxt.config.ts 的 manifest.version 不得是字面量,
 *     下载页 extension 资产 href 也不得内嵌版本号字面量 —— 两者都必须由 apps/extension/package.json
 *     驱动(WXT 在 manifest.version 缺省时回落它;sync-downloads 的文件名同样取它)。
 *     写死的那份"看起来像版本号、却不被任何东西驱动":bump package.json 后文件名是 v1.0.1,
 *     而装进 Chrome 的包仍显示 1.0.0 —— 两边今天相等纯属巧合。
 *   K 全端"对外报版本"的脸按台账对账(2026-11-04 立):K1 = scripts/data/version-single-source-files.json
 *     点名的文件(六端的 about 页 / 能力上报 / MCP serverInfo / 公开状态页)里不得出现版本字面量;
 *     K2 = scripts/data/version-single-source-pairs.json 里三份安装器清单(scoop/winget/snap)的每处
 *     版本号必须逐字等于 apps/cli/package.json。台账坏、点名文件读不到、正则枚举到 0 处 ⇒ 一律判红,
 *     不做"读不到就放过"(§0.3/§0.10)。
 *
 * 用法:
 *   node scripts/check-version-drift.mjs           # 检查,失败 exit 1
 *   node scripts/check-version-drift.mjs --json     # 机器可读
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { maskComments } from './lib/code-mask.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

/**
 * §22c:移动端两条判据的**材料只写这一份** —— 镜像测试 import 它,不得在测试里重抄句子
 * (守门 191 `check-test-judge-not-replicated.mjs` 的 F1 抓的就是"import 了本门又把材料写一遍")。
 * 必须声明在本文件任何调用之前:底部 `isDirectRun` 守卫会在模块求值期就调 `main()`。
 */
export const MOBILE_JUDGE_MESSAGES = {
  appEnvUnconsumed: 'B app.config.js 未消费 IHUI_MOBILE_VERSION —— 版本号又变成人敲的死数字了',
  rnEnvUnconsumed: 'C src/lib/config.ts 的 APP_VERSION 未消费 EXPO_PUBLIC_IHUI_MOBILE_VERSION',
}

/** 语义版本字面量(如 '1.0.0' / "0.0.5");用于识别"写死的版本号" */
const SEMVER_LITERAL = /['"]\d+\.\d+\.\d+(?:[-+][\w.-]+)?['"]/

/**
 * J/K 维共用的那条尺:标识符名里带 version 却被赋成一个语义版本字面量。
 * 单份实现(§0.6)—— wxt.config.ts、扩展源码、六端台账都问它,不各写一遍。
 * 判字面量 ⇒ 只遮注释不遮字符串(`maskComments` 等长,行号不漂)。
 * 刻意不判名字里带 protocol 的标识符:协议版本(如 `PROTOCOL_VERSION = "2026.09.18"`、MCP 的
 * `2025-06-18`)是**契约常量**,本就该写字面量并由对端协商;把它算成"产品版本死值"等于逼人给台账
 * 加豁免。产品面(SERVER/APP/CLIENT/manifest version)照判 —— 正反用例见镜像测试 K1 两档。
 */
const VERSION_LITERAL_ASSIGN =
  /\b(\w*version\w*)\s*[:=]\s*['"`]\d+\.\d+\.\d+(?:[-+][\w.-]+)?['"`]/gi
export function hasVersionLiteral(text) {
  for (const m of maskComments(String(text)).matchAll(VERSION_LITERAL_ASSIGN)) {
    if (/protocol/i.test(m[1] ?? '')) continue
    return true
  }
  return false
}

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
 *   mobileAppJson: object|null, mobilePkg: object|null,
 *   wxtConfig: string|null, extensionSources: Record<string,string|null>,
 *   versionLedger: {files:array,pairs:array}|null, versionFileTexts: Record<string,string|null>,
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
    mobileAppJson,
    mobilePkg,
    wxtConfig,
    extensionSources,
    versionLedger,
    versionFileTexts,
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

  // I 移动端双写一致(2026-10-27 立,A 的移动端同型)
  // app.config.js 的 version 取 `IHUI_MOBILE_VERSION || pkg.version`,而未注入时的兜底值就是
  // apps/mobile-rn/package.json —— 它若与 app.json 的 version 漂开,包里显示的就是旧号。
  // 实测现成事故形态:package.json=0.0.6、app.json=0.0.8、README=0.0.7 三处各说一套。
  // 2026-10-30 修:此前取的是顶层 `mobileAppJson?.version`,而真实 app.json 是
  // `{ expo: { version } }`(Expo 的 schema 一层包裹)⇒ 左值恒 undefined ⇒ `A && B` 恒假,
  // 判据静默失效。实测:app.json=0.0.9 而 package.json=0.0.5,本门照判 PASS。
  // 平行的自测也按同一错误假设写(夹具用扁平 `{ version }`),两边互相"验证"了错误。
  // 现两种形态都认(expo 包裹优先),缺一侧仍不判 —— 那是本门既有契约,不改。
  const appJsonV = mobileAppJson?.expo?.version ?? mobileAppJson?.version
  const mobilePkgV = mobilePkg?.version
  if (appJsonV && mobilePkgV && appJsonV !== mobilePkgV) {
    v.push(
      `I 移动端版本双写不一致:app.json=${appJsonV} 而 apps/mobile-rn/package.json=${mobilePkgV}` +
        '(未注入 IHUI_MOBILE_VERSION 的构建会回落成后者,包内显示的版本号就此落后)',
    )
  }

  // I2 静态 versionCode 是死值(2026-10-30 立,实测咬到):构建读的是 app.config.js 的
  // resolveBuildNumber() 派生值,app.json 里那份静态号**没有任何消费者** —— 于是它必然与真实
  // 版本漂开(实测 app.json=26102802 而当日实产 26103001)。这正是本门头注要消灭的那类字符串:
  // 看起来像版本号、却不被任何东西驱动。
  const staticVc = mobileAppJson?.expo?.android?.versionCode
  if (staticVc !== undefined && staticVc !== null) {
    v.push(
      `I2 app.json 声明了静态 android.versionCode=${staticVc}:构建实际用 app.config.js 的 ` +
        'resolveBuildNumber() 派生值,这份声明没有消费者,只会与真实版本号漂开(要固定号段请改 ' +
        'resolveBuildNumber,不要写静态声明)',
    )
  }

  // B RN 原生版本可追溯
  if (appConfigJs !== null) {
    if (!/IHUI_MOBILE_VERSION/.test(appConfigJs)) {
      v.push(MOBILE_JUDGE_MESSAGES.appEnvUnconsumed)
    }
    if (!/pkg\.version/.test(appConfigJs)) {
      v.push('B app.config.js 缺 package.json 兜底(本地/未注入构建会拿不到版本号)')
    }
  }

  // C RN 界面版本可追溯
  if (rnConfigTs !== null) {
    if (!/EXPO_PUBLIC_IHUI_MOBILE_VERSION/.test(rnConfigTs)) {
      v.push(MOBILE_JUDGE_MESSAGES.rnEnvUnconsumed)
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
      // 整行注释(YAML 说明行 / run 块里的 shell 注释)不执行,不算 bot 裸 push。
      // 只剥**整行**注释:行尾注释(`git push origin main # 推 main`)里的命令照样执行 ⇒ 不豁免。
      if (/^\s*#/.test(line)) return false
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

  // J 扩展端版本单一源头(2026-11-04 立)
  //   文件名与下载页版本取 apps/extension/package.json(scripts/sync-downloads.mjs 的
  //   readExtensionVersion),包内 manifest 由 WXT 在同一处兜底(manifest.version 缺省时回落
  //   package.json)。任何一处把它写成字面量,就等于让"装进 Chrome 的版本"与"下载页/文件名的
  //   版本"分头走 —— 两边今天相等纯属巧合。
  if (wxtConfig !== null && hasVersionLiteral(wxtConfig)) {
    v.push(
      'J1 apps/extension/wxt.config.ts 把 manifest.version 写成了字面量 —— 删掉这一行, ' +
        '让 WXT 回落 apps/extension/package.json(与 sync-downloads 的文件名、下载页版本号同源)',
    )
  }
  // href 由 extensionPkg.version 拼出;手抄一份 v1.0.0 的路径,bump 之后静态兜底链直接 404。
  if (
    downloadsConfig !== null &&
    /\/downloads\/extension\/[^'"`]*\d+\.\d+\.\d+\.zip/.test(downloadsConfig)
  ) {
    v.push(
      'J2 downloads.config.ts 的 extension 资产 href 内嵌了版本号字面量 —— 必须由 ' +
        'extensionPkg.version 拼出,否则 bump package.json 后静态兜底下载链直接 404',
    )
  }
  // 打进包的源码里也不许留"手搓版本常量";取不到清单不判(§0.3),枚举到 0 个文件判死(覆盖面自证)。
  const extFiles = Object.entries(extensionSources || {})
  if (extFiles.length === 0) {
    v.push('J3 extensionSources 枚举到 0 个文件 —— 采集面坏了,这一维等于没装')
  }
  for (const [rel, src] of extFiles) {
    if (src === null) continue
    if (hasVersionLiteral(src)) {
      v.push(
        `J3 ${rel} 里有手搓的版本字面量 —— 运行期请取 chrome.runtime.getManifest().version ` +
          '(它的源头就是 apps/extension/package.json),写死等于向用户/服务端上报一个不存在的版本',
      )
    }
  }

  // K 全端"对外报版本"的每一张脸(2026-11-04 立,清单见 scripts/data/version-single-source-*.json)
  //   J 只管扩展端;同一族在 miniapp/RN/web/api/cli/ai-service 六个端各有一份,且都是"用户或对端
  //   看得见"的版本。逐端手改不留尺子必然回潮,所以这里按台账判:
  //   K1 台账点名的文件里不得出现版本字面量(源头另有其物,登记在条目的 source 里);
  //   K2 安装器清单里每一处版本号必须逐字等于它打包的那个包的 version。
  //   台账坏/空/取不到 ⇒ 判红(等于这一维没装),不做"读不到就放过"。
  if (
    !versionLedger ||
    !Array.isArray(versionLedger.files) ||
    !Array.isArray(versionLedger.pairs)
  ) {
    v.push(
      'K 台账读不到或形状坏(scripts/data/version-single-source-files.json / -pairs.json 任一缺 files/pairs 数组)' +
        ' —— 这一维等于没装,不冒绿',
    )
  } else {
    if (versionLedger.files.length === 0 && versionLedger.pairs.length === 0) {
      v.push('K 台账两侧都枚举到 0 条 —— 清空清单等于把整维抹掉,判死(覆盖面自证)')
    }
    for (const e of versionLedger.files) {
      const p = typeof e?.path === 'string' ? e.path : null
      if (!p || typeof e?.source !== 'string' || typeof e?.why !== 'string') {
        v.push(`K1 台账条目形态坏(path+source+why 三键须齐):${JSON.stringify(e)}`)
        continue
      }
      const text = versionFileTexts?.[p]
      if (typeof text !== 'string') {
        v.push(`K1 台账点名的文件在仓里读不到(路径腐烂或未入库):${p}`)
        continue
      }
      if (hasVersionLiteral(text)) {
        v.push(`K1 ${p} 里有手搓的版本字面量 —— 该条登记的源头是「${e.source}」(理由:${e.why})`)
      }
    }
    for (const e of versionLedger.pairs) {
      const p = typeof e?.path === 'string' ? e.path : null
      const pkg = typeof e?.sourcePkg === 'string' ? e.sourcePkg : null
      const extracts = Array.isArray(e?.extracts) ? e.extracts : null
      if (!p || !pkg || !extracts || extracts.length === 0 || typeof e?.why !== 'string') {
        v.push(`K2 台账条目形态坏(path+sourcePkg+extracts[]+why 须齐):${JSON.stringify(e)}`)
        continue
      }
      const manifestText = versionFileTexts?.[p]
      const pkgText = versionFileTexts?.[pkg]
      if (typeof manifestText !== 'string' || typeof pkgText !== 'string') {
        v.push(
          `K2 台账点名的文件读不到(腐烂或未入库):${typeof manifestText !== 'string' ? p : pkg}`,
        )
        continue
      }
      let want = null
      try {
        const parsed = JSON.parse(pkgText)
        want = typeof parsed?.version === 'string' ? parsed.version : null
      } catch {
        want = null
      }
      if (want === null) {
        v.push(`K2 ${pkg} 取不到 version 字段 —— 没有源值可比,这一条判未判定(不冒绿)`)
        continue
      }
      for (const pat of extracts) {
        if (typeof pat !== 'string') {
          v.push(`K2 ${p} 的 extracts 里有非字符串项:${JSON.stringify(pat)}`)
          continue
        }
        let hits = []
        try {
          hits = [...manifestText.matchAll(new RegExp(pat, 'gm'))].map((m) => m[1])
        } catch (err) {
          v.push(`K2 ${p} 的正则取不出值(${pat}):${err?.message ?? err}`)
          continue
        }
        if (hits.length === 0) {
          v.push(`K2 ${p} 按 ${pat} 枚举到 0 处 —— 台账与文件已脱节,要么改文件要么改台账,不放行`)
          continue
        }
        for (const got of hits) {
          if (got !== want) {
            v.push(`K2 ${p} 写着 ${got},而它打包的 ${pkg} 现读 ${want}(安装器会装到旧包)`)
          }
        }
      }
    }
  }

  return v
}

/**
 * J3 的取材面:会被打进扩展包的源码。
 * 只收 entrypoints/lib/src 三族(.ts/.tsx)—— tests/ 里的是夹具、scripts/ 里的是构建工具,
 * 都不进包,把它们的版本字面量算成违规只会逼人写假数据绕门(排除项在此点名,不静默)。
 */
export function listExtensionSources() {
  const out = {}
  for (const dir of ['entrypoints', 'lib', 'src']) {
    const abs = join(ROOT, 'apps', 'extension', dir)
    if (!existsSync(abs)) continue
    for (const name of readdirSync(abs, { recursive: true, encoding: 'utf-8' })) {
      // 键一律正斜杠:Windows 的 readdirSync 给 `entrypoints\sub\x.tsx`,CI 给 `/` 形,
      // 两套键名会让镜像测试的断言只在半个平台成立。
      const rel = join('apps', 'extension', dir, name).replaceAll('\\', '/')
      if (!/\.tsx?$/.test(rel)) continue
      const full = join(ROOT, rel)
      if (!existsSync(full)) continue
      out[rel] = readFileSync(full, 'utf-8')
    }
  }
  return out
}

/**
 * K 维的取材面:两份台账 + 它们点名的全部文件正文(含 sourcePkg)。
 * 台账坏/读不到 ⇒ 返回 {ledger:null, texts:{}},由判据侧当场判红(不静默放过)。
 */
export function collectVersionLedgerInputs() {
  const filesLedger = readJson('scripts/data/version-single-source-files.json')
  const pairsLedger = readJson('scripts/data/version-single-source-pairs.json')
  const ledger =
    Array.isArray(filesLedger) && Array.isArray(pairsLedger?.pairs)
      ? { files: filesLedger, pairs: pairsLedger.pairs }
      : null
  const paths = new Set()
  if (ledger) {
    for (const e of ledger.files) if (typeof e?.path === 'string') paths.add(e.path)
    for (const e of ledger.pairs) {
      if (typeof e?.path === 'string') paths.add(e.path)
      if (typeof e?.sourcePkg === 'string') paths.add(e.sourcePkg)
    }
  }
  const texts = {}
  for (const p of paths) texts[p] = read(p)
  return { ledger, texts }
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
    mobileAppJson: readJson('apps/mobile-rn/app.json'),
    mobilePkg: readJson('apps/mobile-rn/package.json'),
    appConfigJs: read('apps/mobile-rn/app.config.js'),
    rnConfigTs: read('apps/mobile-rn/src/lib/config.ts'),
    capGradle: read('apps/mobile-cap/android/app/build.gradle'),
    downloadsConfig: read('apps/web/src/config/downloads.config.ts'),
    feedRouteJs: read('apps/web/app/desktop-feed.json/route.ts'),
    feedRouteApi: read('apps/web/app/api/desktop-feed/route.ts'),
    wxtConfig: read('apps/extension/wxt.config.ts'),
    extensionSources: listExtensionSources(),
    ...(() => {
      const k = collectVersionLedgerInputs()
      return { versionLedger: k.ledger, versionFileTexts: k.texts }
    })(),
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

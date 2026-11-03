#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * resolve-mobile-version.mjs — 移动端版本号的自动派生器
 *
 * 立这一步的因(2026-10-17,李总问「安卓界面的版本号会不会随每次更新自动更新」):
 *   RN 设置页显示的 APP_VERSION 取自 apps/mobile-rn/package.json 的 version(当时 0.0.5)。
 *   它确实是**单一真相源**(历史上 SettingsScreen 写死 1.0.2、SharedDemoScreen 写死 1.0.0
 *   的三处互相打架已收敛到这里),但 ——
 *
 *     单一真相源 ≠ 自动更新。
 *
 *   源本身还是人敲的数字:不改 package.json,发一百次 APK 界面都还是同一个串。
 *
 *   同一个病在桌面一侧以更厉害的形态实测发生过:依赖「CI 把快照 push 回 main」的那条
 *   自动链被分支保护恒拒(GITHUB_TOKEN 推送不触发 workflow run ⇒ required status check
 *   永远缺席 ⇒ GH006),线上下载页停在 0.1.54 四天无人察觉。教训是同一条:
 *   **凡是"要人记得改一下"的版本号,结局一定是漂移**。
 *
 * 派生规则(无状态、幂等、单调):
 *   构建号 versionCode —— UTC YYMMDDHH,由 apps/mobile-rn/app.config.js 的
 *     resolveBuildNumber() 实现,本文件不碰它。
 *   显示号 versionName —— `<package.json 的 version>.<UTC YYYYMMDD>`,例 `0.0.5.20261017`。
 *
 *   为什么这一截用日期而不是 git commit 计数:本仓主干会被并行会话整谱系重写,计数会缩,
 *   缩一次就等于给已装机用户发一个"版本倒退"的包 —— Android 降级保护会直接拒绝覆盖安装
 *   (2026-10-12 实测:CI 包 vc=1 覆盖手机上 vc=4 时 install -r 连拒)。
 *   日期时钟天然单调、可由版本号反查构建日,而且**不需要持久状态** —— 不需要把上次版本号
 *   写回仓库,而"写回"这条路在 protected main 上根本走不通。
 *
 * 用法:
 *   node scripts/resolve-mobile-version.mjs --base 0.0.5             # 打印派生版本
 *   node scripts/resolve-mobile-version.mjs --app mobile-rn           # 自动读该端 package.json
 *   node scripts/resolve-mobile-version.mjs --app mobile-rn --kind release --tag v0.1.74
 *   node scripts/resolve-mobile-version.mjs --app mobile-rn --emit github  # 输出 GITHUB_ENV 行
 */
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

/** 取 UTC 日期紧凑串 YYYYMMDD */
function utcStamp(at) {
  const yyyy = String(at.getUTCFullYear())
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(at.getUTCDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

/** 从发布 tag 里取语义版本:`v0.1.74` / `mobile-v0.1.74` / `0.1.74` 都命中;取不到返回 null */
export function extractVersionFromTag(tag) {
  if (!tag) return null
  const m = String(tag).match(/(\d+\.\d+\.\d+)/)
  return m && m[1] ? m[1] : null
}

/**
 * 纯判据:由基准 semver + 构建时刻派生显示版本号。
 *
 * 为什么要留 `base` 而不是全自动生成一个号:`base` 承载"市场版本"语义(0.0.5 → 1.0 是里程碑),
 * 由人按节奏推进;后面那截日期是每次构建必然不同的部分。于是用户看到的串**每次更新都会变**,
 * 而里程碑又能自己说了算 —— 两种语义各归各位,不该揉进同一个数字互相绑架。
 *
 * 2026-10-17 补第二格(**发布 tag 优先**):`kind='release'` 时若给了 tag,版本号取 tag 里的
 *   语义版本而不是 package.json 的 base。原因是实测出来的不一致 —— APK 的 release tag 是
 *   `v0.1.74`(仓库级版本),而 base 是 package.json 的 0.0.5;不修的话**下载页显示 0.1.74、
 *   装到手机上 App 内显示 0.0.5**,正是本轮要消灭的那类"两个号对不上"。
 *   ⇒ 对外发布的构建,版本号必须与发布它的那个 tag 同源;只有日常构建才用日期戳。
 *
 * @param {{ base?: string|null, tag?: string|null, at?: Date, kind?: 'nightly'|'release' }} p
 * @returns {string} nightly 例 `0.0.5.20261017`;release 例 `0.1.74`
 */
export function resolveMobileVersion({ base, tag, at = new Date(), kind = 'nightly' } = {}) {
  const cleaned = String(base ?? '').trim()
  if (kind === 'release') {
    return extractVersionFromTag(tag) ?? (cleaned || '0.0.0')
  }
  if (!cleaned) return '0.0.0'
  return `${cleaned}.${utcStamp(at)}`
}

/** 读取某个 app 的 package.json version */
export function readAppVersion(app) {
  const pkgPath = join(PROJECT_ROOT, 'apps', app, 'package.json')
  return JSON.parse(readFileSync(pkgPath, 'utf-8')).version
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const out = { app: null, base: null, emit: 'stdout', kind: 'nightly', tag: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--app') out.app = argv[++i]
    else if (a === '--base') out.base = argv[++i]
    else if (a === '--emit') out.emit = argv[++i]
    else if (a === '--kind') out.kind = argv[++i]
    else if (a === '--tag') out.tag = argv[++i]
    else if (a === '--help' || a === '-h') out.help = true
    else return { error: `未知参数: ${a}` }
  }
  if (out.kind !== 'nightly' && out.kind !== 'release') {
    return { error: `--kind 只接受 nightly|release,收到 '${out.kind}'` }
  }
  return out
}

/** 计算当次构建要用的版本号并产出输出行(IO 与判据分离,便于测试) */
export function mainCore({
  app,
  base,
  emit = 'stdout',
  kind = 'nightly',
  tag = null,
  at = new Date(),
} = {}) {
  let resolvedBase = base
  if (!resolvedBase && app) {
    try {
      resolvedBase = readAppVersion(app)
    } catch (e) {
      return {
        error: `读不到 apps/${app}/package.json: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  }
  const version = resolveMobileVersion({ base: resolvedBase, tag, at, kind })
  if (emit === 'github') {
    return {
      version,
      lines: [
        `IHUI_MOBILE_VERSION=${version}`,
        // EXPO_PUBLIC_ 前缀才会被 metro/babel 内联进 JS bundle(App 界面读取的那个值)。
        // 必须与原生 versionName **同一次计算** —— 分开算就会出现"原生号 vs 界面号"两个码,
        // 那正是本文件存在的理由。
        `EXPO_PUBLIC_IHUI_MOBILE_VERSION=${version}`,
      ],
    }
  }
  return { version, lines: [version] }
}

const HELP_TEXT = `用法:
  node scripts/resolve-mobile-version.mjs --base 0.0.5
  node scripts/resolve-mobile-version.mjs --app mobile-rn
  node scripts/resolve-mobile-version.mjs --app mobile-rn --kind release --tag v0.1.74
  node scripts/resolve-mobile-version.mjs --app mobile-rn --emit github
`

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2))
  if (args.error) {
    console.error(args.error)
    process.exit(2)
  }
  if (args.help) {
    console.log(HELP_TEXT)
    process.exit(0)
  }
  const r = mainCore(args)
  if (r.error) {
    console.error(r.error)
    process.exit(1)
  }
  console.log(r.lines.join('\n'))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端 dev 构建必须与安装版分家(G-921,2026-10-19 立;机主 2026-10-18 拍板"dev 用独立标识")
//
// 立因(现读源码考据,不是推测):
//   · tauri-plugin-single-instance 2.4.3 的 Windows 实现把锁名从**运行期配置**派生 ——
//     `app.config().identifier` 拼出 `{id}-sic` 窗口类 / `{id}-siw` 隐藏消息窗口 /
//     `{id}-sim` mutex(源码 platform_impl/windows.rs:58-67;`semver` 不是默认 feature,
//     我方 Cargo.toml 未开 ⇒ 无版本后缀)。
//   · tauri-build 2.6.3 `try_build` 先读 base `tauri.conf.json`,再用 `json_patch::merge`
//     把 CLI 经 `TAURI_CONFIG` 传来的 `--config` 覆盖上去 ⇒ 顶层标量(identifier)会被覆盖,
//     且 `cargo:rerun-if-env-changed=TAURI_CONFIG` 保证换配置必重编。
//   · 而 `Context::config()`(tauri 2.11.5 src/lib.rs:405)公开可读 ⇒ 预检/AUMID/WebView2
//     目录都能在 Builder 之前取到**同一枚**标识,不必再写死一份常量。
// 三个配置文件曾现读同值 `com.ihui.desktop`,后果实测:已安装版在场时跑 dev ⇒
// dev 实例被插件静默吞掉并 exit 0,屏幕上是那份安装版,本地代码一行都没上屏。
//
// 本文件判四件事:① 生产面标识没被人顺手改掉;② 所有 dev 面都带标识、彼此同值、且≠生产;
// ③ 每一条 `tauri dev` 入口都真的把 dev 面传进去了(裸 `tauri dev` 就是回到旧故障);
// ④ Rust 侧不得再有写死的标识字面量,预检必须收运行期取进来的那枚。
//
// 判据是**纯函数 + 构造面**(与 desktop-webview-data-loss.test.mjs 同取向):
// 变异靠喂进去的字符串证明,不靠"现在正好没有"。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TAURI_DIR = path.join(ROOT, 'apps', 'desktop', 'src-tauri')

const PROD_FACE = 'tauri.conf.json'

/** 取一份 tauri 配置文本里的 identifier(取不到 ⇒ null,不猜、不回落)。 */
export function identifierOfConfigText(text) {
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  return typeof json?.identifier === 'string' && json.identifier.trim() ? json.identifier.trim() : null
}

/**
 * dev 面对账:每面都必须声明标识、全部同值、且不得等于生产那枚。
 * @returns 违规文案数组(空 = 对得上)
 */
export function findDevFaceViolations({ prodIdentifier, devFaces }) {
  const hits = []
  if (!prodIdentifier) hits.push('生产面 tauri.conf.json 的 identifier 取不到 ⇒ 对账无基准')
  for (const face of devFaces) {
    if (!face.identifier) {
      hits.push(`${face.file} 未声明 identifier —— 它会继承生产标识,安装版在场时该入口的 dev 实例会被单实例插件吞掉`)
      continue
    }
    if (face.identifier === prodIdentifier) {
      hits.push(`${face.file} 的 identifier 与生产同值(${prodIdentifier})`)
    }
  }
  const values = [...new Set(devFaces.map((f) => f.identifier).filter(Boolean))]
  if (values.length > 1) {
    hits.push(`dev 各面标识不同值(${values.join(' | ')})—— 四份面各写一份迟早漂移,只许一处取源`)
  }
  return hits
}

/**
 * 桌面端 dev 入口形态:直接 `tauri dev`,或经唯一包装壳 `desktop-build.mjs --dev`
 * (2026-10-19 起 apps/desktop 的 dev/build 入口全部改走包装壳;判据必须跟着生产者换形,
 *  否则本尺子的正控会变成"一条 dev 入口都没量到"的空尺子 —— 实测踩过)。
 * `--debug` 不算:`\s--dev\b` 的单词边界挡住了它。
 */
const DEV_ENTRY_RE = /\btauri\s+dev\b|\bdesktop-build\.mjs\b[^\n]*\s--dev\b/

/**
 * 桌面端 dev 入口对账:凡命令里出现 dev 入口形态,必须经 `--config` 带上一个 dev 面文件,
 * 且该文件存在、不是生产面本身。
 * @returns 违规文案数组
 */
export function findDevEntryViolations(scripts, { existingConfigFiles }) {
  const hits = []
  for (const [name, cmd] of Object.entries(scripts || {})) {
    if (typeof cmd !== 'string' || !DEV_ENTRY_RE.test(cmd)) continue
    const m = /--config\s+(\S+)/.exec(cmd)
    if (!m) {
      hits.push(`脚本 ${name} 裸跑 "tauri dev" / "desktop-build --dev"(未带 --config)⇒ 继承生产标识,回到 G-921 那一格`)
      continue
    }
    const rel = m[1].replace(/^\.?\//, '')
    if (rel.endsWith(PROD_FACE)) {
      hits.push(`脚本 ${name} 的 --config 直指生产面 ${PROD_FACE}`)
      continue
    }
    if (!existingConfigFiles.has(path.basename(rel))) {
      hits.push(`脚本 ${name} 的 --config 指向不存在的配置(${rel})`)
    }
  }
  return hits
}

/** Rust 源里不得再出现写死的生产标识字面量(取源只能是运行期配置)。 */
export function findHardcodedIdentifierHits(rustSrc) {
  const hits = []
  rustSrc.split(/\r?\n/).forEach((ln, i) => {
    if (/"com\.ihui\.desktop(\.[a-z0-9-]+)?"/.test(ln)) hits.push(i + 1)
  })
  return hits
}

/** 预检与调用方必须成套:preflight 收标识参数,lib.rs 从运行期配置取标识后传进去。 */
export function findPreflightWiringGaps({ guardSrc, libSrc }) {
  const gaps = []
  // 2026-10-21 重钉(票 L7220 P1 把签名演进为 (app_id, log_stem) 双参:日志文件名取源
  // lib.rs 的 APP_LOG_FILE_STEM 单源,§0.6 禁止守护内抄第二份字面量)。判据跟着生产者
  // 换形(与 ③ 段包装壳换形同一理由),语义一格未松:首参仍**必须**是运行期 identifier、
  // 两档同形、调用点仍必须把配置取来的标识传进去 —— 三条都只放宽"闭括号紧跟 &str"
  // 这一形状约束,参数名/类型/传参事实照钉。
  if (!/pub fn preflight\(\s*app_id: &str\b/.test(guardSrc)) {
    gaps.push('startup_guard::preflight 未收 app_id 参数 ⇒ 锁名只能来自写死的常量')
  }
  if (!/pub fn preflight\(\s*_app_id: &str\b/.test(guardSrc)) {
    gaps.push('非 Windows 档的 preflight 签名未同步(两档必须同形,否则调用点会分裂成两份)')
  }
  if (!/context\.config\(\)\.identifier/.test(libSrc)) {
    gaps.push('lib.rs 未从运行期配置取 identifier ⇒ 单实例锁名与预检取源可能劈叉')
  }
  if (!/startup_guard::preflight\(&app_identifier\b/.test(libSrc)) {
    gaps.push('lib.rs 调 preflight 时没把配置取来的标识传进去')
  }
  if (!/identifier:\s*app\.config\(\)\.identifier\.clone\(\)/.test(libSrc) && !/let identifier = app\.config\(\)\.identifier\.clone\(\)/.test(libSrc)) {
    gaps.push('clear_webview_cache 未从 AppHandle 的运行期配置取标识(清理会打到别人的数据目录)')
  }
  return gaps
}

/** dev 启动器必须把标识写进 --config 覆盖里(否则 saas 入口照旧继承生产标识)。 */
export function findOverrideGap(mjsSrc) {
  const at = mjsSrc.indexOf('const configOverride')
  if (at < 0) return ['desktop-dev-saas.mjs 里找不到 configOverride ⇒ 判据失效,不得当成通过']
  const block = mjsSrc.slice(at, at + 600)
  return /\bidentifier:/.test(block) ? [] : ['desktop-dev-saas.mjs 的 --config 覆盖未声明 identifier']
}

// ---------------- 真面读数 ----------------

const configFiles = readdirSync(TAURI_DIR).filter((f) => /^tauri.*\.json$/.test(f)).sort()
const prodIdentifier = identifierOfConfigText(readFileSync(path.join(TAURI_DIR, PROD_FACE), 'utf8'))
const devFaces = configFiles
  .filter((f) => f !== PROD_FACE)
  .map((f) => ({ file: f, identifier: identifierOfConfigText(readFileSync(path.join(TAURI_DIR, f), 'utf8')) }))

const desktopPkg = JSON.parse(readFileSync(path.join(ROOT, 'apps', 'desktop', 'package.json'), 'utf8'))
const guardSrc = readFileSync(path.join(TAURI_DIR, 'src', 'startup_guard.rs'), 'utf8')
const libSrc = readFileSync(path.join(TAURI_DIR, 'src', 'lib.rs'), 'utf8')
const devSaasSrc = readFileSync(path.join(ROOT, 'scripts', 'desktop-dev-saas.mjs'), 'utf8')

test('① 生产面标识保持 com.ihui.desktop(改它等于换应用身份,须另走拍板)', () => {
  assert.equal(prodIdentifier, 'com.ihui.desktop')
})

test('② dev 各面都声明标识、彼此同值、且不等于生产那枚', () => {
  assert.ok(devFaces.length >= 2, `dev 面只量到 ${devFaces.length} 份 ⇒ 尺子失明,不得当成通过`)
  assert.deepEqual(findDevFaceViolations({ prodIdentifier, devFaces }), [])
  for (const face of devFaces) {
    assert.match(String(face.identifier), /^com\.ihui\.desktop\.[a-z0-9-]+$/, `${face.file} 的标识必须是生产标识的子档`)
  }
})

test('③ 每条 tauri dev 入口都真的带上 dev 面', () => {
  const hits = findDevEntryViolations(desktopPkg.scripts, {
    existingConfigFiles: new Set(configFiles),
  })
  assert.deepEqual(hits, [])
  assert.ok(
    Object.values(desktopPkg.scripts || {}).some((c) => DEV_ENTRY_RE.test(String(c))),
    '一条 dev 入口都没量到(tauri dev / desktop-build --dev)⇒ 本判据是恒绿的空尺子',
  )
})

test('④ Rust 侧不再写死标识,且预检与调用点成套', () => {
  assert.deepEqual(findHardcodedIdentifierHits(guardSrc), [], 'startup_guard.rs 里仍有标识字面量')
  assert.deepEqual(findHardcodedIdentifierHits(libSrc), [], 'lib.rs 里仍有标识字面量')
  assert.deepEqual(findPreflightWiringGaps({ guardSrc, libSrc }), [])
})

test('⑤ dev 启动器的 --config 覆盖里带 identifier', () => {
  assert.deepEqual(findOverrideGap(devSaasSrc), [])
  assert.ok(
    existsSync(path.join(TAURI_DIR, 'tauri.dev.json')),
    'tauri.dev.json 不在 ⇒ saas 入口的标识取源断了(该脚本读不到会 exit 1,不是回落)',
  )
})

test('⑥ 尺子本身有牙:喂回旧形态必须判红(构造面,不靠仓库瞬时状态)', () => {
  const oldFaces = findDevFaceViolations({
    prodIdentifier: 'com.ihui.desktop',
    devFaces: [
      { file: 'tauri.dev.json', identifier: 'com.ihui.desktop' },
      { file: 'tauri.cdp.json', identifier: 'com.ihui.desktop' },
    ],
  })
  assert.ok(oldFaces.length === 2, `旧四份同值形态没被判红:${JSON.stringify(oldFaces)}`)

  const drifted = findDevFaceViolations({
    prodIdentifier: 'com.ihui.desktop',
    devFaces: [
      { file: 'tauri.dev.json', identifier: 'com.ihui.desktop.dev' },
      { file: 'tauri.cdp.json', identifier: 'com.ihui.desktop.cdptest' },
    ],
  })
  assert.ok(drifted.some((h) => h.includes('不同值')), '两份 dev 面各写各的应当点名')

  const missing = findDevFaceViolations({
    prodIdentifier: 'com.ihui.desktop',
    devFaces: [{ file: 'tauri.local.json', identifier: null }],
  })
  assert.ok(missing.length === 1 && missing[0].includes('未声明 identifier'), '不声明标识的面必须点名')

  assert.deepEqual(
    findDevEntryViolations({ dev: 'tauri dev' }, { existingConfigFiles: new Set(['tauri.dev.json']) }),
    ['脚本 dev 裸跑 "tauri dev" / "desktop-build --dev"(未带 --config)⇒ 继承生产标识,回到 G-921 那一格'],
  )
  assert.deepEqual(
    findDevEntryViolations(
      { dev: 'node ../../scripts/desktop-build.mjs --dev' },
      { existingConfigFiles: new Set(['tauri.dev.json']) },
    ),
    ['脚本 dev 裸跑 "tauri dev" / "desktop-build --dev"(未带 --config)⇒ 继承生产标识,回到 G-921 那一格'],
    '包装壳形态(现在的生产入口)不带 --config 必须判红,否则换形后判据对真实入口失明',
  )
  assert.deepEqual(
    findDevEntryViolations(
      { dev: 'node ../../scripts/desktop-build.mjs --dev -- --config src-tauri/tauri.dev.json' },
      { existingConfigFiles: new Set(['tauri.dev.json']) },
    ),
    [],
    '包装壳带 dev 面的现行入口被判红 ⇒ 本门会变成恒红门',
  )
  assert.deepEqual(
    findDevEntryViolations(
      { build: 'node ../../scripts/desktop-build.mjs --debug' },
      { existingConfigFiles: new Set(['tauri.dev.json']) },
    ),
    [],
    '--debug 不是 dev 入口,不得被误判',
  )
  assert.deepEqual(
    findDevEntryViolations(
      { dev: 'tauri dev --config src-tauri/tauri.conf.json' },
      { existingConfigFiles: new Set(['tauri.conf.json']) },
    ),
    ['脚本 dev 的 --config 直指生产面 tauri.conf.json'],
  )
  assert.deepEqual(
    findDevEntryViolations(
      { dev: 'tauri dev --config src-tauri/tauri.dev.json' },
      { existingConfigFiles: new Set(['tauri.dev.json']) },
    ),
    [],
    '正确入口形态被判红 ⇒ 本门会变成恒红门',
  )

  const oldRust = [
    '    /// 与 tauri.conf.json `identifier` 一致',
    '    const APP_ID: &str = "com.ihui.desktop";',
    '    let mutex_name = encode_wide(&format!("{APP_ID}-sim"));',
  ].join('\n')
  assert.deepEqual(findHardcodedIdentifierHits(oldRust), [2], '写死的标识没被判红 ⇒ 空尺子')
  const newRust = [
    'pub fn preflight(app_id: &str) {',
    '    let mutex_name = encode_wide(&format!("{app_id}-sim"));',
    '}',
  ].join('\n')
  assert.deepEqual(findHardcodedIdentifierHits(newRust), [], '配置取源形态被判红 ⇒ 恒红门')

  const unguarded = findPreflightWiringGaps({
    guardSrc: 'pub fn preflight() {}\n#[cfg(not(target_os = "windows"))]\npub fn preflight() {}',
    libSrc: 'startup_guard::preflight();\n.run(tauri::generate_context!())',
  })
  assert.ok(unguarded.length >= 4, `旧接线形态只判出 ${unguarded.length} 条 ⇒ 成套判据失效`)
  assert.deepEqual(
    findPreflightWiringGaps({
      guardSrc: 'pub fn preflight(app_id: &str) {}\npub fn preflight(_app_id: &str) {}',
      libSrc: [
        'let context = tauri::generate_context!();',
        'let app_identifier = context.config().identifier.clone();',
        'startup_guard::preflight(&app_identifier);',
        'fn clear_webview_cache(app: tauri::AppHandle) {',
        '    let identifier = app.config().identifier.clone();',
        '}',
      ].join('\n'),
    }),
    [],
    '正确接线被判红 ⇒ 恒红门',
  )
  // L7220 双参现行形态的正控(与上面单参正控成对):重钉后两档签名/调用点带
  // log_stem 第二参必须照样判绿,否则本尺子对现行生产形态失明。
  assert.deepEqual(
    findPreflightWiringGaps({
      guardSrc:
        'pub fn preflight(app_id: &str, log_stem: &str) {}\npub fn preflight(_app_id: &str, _log_stem: &str) {}',
      libSrc: [
        'let context = tauri::generate_context!();',
        'let app_identifier = context.config().identifier.clone();',
        'startup_guard::preflight(&app_identifier, APP_LOG_FILE_STEM);',
        'fn clear_webview_cache(app: tauri::AppHandle) {',
        '    let identifier = app.config().identifier.clone();',
        '}',
      ].join('\n'),
    }),
    [],
    '双参现行形态(app_id+log_stem)被判红 ⇒ 恒红门',
  )

  assert.deepEqual(
    findOverrideGap('const configOverride = JSON.stringify({ build: { beforeDevCommand: \'\' } })'),
    ['desktop-dev-saas.mjs 的 --config 覆盖未声明 identifier'],
  )
})

export const __test__ = {
  identifierOfConfigText,
  findDevFaceViolations,
  findDevEntryViolations,
  findHardcodedIdentifierHits,
  findPreflightWiringGaps,
  findOverrideGap,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

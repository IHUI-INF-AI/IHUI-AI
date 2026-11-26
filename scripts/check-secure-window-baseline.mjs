// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI,需 console 输出诊断信息 */
/**
 * check-secure-window-baseline.mjs — RP-5(L13/P0)安全窗口基线静态审计门
 *
 * 判定边界(诚实纪律,§0.3「没判不写成判过」):
 *   本门只判定**静态可判**的那一份——「安全窗口的配置基线与创建面在源码中完整在位,
 *   且不能被悄悄回退/删掉」。它**不**宣称"生产窗口运行时 contextIsolation/sandbox/
 *   webSecurity 三项已开":本仓桌面端是 Tauri 2 + WebView2,不存在 Electron 的同名开关;
 *   等价面是 withGlobalTauri:false + 严格 CSP + Tauri capability ACL,且运行时断言需
 *   Windows + WebView2 真跑,本机与 CI 均无该能力。把静态路径完整写成运行时通过就是假绿。
 *
 * 判据(全部去注释后判定,注释里出现不算):
 *   配置基线(回退即红):
 *     S1 tauri.conf.json withGlobalTauri:false(等价 contextIsolation:不把 API 挂 window)
 *     S2 security.csp 存在且不含 'unsafe-eval'(等价 webSecurity:脚本来源限制)
 *     S3 无 dangerousDisableAssetCspModification:true
 *     E1 无 Electron 式不安全项回退(nodeIntegration:true / contextIsolation:false /
 *        webSecurity:false)——本仓当前无 Electron,防未来回退
 *   调试开关受控(单边即红):
 *     D1 build.rs 具名注册 toggle_devtools + embedded_browser_devtools(命令面可追溯)
 *     D2 default.json 授权 allow-toggle-devtools + allow-embedded-browser-devtools
 *        (与 D1 配对:授权命令必须存在、注册命令必须有授权,防隐藏命令/孤立授权)
 *   窗口创建面(缺任一即红):
 *     W1-W4 4 处 WebviewWindowBuilder::new 所在的 rust 源可追溯
 *
 * 口径说明:devtools 在本仓是**生产功能**(apps/web/src/lib/menu-actions.ts 经
 *   tauri-bridge.ts 调 toggle_devtools / embedded_browser_devtools,供画中画浏览器用),
 *   不是 Electron 式"调试窗口"。故本门不要求删除 devtools,而是锁"命令面↔授权面配对
 *   可追溯",防止有人新增未授权的隐藏调试命令或留下孤立的 remote 授权。
 *
 * 自失效防护:关键文件缺任一 / 任一条 present 锚点不在 / 任一 absent 锚点被引入 /
 *   rust 生产源枚举不足阈值 ⇒ 判红;取不到 face 正文 ⇒ 未判定(exit 2),绝不静默绿。
 *
 * 取材面(与守门同口径):默认 HEAD blob,--staged 判索引 blob,--worktree 人工排查。
 *
 * 用法:
 *   node scripts/check-secure-window-baseline.mjs
 *   node scripts/check-secure-window-baseline.mjs --staged
 *   node scripts/check-secure-window-baseline.mjs --worktree
 *   node scripts/check-secure-window-baseline.mjs --self-test
 */

import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Undetermined, catBatch, gitRaw, listFaceFiles, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

export const CONF_REL = 'apps/desktop/src-tauri/tauri.conf.json'
export const CAPS_REL = 'apps/desktop/src-tauri/capabilities/default.json'
export const BUILD_REL = 'apps/desktop/src-tauri/build.rs'
export const WINDOW_FILES = Object.freeze([
  'apps/desktop/src-tauri/src/browser_pip_window.rs',
  'apps/desktop/src-tauri/src/embedded_browser.rs',
  'apps/desktop/src-tauri/src/lib.rs',
  'apps/desktop/src-tauri/src/store_browser.rs',
])
export const KEY_FILES = [CONF_REL, CAPS_REL, BUILD_REL, ...WINDOW_FILES]
export const MIN_RUST_FILES = 20

/**
 * 判据表。mode=present 要求去注释后命中;mode=absent 要求去注释后不命中。
 * 每条都必须咬合:present 被删 / absent 被引入 ⇒ 判红。
 */
export const CHECKS = Object.freeze([
  { id: 'S1-global-api-off', file: CONF_REL, mode: 'present', re: /"withGlobalTauri"\s*:\s*false/, label: 'withGlobalTauri:false(API 不挂 window)' },
  { id: 'S2-csp-present', file: CONF_REL, mode: 'present', re: /"csp"\s*:\s*"/, label: 'security.csp 存在' },
  { id: 'S2-csp-no-eval', file: CONF_REL, mode: 'absent', re: /'unsafe-eval'/, label: "CSP 不含 'unsafe-eval'" },
  { id: 'S3-csp-mod-protect', file: CONF_REL, mode: 'absent', re: /"dangerousDisableAssetCspModification"\s*:\s*true/, label: '未关闭 CSP 改写保护' },
  { id: 'E1-no-node-integration', file: CONF_REL, mode: 'absent', re: /nodeIntegration\s*:\s*true/, label: '无 nodeIntegration:true 回退' },
  { id: 'E1-no-no-isolation', file: CONF_REL, mode: 'absent', re: /contextIsolation\s*:\s*false/, label: '无 contextIsolation:false 回退' },
  { id: 'E1-no-no-websecurity', file: CONF_REL, mode: 'absent', re: /webSecurity\s*:\s*false/, label: '无 webSecurity:false 回退' },
  { id: 'D1-build-toggle', file: BUILD_REL, mode: 'present', re: /"toggle_devtools"/, label: 'build.rs 注册 toggle_devtools' },
  { id: 'D1-build-embedded', file: BUILD_REL, mode: 'present', re: /"embedded_browser_devtools"/, label: 'build.rs 注册 embedded_browser_devtools' },
  { id: 'D2-caps-toggle', file: CAPS_REL, mode: 'present', re: /"allow-toggle-devtools"/, label: 'default.json 授权 allow-toggle-devtools' },
  { id: 'D2-caps-embedded', file: CAPS_REL, mode: 'present', re: /"allow-embedded-browser-devtools"/, label: 'default.json 授权 allow-embedded-browser-devtools' },
  { id: 'W1-pip-window', file: WINDOW_FILES[0], mode: 'present', re: /WebviewWindowBuilder\s*::\s*new\s*\(/, label: '画中画窗口创建点' },
  { id: 'W2-embedded', file: WINDOW_FILES[1], mode: 'present', re: /WebviewWindowBuilder\s*::\s*new\s*\(/, label: '内嵌浏览器窗口创建点' },
  { id: 'W3-admin', file: WINDOW_FILES[2], mode: 'present', re: /WebviewWindowBuilder\s*::\s*new\s*\(/, label: 'admin 窗口创建点' },
  { id: 'W4-store', file: WINDOW_FILES[3], mode: 'present', re: /WebviewWindowBuilder\s*::\s*new\s*\(/, label: 'store 浏览器窗口创建点' },
])

/** 去注释但保留字符串字面量 —— 头注里写 withGlobalTauri:false 不算基线在位。 */
export function stripComments(source) {
  const src = String(source ?? '')
  let out = ''
  let i = 0
  let state = 'code'
  let quote = ''
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; i += 2; continue }
      if (c === '/' && n === '*') { state = 'block'; i += 2; continue }
      if (c === '"' || c === "'" || c === '`') { state = 'str'; quote = c; out += c; i += 1; continue }
      out += c
      i += 1
    } else if (state === 'line') {
      if (c === '\n') { state = 'code'; out += '\n' }
      i += 1
    } else if (state === 'block') {
      if (c === '*' && n === '/') { state = 'code'; i += 2; continue }
      if (c === '\n') out += '\n'
      i += 1
    } else {
      out += c
      if (c === '\\' && i + 1 < src.length) { out += src[i + 1]; i += 2; continue }
      if (c === quote) state = 'code'
      i += 1
    }
  }
  return out
}

/** 纯判据:给定同一面的源码集合,产出违规明细。 */
export function evaluate({ files, minRust = MIN_RUST_FILES }) {
  const violations = []
  const list = Array.isArray(files) ? files : []
  const rustCount = list.filter((f) => /\.rs$/.test(f.rel)).length
  if (rustCount < minRust) {
    return {
      ok: false,
      violations: [{ kind: 'empty-face', file: '(none)', detail: `Rust 源只枚举到 ${rustCount} 个(<${minRust}),扫描器可能失明` }],
      stats: { files: list.length, rust: rustCount, passed: 0, total: CHECKS.length },
    }
  }
  const byRel = new Map(list.map((f) => [f.rel, stripComments(f.source)]))
  for (const rel of KEY_FILES) {
    if (!byRel.has(rel)) violations.push({ kind: 'file-missing', file: rel, detail: '关键安全窗口文件不在被审面' })
  }
  for (const c of CHECKS) {
    const code = byRel.get(c.file)
    if (code === undefined) continue // file-missing 已记,不重复刷屏
    const hit = c.re.test(code)
    if (c.mode === 'present' && !hit) {
      violations.push({ kind: 'anchor-missing', file: c.file, detail: `${c.id}: ${c.label}` })
    } else if (c.mode === 'absent' && hit) {
      violations.push({ kind: 'unsafe-introduced', file: c.file, detail: `${c.id}: ${c.label}` })
    }
  }
  return {
    ok: violations.length === 0,
    violations,
    stats: {
      files: list.length,
      rust: rustCount,
      passed: CHECKS.length - violations.filter((v) => v.kind === 'anchor-missing' || v.kind === 'unsafe-introduced').length,
      total: CHECKS.length,
    },
  }
}

/** 按判定面枚举 rust 源并取关键文件正文;取不到 ⇒ 未判定。 */
function readFace(root, face) {
  let rels = listFaceFiles(root, face, { paths: ['apps/desktop/src-tauri/src'] })
  if (face === 'worktree') {
    const untracked = String(gitRaw(['ls-files', '--others', '--exclude-standard', '-z', '--', 'apps/desktop/src-tauri/src'], root))
      .split('\0').filter(Boolean)
    rels = [...new Set([...rels, ...untracked])]
  }
  rels = [...new Set([...rels, ...KEY_FILES])]
  const specs = rels.map((rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`))
  let sources
  if (face === 'worktree') {
    sources = rels.map((rel) => readWorktreeFile(root, rel))
  } else {
    const blobs = catBatch(root, specs)
    sources = specs.map((spec) => blobs.get(spec) ?? null)
  }
  const missing = rels.filter((_, i) => sources[i] === null || sources[i] === undefined)
  if (missing.length) throw new Undetermined(`${face} 面有 ${missing.length} 个文件取不到正文(首:${missing[0]}),不回落其它面`)
  return rels.map((rel, i) => ({ rel, source: sources[i] }))
}

/** 合成夹具:每个 present 锚点给一条真代码行,absent 锚点默认不出现。 */
export function fixture({ omit = [], inject = [], commentOut = [] } = {}) {
  const conf = [
    '"withGlobalTauri": false,',
    '"csp": "default-src \'self\'; script-src \'self\'"',
  ]
  const caps = ['"allow-toggle-devtools",', '"allow-embedded-browser-devtools",']
  const build = ['"toggle_devtools",', '"embedded_browser_devtools",']
  const windows = WINDOW_FILES.map(() => ['WebviewWindowBuilder::new(', '}'])
  const files = {
    [CONF_REL]: conf,
    [CAPS_REL]: caps,
    [BUILD_REL]: build,
    ...Object.fromEntries(WINDOW_FILES.map((rel, i) => [rel, windows[i]])),
  }
  for (const id of commentOut) {
    const c = CHECKS.find((x) => x.id === id)
    assert.ok(c && c.mode === 'present', `commentOut 仅用于 present 锚点: ${id}`)
    const lines = files[c.file]
    const idx = lines.findIndex((l) => c.re.test(l))
    assert.ok(idx >= 0, `fixture 缺锚点行 ${id}`)
    lines[idx] = `// ${lines[idx]}`
  }
  for (const id of omit) {
    const c = CHECKS.find((x) => x.id === id)
    assert.ok(c && c.mode === 'present', `omit 仅用于 present 锚点: ${id}`)
    const lines = files[c.file]
    const idx = lines.findIndex((l) => c.re.test(l))
    assert.ok(idx >= 0, `fixture 缺锚点行 ${id}`)
    lines.splice(idx, 1)
  }
  for (const { id, line } of inject) {
    const c = CHECKS.find((x) => x.id === id)
    assert.ok(c && c.mode === 'absent', `inject 仅用于 absent 锚点: ${id}`)
    files[c.file].push(line)
  }
  const out = KEY_FILES.map((rel) => ({ rel, source: files[rel].join('\n') }))
  for (let i = 0; out.filter((f) => /\.rs$/.test(f.rel)).length < MIN_RUST_FILES; i += 1) {
    out.push({ rel: `apps/desktop/src-tauri/src/filler_${i}.rs`, source: '// no anchors here' })
  }
  return out
}

function selfTest() {
  const green = evaluate({ files: fixture() })
  assert.equal(green.ok, true, `绿夹具应通过:${JSON.stringify(green.violations)}`)

  for (const c of CHECKS) {
    if (c.mode === 'present') {
      const red = evaluate({ files: fixture({ omit: [c.id] }) })
      assert.equal(red.ok, false, `删掉 ${c.id} 必须判红`)
      assert.ok(red.violations.some((v) => v.kind === 'anchor-missing' && v.detail.startsWith(c.id)), `${c.id} 应产出 anchor-missing`)
    } else {
      const c2 = CHECKS.find((x) => x.id === c.id)
      const badLine = c.id === 'S2-csp-no-eval' ? "'unsafe-eval'"
        : c.id === 'S3-csp-mod-protect' ? '"dangerousDisableAssetCspModification": true'
          : c.id === 'E1-no-node-integration' ? 'nodeIntegration: true'
            : c.id === 'E1-no-no-isolation' ? 'contextIsolation: false'
              : c.id === 'E1-no-no-websecurity' ? 'webSecurity: false' : ''
      assert.ok(c2 && badLine, `缺坏串定义: ${c.id}`)
      const red = evaluate({ files: fixture({ inject: [{ id: c.id, line: badLine }] }) })
      assert.equal(red.ok, false, `引入 ${c.id} 必须判红`)
      assert.ok(red.violations.some((v) => v.kind === 'unsafe-introduced' && v.detail.startsWith(c.id)), `${c.id} 应产出 unsafe-introduced`)
    }
  }

  // 反假绿:present 锚点写进注释不算基线在位
  const commented = evaluate({ files: fixture({ commentOut: ['S1-global-api-off'] }) })
  assert.ok(commented.violations.some((v) => v.detail.startsWith('S1-global-api-off')), '注释里的 withGlobalTauri:false 不得算数')

  // 反假绿:absent 坏串写进注释不算回退(应仍绿)
  const commentBad = fixture({ inject: [{ id: 'E1-no-node-integration', line: '// nodeIntegration: true' }] })
  assert.equal(evaluate({ files: commentBad }).ok, true, '注释里的 nodeIntegration:true 不得算回退')

  // 反假绿:空面 / 缺关键文件
  assert.equal(evaluate({ files: [] }).violations[0].kind, 'empty-face', '空扫描面必须判红')
  const missingFile = fixture().filter((f) => f.rel !== CAPS_REL)
  for (let i = 0; missingFile.filter((f) => /\.rs$/.test(f.rel)).length < MIN_RUST_FILES; i += 1) {
    missingFile.push({ rel: `apps/desktop/src-tauri/src/extra_${i}.rs`, source: '// filler' })
  }
  assert.ok(evaluate({ files: missingFile }).violations.some((v) => v.kind === 'file-missing'), '缺关键文件必须判红')

  console.log('✅ check-secure-window-baseline self-test: 绿夹具 + 15 锚点逐条变异 + 注释不算 / 空面 / 缺文件 全部咬合')
}

function main(argv) {
  if (argv.includes('--self-test')) {
    selfTest()
    return 0
  }
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (picked.error) {
    console.error(`❌ check-secure-window-baseline: ${picked.error}(未判定,exit 2)`)
    return 2
  }
  let result
  try {
    result = evaluate({ files: readFace(ROOT, picked.face) })
  } catch (e) {
    console.error(`❌ check-secure-window-baseline: ${e.message}(未判定,exit 2)`)
    return 2
  }
  if (result.ok) {
    console.log(`✅ check-secure-window-baseline: 安全窗口基线 ${result.stats.passed}/${result.stats.total} 在位,扫描 ${result.stats.rust} 个 Rust 源(面:${picked.face})`)
    console.log('   ℹ️  静态基线完整 ≠ 运行时"三安全项已开":Tauri/WebView2 无 Electron 同名开关,运行时需 Windows 真跑,本门不伪称该断言')
    return 0
  }
  console.error(`❌ check-secure-window-baseline: ${result.violations.length} 处基线缺口(面:${picked.face})`)
  for (const v of result.violations) console.error(`  - [${v.kind}] ${v.file}: ${v.detail}`)
  return 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}

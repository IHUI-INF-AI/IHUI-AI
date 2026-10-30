#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * createPortal 定位守门 — portal div 必须显式 position: fixed(2026-09-07 立)。
 *
 * 根因案例(2026-09-07 实修 4 处):自写 createPortal popover 把
 * style={{ top, left }} 挂在 portal div 上但缺 position: fixed ——
 * div 被 portal 到 document.body 后是 static 定位,top/left 被静默忽略,
 * 症状表现为"弹层位置漂移/点击没反应",且极难排查。
 *
 * 规则(依据 AGENTS.md 样式守门):凡 createPortal(<div ...>) 渲染的
 * 定位容器,必须满足以下其一:
 *   1. style 中含 position: 'fixed'(或 'absolute'——已知相对定位容器)
 *   2. className 含 Tailwind fixed / absolute 类
 *   3. style 引用外部变量(如 style={panelStyle}),允许——变量定义处
 *      无法静态可靠追踪,降级为人工 review 责任(WARN 不阻塞)
 *
 * 豁免:createPortal 的第二参(document/body 等)行、非 JSX 元素首行。
 *
 * 用法:
 *   node scripts/check-portal-fixed.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-portal-fixed.mjs             (全量扫描报告, exit 0)
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { gitRaw } from './lib/face-reader.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const SCAN_EXTS = ['.tsx', '.jsx']

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (isExcludedDirName(name) || name === 'node_modules') continue
      walk(full, out)
    } else if (SCAN_EXTS.some((e) => name.endsWith(e))) {
      out.push(full)
    }
  }
  return out
}

function listStagedFiles() {
  try {
    // 枚举走取材层:绝对 git / 显式 stdio(§12g,EBUSY 病窗)/ windowsHide / timeout 由 gitRaw 统一提供。
    const out = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACM'], ROOT)
    return out.split('\n').filter((f) => f && SCAN_EXTS.some((e) => f.endsWith(e)))
  } catch {
    return []
  }
}

/**
 * 常量引用解析(把 `style={{ ...PANEL_STYLE, top }}` 这种**引用**追到含 position 的字面量)。
 * 与守门 8 的"一跳常量解析"同一条思路:判据看不见合法形制时,该扩的是扫描面,不是阈值。
 * 立因(2026-10-30 现读):`components/feedback/portal-panel.tsx` 的定位来自
 * `PORTAL_PANEL_POSITION_STYLE = { position: 'fixed' }`(lib/portal-panel-position.ts:34),
 * 而旧判据只认 JSX snippet 里的字面 `position:'fixed'` ⇒ 把这一形判成 FAIL。
 * 窗口取 600 字符:样式常量在本仓都是十几行的短对象,窗口法不必做完整 AST 也能命中;
 * 追不到 ⇒ 如实返回 false 落 WARN 档(交人工),绝不冒充"已确认"。
 */
const FILE_TEXT_CACHE = new Map()
function readTextCached(abs) {
  if (FILE_TEXT_CACHE.has(abs)) return FILE_TEXT_CACHE.get(abs)
  let t = ''
  try {
    t = readFileSync(abs, 'utf8')
  } catch {
    t = ''
  }
  FILE_TEXT_CACHE.set(abs, t)
  return t
}

/** `@/lib/x` / `./x` / `../x` → 绝对文件路径(补 .ts/.tsx,取第一个存在的) */
function resolveImportFile(fromAbs, spec) {
  const base = spec.startsWith('./') || spec.startsWith('../') ? join(dirname(fromAbs), spec) : null
  const atWebSrc = fromAbs.replace(/\\/g, '/').match(/^(.*\/apps\/web\/)src\//)
  const viaAlias = spec.startsWith('@/') && atWebSrc ? join(atWebSrc[1], 'src', spec.slice(2)) : null
  const cand = base || viaAlias
  if (!cand) return ''
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const p = cand + ext
    if (existsSync(p)) return p
  }
  return ''
}

/**
 * 在 fileText 里找 `IDENT` 的定义窗口,返回窗口内是否已含显式定位;
 * 窗口里出现别的 `...OTHER` 时顺 import 再跳一层(深度上限 3,带 seen 防环)。
 */
function symbolImpliesFixed(fileText, abs, ident, depth, seen) {
  if (depth > 3 || !fileText) return false
  const key = `${abs}#${ident}`
  if (seen.has(key)) return false
  seen.add(key)
  // 名字与 `=` 之间允许类型注解(`const panelStyle: React.CSSProperties = coords`)——
  // 少了这一档,带注解的常量一律搜不到,解析会静默退化成"人工确认"(2026-10-30 实测踩到)。
  const defIdx = fileText.search(new RegExp(`(const|let|var)\\s+${ident}\\b[^=\\n]*=`))
  if (defIdx < 0) return false
  const win = fileText.slice(defIdx, defIdx + 600)
  if (/position:\s*['"](fixed|absolute)['"]/.test(win)) return true
  for (const m of win.matchAll(/\.\.\.([A-Za-z_][\w.]*)/g)) {
    const name = m[1].split('.').pop()
    // 同文件先找,再顺 import 说明符跳
    if (symbolImpliesFixed(fileText, abs, name, depth + 1, seen)) return true
    for (const imp of fileText.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
      if (!imp[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).includes(name)) continue
      const target = resolveImportFile(abs, imp[2])
      if (target && symbolImpliesFixed(readTextCached(target), target, name, depth + 1, seen)) return true
    }
  }
  return false
}

/** 从 JSX snippet 的 style 属性里抽出被引用的标识符(含对象字面量内的 spread) */
function styleIdentsOf(snippet) {
  const out = new Set()
  const direct = snippet.match(/style=\{\s*([A-Za-z_][\w.]*)\s*\}/)
  if (direct) out.add(direct[1].split('.').pop())
  const obj = snippet.match(/style=\{\{([\s\S]{0,400}?)\}\s*\}/)
  if (obj) for (const m of obj[1].matchAll(/\.\.\.([A-Za-z_][\w.]*)/g)) out.add(m[1].split('.').pop())
  return [...out]
}

/** 判断 createPortal(<div 开始于 lineIdx) 的该元素是否显式定位 */
/** 判断 createPortal(<div 开始于 lineIdx) 的该元素是否显式定位 */
function checkPortalElement(lines, startIdx, relPath, findings, absPath) {
  // 在 createPortal( 之后的 12 行内寻找首个 <div(或 <section 等容器)
  for (let i = startIdx; i < Math.min(startIdx + 12, lines.length); i++) {
    const line = lines[i]
    if (!line || !line.includes('<div')) continue
    // 自该行向后收集 10 行内的元素属性(含跨行 JSX)
    const snippet = lines.slice(i, i + 18).join('\n')
    const hasFixedClass = /\b(?:fixed|absolute)\b/.test(
      (snippet.match(/className=\{?[`'"]([^`'"]*)/)?.[1] ?? '')
    )
    const hasInlinePosition = /position:\s*['"](fixed|absolute)['"]/.test(snippet)
    // 引用形制(`style={{ ...PANEL_STYLE, top }}` / `style={panelStyle}`)先做常量解析:
    // 追到字面量里确有 position 就是**真凭据**(不进 findings,也不挂"请人工确认"的虚账);
    // 追不到才落 WARN —— 失效方向是"多要一次人工确认",绝不是"多放一次 FAIL 误报"。
    const idents = hasFixedClass || hasInlinePosition ? [] : styleIdentsOf(snippet)
    if (idents.some((id) => symbolImpliesFixed(readTextCached(absPath), absPath, id, 0, new Set()))) return
    const styleRefOnly = idents.length > 0
    if (!hasFixedClass && !hasInlinePosition) {
      findings.push({
        file: relPath,
        line: i + 1,
        level: styleRefOnly ? 'WARN' : 'FAIL',
        msg: styleRefOnly
          ? 'portal 容器 style 引用外部变量,无法静态确认 position —— 请人工确认已含 fixed'
          : 'createPortal 容器缺显式 position: fixed —— portal 到 body 后 top/left 静默失效',
      })
    }
    return // 只检查首个容器元素
  }
}

function scanFile(absPath, relPath, findings) {
  let content
  try {
    content = readFileSync(absPath, 'utf8')
  } catch {
    return
  }
  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    if (/createPortal\(/.test(line) && !/^\s*\/\//.test(line)) {
      // 第一参为变量引用(如 createPortal(overlay, ...))时跳过:
      // overlay 定义处与 createPortal 调用相距太远,静态追踪不可靠(人工 review)
      if (/createPortal\(\s*[A-Za-z_$][\w$]*\s*,/.test(line)) return
      checkPortalElement(lines, idx, relPath, findings, absPath)
    }
  })
}

function main() {
  let files
  if (isStaged) {
    files = listStagedFiles().map((f) => join(ROOT, f))
  } else {
    files = walk(join(ROOT, 'apps', 'web', 'src'))
  }
  const findings = []
  for (const f of files) {
    if (!existsSync(f)) continue
    scanFile(f, relative(ROOT, f).replace(/\\/g, '/'), findings)
  }
  const fails = findings.filter((x) => x.level === 'FAIL')
  const warns = findings.filter((x) => x.level === 'WARN')
  if (warns.length) {
    console.log(`\n${C.yellow}WARN${C.reset} (需人工确认,不阻塞):`)
    for (const w of warns) console.log(`  ${w.file}:${w.line} — ${w.msg}`)
  }
  if (fails.length) {
    console.log(`\n${C.red}FAIL${C.reset} — createPortal 定位守门(${fails.length} 处):`)
    for (const f of fails) console.log(`  ${f.file}:${f.line} — ${f.msg}`)
    console.log(
      `\n修复:portal 容器加 ${C.cyan}position: 'fixed'${C.reset}(style)或 ${C.cyan}fixed${C.reset} 类。`,
    )
    process.exit(1)
  }
  if (!warns.length) console.log(`${C.green}✓ createPortal 定位守门通过${C.reset}`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  // main() 是同步函数(本票禁止改为 async),故走 try/catch 而非 .catch(AGENTS.md §22d)
  try {
    main()
  } catch (e) {
    console.error(String(e?.stack ?? e))
    process.exit(2)
  }
}

export const __test__ = {
  checkPortalElement,
  scanFile,
  walk,
  SCAN_EXTS,
  styleIdentsOf,
  resolveImportFile,
  symbolImpliesFixed,
}

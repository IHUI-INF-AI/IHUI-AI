#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Button 高度/宽度覆盖守门(2026-09-07 立,AGENTS.md §4「Button 高度档位守门」配套)
// 规则:<Button> 禁止 className h-* / w-* 覆盖尺寸,必须用 size 档位
//       (xs/sm/default/lg/icon-2xs/icon-xs/icon-sm/icon;档位清单从
//        packages/ui-react/src/components/button.tsx 的 size 表动态解析,勿硬编码)
// 同时校验 size 值合法性(防拼写错误静默回退 default 档)。
// 豁免:原生 <button> 自绘(IDE 面板等 24px 紧凑档为有意设计)、Input/SelectTrigger/Skeleton、
//       Button 上的 h-5/h-6(24px/20px 紧凑档,存量 45 处表格行/侧栏密集场景,与原生紧凑档同哲学)、
//       packages/ui-react/src/components/button.tsx 定义文件本身、测试文件、注释内的示例代码。
// 用法:node scripts/check-button-height.mjs            (全量扫描,pre-commit 用)
//       node scripts/check-button-height.mjs --staged   (仅扫描 staged 文件)
//       node scripts/check-button-height.mjs --root <dir> | --root=<dir>
//                                                       (显式注入扫描根,自检/审计缝;
//                                                        根不存在 → exit 2,绝不静默 exit 0;
//                                                        与 --staged 互斥,同给 → exit 2)
//       环境变量 BUTTON_HEIGHT_ROOT 等价 --root(照 check-i18n-messages-exist.mjs 惯例)
//       node scripts/check-button-height.mjs --self-test (独立夹具正反成对取证,不扫真仓)
// 退出码:0 通过 / 1 发现违规 / 2 脚本自身异常(--root 缺值、根不存在、空根、参数冲突、未知参数)
// 紧急跳过:HUSKY_SKIP_BUTTON_HEIGHT_GUARD=1 git commit ...
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ───────────────────── 扫描根注入(2026-09-24 自检加固) ─────────────────────
// 此前 ROOT = process.cwd():自检若只"cd 到夹具"实际仍静默扫真仓(本仓实证事故形态:
// 14 例里 13 例根本没碰夹具),红绿都不作数。现优先级:
//   --root <dir>(空格形态)/ --root=<dir>(等号形态)> env BUTTON_HEIGHT_ROOT > 脚本自身推导仓库根。
// 等号形态必须认:早期只认空格形态时 `--root=<不存在的目录>` 被静默忽略 → 直扫真仓假绿。
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const SELF = path.join(SCRIPT_DIR, 'check-button-height.mjs')
const SCRIPT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..')

/**
 * 解析扫描根。--root / --root=<dir> > BUTTON_HEIGHT_ROOT > 脚本自身推导仓库根。
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ root: string, explicitCli: boolean }}
 * @throws {Error} --root / --root= 给了开关但缺目录值
 */
function resolveRoot(argv, env) {
  const eq = argv.find((a) => typeof a === 'string' && a.startsWith('--root='))
  if (eq !== undefined) {
    const v = eq.slice('--root='.length)
    if (!v.trim()) throw new Error('--root= 缺少目录值(要么给路径,要么去掉这个参数)')
    return { root: path.resolve(SCRIPT_REPO_ROOT, v), explicitCli: true }
  }
  const i = argv.indexOf('--root')
  if (i >= 0) {
    const v = argv[i + 1]
    if (!v || v.startsWith('--')) throw new Error('--root 缺少目录参数')
    return { root: path.resolve(SCRIPT_REPO_ROOT, v), explicitCli: true }
  }
  if (env && env.BUTTON_HEIGHT_ROOT) {
    return { root: path.resolve(env.BUTTON_HEIGHT_ROOT), explicitCli: false }
  }
  return { root: SCRIPT_REPO_ROOT, explicitCli: false }
}

const ROOTS = [
  'apps/web/app',
  'apps/web/src',
  'apps/extension/src',
  'apps/desktop/src',
  'packages/ui-react/src',
]
const EXCLUDE_FILE = 'packages/ui-react/src/components/button.tsx' // size 档位定义文件
const FALLBACK_SIZES = ['xs', 'sm', 'default', 'lg', 'icon-2xs', 'icon-xs', 'icon-sm', 'icon']

/**
 * 档位白名单:从 button.tsx 的 size 表动态解析(2026-09-21 起,此前为硬编码)。
 *
 * 背景:原为 `new Set(['xs','sm','default','lg','icon-xs','icon-sm','icon'])`。
 * 2026-09-21 按 AGENTS.md §4「需要新高度先在 size 表立档」新增 icon-2xs 档位后,
 * 守门立即把合法用法误报成「不在档位表」—— 文档 / 实现 / 守门三处手抄同一份清单,
 * 必然漂移。改为单一事实源(button.tsx):立档后守门自动生效,无需再改三处。
 * 兜底:解析失败(文件缺失/结构变更)时回退静态表,保证守门不静默失效。
 * ⚠️ 兜底表与真表现值相同,"回退了"没有任何声响 —— 判动态解析是否真生效靠 --self-test
 *    的双向探针:夹具表独有档位 zz-mega 必须被认(回退会拦 → 红),夹具删除的 icon-2xs
 *    必须被拦(回退会放 → 红)。两个方向都钉死。
 * @param {string} root
 * @returns {Set<string>}
 */
function loadValidSizes(root) {
  try {
    const src = readFileSync(path.join(root, EXCLUDE_FILE), 'utf8')
    const m = /size:\s*\{/.exec(src)
    if (!m) return new Set(FALLBACK_SIZES)
    const tail = src.slice(m.index + m[0].length)
    const end = tail.indexOf('defaultVariants')
    const body = (end > 0 ? tail.slice(0, end) : tail)
      .replace(/\/\/[^\n]*/g, '') // 去行注释(注释中的 `key:` 形态会污染键名解析)
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const names = [...body.matchAll(/^\s*'?([A-Za-z][A-Za-z0-9_-]*)'?\s*:/gm)].map((x) => x[1])
    return names.length > 0 ? new Set(names) : new Set(FALLBACK_SIZES)
  } catch {
    return new Set(FALLBACK_SIZES)
  }
}
const SIZE_TOKEN_RE = /^(h|w)-(7|8|9|10|11|12|\[.+\])$/ // h-7 / h-[36px] 等;h-5/h-6(24px/20px 紧凑档)豁免
const BAD_SIZE_RE = /^(h|w)-/ // h-*/w-* 类(SIZE_TOKEN_RE 已排除紧凑档)

/**
 * 把行注释与块注释内容替换为空格(保留长度与换行,行号不漂移),字符串字面量原样保留。
 * 根治:注释里留档/举例的 `<Button className="h-7">` 此前会被当真代码判红(误伤);
 * "不得判红注释"是判据的一部分,由 --self-test 正反成对钉住。
 * @param {string} src
 * @returns {string}
 */
function maskComments(src) {
  const out = src.split('')
  const n = src.length
  let i = 0
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') { out[i] = ' '; i++ }
      continue
    }
    if (c === '/' && c2 === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end < 0 ? n : end + 2
      for (; i < stop; i++) if (src[i] !== '\n') out[i] = ' '
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c
      i++
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === q) { i++; break }
        i++
      }
      continue
    }
    i++
  }
  return out.join('')
}

// 提取从 <Button 开始的完整开标签(感知字符串/花括号,零误报)
function extractTag(src, start) {
  let i = start + 7 // "<Button".length
  let depth = 0
  let quote = null
  while (i < src.length) {
    const c = src[i]
    if (quote) {
      if (c === '\\') { i += 2; continue }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return src.slice(start, i + 1)
    i++
  }
  return null
}
function lineOf(src, idx) {
  let n = 1
  for (let i = 0; i < idx; i++) if (src[i] === '\n') n++
  return n
}
function extractClasses(tag) {
  const out = []
  for (const s of tag.match(/\bclassName\s*=\s*"([^"]*)"/g) || [])
    out.push(...s.replace(/^.*?"/, '').replace(/"$/, '').split(/\s+/))
  for (const b of tag.match(/\bclassName\s*=\s*\{[\s\S]*?\}/g) || [])
    for (const s of b.match(/'([^']*)'/g) || []) out.push(...s.slice(1, -1).split(/\s+/))
  return out.filter(Boolean)
}
function extractSize(tag) {
  const m = tag.match(/\bsize\s*=\s*"([^"]*)"/) || tag.match(/\bsize\s*=\s*\{\s*'([^']*)'\s*\}/)
  return m ? m[1] : null
}
/** 豁免文件:button.tsx 定义本体、测试目录/测试文件(与旧版逐字同口径) */
function isScannedFile(rel) {
  if (rel === EXCLUDE_FILE) return false
  if (/(^|\/)(tests?|e2e|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel)) return false
  return true
}
/**
 * 单文件纯函数面:源码 → 违规清单。无 fs 依赖,供自检直接调用。
 * 注释处理刻意收窄:maskComments 只用于 <Button 开标签的"定位"面(消灭"注释里的示例代码被判红");
 * 标签体一律从**原始源码**提取,与旧版逐字节同语义 —— 全仓现绿,任何解析强化都可能把某处历史
 * 真违规瞬间变红(恒红门 = 全队 --no-verify 的教训)。由"标签体截断"产生的漏拦见 --self-test
 * 未覆盖面清单与交付报告,属另一票。
 */
function collectViolationsInSource(src, validSizes, rel = '<memory>') {
  const masked = maskComments(src)
  const violations = []
  const re = /<Button(?=[\s/>])/g
  let m
  while ((m = re.exec(masked))) {
    const tag = extractTag(src, m.index)
    if (!tag) continue
    const classes = extractClasses(tag)
    const size = extractSize(tag)
    const bad = classes.filter((c) => BAD_SIZE_RE.test(c) && SIZE_TOKEN_RE.test(c))
    const badSize =
      size !== null && !validSizes.has(size) ? [`size="${size}" 不在档位表 ${[...validSizes].join('/')}`] : []
    if (bad.length || badSize.length) {
      violations.push({ file: rel, line: lineOf(masked, m.index), bad: [...bad, ...badSize] })
    }
  }
  return violations
}
function walkTsx(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) walkTsx(p, out)
    else if (/\.(tsx|jsx)$/.test(e)) out.push(p.replaceAll('\\', '/'))
  }
}
/** 在指定根上扫描(stagedSet 非空时收窄到该集合) */
function scanTree(root, stagedSet = null) {
  const validSizes = loadValidSizes(root)
  const files = []
  for (const r of ROOTS) {
    try {
      if (statSync(path.join(root, r)).isDirectory()) walkTsx(path.join(root, r), files)
    } catch {
      /* 该端目录不存在,跳过(与旧版 filter 同语义) */
    }
  }
  const violations = []
  for (const f of files) {
    const rel = path.relative(root, f).replaceAll('\\', '/')
    if (!isScannedFile(rel)) continue
    if (stagedSet && !stagedSet.has(rel)) continue
    let src
    try {
      src = readFileSync(f, 'utf8')
    } catch {
      continue
    }
    violations.push(...collectViolationsInSource(src, validSizes, rel))
  }
  return { violations, fileCount: files.length, validSizes }
}
function getStagedSet(root) {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 16 * 1024 * 1024,
    })
    return new Set(out.split('\n').filter(Boolean).map((f) => f.replaceAll('\\', '/')))
  } catch {
    return null
  }
}
function report(violations, fileCount, validSizes) {
  if (violations.length) {
    console.error(`❌ Button 高度/宽度覆盖守门:发现 ${violations.length} 处违规\n`)
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  →  ${v.bad.join(', ')}`)
    }
    console.error(
      `\n修复:改用 size 档位(${[...validSizes].join('/')}),需要新高度先在 button.tsx size 表立档。`,
    )
    console.error('规则详见 AGENTS.md §4「Button 高度档位守门」。紧急跳过:HUSKY_SKIP_BUTTON_HEIGHT_GUARD=1')
    return 1
  }
  console.log(`✅ Button 高度/宽度守门通过(0 违规,扫描 ${fileCount} 个 tsx/jsx)`)
  return 0
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  const known = new Set()
  argv.forEach((a, i) => {
    if (a === '--staged' || a === '--self-test') known.add(i)
    if (a === '--root' || a.startsWith('--root=')) {
      known.add(i)
      if (a === '--root') known.add(i + 1)
    }
  })
  const unknown = argv.filter((_, i) => !known.has(i))
  if (unknown.length) {
    console.error(`❌ 未知参数:${unknown.join(' ')}(用法:--staged | --root <dir|--root=<dir>> | --self-test)`)
    return 2
  }
  let parsed
  try {
    parsed = resolveRoot(argv, process.env)
  } catch (e) {
    console.error(`❌ ${e.message}`)
    return 2
  }
  const { root, explicitCli } = parsed
  const staged = argv.includes('--staged')
  if (staged && explicitCli) {
    console.error('❌ --staged 不得与 --root/BUTTON_HEIGHT_ROOT 并用(暂存集来自真仓、扫描根却是夹具 → 必假绿)')
    return 2
  }
  let rootOk = false
  try {
    rootOk = statSync(root).isDirectory()
  } catch {
    rootOk = false
  }
  if (!rootOk) {
    console.error(`❌ 扫描根不存在或不是目录:${root}(--root 指错绝不静默放行)`)
    return 2
  }
  let stagedSet = null
  if (staged) {
    stagedSet = getStagedSet(root)
    if (!stagedSet) console.warn('⚠️ 读取 staged 清单失败(git 不可用?),按旧语义回落全量扫描')
  }
  const { violations, fileCount, validSizes } = scanTree(root, stagedSet)
  // 反假绿:一个 tsx 都没扫到 = 根指错 / ROOTS 漂移,绝不允许输出"通过 0 个"的绿灯
  if (fileCount === 0) {
    console.error(`❌ 在 ${root} 下未扫到任何 tsx/jsx(ROOTS 漂移或根指错),按脚本异常处理`)
    return 2
  }
  return report(violations, fileCount, validSizes)
}

// ═════════════ self-test(独立夹具正反成对取证,绝不扫真仓) ═════════════
// 夹具落 <repo>/.ihui-agent/tmp/button-height/selftest-<pid>/(AGENTS.md §15 项目内路径)。
// 每一组"必红"都配同源/同形"必绿"对照;所有 CLI 判定经 --root 注入夹具,
// 若判据其实静默扫了真仓,fileCount 对不上夹具数量 → 立即红(反"只改 cwd"陷阱)。
function buildButtonTsx(withIcon2xs, withZzMega) {
  const lines = [
    `import { cva } from 'class-variance-authority'`,
    `export const buttonVariants = cva('base', {`,
    `  variants: {`,
    `    size: {`,
    `      xs: 'h-7 rounded-md px-3 text-xs',`,
    `      default: 'h-9 px-4 py-2',`,
    `      sm: 'h-8 rounded-md px-3 text-xs',`,
    `      lg: 'h-10 rounded-md px-8',`,
    `      // 注释里的 key: fake 不得污染档位解析`,
  ]
  if (withIcon2xs) lines.push(`      'icon-2xs': 'h-7 w-7',`)
  lines.push(
    `      'icon-xs': ICON_BUTTON_SIZE,`,
    `      'icon-sm': ICON_BUTTON_SIZE,`,
    `      'icon': ICON_BUTTON_SIZE,`,
  )
  if (withZzMega) lines.push(`      'zz-mega': 'h-12 w-12',`)
  lines.push(
    `    },`,
    `  },`,
    `  defaultVariants: { variant: 'default', size: 'default' },`,
    `})`,
  )
  return lines.join('\n') + '\n'
}
const FIX_VIOLATIONS_TSX = `import { Button, Input } from '@ihui/ui-react'
// 注释里的历史代码不得判红:// <Button className="h-7 w-7" /> 与 size="nope" 都在注释内
export function Demo({ isOpen, ...props }) {
  return (
    <>
      <Button className="h-7 w-7">A 覆盖高度宽度</Button>
      <Button size="xl2">B 不存在的档位</Button>
      <Button className={isOpen ? 'h-7 w-7' : 'px-2'}>C 三元 className</Button>
      <Button
        variant="outline"
        {...props}
        className="h-9"
      >D 多行属性</Button>
      <Button className="h-5 w-5 px-1">E 白名单紧凑档</Button>
      <Button className="h-6">F 白名单紧凑档</Button>
      {/* <Button className="h-7 w-7">G 块注释里的覆盖</Button> */}
      <Input className="h-9" />
      <div className="h-10 w-11" />
      <button className="h-8 w-8">原生按钮</button>
    </>
  )
}
`
const FIX_OK_TSX = `import { Button, Input } from '@ihui/ui-react'
export function Ok(props) {
  return (
    <>
      <Button size="icon-2xs">合法档位</Button>
      <Button size="sm">合法档位</Button>
      <Button size="zz-mega">夹具表独有档位(回退兜底表没有它,被拦即证明动态解析失效)</Button>
      <Button className="h-5">白名单紧凑档</Button>
      <Button {...props}>无 className</Button>
      <Input className="h-9" />
      <div className="h-10 w-11" />
      <button className="h-8 w-8">原生按钮</button>
    </>
  )
}
`
const FIX_TOOLBAR_TSX = `export const T = () => <Button className="h-7">ui-react 内非 button.tsx 文件,必红</Button>\n`
const FIX_TESTS_TSX = `export const E = () => <Button className="h-7">与 A 同内容,但 tests 目录必须豁免</Button>\n`

async function runSelfTest() {
  const results = []
  const ck = (name, cond) => results.push({ name, ok: !!cond })
  const FIX = path.join(SCRIPT_REPO_ROOT, '.ihui-agent', 'tmp', 'button-height', `selftest-${process.pid}`)
  const MAIN = path.join(FIX, 'main')
  const MIN = path.join(FIX, 'min')
  const OKR = path.join(FIX, 'ok')
  const EMPTY = path.join(FIX, 'empty')
  const w = (abs, content) => {
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content, 'utf8')
  }
  const runCli = (args, env) =>
    spawnSync(process.execPath, [SELF, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 32 * 1024 * 1024,
      env: env ? { ...process.env, ...env } : process.env,
    })
  try {
    mkdirSync(MAIN, { recursive: true })
    w(path.join(MAIN, EXCLUDE_FILE), buildButtonTsx(true, true))
    w(path.join(MAIN, 'packages/ui-react/src/components/toolbar.tsx'), FIX_TOOLBAR_TSX)
    w(path.join(MAIN, 'apps/web/src/demo/violations.tsx'), FIX_VIOLATIONS_TSX)
    w(path.join(MAIN, 'apps/web/src/demo/ok.tsx'), FIX_OK_TSX)
    w(path.join(MAIN, 'apps/web/src/demo/tests/excluded.tsx'), FIX_TESTS_TSX)
    w(path.join(MIN, EXCLUDE_FILE), buildButtonTsx(false, false))
    w(path.join(MIN, 'apps/web/src/b.tsx'), `export const X = () => <Button size="icon-2xs">最小表删了 icon-2xs,必红</Button>\n`)
    w(path.join(OKR, EXCLUDE_FILE), buildButtonTsx(true, true))
    w(path.join(OKR, 'apps/web/src/ok.tsx'), FIX_OK_TSX)
    mkdirSync(EMPTY, { recursive: true })

    // ── 1 必红:h-7 w-7 覆盖 ── 2 必绿:合法档位 icon-2xs/sm ──
    const mainScan = scanTree(MAIN)
    ck('夹具规模=fileCount 恰为 5(若其实扫了真仓,此数对不上 → 反静默扫真仓)', mainScan.fileCount === 5)
    ck('违规总数恰为 5(violations.tsx 4 + toolbar.tsx 1)', mainScan.violations.length === 5)
    const vio = mainScan.violations
    const badFlat = vio.flatMap((v) => v.bad)
    ck('A:<Button className="h-7 w-7"> 必红且点名 h-7 与 w-7', badFlat.includes('h-7') && badFlat.includes('w-7'))
    ck('B:size="xl2"(不存在档位)必红且报"不在档位表"', badFlat.some((b) => b.includes('size="xl2"') && b.includes('不在档位表')))
    ck('C:三元 className 里的 h-7 必红', badFlat.filter((b) => b === 'h-7').length >= 2)
    ck('D:多行属性 + {...props} 展开后的 h-9 必红', badFlat.includes('h-9'))
    ck('ok.tsx 全绿:icon-2xs/sm/zz-mega 档位与白名单不产生任何违规', !vio.some((v) => v.file.endsWith('ok.tsx')))

    // ── 3 白名单对照:h-5/h-6 放过而 h-7 仍拦(同断言内对照,防豁免通道被顺手放宽) ──
    ck('白名单对照:E/F 的 h-5 h-6 w-5 未被判红,而同文件 h-7/h-9 判红',
      !badFlat.includes('h-5') && !badFlat.includes('h-6') && !badFlat.includes('w-5') && badFlat.includes('h-7') && badFlat.includes('h-9'))

    // ── 5 非 Button 元素必绿(拦了即误伤) ──
    ck('非 Button:<Input h-9>/<div h-10>/<button h-8> 不判红', collectViolationsInSource(
      `export const N = () => (<><Input className="h-9" /><div className="h-10 w-11" /><button className="h-8 w-8" /></>)`,
      new Set(['default']),
    ).length === 0)

    // ── 7 JSX 边界:注释不得判红 ──
    ck('注释:单行// 与 块/* */ 及 JSX {/* */} 内的 h-7 Button 全不判红',
      collectViolationsInSource(`// <Button className="h-7 w-7" /> x\n/* <Button className="h-8">y */\nexport const Q = () => <p>{"z"}</p>\n`, new Set()).length === 0)
    ck('多行开标签本身可被提取(extractTag 感知花括号配平)',
      extractTag(`a <Button\n x={ {a:1} }\n className="h-9">`, 2).endsWith('className="h-9">'))
    // 钉死旧语义:标签体内注释含 > 会在注释处截断提取,其后的真 className 不被读。
    // 这是 SidebarHeader.tsx:280 历史绿到今天的根因,属"已知漏拦面"(见报告);
    // 本条把"零行为变更"变成可回归的事实 —— 若将来收紧标签体,本条必红,倒逼显式改判据。
    ck('标签体保留原始截断语义(注释内含 > 时其后 className 不被读 = 已知漏拦,防无声变红/变绿)',
      collectViolationsInSource(`export const L = () => <Button\n // 示例 [&>svg]:!h-5 注释含尖括号\n className="h-7">x</Button>\n`, new Set()).length === 0)

    // ── 6 动态档位解析:双向探针(防"动态解析其实没生效、回落到硬编码兜底表") ──
    ck('探针①:夹具独有档位 zz-mega 被 loadValidSizes 认出(兜底表无此档,回退即红)', mainScan.validSizes.has('zz-mega'))
    ck('探针①b:夹具档位集 ≠ 兜底集(相等即解析根本没读夹具文件)', mainScan.validSizes.size !== new Set(FALLBACK_SIZES).size)
    const minScan = scanTree(MIN)
    ck('探针②:夹具表删掉 icon-2xs 后 size="icon-2xs" 立即变红(判据跟着表走)',
      minScan.violations.length === 1 && minScan.violations[0].bad[0].includes('icon-2xs'))
    ck('真仓 sanity:loadValidSizes(真仓根) ⊇ 核心档位 xs/sm/default/lg/icon-2xs', (() => {
      const s = loadValidSizes(SCRIPT_REPO_ROOT)
      return ['xs', 'sm', 'default', 'lg', 'icon-2xs'].every((k) => s.has(k))
    })())

    // ── tests 目录豁免(同内容必绿) ──
    ck('tests 目录豁免:excluded.tsx 与违规文件同内容但不判红', !vio.some((v) => v.file.includes('tests/')))

    // ── CLI 装车证明:退出码全部经 --root 注入夹具,不触真仓 ──
    const rBad = runCli(['--root', MAIN])
    ck('CLI --root 有违规夹具 → exit 1 且 stderr 点名 h-7', rBad.status === 1 && rBad.stderr.includes('h-7'))
    const rOk = runCli(['--root', OKR])
    ck('CLI --root 全绿夹具 → exit 0', rOk.status === 0 && rOk.stdout.includes('守门通过'))
    const MISSING = path.join(FIX, 'nope-not-exist')
    const rMiss = runCli(['--root', MISSING])
    ck('CLI --root 指不存在目录 → exit 2(绝不静默 exit 0)', rMiss.status === 2 && rMiss.stderr.includes('根不存在'))
    const rEqMiss = runCli([`--root=${MISSING}`])
    ck('CLI --root=<不存在目录> 等号形态同样 exit 2(防等号形态被静默忽略→直扫真仓假绿)', rEqMiss.status === 2 && rEqMiss.stderr.includes('根不存在'))
    const rEqOk = runCli([`--root=${OKR}`])
    ck('CLI --root=<dir> 等号形态正常注入生效 → exit 0', rEqOk.status === 0)
    const rEnv = runCli([], { BUTTON_HEIGHT_ROOT: MAIN })
    ck('CLI 环境变量 BUTTON_HEIGHT_ROOT 注入有违规夹具 → exit 1(env 通道装车证明)', rEnv.status === 1)
    const rConflict = runCli(['--staged', '--root', MAIN])
    ck('CLI --staged 与 --root 并用 → exit 2(互斥,防暂存集/扫描根错配假绿)', rConflict.status === 2)
    const rEmpty = runCli(['--root', EMPTY])
    ck('CLI --root 指向存在但无 tsx 的目录 → exit 2(反"扫描 0 个也通过"假绿)', rEmpty.status === 2)
    const rBogus = runCli(['--bogus'])
    ck('CLI 未知参数 → exit 2', rBogus.status === 2)
    const rNoVal = runCli(['--root='])
    ck('CLI --root= 空值 → exit 2(明确报错不静默)', rNoVal.status === 2)
  } finally {
    try {
      rmSync(FIX, { recursive: true, force: true })
    } catch {
      /* 临时夹具清理失败不影响自检结论 */
    }
  }
  const failed = results.filter((r) => !r.ok)
  for (const f of failed) console.error(`  ❌ ${f.name}`)
  console.log(
    failed.length
      ? `❌ check-button-height self-test FAILED ${failed.length}/${results.length}`
      : `✅ check-button-height self-test 全部通过(${results.length} 例,正反成对,夹具经 --root 注入未触真仓)`,
  )
  return failed.length ? 1 : 0
}

// §22d isDirectRun 守卫:直接 node 执行才跑 main();被测试 import 只取 __test__ 导出,零副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

// §22c:核心纯函数经 __test__ 暴露给镜像测试(scripts/tests/check-button-height.test.mjs),
// 测试禁止复制源实现当镜像常量。
export const __test__ = {
  resolveRoot,
  loadValidSizes,
  maskComments,
  extractTag,
  extractClasses,
  extractSize,
  isScannedFile,
  collectViolationsInSource,
  scanTree,
  FALLBACK_SIZES,
  SIZE_TOKEN_RE,
  BAD_SIZE_RE,
  SELF,
  SCRIPT_REPO_ROOT,
}

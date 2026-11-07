#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web 接屏脚手架(只出补丁草案,不落盘,2026-11-08 立)
 *
 * ## 它做什么
 *
 * 输入一条 adopt 候选(web 路由 + 登记表里的 RN 壳),读三份判定面:
 *
 *   1. **web 页面族正文** —— 宿主职责(取数 / 登录门 / 导航 / 弹窗 / 平台能力);
 *   2. **RN 壳正文** —— 已经接好的那一份:共享屏 props 是怎么被宿主喂进去的;
 *   3. **共享屏正文** —— props 签名(哪些能力是它接受注入的)。
 *
 * 产出一份**能力对照**与一份**补丁草案**:
 *
 *   - 宿主能原样保留的职责 → 「留在宿主」;
 *   - 共享屏接受注入的能力 → 「注入 props」;
 *   - web 有、共享屏没有的能力 → **拒绝出补丁并点名原因**(不许拼一个能编译但功能缺失的版本)。
 *
 * ## 硬边界
 *
 *   - **只出 diff**:`--diff` 打到 stdout 或 `--out=<文件>`;`--apply` 参数一律 exit 2。
 *   - 只有"零能力缺口 + 每个 needed prop 都能在宿主现有状态里找到来源"才出 diff;
 *     任何一项不满足 ⇒ 拒绝(拒绝报告比草案更有用)。
 *   - 拒绝档会逐条给 `文件:行` 证据与"解封条件"(补共享屏能力 / 保留宿主自实现)。
 *
 * ## 形态边界(v1)
 *
 *   **可处理**:单面板路由页;web 页面族的全部用户可见能力都能被共享屏覆盖或经 props 注入;
 *            文件里只有一个导出组件、一个顶层 `return(`(机械替换才安全)。
 *   **拒绝**:① web 调了 RN 壳没有的领域 API;② web 引了 RN 壳与共享屏都没有的领域工具;
 *            ③ 平台能力(文件选择 / 剪贴板 / 分享 / markdown / 媒体)在共享屏没有对应 prop;
 *            ④ 多面板页(Tabs 下两块独立功能),共享屏只覆盖其一;
 *            ⑤ 结构无法机械定位(多导出组件 / 多顶层 return);
 *            ⑥ 任一 shared prop 无法从宿主现有状态映射(不做 TODO 占位)。
 *
 * ## 取材面(§0.4)
 *
 *   默认 = HEAD blob;`--worktree` = 磁盘(人工逃生舱);两面同给 ⇒ exit 2「未判定」。
 *
 * ## 用法
 *
 *   node scripts/web-adopt-shared-screen.mjs settings/import
 *   node scripts/web-adopt-shared-screen.mjs settings/import --json
 *   node scripts/web-adopt-shared-screen.mjs <route> --diff [--out=tmp/adopt.diff]
 *   node scripts/web-adopt-shared-screen.mjs --survey        # 226 条 adopt 候选的形态筛选
 *   node scripts/web-adopt-shared-screen.mjs --self-test
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { catBatch } from './lib/face-reader.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { __test__ as parity } from './check-web-rn-screen-parity.mjs'

const ROOT = process.cwd()
const WEB_DIR = 'apps/web'
const REGISTRY_PATH = 'scripts/data/cross-end-screen-registry.json'
const argv = process.argv.slice(2)
const flags = {
  worktree: argv.includes('--worktree'),
  json: argv.includes('--json'),
  diff: argv.includes('--diff'),
  survey: argv.includes('--survey'),
  list: argv.includes('--list') || argv.includes('--survey'),
  selfTest: argv.includes('--self-test'),
  out: (argv.find((a) => a.startsWith('--out=')) ?? '').slice('--out='.length) || null,
  unknown: argv.filter(
    (a) =>
      a.startsWith('--') &&
      !['--worktree', '--json', '--diff', '--survey', '--list', '--self-test', '--apply'].includes(
        a,
      ) &&
      !a.startsWith('--out='),
  ),
}
if (argv.includes('--apply')) {
  console.error('❌ 本门只出补丁草案,不落盘:`--apply` 不受支持(人工确认后由人落地)')
  process.exit(2)
}
if (flags.worktree && argv.includes('--staged')) {
  console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4)')
  process.exit(2)
}
const FACE = flags.worktree ? 'worktree' : 'head'
const revOf = (rel) => (FACE === 'worktree' ? rel : `HEAD:${rel}`)

// 同一进程内复用:survey 要扫全部候选,重复取同一份 blob 会把耗时放大成 O(n²)。
const __blobCache = new Map()
const __listCache = new Map()
function faceList(dir) {
  if (!__listCache.has(dir)) __listCache.set(dir, cov.faceList(FACE, dir))
  return __listCache.get(dir)
}
let __mapCache = null
function loadMap() {
  if (!__mapCache) __mapCache = parity.loadMap(FACE)
  return __mapCache
}

function readBatch(rels) {
  const map = new Map()
  const uniq = [...new Set(rels.filter(Boolean))]
  if (uniq.length === 0) return map
  const pend = []
  for (const rel of uniq) {
    if (__blobCache.has(rel)) map.set(rel, __blobCache.get(rel))
    else pend.push(rel)
  }
  if (pend.length === 0) return map
  if (FACE === 'worktree') {
    for (const rel of pend) {
      try {
        const t = readFileSync(join(ROOT, rel), 'utf8')
        __blobCache.set(rel, t)
        map.set(rel, t)
      } catch {
        __blobCache.set(rel, null)
        map.set(rel, null)
      }
    }
    return map
  }
  const got = catBatch(ROOT, pend.map(revOf), { maxBuffer: 512 * 1024 * 1024 })
  for (const rel of pend) {
    const t = got.get(revOf(rel)) ?? null
    __blobCache.set(rel, t)
    map.set(rel, t)
  }
  return map
}

const IMPORT_RE = /import\s+(?:type\s+)?(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/g

function importedNames(clause) {
  const out = []
  const raw = String(clause ?? '').trim()
  const braced = raw.match(/\{([\s\S]*)\}/)
  if (braced) {
    for (const part of braced[1].split(',')) {
      const seg = part.trim()
      if (!seg) continue
      const name = seg
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name) out.push(name)
    }
  }
  const head = raw.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim()
  for (const seg of head.split(/\s+/)) {
    const name = seg.split(/\s+as\s+/).pop()
    if (name && name !== '' && !name.startsWith('*')) out.push(name)
  }
  return out
}

/** 解析一组文件里的 import 绑定与来源;返回 [{name,spec,file,line}]。 */
function importsOf(files, read = readBatch) {
  const texts = read(files)
  const out = []
  for (const file of files) {
    const text = texts.get(file)
    if (typeof text !== 'string') continue
    const lineAt = (idx) => text.slice(0, idx).split('\n').length
    for (const m of text.matchAll(IMPORT_RE)) {
      for (const name of importedNames(m[1])) {
        out.push({ name, spec: m[2], file, line: lineAt(m.index ?? 0) })
      }
    }
  }
  return out
}

/** `/api/...` 字面量;(file,line) 用于证据。 */
function endpointsOf(files, read = readBatch) {
  const texts = read(files)
  const out = new Set()
  for (const file of files) {
    const text = texts.get(file)
    if (typeof text !== 'string') continue
    for (const m of text.matchAll(/['"`](\/api\/[^'"`\s]+)['"`]/g)) out.add(m[1])
  }
  return out
}

const posixDir = (p) => p.slice(0, p.lastIndexOf('/')) || ''
const normSegs = (p) => p.split('/').filter((s) => s && s !== '.')

/** `apps/web/app/(main)/settings/import/page.tsx` → `settings/import` */
export function routeOfWebFile(file) {
  const segs = normSegs(posixDir(file))
  if (segs[0] !== 'apps' || segs[1] !== 'web' || segs[2] !== 'app') return null
  const rest = segs.slice(3).filter((s) => !(s.startsWith('(') && s.endsWith(')')))
  return rest.join('/')
}

/** 取共享 props 的顶层字段名(接口或类型字面量;按花括号深度只取第 1 层)。 */
export function parsePropNames(text, propsName) {
  const src = String(text ?? '')
  const re = new RegExp(
    `(?:export\\s+)?(?:interface|type)\\s+${propsName}[^\\n{]*\\{([\\s\\S]*?)\\n\\}`,
  )
  const m = src.match(re)
  if (!m) return []
  const names = []
  let depth = 0
  for (const raw of m[1].split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue
    const field = line.match(/^([A-Za-z_$][\w$]*)\??\s*:/)
    if (field && depth === 0) names.push(field[1])
    for (const ch of line) {
      if (ch === '{' || ch === '(' || ch === '[') depth += 1
      else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    }
  }
  return [...new Set(names)]
}

/** RN 壳里喂给共享屏的 JSX 属性名(只认 `<SharedXxx ...>` 那一块)。 */
export function passedPropsOf(text, componentName) {
  const src = String(text ?? '')
  const start = src.search(new RegExp(`<\\s*${componentName}[\\s/>]`))
  if (start < 0) return []
  const chunk = src.slice(start)
  const end = chunk.search(/\n\s*\/>/)
  const block = end > 0 ? chunk.slice(0, end) : chunk.slice(0, 2000)
  const names = [...block.matchAll(/(?:^|\s)([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1])
  // `<SharedX` 自身不是属性;`key/ref` 也不算 props 合同
  return [...new Set(names.filter((n) => n !== componentName && n !== 'key' && n !== 'ref'))]
}

/* ---------------- 宿主职责与平台能力词表(显式、可审计) ---------------- */

const HOST_MARKERS = [
  {
    id: 'data-fetch',
    label: '取数/提交',
    re: /\b(useQuery|useMutation|useInfiniteQuery|fetchApi|apiOrThrow)\b/,
    prop: null,
  },
  { id: 'auth-gate', label: '登录门', re: /\b(useAuthGate|AuthGatePrompt)\b/, prop: null },
  { id: 'navigation', label: '导航', re: /\b(useRouter|useParams)\b|\brouter\.(push|replace|back)\b|<Link\b/, prop: null },
  { id: 'toast', label: 'toast 反馈', re: /\btoast\.(success|error|info)\b/, prop: null },
  { id: 'file-pick', label: '文件选择', re: /type=["']file["']|DocumentPicker/, prop: /onPickFile|onSelectFile|onUpload/i },
  { id: 'clipboard', label: '剪贴板', re: /navigator\.clipboard/, prop: /onCopy|onCopyLink/i },
  { id: 'web-share', label: '分享/外开', re: /navigator\.share|window\.open/, prop: /onShare|onPreview|onOpen/i },
  { id: 'rich-text', label: '富文本渲染', re: /\bReactMarkdown\b|dangerouslySetInnerHTML|<SafeHtml\b/, prop: /renderText|renderContent|renderHtml/i },
  { id: 'media', label: '视频/音频', re: /<video\b|<audio\b/, prop: /renderVideo|renderAudio/i },
  { id: 'modal', label: '弹窗/抽屉', re: /\b(ImportAnalysisDialog|Dialog|Modal|Sheet|Drawer)\b|\bdynamic\s*\(/, prop: /render.*|footer|onAnalyze/i },
]

function hostResponsibilities(files, read = readBatch) {
  const texts = read(files)
  const rows = []
  for (const marker of HOST_MARKERS) {
    for (const file of files) {
      const text = texts.get(file)
      if (typeof text !== 'string') continue
      const idx = text.search(marker.re)
      if (idx < 0) continue
      rows.push({
        id: marker.id,
        label: marker.label,
        file,
        line: text.slice(0, idx).split('\n').length,
        propRe: marker.prop,
      })
      break
    }
  }
  return rows
}

/* ---------------- 候选解析 ---------------- */

function webFamilyFiles(route) {
  const all = faceList(WEB_DIR)
  return {
    all,
    family: all.filter(
      (f) =>
        routeOfWebFile(f) === route &&
        /\.(t|j)sx?$/.test(f) &&
        !/\.test\.|\/__tests__\//.test(f),
    ),
    tests: all.filter(
      (f) => /\.(test|spec)\.(t|j)sx?$/.test(f) && /\/__tests__\/|\/tests\//.test(f),
    ),
  }
}

/** 组件参数上的 props 类型名(有的屏用 `XxxCurrentScreenProps extends XxxScreenProps`)。 */
export function propsTypeOf(sharedText, componentName) {
  const src = String(sharedText ?? '')
  const m = src.match(
    new RegExp(`(?:function|const)\\s+${componentName}\\s*[=(][\\s\\S]{0,600}?\\}:\\s*([A-Za-z_$][\\w$]*)`),
  )
  return m?.[1] ?? null
}

/** shared props 契约:本文件接口 + `extends` 基接口(基接口常落在 packages/types/src)。 */
function propsNamesOf(propsName, sharedText, read = readBatch) {
  const typeFiles = faceList('packages/types/src')
  const typeTexts = read(typeFiles)
  const lookup = (name, hintText) => {
    const here = parsePropNames(hintText, name)
    if (here.length) return here
    for (const file of typeFiles) {
      const got = parsePropNames(typeTexts.get(file), name)
      if (got.length) return got
    }
    return []
  }
  const local = lookup(propsName, sharedText)
  if (!local.length) return { names: [], source: null }
  const names = new Set(local)
  const seen = new Set([propsName])
  let frontier = [propsName]
  while (frontier.length) {
    const next = []
    for (const name of frontier) {
      const bases = parseInterfaceExtends(sharedText, name)
      for (const base of bases) {
        if (seen.has(base)) continue
        seen.add(base)
        const got = lookup(base, sharedText)
        for (const p of got) names.add(p)
        next.push(base)
      }
    }
    frontier = next
  }
  return { names: [...names], source: 'shared+types' }
}

/** `interface X extends A, B {` → ['A','B'] */
export function parseInterfaceExtends(text, name) {
  const m = String(text ?? '').match(
    new RegExp(`(?:export\\s+)?interface\\s+${name}\\s+extends\\s+([^\\n{]+)\\{`),
  )
  if (!m) return []
  return m[1]
    .split(',')
    .map((s) => s.trim().split(/\s+/)[0])
    .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s))
}

/**
 * RN 壳的唯一事实源是跨端登记表。映射表(web-rn-screen-map.jsonl)在"已委托"行把
 * `rn` 指向共享屏本身,那一栏不能当宿主读;登记表无对应行一律未判定,不回退映射表。
 */
export function hostShellOf(mapRn, read = readBatch) {
  if (!mapRn) return null
  const regText = read([REGISTRY_PATH]).get(REGISTRY_PATH)
  if (typeof regText !== 'string') return null
  let entries = []
  try {
    entries = JSON.parse(regText).entries ?? []
  } catch {
    return null
  }
  const pool = entries.filter((e) => e.shared === mapRn || e.rn === mapRn)
  if (pool.length === 0) return null
  const rn = String(pool[0].rn ?? '')
  // 登记表自己也把 rn 指向共享层 ⇒ 仍是没有宿主的形态,判未判定而不是硬读共享屏。
  if (!rn || rn.startsWith('packages/app/src/')) return null
  return { rn, shared: String(pool[0].shared ?? '') }
}

/* ---------------- 能力缺口规则 ---------------- */

/** 通用 API 词表:任何端都必须自己接,不算领域能力缺口。 */
const GENERIC_API = new Set([
  'fetchApi',
  'apiOrThrow',
  'api',
  'apiFailureToText',
  'apiFailureToError',
])

let __apiEndpointCache = null

/**
 * api-client 导出 → 它打的端点。同一能力不同封装的等价判据:
 * web 用 `parseConversationImport()`,RN 壳用 `fetchApi('/api/.../parse')`,端点相同即已覆盖。
 */
function apiEndpointOf(name, read = readBatch) {
  if (!__apiEndpointCache) {
    const files = faceList('packages/api-client/src')
    const texts = read(files)
    __apiEndpointCache = new Map()
    for (const file of files) {
      const text = texts.get(file)
      if (typeof text !== 'string') continue
      for (const m of text.matchAll(/\bexport\s+(?:async\s+)?(?:function|const)\s+([A-Za-z_$][\w$]*)/g)) {
        const from = m.index ?? 0
        const tail = text.slice(from, from + text.slice(from).split('\n').slice(0, 30).join('\n').length)
        const ep = tail.match(/['"`](\/api\/[^'"`\s]+)['"`]/)
        if (ep) __apiEndpointCache.set(m[1], ep[1])
      }
    }
  }
  return __apiEndpointCache.get(name) ?? null
}

/**
 * R1 领域 API 面:web 引了、RN 壳没引、且端点也没出现在 RN 壳/共享屏里的 api-client 导出。
 */
function apiGaps(webFiles, rnFiles, sharedFiles, read = readBatch) {
  const webImports = importsOf(webFiles, read).filter((i) => i.spec === '@ihui/api-client')
  const rnImports = importsOf(rnFiles, read).filter((i) => i.spec === '@ihui/api-client')
  const sharedImports = importsOf(sharedFiles, read).filter((i) => i.spec === '@ihui/api-client')
  const have = new Set([...rnImports, ...sharedImports].map((i) => i.name))
  const rnEndpoints = endpointsOf(rnFiles, read)
  const sharedEndpoints = endpointsOf(sharedFiles, read)
  const gaps = []
  for (const imp of webImports) {
    if (GENERIC_API.has(imp.name) || have.has(imp.name)) continue
    const ep = apiEndpointOf(imp.name, read)
    if (ep && (rnEndpoints.has(ep) || sharedEndpoints.has(ep))) continue
    gaps.push({
      rule: 'R1-领域API',
      detail: `web 引用了 api-client 的 \`${imp.name}\`,RN 壳与共享屏都没有对等出口${
        ep ? `(端点 ${ep} 两端都没有)` : ''
      }`,
      evidence: `${imp.file}:${imp.line}`,
    })
  }
  return gaps
}

/** R2 领域工具面:web 引了 `@ihui/shared/*`,RN 壳与共享屏都没引。 */
function sharedUtilGaps(webFiles, rnFiles, sharedFiles, read = readBatch) {
  const webImports = importsOf(webFiles, read).filter((i) => i.spec.startsWith('@ihui/shared/'))
  const have = new Set(
    [...importsOf(rnFiles, read), ...importsOf(sharedFiles, read)]
      .filter((i) => i.spec.startsWith('@ihui/shared/'))
      .map((i) => `${i.spec}#${i.name}`),
  )
  const gaps = []
  for (const imp of webImports) {
    if (have.has(`${imp.spec}#${imp.name}`)) continue
    gaps.push({
      rule: 'R2-领域工具',
      detail: `web 引用了 \`${imp.spec}\` 的 \`${imp.name}\`,RN 壳与共享屏都没有`,
      evidence: `${imp.file}:${imp.line}`,
    })
  }
  return gaps
}

/** R3 平台能力:web 用了,而共享屏 prop 面里没有对应注入点。 */
function platformGaps(hostRows, sharedProps) {
  const gaps = []
  for (const row of hostRows) {
    if (!row.propRe) continue
    if (sharedProps.some((p) => row.propRe.test(p))) continue
    gaps.push({
      rule: 'R3-平台能力',
      detail: `web 用了「${row.label}」,共享屏 props 里没有可注入点(${row.propRe})`,
      evidence: `${row.file}:${row.line}`,
    })
  }
  return gaps
}

/** R4 多面板页:页面用 Tabs 且 ≥2 个 TabsContent,共享屏只对应其中一块。 */
function multiPanelGaps(webFiles, read = readBatch) {
  const texts = read(webFiles)
  const gaps = []
  for (const file of webFiles) {
    const text = texts.get(file)
    if (typeof text !== 'string') continue
    const tabsIdx = text.search(/<Tabs\b/)
    if (tabsIdx < 0) continue
    const contents = [...text.matchAll(/<TabsContent\b/g)].length
    if (contents < 2) continue
    gaps.push({
      rule: 'R4-多面板',
      detail: `页面是 Tabs 双/多面板(${contents} 块),共享屏只覆盖其中一块,机械替换会丢掉另一块`,
      evidence: `${file}:${text.slice(0, tabsIdx).split('\n').length}`,
    })
  }
  return gaps
}

/** R5 结构:替换单元里导出组件 / 顶层 return 不唯一 ⇒ 无法机械定位。 */
function structureGaps(unitFile, text) {
  if (typeof text !== 'string') {
    return [{ rule: 'R5-结构', detail: '替换单元正文取不到', evidence: unitFile }]
  }
  const exports = [...text.matchAll(/export\s+(?:default\s+)?(?:function|const)\s+([A-Za-z_$][\w$]*)/g)]
  const returns = [...text.matchAll(/^\s{0,4}return\s*\(/gm)]
  const gaps = []
  if (exports.length !== 1) {
    gaps.push({
      rule: 'R5-结构',
      detail: `替换单元导出组件 ${exports.length} 个(期望 1),机械替换不安全`,
      evidence: unitFile,
    })
  }
  if (returns.length !== 1) {
    gaps.push({
      rule: 'R5-结构',
      detail: `替换单元顶层 return( ${returns.length} 处(期望 1),机械替换不安全`,
      evidence: unitFile,
    })
  }
  return gaps
}

/* ---------------- prop 映射 ---------------- */

const tFunctionProps = (name) => name === 't'

/** 共享屏 t 的键是否带命名空间前缀(带 ⇒ 需要 mapper,不能直接把 web 的 t 塞进去)。 */
export function needsTranslationMapper(sharedText) {
  const keys = [...String(sharedText ?? '').matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  return keys.some((k) => k.includes('.'))
}

/**
 * 逐个 shared prop 找宿主来源。返回 {mapped, unresolved}。
 * 只认**现有状态里的同名实体**(state / const / function / query 派生),不猜、不造 TODO。
 */
export function mapProps({ sharedProps, sharedText, webText, rnPassed, colorScheme = 'light' }) {
  const declared = new Set(
    [...String(webText ?? '').matchAll(/\b(?:const|let|function)\s+([A-Za-z_$][\w$]*)/g)].map(
      (m) => m[1],
    ),
  )
  const stateVars = new Set(
    [...String(webText ?? '').matchAll(/\b(?:useState|useRef|useMemo)\b[^\n]*/g)].flatMap((m) => {
      const seg = m[0]
      const mm = seg.match(/(?:const|let)\s+([A-Za-z_$][\w$]*)/)
      return mm ? [mm[1]] : []
    }),
  )
  const mapped = []
  const unresolved = []
  for (const prop of sharedProps) {
    if (tFunctionProps(prop)) {
      if (needsTranslationMapper(sharedText)) {
        unresolved.push({ prop, why: '共享屏 t 用带命名空间前缀的键,需要 mapper(不能直传 web 的 t)' })
      } else {
        mapped.push({ prop, expr: 't' })
      }
      continue
    }
    if (prop === 'colorScheme') {
      mapped.push({ prop, expr: `"${colorScheme}"` })
      continue
    }
    if (rnPassed.includes(prop) && (declared.has(prop) || stateVars.has(prop))) {
      mapped.push({ prop, expr: prop })
      continue
    }
    if (declared.has(prop) || stateVars.has(prop)) {
      mapped.push({ prop, expr: prop })
      continue
    }
    unresolved.push({ prop, why: '宿主现有状态里没有同名实体' })
  }
  return { mapped, unresolved }
}

/* ---------------- 单候选判定 ---------------- */

function analyzeRoute(route, read = readBatch) {
  const { all, family } = webFamilyFiles(route)
  if (family.length === 0) {
    return { route, verdict: 'refuse', reason: `未判定:web 页面族取不到(${FACE} 面)`, gaps: [] }
  }
  const mapRows = loadMap()
  const row = mapRows.find((r) => !r.bad && r.web === route)
  if (!row) return { route, verdict: 'refuse', reason: '登记表没有该路由,无法定位 RN 壳', gaps: [] }
  if (!row.rn) return { route, verdict: 'refuse', reason: '登记表该路由没有 RN 壳路径', gaps: [] }
  const host = hostShellOf(row.rn, read)
  if (!host) {
    return {
      route,
      verdict: 'unread',
      reason: `未判定:跨端登记表没有该路由的 RN 壳(映射表 rn=${row.rn} 不作数)`,
      webFiles: family,
      rn: null,
      shared: row.rn,
      hostRows: hostResponsibilities(family, read),
      gaps: [],
    }
  }
  const rnText = read([host.rn]).get(host.rn)
  if (typeof rnText !== 'string') {
    return { route, verdict: 'refuse', reason: `RN 壳正文取不到:${host.rn}`, rn: host.rn, shared: host.shared, gaps: [] }
  }
  const sharedText = read([host.shared]).get(host.shared)
  if (typeof sharedText !== 'string') {
    return { route, verdict: 'refuse', reason: `共享屏正文取不到:${host.shared}`, rn: host.rn, shared: host.shared, gaps: [] }
  }

  const sharedBindings = importsOf([host.rn], read)
  const screenBinding = sharedBindings.find(
    (b) => /^[A-Z][A-Za-z0-9]*Screen$/.test(b.name) && b.spec.startsWith('@ihui/rn-app'),
  )
  const componentName = screenBinding?.name ?? host.shared.split('/').pop().replace(/\.tsx?$/, '')
  const propsName = propsTypeOf(sharedText, componentName) ?? `${componentName.replace(/^Shared/, '')}Props`
  const propsDecl = propsNamesOf(propsName, sharedText, read)
  const sharedProps = propsDecl.names
  const rnPassed = passedPropsOf(rnText, componentName)
  const hostRows = hostResponsibilities(family, read)

  const webTexts = read(family)
  const unitFile =
    family.find((f) => !/page\.(tsx|jsx|ts|js)$/.test(f)) ??
    family.find((f) => /page\.(tsx|jsx|ts|js)$/.test(f)) ??
    family[0]
  const unitText = webTexts.get(unitFile) ?? ''

  const gaps = [
    ...apiGaps(family, [host.rn], [host.shared], read),
    ...sharedUtilGaps(family, [host.rn], [host.shared], read),
    ...platformGaps(hostRows, sharedProps),
    ...multiPanelGaps(family, read),
    ...structureGaps(unitFile, unitText),
  ]
  if (!propsDecl.source) {
    gaps.push({
      rule: 'R6-props',
      detail: `共享屏 props 契约 \`${propsName}\` 在共享屏与 packages/types/src 都找不到(未判定)`,
      evidence: host.shared,
    })
  }

  const unitStem = unitFile.split('/').pop().replace(/\.(tsx|ts|jsx|js)$/, '')
  const testNeedle = unitStem === 'page' ? route.split('/').pop() : unitStem
  const tests = all.filter(
    (f) => /\.(test|spec)\.(t|j)sx?$/.test(f) && f.split('/').pop().includes(testNeedle),
  )

  if (gaps.length) {
    return {
      route,
      verdict: 'refuse',
      reason: `发现 ${gaps.length} 项共享屏无法覆盖的能力/结构`,
      webFiles: family,
      unitFile,
      rn: host.rn,
      shared: host.shared,
      componentName,
      sharedProps,
      rnPassed,
      hostRows,
      gaps,
      tests: tests.length,
    }
  }

  const plan = mapProps({ sharedProps, sharedText, webText: unitText, rnPassed })
  if (plan.unresolved.length) {
    return {
      route,
      verdict: 'refuse',
      reason: `props 无法从宿主现有状态映射(${plan.unresolved.length} 个),不做 TODO 占位`,
      webFiles: family,
      unitFile,
      rn: host.rn,
      shared: host.shared,
      componentName,
      sharedProps,
      rnPassed,
      hostRows,
      gaps: plan.unresolved.map((u) => ({
        rule: 'R6-props',
        detail: `\`${u.prop}\`:${u.why}`,
        evidence: unitFile,
      })),
      tests: tests.length,
    }
  }

  return {
    route,
    verdict: 'ready',
    webFiles: family,
    unitFile,
    rn: row.rn,
    shared: host.shared,
    componentName,
    sharedProps,
    rnPassed,
    hostRows,
    mapped: plan.mapped,
    gaps: [],
    tests: tests.length,
  }
}

/* ---------------- diff 草案 ---------------- */

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 机械替换:保留宿主 hooks,把唯一顶层 return 块换成共享屏渲染。 */
export function draftUnitText(unitText, result) {
  const lines = String(unitText).split('\n')
  const ret = lines.findIndex((l) => /^\s{0,4}return\s*\(/.test(l))
  if (ret < 0) return null
  let depth = 0
  let start = -1
  let end = -1
  for (let i = ret; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '(') {
        depth += 1
        if (depth === 1) start = i
      } else if (ch === ')') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end >= 0) break
  }
  if (start < 0 || end < 0) return null
  const indent = lines[ret].match(/^\s*/)[0] + '  '
  const propLines = result.mapped.map((m) => `${indent}  ${m.prop}={${m.expr}}`)
  const render = [
    `${indent}return (`,
    `${indent}  <${result.componentName}`,
    ...propLines,
    `${indent}  />`,
    `${indent})`,
  ]
  const out = [
    ...lines.slice(0, ret),
    render[0],
    ...render.slice(1),
    ...lines.slice(end + 1),
  ]
  // 追加 import(放在最后一条 import 之后;找不到就放在 shebang/use client 之后)
  const lastImport = out.reduce((acc, l, i) => (/^import\s/.test(l) ? i : acc), -1)
  const importLine = `import { ${result.componentName} } from '${sharedSpecOf(result.shared)}'`
  if (!out.some((l) => l.includes(result.componentName) && l.startsWith('import'))) {
    out.splice(lastImport + 1, 0, importLine)
  }
  return out.join('\n')
}

function sharedSpecOf(sharedPath) {
  const p = sharedPath.replace(/^packages\/app\/src\//, '').replace(/\.tsx?$/, '')
  return `@ihui/rn-app/${p}`
}

function unifiedDiff(origPath, newText) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-adopt-'))
  const tmp = join(dir, origPath.split('/').pop())
  const orig = join(dir, 'orig.txt')
  writeFileSync(tmp, newText)
  writeFileSync(orig, readBatch([origPath]).get(origPath) ?? '')
  try {
    let raw = ''
    try {
      raw = execFileSync('git', ['diff', '--no-index', '--no-color', '--', orig, tmp], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
    } catch (e) {
      // --no-index 有差异时退出码就是 1,不是失败;stdout 里才是补丁正文。
      if (e.status === 1 && typeof e.stdout === 'string') raw = e.stdout
      else throw e
    }
    // 把临时路径还原成仓库路径,便于人工直接 `git apply`
    return raw
      .replace(new RegExp(esc(orig), 'g'), `a/${origPath}`)
      .replace(new RegExp(esc(tmp), 'g'), `b/${origPath}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* ---------------- 输出 ---------------- */

function printReport(r) {
  console.log(`\n=== ${r.route} ===`)
  console.log(
    `判定:${r.verdict === 'ready' ? '可出补丁草案' : r.verdict === 'unread' ? '未判定' : '拒绝'}`,
  )
  if (r.rn) console.log(`RN 壳:${r.rn}`)
  if (r.shared) console.log(`共享屏:${r.shared}`)
  if (r.componentName) console.log(`组件:${r.componentName}(props ${r.sharedProps.length} 个)`)
  if (r.reason) console.log(`原因:${r.reason}`)
  if (r.hostRows?.length) {
    console.log('\n宿主职责:')
    for (const h of r.hostRows) {
      const injectable = h.propRe && r.sharedProps?.some((p) => h.propRe.test(p))
      console.log(
        `  - ${h.label}(${h.id}) @ ${h.file}:${h.line} → ${
          h.propRe ? (injectable ? '注入 props' : '共享屏无注入点') : '留在宿主'
        }`,
      )
    }
  }
  if (r.gaps?.length) {
    console.log('\n拒绝理由(逐条):')
    for (const g of r.gaps) console.log(`  - [${g.rule}] ${g.detail}  (${g.evidence})`)
  }
  if (r.mapped?.length) {
    console.log('\nprops 映射:')
    for (const m of r.mapped) console.log(`  - ${m.prop}={${m.expr}}`)
  }
  if (r.tests) console.log(`\n宿主测试:${r.tests} 个文件引用该单元(落地时需同步改断言)`)
  if (r.verdict === 'refuse') {
    console.log('\n解封条件:共享屏补齐上述能力(需改 packages/app,本席只读)或保留该块宿主自实现。')
  }
}

/* ---------------- survey ---------------- */

/** 与总账同口径的"别条产线屏"排除表(Favorites/Coupon/ApiKeys/Patrol/Groups/RepoWiki/TeamKnowledge/Address/Help/NotificationList)。 */
const OTHER_LINE_SEGMENTS = new Set([
  'favorites',
  'favorite',
  'coupon',
  'coupons',
  'api-keys',
  'patrol',
  'groups',
  'repo-wiki',
  'team-knowledge',
  'address',
  'help',
  'notifications',
])
const isOtherLine = (route) => route.split('/').some((seg) => OTHER_LINE_SEGMENTS.has(seg))

/** RN 壳正文是否真的渲染了共享 `*Screen`(只看 import 不算委托)。 */
function rendersSharedScreen(text) {
  const src = String(text ?? '')
  for (const m of src.matchAll(IMPORT_RE)) {
    if (!m[2].startsWith('@ihui/rn-app')) continue
    for (const name of importedNames(m[1])) {
      if (!/^[A-Z][A-Za-z0-9]*Screen$/.test(name)) continue
      if (new RegExp(`<\\s*${name}[\\s/>]`).test(src)) return true
    }
  }
  return false
}

/** web 页面族是否已经接上共享屏(已接的不算 adopt 候选,避免把做过的重复算进分母)。 */
function webAlreadyAdopted(family) {
  const texts = readBatch(family)
  for (const file of family) {
    const text = texts.get(file)
    if (typeof text !== 'string') continue
    if (rendersSharedScreen(text)) return true
  }
  return false
}

function survey() {
  const rows = loadMap().filter((r) => !r.bad && (r.status === 'aligned' || r.status === 'pending'))
  const rnShells = new Set(faceList('apps/mobile-rn/src'))
  const sharedFiles = new Set(faceList('packages/app/src'))
  const webRoutes = new Set()
  for (const f of faceList(WEB_DIR)) {
    const r = routeOfWebFile(f)
    if (r) webRoutes.add(r)
  }
  // adopt 候选三档:① 登记 rn 直接指共享层文件;② RN 壳正文已渲染共享屏;③ 都不是 ⇒ 不是 adopt。
  const candidates = []
  for (const r of rows) {
    if (!r.rn || isOtherLine(r.web) || !webRoutes.has(r.web)) continue
    const family = webFamilyFiles(r.web).family
    if (family.length === 0 || webAlreadyAdopted(family)) continue
    if (sharedFiles.has(r.rn)) {
      candidates.push(r)
      continue
    }
    if (!rnShells.has(r.rn)) continue
    const text = readBatch([r.rn]).get(r.rn)
    if (!rendersSharedScreen(text)) continue
    candidates.push(r)
  }
  const results = []
  for (const c of candidates) {
    const r = analyzeRoute(c.web)
    results.push({
      route: c.web,
      verdict: r.verdict,
      reason: r.reason ?? null,
      rules: [...new Set((r.gaps ?? []).map((g) => g.rule))],
      mapRn: c.rn,
      rn: r.rn ?? null,
      shared: r.shared ?? null,
      rnPassed: Array.isArray(r.rnPassed) ? r.rnPassed.length : 0,
    })
  }
  const pass = results.filter((r) => r.verdict === 'ready')
  // 只看"共享屏已有能力覆盖"(R1–R5);R6 是 props 从宿主现有状态能不能映射,属落地工作量,不是形态边界。
  const capabilityPass = results.filter(
    (r) => r.verdict === 'ready' || (r.rules.length > 0 && r.rules.every((rule) => rule === 'R6-props')),
  )
  const byRule = {}
  for (const r of results) for (const rule of r.rules) byRule[rule] = (byRule[rule] ?? 0) + 1
  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          face: FACE,
          candidates: candidates.length,
          pass: pass.length,
          capabilityPass: capabilityPass.length,
          byRule,
          results,
        },
        null,
        2,
      ),
    )
    return
  }
  console.log(
    `[web-adopt-survey] 面=${FACE} adopt 候选=${candidates.length} 形态可过=${pass.length} 拒绝=${candidates.length - pass.length}`,
  )
  console.log(`  其中"共享屏已有能力覆盖"(不计 props 映射工作量)=${capabilityPass.length}`)
  const unread = results.filter((r) => r.verdict === 'unread')
  console.log(`  其中未判定(registry 无宿主,不回退映射表)=${unread.length}`)
  console.log(
    `  拒绝原因分布:${Object.entries(byRule)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(' / ') || '(无)'}`,
  )
  if (flags.list) {
    console.log('\n形态可过:')
    for (const p of pass) console.log(`  - ${p.route}`)
  }
}

/* ---------------- self-test ---------------- */

function selfTest() {
  const bad = []
  const eq = (name, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${name}: 期望 ${JSON.stringify(want)},实得 ${JSON.stringify(got)}`)
  }
  eq('routeOfWebFile', routeOfWebFile('apps/web/app/(main)/settings/import/page.tsx'), 'settings/import')
  eq(
    'parsePropNames',
    parsePropNames(
      'export interface FooProps {\n  t: T\n  onBack?: () => void\n  colorScheme?: string\n}',
      'FooProps',
    ),
    ['t', 'onBack', 'colorScheme'],
  )
  eq(
    'passedPropsOf',
    passedPropsOf('<SharedFooScreen\n  t={t}\n  onBack={goBack}\n/>', 'SharedFooScreen'),
    ['t', 'onBack'],
  )
  eq(
    'needsTranslationMapper(带前缀)',
    needsTranslationMapper("t('conversationImport.historyFailed')"),
    true,
  )
  eq('needsTranslationMapper(不带前缀)', needsTranslationMapper("t('backToWallet')"), false)
  const rows = [
    'apps/web/app/(main)/x/panel.tsx',
  ]
  const read = (paths) => {
    const m = new Map()
    for (const p of paths) if (p === rows[0]) m.set(p, "import { Tabs, TabsContent } from '@ihui/ui-react'\nreturn (<Tabs><TabsContent/><TabsContent/></Tabs>)")
    return m
  }
  eq('multiPanelGaps', multiPanelGaps(rows, read).length, 1)
  eq(
    'parseInterfaceExtends',
    parseInterfaceExtends('interface CurrentProps extends BaseProps, Extra {', 'CurrentProps'),
    ['BaseProps', 'Extra'],
  )
  eq(
    'propsTypeOf',
    propsTypeOf('export function FooScreen({ t, onBack }: FooCurrentProps) {', 'FooScreen'),
    'FooCurrentProps',
  )
  const icpHost = analyzeRoute('settings/icp-record')
  eq('icp-record 宿主走 registry', icpHost.rn, 'apps/mobile-rn/src/screens/IcpRecordScreen.tsx')
  eq(
    'icp-record 不拿共享屏当宿主',
    icpHost.rn === 'packages/app/src/features/icp-record/IcpRecordScreen.tsx',
    false,
  )
  eq('hostShellOf(未登记路由)', hostShellOf('apps/web/app/(main)/x/page.tsx'), null)
  const draft = draftUnitText(
    [
      "import React from 'react'",
      'export default function Foo() {',
      '  const t = useT()',
      '  return (',
      '    <div>old</div>',
      '  )',
      '}',
    ].join('\n'),
    {
      componentName: 'SharedFooScreen',
      mapped: [
        { prop: 't', expr: 't' },
        { prop: 'colorScheme', expr: '"light"' },
      ],
      shared: 'packages/app/src/features/foo/FooScreen.tsx',
    },
  )
  const draftAssert =
    draft?.includes('<SharedFooScreen') &&
    draft?.includes('t={t}') &&
    draft?.includes("import { SharedFooScreen } from '@ihui/rn-app/features/foo/FooScreen'") &&
    !draft?.includes('<div>old</div>')
  eq('draftUnitText', Boolean(draftAssert), true)
  const read2 = (paths) => {
    const m = new Map()
    for (const p of paths)
      if (p === rows[0])
        m.set(
          p,
          "import { addConversationToKnowledge } from '@ihui/api-client'\nawait addConversationToKnowledge('x')",
        )
    return m
  }
  eq('apiGaps', apiGaps(rows, [], [], read2).length, 1)
  if (bad.length) {
    console.error('❌ self-test 失败:\n' + bad.join('\n'))
    process.exit(1)
  }
  console.log('✅ self-test 通过(13 条判据)')
}

/* ---------------- main ---------------- */

if (flags.selfTest) {
  selfTest()
  process.exit(0)
}
if (flags.unknown.length) {
  console.error(`❌ 未知参数:${flags.unknown.join(' ')}`)
  process.exit(2)
}
if (flags.survey) {
  survey()
  process.exit(0)
}
const route = argv.find((a) => !a.startsWith('--'))
if (!route) {
  console.error('用法: node scripts/web-adopt-shared-screen.mjs <route> [--diff] [--json] [--survey]')
  process.exit(2)
}
const result = analyzeRoute(route.replace(/^\/+|\/+$/g, ''))
if (flags.json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  printReport(result)
}
if (result.verdict === 'unread') {
  console.error(`\n⛔ 未判定:${result.reason}(不回退映射表 rn,不给错的宿主职责)`)
  process.exit(2)
}
if (flags.diff) {
  if (result.verdict !== 'ready') {
    console.error(`\n❌ 拒绝出补丁:${result.reason}(不产生可编译但功能缺失的版本)`)
    process.exit(1)
  }
  const draft = draftUnitText(readBatch([result.unitFile]).get(result.unitFile), result)
  if (!draft) {
    console.error(`\n❌ 拒绝出补丁:无法机械定位 ${result.unitFile} 的 return 块`)
    process.exit(1)
  }
  const diff = unifiedDiff(result.unitFile, draft)
  if (diff.trim()) {
    if (flags.out) {
      writeFileSync(flags.out, diff)
      console.log(`补丁草案已写到 ${flags.out}(未落盘到源码树)`)
    } else {
      console.log(diff)
    }
  } else {
    console.error('❌ 草案与原文无差异,拒绝输出空补丁')
    process.exit(1)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

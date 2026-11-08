#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cross-end-pipeline-inventory.mjs —— web 页面「是否已走共享屏」的总账(只读,零写盘)。
 *
 * 立因(2026-11-08):仓里已有 web→RN 对账尺、共享屏覆盖门、小程序薄壳台账,但没有一张
 * **按 web 页面逐页**的账:哪一页已经把渲染层交给 packages/app,哪一页三端各写一份,
 * 哪一页只存在于一端,哪一页按设计不可能共享。没有这张账,「RN 自动同步 web、小程序对齐 RN」
 * 就仍然是一次次临时任务,而不是一条能持续跑的生产线。
 *
 * 本脚本不发明判据,四类的机器判定依据逐条可复算:
 *   1. 已共享(shared-screen) —— web 页面族内 import 了 `@ihui/rn-app*` 或 `packages/app/src`,
 *      且被导入的某个 `*Screen` 符号在页面族里以 JSX 渲染。只 import 小组件(如 CategoryHeader)
 *      记为「局部共享」,不冒充满屏共享。
 *   2. 端侧各自实现 —— 登记表 `scripts/data/web-rn-screen-map.jsonl` 判 aligned(或 pending),
 *      且 web 未接共享屏。再按登记表 rn 指向的层分两档:
 *        · shared-backed: RN 屏已委托 packages/app 共享屏(web 是最后一块未接的);
 *        · both-native:   RN 端内自实现(两端真重复)。
 *   3. 只存在于一端 —— web 侧登记表判 gap(判过确缺)或整段未登记(=**未判定**,不折成缺口);
 *      RN 侧 `apps/mobile-rn/src/screens/*Screen.tsx` 未被任何 aligned 行引用(启发式消歧,
 *      含同名行与「该 RN 文件渲染了被引用的共享屏」两种豁免),单列候选并标明启发式。
 *   4. 无法共享 —— 登记表 excluded(必须带 reason,验过才免)与 portal(WebView 门户承载)。
 *      portal 不是重复开发,而是按设计复用 web 实现,单列以免把 88 行读成待办。
 *
 * 取材面纪律(AGENTS §0.4):默认 HEAD blob,`--worktree` 仅人工逃生舱;两面旗同给 = exit 2。
 * 取不到 web 路由集/登记表 ⇒ exit 2「未判定」,不折成空集冒绿(§0.3)。
 *
 * 复跑:
 *   node scripts/cross-end-pipeline-inventory.mjs                 # 人读总账
 *   node scripts/cross-end-pipeline-inventory.mjs --list          # 四类逐页清单
 *   node scripts/cross-end-pipeline-inventory.mjs --candidates    # 抽屏候选排序
 *   node scripts/cross-end-pipeline-inventory.mjs --json          # 机读全量
 *   node scripts/cross-end-pipeline-inventory.mjs --pages-md=docs/engineering/xxx.pages.md  # 逐页清单落地
 *   node scripts/cross-end-pipeline-inventory.mjs --worktree      # 人工逃生舱(磁盘面)
 *   node scripts/cross-end-pipeline-inventory.mjs --self-test     # 判据自检(零 IO)
 */

import { catBatch } from './lib/face-reader.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { __test__ as parity } from './check-web-rn-screen-parity.mjs'
import { __test__ as probe } from './probe-web-rn-gap.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const listMode = argv.includes('--list')
const candidatesMode = argv.includes('--candidates')
const pagesMdMode = argv.find((a) => a.startsWith('--pages-md='))
const selfTestMode = argv.includes('--self-test')
const worktreeMode = argv.includes('--worktree')
if (worktreeMode && argv.includes('--staged')) {
  console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4)')
  process.exit(2)
}

const FACE = worktreeMode ? 'worktree' : 'head'
const FACE_LABEL =
  FACE === 'head' ? 'HEAD blob(git ls-tree + git cat-file --batch)' : '工作树(磁盘,人工逃生舱)'
const WEB_DIR = 'apps/web'
const SHARED_DIR = 'packages/app/src'
const RN_DIR = 'apps/mobile-rn/src'
const REGISTRY_PATH = 'scripts/data/cross-end-screen-registry.json'

/** 归属别条产线的屏:本总账只记账,不在此列里推荐抽屏(避免与并行开发撞车)。 */
const OTHER_LINE_TOKENS = new Set(['favorite', 'coupon', 'address', 'help', 'notification', 'group'])
/** 内部工具页(不是产品屏):单列,不混进四类分母。 */
const NON_PRODUCT_ROUTES = new Set(['shared-pilot'])
/** 已由别条产线接管的屏:只记账,不进抽屏候选(避免并行开发撞车)。 */
const OTHER_LINE_ROUTES = new Set([
  'patrol',
  'repo-wiki',
  'team-knowledge',
  'settings/api-keys',
  'groups',
])

const posixDir = (p) => p.slice(0, p.lastIndexOf('/')) || ''
const normalize = (p) => {
  const out = []
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}
const revOf = (rel) => (FACE === 'worktree' ? rel : `HEAD:${rel}`)
const readBatch = (rels) => {
  const map = new Map()
  const uniq = [...new Set(rels.filter(Boolean))]
  if (uniq.length === 0) return map
  if (FACE === 'worktree') {
    for (const rel of uniq) {
      try {
        map.set(rel, readFileSync(join(ROOT, rel), 'utf8'))
      } catch {
        map.set(rel, null)
      }
    }
    return map
  }
  const got = catBatch(ROOT, uniq.map(revOf), { maxBuffer: 512 * 1024 * 1024 })
  for (const rel of uniq) map.set(rel, got.get(revOf(rel)) ?? null)
  return map
}

const RESOLVE_EXTS = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']
function resolveLocal(fromRel, spec, fileSet) {
  let base = null
  if (spec.startsWith('@/')) base = `apps/web/src/${spec.slice(2)}`
  else if (spec.startsWith('.')) base = normalize(`${posixDir(fromRel)}/${spec}`)
  if (!base) return null
  for (const ext of RESOLVE_EXTS) if (fileSet.has(base + ext)) return base + ext
  return null
}

const IMPORT_RE = /import\s+([\s\S]+?)\s+from\s+['"]([^'"]+)['"]/g
const LOCAL_IMPORT_RE = /(?:import|export)\s+[\s\S]+?\s+from\s+['"]([^'"]+)['"]/g

/** 从 import clause 抽被导入的绑定名(支持 `{A, B as C}` / `* as X` / 默认导入)。 */
function importedNames(clause) {
  const out = []
  const braces = clause.match(/\{([\s\S]*?)\}/)
  if (braces) {
    for (const part of braces[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()
      if (/^[A-Za-z_$][\w$]*$/.test(name || '')) out.push(name)
    }
  }
  const star = clause.match(/\*\s+as\s+([\w$]+)/)
  if (star) out.push(star[1])
  const def = clause.trim().split(/\s*,\s*|\s+from/)[0].replace(/^type\s+/, '')
  if (/^[A-Za-z_$][\w$]*$/.test(def) && !clause.trim().startsWith('{')) out.push(def)
  return [...new Set(out)]
}

const isSharedSpec = (spec) => spec.startsWith('@ihui/rn-app') || spec.startsWith('packages/app/src')

/** 页面族正文里是否有共享屏 import;返回 {screen, partial, symbols}。 */
function sharedImportsOf(text) {
  const symbols = []
  for (const m of String(text).matchAll(IMPORT_RE)) {
    if (!isSharedSpec(m[2])) continue
    for (const name of importedNames(m[1])) symbols.push({ name, spec: m[2] })
  }
  const rendered = (name) => new RegExp(`<\\s*${name.replace(/[$]/g, '\\$')}[\\s/>]`).test(text)
  const screens = symbols.filter((s) => /Screen$/.test(s.name) && rendered(s.name))
  return {
    screen: screens.length > 0,
    partial: symbols.length > 0 && screens.length === 0,
    symbols: [...new Set(symbols.map((s) => s.name))],
  }
}

/** 登记表规则解析:逐条优先于段级;段级按前缀长度降序(更具体的段先赢)。 */
function resolveMapRule(route, exactMap, prefixRows) {
  const exact = exactMap.get(route)
  if (exact) return { row: exact, source: 'exact' }
  for (const row of prefixRows) {
    if (parity.routeInScope(route, parity.prefixScopeOf(row.web))) return { row, source: 'prefix' }
  }
  return null
}

function selfTest() {
  const files = new Set(['apps/web/app/x/page.tsx', 'apps/web/src/components/X.tsx'])
  const cases = [
    {
      want: 'screen',
      text: "import { GroupsScreen } from '@ihui/rn-app'\nexport default () => <GroupsScreen />",
    },
    {
      want: 'partial',
      text: "import { CategoryHeader } from '@ihui/rn-app/pilot'\nexport default () => <CategoryHeader />",
    },
    { want: 'none', text: "import { Foo } from '@ihui/ui'\nexport default () => <Foo />" },
  ]
  const got = cases.map((c) => {
    const v = sharedImportsOf(c.text)
    return v.screen ? 'screen' : v.partial ? 'partial' : 'none'
  })
  const bad = cases.filter((c, i) => got[i] !== c.want).map((c, i) => `${c.want}→${got[i]}`)
  const exact = new Map([['a', { web: 'a', status: 'aligned' }]])
  const prefixes = [{ web: 'a/**', status: 'excluded' }]
  const ruleChecks = [
    [resolveMapRule('a', exact, prefixes)?.row?.status, 'aligned'], // 逐条优先
    [resolveMapRule('a/b', exact, prefixes)?.row?.status, 'excluded'],
    [resolveMapRule('b', exact, prefixes), null],
    [resolveLocal('apps/web/app/x/page.tsx', './Y', files), null],
    [resolveLocal('apps/web/app/x/page.tsx', '@/components/X', files), 'apps/web/src/components/X.tsx'],
  ]
  const ruleBad = ruleChecks.filter(([a, b]) => a !== b).length
  if (bad.length || ruleBad) {
    console.error(`❌ 自检失败:分类 ${bad.join('; ') || 'ok'} / 规则 ${ruleBad} 条不符`)
    return 1
  }
  console.info('✅ 自检通过:shared/partial/none 三态 + 逐条优先/段级/本地解析 全部可构造')
  return 0
}

function renderPagesMd(p) {
  const L = []
  const sec = (title, list, fmt) => {
    L.push(`### ${title} (${list.length})`, '')
    if (!list.length) {
      L.push('(空)', '')
      return
    }
    for (const r of list) L.push(fmt(r))
    L.push('')
  }
  L.push(
    '# 跨端生产线总账 · 逐页清单(机器生成)',
    '',
    '> 由 `scripts/cross-end-pipeline-inventory.mjs --pages-md=<路径>` 生成,与 `--json` 同一份判定数据。',
    `> 取材面 = ${p.face}(本报告默认 HEAD blob);重跑会整文件覆盖本文件。`,
    '> 说明与判据见 [主报告](./cross-end-pipeline-inventory-2026-11-08.md)。',
    '',
    '## 口径速记',
    '',
    '- 已共享 = web 页面族 import `@ihui/rn-app`/`packages/app/src` 且渲染 `*Screen`;仅 import 组件记为局部共享。',
    '- 端侧各自 = 登记表 aligned,web 未接共享屏;按 RN 侧真实形态分三档(已接共享屏 / 共享屏在但 RN 未接 / 两端都自实现)。',
    '- 只存在一端 = web 侧 gap/unmapped(未判定) + RN 侧未被 aligned 行引用(启发式消歧)。',
    '- 无法共享 = 登记表 excluded(平台特有) + portal(WebView 门户承载)。',
    '- 行数 = 页面族有效内容行(不含空行/整行注释),仅用于候选排序,不是精确 LOC。',
    '',
  )
  sec('已共享·整屏', p.buckets.sharedScreen, (r) => `- \`${r.route}\` ← ${r.symbols.filter((s) => /Screen$/.test(s)).join(', ')}  (${r.rel})`)
  sec('已共享·仅局部组件', p.buckets.sharedPartial, (r) => `- \`${r.route}\` ← ${r.symbols.join(', ')}  (${r.rel})`)
  sec('端侧各自·RN 已接共享屏', p.buckets.parallelSharedBacked, (r) => `- \`${r.route}\` — web ${r.loc} 行 / rn \`${r.rn}\`  (${r.layer})`)
  sec('端侧各自·共享屏在但 RN 未接', p.buckets.parallelSharedOrphan, (r) => `- \`${r.route}\` — web ${r.loc} 行 / rn \`${r.rn}\``)
  sec('端侧各自·两端都自实现', p.buckets.parallelBothNative, (r) => `- \`${r.route}\` — web ${r.loc} 行 / rn \`${r.rn}\``)
  sec('只存在一端·web 未判定', p.buckets.webOnlyUndetermined, (r) => `- \`${r.route}\` — ${r.why} / rn \`${r.rn || '-'}\``)
  sec('只存在一端·RN 独有(启发式)', p.buckets.rnOnly, (r) => `- \`${r.name}\` — ${r.loc} 行 / \`${r.rel}\``)
  sec('无法共享·WebView 门户承载', p.buckets.portalCarried, (r) => `- \`${r.route}\``)
  sec('无法共享·平台特有(excluded)', p.buckets.platformExcluded, (r) => `- \`${r.route}\`［${r.ruledBy || '逐条'}］`)
  sec('内部工具页', p.buckets.toolPages, (r) => `- \`${r.route}\``)
  return L.join('\n')
}

function run() {
  const webRoutes = parity.collectWebRoutes(FACE)
  const mapRows = parity.loadMap(FACE)
  if (webRoutes.length === 0 || mapRows.length === 0) {
    console.error(
      `❌ 未判定:web 路由 ${webRoutes.length} / 登记表 ${mapRows.length}(取不到判定面不记绿不冒红,§0.3)`,
    )
    return 2
  }
  const badRows = mapRows.filter((r) => r.bad)
  const exactMap = new Map()
  const prefixRows = []
  for (const row of mapRows) {
    if (row.bad || !row.web) continue
    if (row.web.endsWith('/**')) {
      if (row.status === 'excluded' && row.reason) prefixRows.push(row)
    } else if (!exactMap.has(row.web)) exactMap.set(row.web, row)
  }
  prefixRows.sort((a, b) => b.web.length - a.web.length)

  const webFiles = cov.faceList(FACE, WEB_DIR)
  const webFileSet = new Set(webFiles)
  const rnFiles = cov.faceList(FACE, RN_DIR)
  const rnFileSet = new Set(rnFiles)
  const sharedFiles = cov.faceList(FACE, SHARED_DIR)
  const sharedFileSet = new Set(sharedFiles)
  const allKnown = new Set([...webFileSet, ...rnFileSet, ...sharedFileSet])
  const testFiles = [
    ...cov.faceList(FACE, 'apps/mobile-rn/tests'),
    ...cov.faceList(FACE, 'apps/miniapp-taro/tests'),
    ...sharedFiles.filter((f) => /\/__tests__\/|\/tests\/|\.test\.[jt]sx?$/.test(f)),
  ]

  /* ---------- 阶段 1:page.tsx + 同目录伴生(Next 的 page + PageClient 形态) ---------- */
  const siblingsOf = (rel) => {
    const dir = posixDir(rel)
    return webFiles
      .filter((f) => posixDir(f) === dir && /\.(t|j)sx?$/.test(f) && !/page\.(tsx|jsx|ts|js)$/.test(f))
      .filter((f) => !/\.test\.|\/__tests__\//.test(f))
      .slice(0, 8)
  }
  const startFiles = []
  for (const r of webRoutes) startFiles.push(r.rel, ...siblingsOf(r.rel))
  const texts = readBatch(startFiles)

  /* ---------- 阶段 2:沿本地 import 展开两层 ---------- */
  const familyOf = (rel, depth = 2, maxFiles = 20) => {
    const seen = new Set([rel])
    const parts = []
    let frontier = [rel]
    for (let d = 0; d < depth; d++) {
      const next = []
      for (const f of frontier) {
        const t = texts.get(f)
        if (typeof t !== 'string') continue
        parts.push(t)
        if (d === depth - 1) continue
        for (const m of t.matchAll(LOCAL_IMPORT_RE)) {
          if (seen.size >= maxFiles) break
          const target = resolveLocal(f, m[1], webFileSet)
          if (target && !seen.has(target)) {
            seen.add(target)
            next.push(target)
          }
        }
      }
      if (next.length === 0) break
      const miss = next.filter((f) => !texts.has(f))
      if (miss.length) {
        const got = readBatch(miss)
        for (const [k, v] of got) texts.set(k, v)
      }
      frontier = next
    }
    return { text: parts.join('\n'), files: [...seen] }
  }

  /* ---------- 阶段 3:逐页判定 ---------- */
  const sharedScreens = cov.collectShared(FACE)
  const rnScreens = cov.collectRn(FACE)

  const rows = []
  const sharedBasenames = new Set(
    sharedFiles.map((f) => f.split('/').pop()).filter((b) => /Screen\.tsx$/.test(b)),
  )
  const alignedRnPaths = new Set()
  for (const row of mapRows) if (row.status === 'aligned' && row.rn) alignedRnPaths.add(row.rn)
  const rnTexts = readBatch([...alignedRnPaths].filter((p) => rnFileSet.has(p)))
  for (const r of webRoutes) {
    const fam = familyOf(r.rel)
    const shared = sharedImportsOf(fam.text)
    const rule = resolveMapRule(r.route, exactMap, prefixRows)
    const status = rule?.row?.status ?? 'unmapped'
    let layer = null
    if (status === 'aligned' || status === 'pending') {
      const rnPath = rule.row.rn ?? null
      if (rnPath && sharedFileSet.has(rnPath)) layer = 'shared'
      else if (rnPath && rnFileSet.has(rnPath)) {
        // 登记表记的是端内壳文件,但壳可能已经委托共享屏 —— 必须读正文,不能只看路径。
        const rnShared = sharedImportsOf(rnTexts.get(rnPath) ?? '')
        if (rnShared.screen) layer = 'shared-adapter'
        else if (sharedBasenames.has(rnPath.split('/').pop())) layer = 'shared-orphan'
        else layer = 'rn-native'
      } else layer = 'missing' // 登记腐烂:aligned 指向不存在的屏,按未判定记账
    }
    rows.push({
      route: r.route,
      rel: r.rel,
      shared: shared.screen ? 'screen' : shared.partial ? 'partial' : 'none',
      symbols: shared.symbols,
      status,
      ruledBy: rule ? rule.row.web : null,
      rn: rule?.row?.rn ?? null,
      layer,
      pending: status === 'pending',
      loc: probe.effectiveLines(fam.text),
      familyText: fam.text,
      familyFiles: fam.files.length,
    })
  }

  /* ---------- 四类归并(互斥;找不到归属一律进「未判定」,不猜) ---------- */
  const buckets = {
    sharedScreen: [],
    sharedPartial: [],
    parallelSharedBacked: [],
    parallelSharedOrphan: [],
    parallelBothNative: [],
    webOnlyConfirmed: [],
    webOnlyUndetermined: [],
    rnOnly: [],
    platformExcluded: [],
    portalCarried: [],
    toolPages: [],
  }
  let mapRot = 0
  for (const r of rows) {
    if (NON_PRODUCT_ROUTES.has(r.route)) buckets.toolPages.push(r)
    else if (r.shared === 'screen') buckets.sharedScreen.push(r)
    else if (r.shared === 'partial') buckets.sharedPartial.push(r)
    else if (r.status === 'excluded') buckets.platformExcluded.push(r)
    else if (r.status === 'portal') buckets.portalCarried.push(r)
    else if (r.status === 'aligned' && (r.layer === 'shared' || r.layer === 'shared-adapter'))
      buckets.parallelSharedBacked.push(r)
    else if (r.status === 'aligned' && r.layer === 'shared-orphan') buckets.parallelSharedOrphan.push(r)
    else if (r.status === 'aligned' && r.layer === 'rn-native') buckets.parallelBothNative.push(r)
    else if (r.status === 'aligned' && r.layer === 'missing') {
      mapRot++
      buckets.webOnlyUndetermined.push({ ...r, why: 'aligned 指向的 RN 屏不存在(登记腐烂)' })
    } else if (r.status === 'gap') buckets.webOnlyConfirmed.push(r)
    else if (r.status === 'pending') buckets.webOnlyUndetermined.push({ ...r, why: 'pending 未验证' })
    else buckets.webOnlyUndetermined.push({ ...r, why: '登记表未登记(没人判过)' })
  }

  // 无法共享的放宽理由分组(按命中的段级/逐条规则键,口径可复算)
  const excludedGroups = new Map()
  for (const r of buckets.platformExcluded) {
    const key = r.ruledBy || '(逐条)'
    excludedGroups.set(key, (excludedGroups.get(key) ?? 0) + 1)
  }

  /* ---------- RN 侧只存在于一端(启发式消歧) ---------- */
  const alignedSymbols = new Set(
    [...alignedRnPaths].map((p) => p.split('/').pop().replace(/\.tsx$/, '')),
  )
  for (const rn of rnScreens) {
    const name = rn.name
    const file = rn.file
    if (alignedRnPaths.has(file)) continue
    if (alignedSymbols.has(name)) continue // 登记表用同名共享屏做承载,RN 壳文件不必逐条在册
    const rendered = [...(rn.text ?? '').matchAll(/<(\w+Screen)[\s/>]/g)].map((m) => m[1])
    if (rendered.some((s) => alignedSymbols.has(s))) continue
    buckets.rnOnly.push({ name, rel: file, loc: (rn.text ?? '').split('\n').length })
  }
  buckets.rnOnly.sort((a, b) => a.name.localeCompare(b.name))

  /* ---------- 抽屏候选排序 ---------- */
  const nameTokens = (s) => new Set(String(s).toLowerCase().split(/[-_.]/).filter(Boolean))
  const touchesOtherLine = (r) => {
    for (const t of nameTokens(r.route)) if (OTHER_LINE_TOKENS.has(t)) return true
    for (const t of nameTokens((r.rn ?? '').split('/').pop() ?? '')) if (OTHER_LINE_TOKENS.has(t)) return true
    return false
  }
  const forkCount = (r) => {
    const text = `${r.familyText ?? ''}\n${r.rn && allKnown.has(r.rn) ? rnTextOf(r.rn) : ''}`
    return (text.match(/Platform\.OS|window\.|navigator\.|Taro\./g) ?? []).length
  }
  const rnTextCache = new Map()
  const rnTextOf = (rel) => {
    if (!rnTextCache.has(rel)) rnTextCache.set(rel, readBatch([rel]).get(rel) ?? '')
    return rnTextCache.get(rel)
  }
  const testHit = (r) => {
    const base = (r.rn ?? '').split('/').pop()?.replace(/\.tsx$/, '') ?? ''
    return testFiles.some((f) => (base && f.toLowerCase().includes(base.toLowerCase())) ||
      f.toLowerCase().includes(r.route.split('/').pop().toLowerCase()))
  }
  const mkCandidate = (r, kind) => {
    const rnLoc = r.rn && allKnown.has(r.rn) ? rnTextOf(r.rn).split('\n').length : 0
    const forks = forkCount(r)
    const saving = r.loc + (kind === 'extract' ? rnLoc : 0)
    const score = saving - forks * 20 + (testHit(r) ? 40 : 0)
    return { kind, route: r.route, shared: r.rn ?? null, layer: r.layer, locWeb: r.loc, locRn: rnLoc, forks, test: testHit(r), score, saving }
  }
  const candidates = []
  const notOurs = (r) => OTHER_LINE_ROUTES.has(r.route) || touchesOtherLine(r)
  for (const r of buckets.parallelSharedBacked) if (!notOurs(r)) candidates.push(mkCandidate(r, 'adopt'))
  for (const r of buckets.parallelSharedOrphan) if (!notOurs(r)) candidates.push(mkCandidate(r, 'adopt-orphan'))
  for (const r of buckets.parallelBothNative) if (!notOurs(r)) candidates.push(mkCandidate(r, 'extract'))
  candidates.sort((a, b) => b.score - a.score)

  const registry = (() => {
    try {
      const text = readBatch([REGISTRY_PATH]).get(REGISTRY_PATH)
      if (typeof text !== 'string') return null
      const parsed = JSON.parse(text)
      return Array.isArray(parsed.entries) ? parsed.entries.length : null
    } catch {
      return null
    }
  })()

  const count = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length]))
  const slim = (r) => {
    const rest = { ...r }
    delete rest.familyText
    return rest
  }
  const payload = {
    face: FACE,
    webRoutes: webRoutes.length,
    mapRows: mapRows.length,
    mapBadRows: badRows.length,
    mapRot,
    sharedScreens: sharedScreens.length,
    rnScreens: rnScreens.length,
    registryTriples: registry,
    counts: count,
    excludedGroups: [...excludedGroups.entries()].sort((a, b) => b[1] - a[1]),
    buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.map(slim)])),
    candidates,
  }

  if (pagesMdMode) {
    const out = pagesMdMode.slice('--pages-md='.length)
    if (!out) {
      console.error('❌ --pages-md= 需要输出路径')
      return 2
    }
    writeFileSync(out, renderPagesMd(payload))
    console.info(`✅ 逐页清单已写入 ${out}`)
    return 0
  }

  if (jsonMode) {
    console.info(JSON.stringify(payload, null, 2))
    return 0
  }

  const log = (...a) => console.info(...a)
  log(`取材面        : ${FACE_LABEL}`)
  log(`web 路由      : ${webRoutes.length}(登记表 ${mapRows.length} 行,坏行 ${badRows.length})`)
  log(`共享屏        : ${sharedScreens.length};RN 端内屏 ${rnScreens.length};三端登记三元组 ${registry ?? '未判定'}`)
  log('')
  log('四类总账(互斥):')
  log(`  已共享         : ${count.sharedScreen} 整屏 + ${count.sharedPartial} 仅局部组件 = ${count.sharedScreen + count.sharedPartial}`)
  log(`  端侧各自实现   : ${count.parallelSharedBacked + count.parallelSharedOrphan + count.parallelBothNative}  (RN 已接共享屏 ${count.parallelSharedBacked} / 共享屏在但 RN 未接 ${count.parallelSharedOrphan} / 两端都自实现 ${count.parallelBothNative})`)
  log(`  只存在于一端   : web 确缺 ${count.webOnlyConfirmed} + web 未判定 ${count.webOnlyUndetermined} + RN 独有(启发式)${count.rnOnly}`)
  log(`  无法共享       : ${count.platformExcluded} 条 excluded + ${count.portalCarried} 条 WebView 门户承载`)
  log(`  内部工具页     : ${count.toolPages}(不计入四类分母)`)
  if (mapRot) log(`⚠ 登记腐烂 ${mapRot} 条(aligned 指向不存在的屏)已计入「web 未判定」,不算已共享`)
  log('')
  log('excluded 分组(按命中的豁免键):')
  for (const [k, v] of payload.excludedGroups.slice(0, 12)) log(`  ${String(v).padStart(4)}  ${k}`)
  log('')

  const printRows = (title, list, n = 8, fmt = (r) => r.route) => {
    log(`── ${title}(${list.length}) ──`)
    for (const r of list.slice(0, listMode ? list.length : n)) log(`  ${fmt(r)}`)
    if (!listMode && list.length > n) log(`  … 另 ${list.length - n} 条(用 --list 看全量)`)
    log('')
  }
  printRows('已共享·整屏', buckets.sharedScreen, 12, (r) => `${r.route}  <- ${r.symbols.filter((s) => /Screen$/.test(s)).join(',')}`)
  printRows('已共享·仅局部组件', buckets.sharedPartial, 12, (r) => `${r.route}  <- ${r.symbols.join(',')}`)
  printRows('端侧各自·RN 已接共享屏', buckets.parallelSharedBacked, 12, (r) => `${r.route}  web ${r.loc} 行 / rn ${r.rn}`)
  printRows('端侧各自·共享屏在但 RN 未接', buckets.parallelSharedOrphan, 12, (r) => `${r.route}  web ${r.loc} 行 / rn ${r.rn}`)
  printRows('端侧各自·两端都自实现', buckets.parallelBothNative, 12, (r) => `${r.route}  web ${r.loc} 行 / rn ${r.rn}`)
  printRows('只存在于一端·web 确缺(gap)', buckets.webOnlyConfirmed, 12)
  printRows('只存在于一端·RN 独有(启发式)', buckets.rnOnly, 12, (r) => `${r.name}  ${r.rel}`)

  if (candidatesMode || listMode) {
    log(`── 抽屏候选排序(${candidates.length};排除别条产线屏:${[...OTHER_LINE_TOKENS].join('/')}) ──`)
    log('  kind=adopt: web 接现成共享屏;kind=extract: 抽新共享屏(web+RN 同时减行)')
    log('  score = 可减行数 - 平台分叉×20 + 既有测试×40')
    for (const c of candidates.slice(0, listMode ? candidates.length : 20)) {
      log(`  ${String(c.score).padStart(6)}  ${c.kind.padEnd(7)} ${c.route}  web=${c.locWeb} rn=${c.locRn} forks=${c.forks} test=${c.test ? 'Y' : 'N'}`)
    }
    log('')
  }
  log('复跑:node scripts/cross-end-pipeline-inventory.mjs [--list|--candidates|--json|--worktree]')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) process.exit(selfTestMode ? selfTest() : run())

export const __test__ = { sharedImportsOf, resolveMapRule, resolveLocal, importedNames, renderPagesMd }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

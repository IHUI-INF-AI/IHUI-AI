#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-docs-public-health.mjs — /docs 公开面健康对账尺(**只读不改盘**,判声明↔路由现实;
 * 已进提交链,见下文「接线现实」)
 *
 * 立因(主席 2026-11-01 实测,全仓无人看守):
 *   ① docs 各页 metadata.alternates.languages 声明了 /zh-cn、/zh-tw、/ko、/ja 语言版,
 *      实测**全部 404**;hreflang 把爬虫指向死链,没有任何门在判这件事。
 *   ② app/sitemap.ts 收录的 /docs* 路径同样无人核对路由文件是否存在(收录即承诺可达)。
 *   ③ docs 页面里存在 emoji 当图标(通用门 102 判全仓形态,docs 这一片专项无人点名)。
 *
 * 判据(每条独立三态 ok / violation / unjudged,**绝不并桶、绝不拿 0 冒充"没有"** §0.3):
 *   D1 从 `apps/web/app/(main)/docs/**` 各页源码解析 `alternates.languages` 声明的路径,
 *      按 App Router 目录/文件规则(路由组 `(x)` 透明、动态段 `[x]`/`[...x]` 通配、
 *      终点须有 page.[jt]sx? 或 route.[jt]sx?)核对**路由文件是否真实存在**,不联网。
 *      段名精确匹配(Next 的 URL 段大小写敏感),但大小写近似目录会以 near-miss 点名(取证用)。
 *      声明了不存在的 ⇒ violation 并逐条点名(文件:行 + locale + 声明路径 + 断在哪一段)。
 *      另出「语言族分档」两档,不混为一谈:全灭簇 = 该 locale 的声明条条指向死路由;
 *      部分死簇 = 同一 locale 有死有活(en 就是这一档 —— /en/docs 活着、17 个 /en/docs/* 死了)。
 *   D2 从 `apps/web/app/sitemap.ts` 解析 PAGES 里全部 `/docs*` 收录路径,同法核对路由存在性。
 *   D3 docs 页面源码出现 `icon:` 字段且值为含 emoji 的字符串字面量(\\p{Extended_Pictographic})
 *      ⇒ 点名;组件标识符(icon: BookOpen)不算(成对夹具钉住这条,防判据过宽)。
 *   输入取不到 ⇒ 该维 unjudged 并点名原因:D1 = docs 目录无候选文件 / 全部候选都解析不到
 *   languages 块;D2 = sitemap.ts 读不到或解析不出任何 /docs* 条目;路由面列不出来 ⇒ 三维同判
 *   未判定(判据依赖的输入没了,不回落另一个面 §0.4)。
 *
 * 取材面纪律(§0.4):全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;
 *   清单与内容**同面同轮**;两面旗同给 ⇒ exit 2。取不到不回落另一个面。
 * 棘轮(§0.5):锚点 = 该文件 HEAD 面自身的违规数,存量只报数;只有 `--staged` 档存在"本次改动"
 *   可言,head/worktree 档打印说明行而非静默跳过(§0.3)。
 *
 * 接线现实(2026-11-03 现读对账,头注与 guardian-runner.mjs 注册条目对齐):本门**已进提交链**
 *   —— runner id '285',mode=blocking,args=['--staged'],stagedTriggers=['apps/web/app/'],
 *   应急放行 HUSKY_SKIP_DOCS_PUBLIC_HEALTH=1。逐维定性(§12e 升 blocking 前置 = 存量归零):
 *   D1/D2/D3 的输入全是仓内静态文本(languages 声明、sitemap 条目、icon 字面量)↔ 被审面路由
 *   清单,**不需要任何外部态**(不碰真浏览器/公网/DB),本次提交内容结构上就能满足 ⇒ 三维全部
 *   合法进提交链;2026-11-03 实测三维存量均为 0(D1 另带差值棘轮兜底)。头注旧稿写于 2026-11-01
 *   存量未清时,当时判断成立,存量清零并完成接线后该段失真,已按现实改写(§0.9)。
 * 能力边界(防夸大):本门只判 hreflang 可达性 / sitemap 收录 / docs 页 icon 禁 emoji 三维,
 *   与「格式支持/依赖/渲染链路」**零相关**,不得当作文档渲染健康的证据引用。
 *
 * 用法:
 *   node scripts/check-docs-public-health.mjs              # 全量档:判 HEAD blob
 *   node scripts/check-docs-public-health.mjs --staged     # 判索引 blob(带差值棘轮)
 *   node scripts/check-docs-public-health.mjs --worktree   # 仅人工排查
 *   node scripts/check-docs-public-health.mjs --json       # 供调度器读结论(不手抄文案)
 *   node scripts/check-docs-public-health.mjs --self-test  # 内联夹具(含反向牙)
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, gitRaw } from './lib/face-reader.mjs'
import { scanLiterals } from './lib/code-mask.mjs'
import { headAnchors, overBaseline, readSources, sourceCandidates } from './lib/face-scan.mjs'

// ROOT 由脚本自身位置推导(§15:共享工作树的 cwd 不可靠)
export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_REL = 'apps/web/app'
const DOCS_REL = 'apps/web/app/(main)/docs'
const SITEMAP_REL = 'apps/web/app/sitemap.ts'
const EXIT = Object.freeze({ clean: 0, violation: 1, unjudged: 2 })
const PAGE_RE = /^page\.[jt]sx?$/
const ROUTE_FILE_RE = /^route\.[jt]sx?$/
const WALK_SKIP = new Set(['node_modules', '.next', '.git'])

/** 判据本体:纯函数、零 IO,镜像测试直接 import 同一份(§22c 禁止在测试里复算)。 */

/** 语言族/声明解析:`languages: { 'zh-CN': '/zh-cn/docs', en: '/en/docs' }`(逐行扫描,行号即证据) */
export function parseLanguageBlocks(text) {
  const declared = []
  const unparseable = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/(^|[\s{,])languages:\s*\{/.test(lines[i])) continue
    let depth = (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length
    for (let j = i + 1; j < lines.length && depth > 0; j++) {
      const line = lines[j]
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
      const trimmed = line.trim()
      if (trimmed.length === 0 || trimmed.startsWith('//')) continue
      const pair =
        /^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:\s*(['"`])([^'"`]*)\4\s*,?\s*$/.exec(
          line,
        )
      if (!pair) {
        // 块的收尾行(`}` / `},` / `])` 等)不是条目,别把它算成"解析不出"
        if (!/^[}\])]*[,;]?$/.test(trimmed))
          unparseable.push({ line: j + 1, reason: `languages 条目形态不认识:${trimmed}` })
        continue
      }
      const locale = pair[1] ?? pair[2] ?? pair[3]
      const value = pair[5]
      if (value.includes('${')) {
        unparseable.push({ line: j + 1, locale, reason: '声明值是模板字符串,静态判不了可达性' })
      } else if (!value.startsWith('/')) {
        unparseable.push({ line: j + 1, locale, reason: `声明值不是站内路径:${value}` })
      } else {
        declared.push({ locale, path: value, line: j + 1 })
      }
      if (depth <= 0) break
    }
  }
  return { declared, unparseable }
}

/** sitemap PAGES 条目:`{ path: '/docs/api', ... }` */
export function parseSitemapDocPaths(text) {
  const paths = []
  const unparseable = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*\{\s*path:\s*(['"`])([^'"`]*)\1/.exec(lines[i])
    if (!m) continue
    const value = m[2]
    if (value.includes('${')) {
      unparseable.push({ line: i + 1, reason: 'path 是模板字符串,静态判不了收录集' })
      continue
    }
    if (value.startsWith('/docs') && value !== '/docs*') paths.push({ path: value, line: i + 1 })
  }
  return { paths, unparseable }
}

/**
 * D3:docs 源码里 icon: '<含 emoji>'
 * 文档页常把「别的项目的 SDK 用法」整段塞进 <pre><code>{`…`}</code></pre> 展示给读者;
 * 那段里的 icon: 是被展示的字面量,不是本页配置 ⇒ 落在模板字符串跨度内的命中一律不判。
 * 判据走 code-mask 的字面量跨度(单源 scripts/lib/code-mask.mjs),所以
 * `{ icon: '🔒' }`(键不在行首)也命中,而 `icon: BookOpen,`(组件标识符)不命中。
 */
export function parseEmojiIcons(text) {
  const hits = []
  const { strings } = scanLiterals(text)
  const templates = strings.filter((s) => s.isTemplate)
  const insideTemplate = (idx) => templates.some((t) => idx > t.start && idx < t.end)
  for (const s of strings) {
    if (s.isTemplate || insideTemplate(s.start)) continue
    const before = text.slice(Math.max(0, s.start - 24), s.start)
    if (!/(?:^|[{,[]|\s)(?:'icon'|"icon"|\bicon\b)\s*:\s*$/.test(before)) continue
    if (!/\p{Extended_Pictographic}/u.test(s.body)) continue
    hits.push({ line: text.slice(0, s.start).split('\n').length, value: s.body })
  }
  return hits
}

export function isRouteGroup(name) {
  return /^\(.+\)$/.test(name)
}
export function isCatchAll(name) {
  return /^\[\.{3}.+\]$/.test(name) || /^\[\[\.{3}.+\]\]$/.test(name)
}
export function isDynamic(name) {
  return /^\[.+\]$/.test(name)
}

/** 由「被审面的 app 目录文件清单」建 App Router 目录树(路由组透明、动态段通配)。 */
export function buildRouteIndex(filePaths, appRoot = APP_REL) {
  const nodes = new Map()
  const ensure = (dir) => {
    if (nodes.has(dir)) return nodes.get(dir)
    const node = {
      name: dir === appRoot ? '' : path.posix.basename(dir),
      dir,
      childDirs: [],
      files: [],
    }
    nodes.set(dir, node)
    if (dir !== appRoot) {
      const parent = path.posix.dirname(dir)
      if (parent === appRoot || parent.startsWith(appRoot + '/'))
        ensure(parent).childDirs.push(node)
    }
    return node
  }
  const root = ensure(appRoot)
  for (const f of filePaths) {
    if (typeof f !== 'string' || !f.startsWith(`${appRoot}/`)) continue
    ensure(path.posix.dirname(f)).files.push(path.posix.basename(f))
  }
  return { appRoot, root, size: nodes.size }
}

export function effectiveChildren(node) {
  const out = []
  const stack = [...node.childDirs]
  while (stack.length > 0) {
    const d = stack.pop()
    if (isRouteGroup(d.name)) stack.push(...d.childDirs)
    else out.push(d)
  }
  return out
}

export function serveableBy(node) {
  return node.files.some((f) => PAGE_RE.test(f) || ROUTE_FILE_RE.test(f))
}

/**
 * 路由可达性:返回 { reachable, brokenAt, nearMiss }
 * brokenAt = 第一个匹配不上的段;nearMiss = 该段只有大小写近似目录(Next 段名大小写敏感)。
 */
export function routeExists(index, urlPath) {
  const segs = String(urlPath).split('/').filter(Boolean)
  let level = [index.root]
  const walked = []
  for (const seg of segs) {
    const next = []
    let nearMiss = null
    for (const node of level) {
      for (const child of effectiveChildren(node)) {
        if (child.name === seg) next.push(child)
        else if (isCatchAll(child.name)) next.push(child)
        else if (isDynamic(child.name)) next.push(child)
        else if (child.name.toLowerCase() === seg.toLowerCase()) nearMiss = child.name
      }
    }
    if (next.length === 0) return { reachable: false, brokenAt: seg, nearMiss }
    // catch-all 命中即吃剩余段
    if (next.some((n) => isCatchAll(n.name)) && next.some((n) => serveableBy(n))) {
      return { reachable: true, brokenAt: null, nearMiss: null }
    }
    level = next
    walked.push(seg)
  }
  return {
    reachable: level.some((n) => serveableBy(n)),
    brokenAt: level.length === 0 ? (walked.at(-1) ?? null) : null,
    nearMiss: null,
    servedBy: level.find((n) => serveableBy(n))?.dir ?? null,
  }
}

export function judgeDocsLanguages(docsPages, index) {
  const dead = []
  const alive = []
  let declaredTotal = 0
  const perLocaleDeclared = new Map()
  const perLocaleDead = new Map()
  const filesWithDeclaration = []
  const unparseable = []
  for (const { rel, text } of docsPages) {
    const { declared, unparseable: bad } = parseLanguageBlocks(text)
    for (const b of bad) unparseable.push({ file: rel, ...b })
    if (declared.length === 0) continue
    filesWithDeclaration.push(rel)
    for (const d of declared) {
      declaredTotal++
      perLocaleDeclared.set(d.locale, (perLocaleDeclared.get(d.locale) ?? 0) + 1)
      const r = routeExists(index, d.path)
      if (r.reachable) alive.push({ file: rel, line: d.line, locale: d.locale, path: d.path })
      else {
        perLocaleDead.set(d.locale, (perLocaleDead.get(d.locale) ?? 0) + 1)
        dead.push({
          file: rel,
          line: d.line,
          locale: d.locale,
          path: d.path,
          brokenAt: r.brokenAt,
          nearMiss: r.nearMiss,
        })
      }
    }
  }
  return {
    dead,
    alive,
    declaredTotal,
    filesWithDeclaration,
    unparseable,
    perLocaleDeclared,
    perLocaleDead,
  }
}

/**
 * 语言族分档:「全灭」= 该 locale 的声明条条指向死路由;「部分死」= 有死有活。
 * 两档必须分开报 —— 把 en(17/18 死)混进"全灭簇"就是话术失真(§10)。
 */
export function localeBuckets(j) {
  const deadBy = localeFamilies(j.dead ?? []) // locale → 死链条数(与点名同一份读数)
  const allDead = []
  const partial = []
  // 调用方没交 perLocaleDeclared(手写夹具)时不猜覆盖率,只按死链读数分档
  for (const [locale, declared] of j.perLocaleDeclared ?? new Map()) {
    const dead = deadBy.get(locale) ?? 0
    if (dead === 0) continue
    if (dead === declared) allDead.push({ locale, dead, declared })
    else partial.push({ locale, dead, declared })
  }
  const by = (a, b) => b.dead - a.dead || a.locale.localeCompare(b.locale)
  return { allDead: allDead.sort(by), partial: partial.sort(by) }
}

export function localeFamilies(dead) {
  const by = new Map()
  for (const d of dead) by.set(d.locale, (by.get(d.locale) ?? 0) + 1)
  return by
}

export function judgeSitemap(sitemapText, index) {
  const { paths, unparseable } = parseSitemapDocPaths(sitemapText)
  const dead = []
  const alive = []
  for (const p of paths) {
    const r = routeExists(index, p.path)
    if (r.reachable) alive.push(p)
    else dead.push({ ...p, brokenAt: r.brokenAt, nearMiss: r.nearMiss })
  }
  return { entries: paths.length, dead, alive, unparseable }
}

export function judgeEmojiIcons(docsPages) {
  const hits = []
  for (const { rel, text } of docsPages) {
    for (const h of parseEmojiIcons(text)) hits.push({ file: rel, ...h })
  }
  return hits
}

/** 三维汇成一份结论;每维独立三态,绝不并桶(§0.3)。 */
export function assemble({ d1, d2, d3, newByFile = null }) {
  // 语言族分档:"全灭簇" = 该 locale 声明的每条路径都指向死路由;
  // "部分死簇" = 同一 locale 有死有活(如 en:/en/docs 活着、17 个 /en/docs/* 子页死了)。
  // 把两档混在一行就是话术失真(§10 交付一致性)。
  const buckets = localeBuckets(d1)
  const D1 = {
    state: d1.declaredTotal === 0 ? 'unjudged' : d1.dead.length > 0 ? 'violation' : 'ok',
    reason:
      d1.declaredTotal === 0
        ? 'docs 各页一个 languages 声明都解析不到 ⇒ D1 未判定(不冒红也不记绿)'
        : d1.dead.length > 0
          ? `${d1.dead.length}/${d1.declaredTotal} 条 hreflang 声明指向不存在的路由`
          : `${d1.declaredTotal} 条 hreflang 声明全部有路由文件`,
    declaredTotal: d1.declaredTotal,
    filesWithDeclaration: d1.filesWithDeclaration.length,
    dead: d1.dead,
    alive: d1.alive,
    aliveCount: d1.alive.length,
    unparseable: d1.unparseable,
    deadLocaleFamilies: buckets.allDead,
    partialLocaleFamilies: buckets.partial,
    newCount: newByFile ? [...newByFile.values()].reduce((a, b) => a + b, 0) : null,
  }
  const D2 = {
    state: d2.entries === 0 ? 'unjudged' : d2.dead.length > 0 ? 'violation' : 'ok',
    reason:
      d2.entries === 0
        ? `sitemap 里解析不出任何 /docs* 收录条目 ⇒ D2 未判定`
        : d2.dead.length > 0
          ? `${d2.dead.length}/${d2.entries} 条 /docs* 收录指向不存在的路由`
          : `${d2.entries} 条 /docs* 收录全部有路由文件`,
    entries: d2.entries,
    dead: d2.dead,
    unparseable: d2.unparseable,
  }
  const D3 = {
    state: d3.length > 0 ? 'violation' : 'ok',
    reason:
      d3.length > 0 ? `${d3.length} 处 docs icon 字段用 emoji` : 'docs 源码无 emoji icon 字段',
    hits: d3,
    counted: true,
  }
  const dims = { D1, D2, D3 }
  const anyUnjudged = Object.values(dims).some((d) => d.state === 'unjudged')
  const anyViolation = Object.values(dims).some((d) => d.state === 'violation')
  return {
    dims,
    exitCode: anyUnjudged ? EXIT.unjudged : anyViolation ? EXIT.violation : EXIT.clean,
    overall: anyUnjudged ? 'unjudged' : anyViolation ? 'violation' : 'ok',
  }
}

/** 面旗解析:两面旗同给 ⇒ 未判定(§0.4)。 */
export function resolveFace(argv) {
  const flags = ['--staged', '--worktree'].filter((f) => argv.includes(f))
  if (flags.length > 1) {
    return {
      face: null,
      error: `--staged 与 --worktree 不得同给(两面旗 ⇒ 取材面无定义):${flags.join(' ')}`,
    }
  }
  if (flags.length === 1)
    return { face: flags[0] === '--staged' ? 'staged' : 'worktree', error: null }
  return { face: 'head', error: null }
}

export function listAppTreeFromFs(root, appAbs) {
  const out = []
  const stack = [appAbs]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (WALK_SKIP.has(e.name)) continue
      const abs = path.join(dir, e.name)
      const rel = path.relative(root, abs).split(path.sep).join('/')
      if (e.isDirectory()) stack.push(abs)
      else out.push(rel)
    }
  }
  return out
}

/** 被审面的 app 目录清单:与内容同面同轮,取不到 ⇒ Undetermined(不回落另一个面)。 */
export function listAppTree(face, root) {
  if (face === 'worktree') {
    const files = listAppTreeFromFs(root, path.join(root, ...APP_REL.split('/')))
    if (files.length === 0) throw new Undetermined(`工作树读不到 ${APP_REL} ⇒ 路由面为空,不判绿`)
    return files
  }
  const args =
    face === 'staged'
      ? ['ls-files', '--', APP_REL]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', APP_REL]
  const out = String(gitRaw(args, root, { timeout: 120_000, maxBuffer: 1 << 26 }))
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (out.length === 0) {
    throw new Undetermined(
      `${face === 'staged' ? '索引' : 'HEAD'} 面列不出 ${APP_REL} ⇒ 路由面为空,不判绿`,
    )
  }
  return out
}

function readDocsPages(face, root) {
  const files = sourceCandidates(root, face, {
    prefilterRe: 'languages:',
    pathspecs: [DOCS_REL],
    roots: ['apps/'],
  })
  if (files.length === 0) {
    throw new Undetermined(
      `${face} 面在 ${DOCS_REL} 下枚举到 0 个含 languages: 的候选文件 ⇒ 判死,不记绿(§0.3)`,
    )
  }
  const { texts, skippedMissing } = readSources(root, face, files)
  return {
    docsPages: files.map((rel) => ({ rel, text: texts.get(rel) ?? '' })),
    files,
    skippedMissing,
  }
}

function readSitemap(face, root) {
  const { texts } = readSources(root, face, [SITEMAP_REL])
  const text = texts.get(SITEMAP_REL)
  if (typeof text !== 'string' || text.length === 0)
    throw new Undetermined(`${face} 面读不到 ${SITEMAP_REL}`)
  return text
}

export function runChecks(face, root = ROOT) {
  const index = buildRouteIndex(listAppTree(face, root))
  const { docsPages, files, skippedMissing } = readDocsPages(face, root)
  const d1 = judgeDocsLanguages(docsPages, index)
  const d2 = judgeSitemap(readSitemap(face, root), index)
  const d3 = judgeEmojiIcons(docsPages)
  let newByFile = null
  let ratchetNote = ''
  if (face === 'staged') {
    // 锚点 = 各文件 HEAD 面自身的死链数;判据与读数同一函数(judgeDocsLanguages),零复算(§22c)
    const headIndex = buildRouteIndex(listAppTree('head', root))
    const anchor = headAnchors(
      root,
      files,
      (rel, text) => judgeDocsLanguages([{ rel, text }], headIndex).dead.length,
    )
    const reads = new Map(
      docsPages.map((p) => [p.rel, d1.dead.filter((d) => d.file === p.rel).length]),
    )
    newByFile = overBaseline(reads, anchor)
    const added = [...newByFile.values()].reduce((a, b) => a + b, 0)
    ratchetNote = `D1 棘轮:新增 ${added} / 存量 ${d1.dead.length - added}(锚点 = 各文件 HEAD 面自身死链数;存量只报数不拦 §0.5)`
  } else if (face === 'head') {
    // 全量档:锚点与读数同面同判据(HEAD blob 自己)⇒ 新增恒 0,整批按存量报数(§0.5/§12e)
    ratchetNote = `D1 棘轮:新增 0 / 存量 ${d1.dead.length}(head 档锚点 = 本轮读数本身,存量只报数不拦)`
  } else {
    ratchetNote = `D1 棘轮:${face} 档没有「本次改动」可言 ⇒ 只报总数(${d1.dead.length}),新增维度不适用(§0.3 打印说明不静默)`
  }
  const result = assemble({ d1, d2, d3, newByFile })
  result.meta = {
    face,
    docsFiles: files.length,
    skippedMissing,
    ratchetNote,
    appTreeSize: index.size,
  }
  return result
}

export function printReport(result) {
  const { meta } = result
  console.log(
    `DOCS-PUBLIC-HEALTH face=${meta.face} 候选 docs 文件=${meta.docsFiles} 路由面条目=${meta.appTreeSize}`,
  )
  for (const key of ['D1', 'D2', 'D3']) {
    const d = result.dims[key]
    console.log(`${key} → ${d.state.toUpperCase()} — ${d.reason}`)
    if (key === 'D1') {
      for (const it of d.dead) {
        console.log(
          `  - ${it.file}:${it.line} [${it.locale}] '${it.path}' ⇒ 无路由文件(断在段 ${it.brokenAt}${it.nearMiss ? `,近似目录 ${it.nearMiss}(URL 段大小写敏感)` : ''})`,
        )
      }
      if (d.unparseable.length > 0) {
        console.log(`  · 解析不出的声明 ${d.unparseable.length} 条(逐条点名见 --json)`)
        for (const u of d.unparseable) console.log(`  ! ${u.file}:${u.line} ${u.reason}`)
      }
      console.log(
        `  语言族·全灭簇(该 locale 声明条条死)${d.deadLocaleFamilies.length} 个 → ${d.deadLocaleFamilies.map((f) => `${f.locale}(${f.dead}/${f.declared})`).join(', ') || '无'}`,
      )
      console.log(
        `  语言族·部分死簇 ${d.partialLocaleFamilies.length} 个 → ${d.partialLocaleFamilies.map((f) => `${f.locale}(${f.dead}/${f.declared})`).join(', ') || '无'}`,
      )
    }
    if (key === 'D2') {
      for (const it of d.dead)
        console.log(
          `  - ${SITEMAP_REL}:${it.line} '${it.path}' ⇒ 无路由文件(断在段 ${it.brokenAt})`,
        )
      for (const u of d.unparseable) console.log(`  ! ${SITEMAP_REL}:${u.line} ${u.reason}`)
    }
    if (key === 'D3') {
      for (const it of d.hits)
        console.log(`  - ${it.file}:${it.line} icon: '${it.value}' ⇒ emoji 当图标`)
    }
  }
  console.log(meta.ratchetNote)
  console.log(`DOCS-HEALTH-RESULT state=${result.overall} exit=${result.exitCode}`)
}

export const __test__ = {
  parseLanguageBlocks,
  parseSitemapDocPaths,
  parseEmojiIcons,
  buildRouteIndex,
  effectiveChildren,
  routeExists,
  serveableBy,
  judgeDocsLanguages,
  judgeSitemap,
  judgeEmojiIcons,
  localeFamilies,
  localeBuckets,
  assemble,
  resolveFace,
  isRouteGroup,
  isCatchAll,
  isDynamic,
  APP_REL,
  DOCS_REL,
  SITEMAP_REL,
  EXIT,
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const { face, error } = resolveFace(argv)
  if (error) {
    console.log(`DOCS-HEALTH-RESULT state=unjudged exit=2 reason=${error}`)
    return EXIT.unjudged
  }
  let result
  try {
    result = runChecks(face)
  } catch (e) {
    const why = e instanceof Undetermined ? e.message : `${e?.message ?? e}\n${e?.stack ?? ''}`
    console.log(`DOCS-HEALTH-RESULT state=unjudged exit=2 reason=${why}`)
    return EXIT.unjudged
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printReport(result)
  }
  return result.exitCode
}

/** 内联夹具:三类必答 + 反向牙(摘掉判据即翻红、判据过宽也翻红)。 */
function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })

  const realTree = [
    'apps/web/app/(main)/docs/page.tsx',
    'apps/web/app/(main)/docs/api/page.tsx',
    'apps/web/app/(main)/layout.tsx',
    'apps/web/app/en/page.tsx',
    'apps/web/app/en/docs/page.tsx',
    'apps/web/app/(main)/zh-TW/use-cases/ai-edu/page.tsx',
  ]
  const deadSource = `export const metadata = {
  alternates: {
    canonical: '/docs',
    languages: {
      'zh-CN': '/zh-cn/docs',
      'zh-TW': '/zh-tw/docs',
      en: '/en/docs',
      ko: '/ko/docs',
      ja: '/ja/docs',
      'x-default': '/docs',
    },
  },
}`

  t('D1 夹具:声明死链必命中', () => {
    const idx = buildRouteIndex(realTree)
    const r = judgeDocsLanguages(
      [{ rel: 'apps/web/app/(main)/docs/page.tsx', text: deadSource }],
      idx,
    )
    if (r.declaredTotal !== 6) return `声明条数应 6,实得 ${r.declaredTotal}`
    if (r.dead.length !== 4) return `死链应 4(zh-CN/zh-TW/ko/ja),实得 ${r.dead.length}`
    if (r.alive.length !== 2) return `活链应 2(en + x-default),实得 ${r.alive.length}`
    const locales = r.dead
      .map((d) => d.locale)
      .sort()
      .join(',')
    if (locales !== 'ja,ko,zh-CN,zh-TW') return `点名 locale 族不符:${locales}`
    return null
  })

  t('D1 反向牙:路由补齐后同一判据必须归零(判据不得恒真)', () => {
    const idx = buildRouteIndex([
      ...realTree,
      'apps/web/app/(main)/zh-cn/docs/page.tsx',
      'apps/web/app/(main)/zh-tw/docs/page.tsx',
      'apps/web/app/(main)/ko/docs/page.tsx',
      'apps/web/app/(main)/ja/docs/page.tsx',
    ])
    const r = judgeDocsLanguages(
      [{ rel: 'apps/web/app/(main)/docs/page.tsx', text: deadSource }],
      idx,
    )
    if (r.dead.length !== 0) return `路由齐备仍有 ${r.dead.length} 条死链 ⇒ 判据过宽`
    return null
  })

  t('D1 反向牙:摘掉判据即翻绿 ⇒ 红确实来自判据(不来自文案)', () => {
    const idx = buildRouteIndex(realTree)
    const strict = judgeDocsLanguages([{ rel: 'x', text: deadSource }], idx)
    const okDims = { entries: 1, dead: [], alive: [], unparseable: [] }
    const withJudge = assemble({ d1: strict, d2: okDims, d3: [] })
    const neutered = assemble({ d1: { ...strict, dead: [] }, d2: okDims, d3: [] })
    if (strict.dead.length === 0) return '夹具本身没命中 ⇒ 反向牙无从谈起'
    if (withJudge.exitCode !== EXIT.violation) return `带判据应 exit 1,实得 ${withJudge.exitCode}`
    if (neutered.exitCode !== EXIT.clean) {
      return `摘判据后仍非 0(exit=${neutered.exitCode})⇒ 结论与判据脱钩,是假红源`
    }
    return null
  })

  t('D1 夹具:大小写近似目录要点名 near-miss', () => {
    const idx = buildRouteIndex(realTree)
    const r = routeExists(idx, '/zh-tw/use-cases/ai-edu')
    if (r.reachable) return '大小写近似路由不得判可达(Next URL 段大小写敏感)'
    if (r.nearMiss !== 'zh-TW') return `near-miss 应 zh-TW,实得 ${r.nearMiss}`
    return null
  })

  t('D2 夹具:sitemap 死链必命中 + 全实则归零', () => {
    const idx = buildRouteIndex(realTree)
    const src = `const PAGES = [
  { path: '/docs', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/docs/api', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/dead-one', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
]`
    const r = judgeSitemap(src, idx)
    if (r.entries !== 3) return `/docs* 条目应 3(pricing 不在射程),实得 ${r.entries}`
    if (r.dead.length !== 1 || r.dead[0].path !== '/docs/dead-one')
      return `死链点名不对:${JSON.stringify(r.dead)}`
    const fullIdx = buildRouteIndex([...realTree, 'apps/web/app/(main)/docs/dead-one/page.tsx'])
    const r2 = judgeSitemap(src, fullIdx)
    if (r2.dead.length !== 0) return `路由齐备仍有 ${r2.dead.length} 条 ⇒ D2 判据过宽`
    return null
  })

  t('D3 夹具:emoji icon 命中,组件标识符不得命中', () => {
    const emoji = judgeEmojiIcons([{ rel: 'a', text: `const x = {\n  icon: '📄',\n}` }])
    if (emoji.length !== 1) return `emoji icon 应命中 1,实得 ${emoji.length}`
    const component = judgeEmojiIcons([{ rel: 'a', text: `const x = {\n  icon: BookOpen,\n}` }])
    if (component.length !== 0) return `组件形态被误判 ${component.length} 条 ⇒ D3 判据过宽`
    return null
  })

  t('D3 成对夹具:展示用示例代码(模板字符串内)不判,同文件真实配置照判', () => {
    const text = [
      'const page = () => (',
      '  <pre><code>{`',
      'export default defineAgentTemplate({',
      "  icon: '📄',",
      '})',
      '`}</code></pre>',
      ')',
      "const real = { icon: '🔒' }",
    ].join('\n')
    const hits = judgeEmojiIcons([{ rel: 'a', text }])
    if (hits.length !== 1)
      return `模板内示例应豁免、真实配置应命中 1,实得 ${hits.length} ⇒ D3 把文档展示的示例代码当成了页面配置`
    if (hits[0].line !== 8) return `命中的应是真实配置那行(8),实得 ${hits[0].line}`
    return null
  })

  t('输入取不到:D1 未判定(0 候选/0 声明)不得记绿也不得冒红', () => {
    const idx = buildRouteIndex(realTree)
    const empty = assemble({
      d1: judgeDocsLanguages([{ rel: 'a', text: 'export const metadata = {}' }], idx),
      d2: { entries: 0, dead: [], alive: [], unparseable: [] },
      d3: [],
    })
    if (empty.exitCode !== EXIT.unjudged) return `应为 exit 2,实得 ${empty.exitCode}`
    if (empty.dims.D1.state !== 'unjudged' || empty.dims.D2.state !== 'unjudged') {
      return `D1/D2 应 unjudged,实得 ${empty.dims.D1.state}/${empty.dims.D2.state}`
    }
    if (empty.dims.D3.state === 'unjudged') return 'D3 无声明不等于未判定(它判的是"有无 emoji")'
    return null
  })

  t('两面旗同给 ⇒ exit 2', () => {
    const r = resolveFace(['--staged', '--worktree'])
    if (!r.error || r.face !== null) return `应报错并置空面,实得 ${JSON.stringify(r)}`
    if (resolveFace(['--staged']).face !== 'staged') return '--staged 面解析错'
    if (resolveFace([]).face !== 'head') return '默认应为 head 面'
    return null
  })

  t('assemble 三态绝不并桶', () => {
    const idx = buildRouteIndex(realTree)
    const a = assemble({
      d1: judgeDocsLanguages([{ rel: 'x', text: deadSource }], idx),
      d2: { entries: 2, dead: [], alive: [], unparseable: [] },
      d3: [],
    })
    if (a.exitCode !== EXIT.violation) return `有死链应 exit 1,实得 ${a.exitCode}`
    if (a.dims.D2.state !== 'ok' || a.dims.D3.state !== 'ok')
      return '其余维必须独立记 ok,不得随 D1 冒红'
    const b = assemble({
      d1: judgeDocsLanguages([{ rel: 'x', text: deadSource }], idx),
      d2: { entries: 0, dead: [], alive: [], unparseable: [] },
      d3: [],
    })
    if (b.exitCode !== EXIT.unjudged) return `存在 unjudged 维时顶红 exit 2,实得 ${b.exitCode}`
    return null
  })

  const fails = []
  for (const c of cases) {
    let why = null
    try {
      why = c.fn()
    } catch (e) {
      why = `抛异常:${e?.message ?? e}`
    }
    if (why) {
      console.log(`FAIL ${c.name} — ${why}`)
      fails.push(c.name)
    } else {
      console.log(`ok   ${c.name}`)
    }
  }
  console.log(`SELF-TEST 例数=${cases.length} 失败=${fails.length}`)
  return fails.length === 0 ? EXIT.clean : EXIT.violation
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(EXIT.unjudged)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

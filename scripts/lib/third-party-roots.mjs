// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方来源台账的「路径面」唯一出口(2026-09-25 立)。
 *
 * 立因:水印门禁(scripts/watermark.mjs + scripts/check-watermark-coverage.mjs)会把归属横幅
 * 打到它认为"源文件"的每个已跟踪文件上,而 `apps/web/public/pdfjs/pdf.worker.min.mjs`
 * (Mozilla PDF.js 的压缩包,台账 `copied.json` 条目 `pdfjs-worker-6.x` 已登记为 copied)
 * 的第 1–3 行实测就是我们的横幅 —— 即**把别人的作品声明成自己的**。
 * 台账原判据(P1–P7)只看"来源有没有登记",没有一条看"登记过的第三方文件上是否被我们盖了归属"。
 *
 * 本模块是"哪些路径属已登记第三方内容"的**唯一**答案来源:
 *   - watermark.mjs 与 check-watermark-coverage.mjs 各自有一套枚举逻辑(后者不 import 前者),
 *     两边都改调本出口,不得再各抄一份路径清单(本仓最高频教训即"两处算同一件事各写一份")。
 *   - provenance-ledger.mjs 的 P8「归属反噬」判据复用本模块的**纯函数** `expandRootsToFiles`,
 *     按它自己要判定的那个取材面展开,不另起一份 git 调用。
 *
 * ⚠️ 取材口径(如实登记,别把它当成"纯配置"或"纯磁盘"):
 *   排除清单 = 台账 JSON(读**工作树磁盘**,它是仓库配置而非被审对象)
 *              ∩ `git ls-files`(工作树索引)展开出的真实文件。
 *   所以它既不是纯配置也不是纯磁盘:台账登记了而盘上没有的 root 不计入"排除文件数",
 *   但会以 `unresolvedRoots` 原样报出(那是台账腐烂,归 provenance-ledger P1 问责,不在本层判)。
 *
 * ⚠️ 不依赖目录名巧合:`scripts/watermark.mjs` 的 SKIP_DIRS 里那条 `'vendor'` 只是让
 *   `apps/desktop/src-tauri/vendor/tray-icon-0.24.2/` **碰巧**幸免 —— 摘掉它(或门禁扩面)
 *   那 18 个 Apache-2.0/MIT 文件就会凭空多出 18 个"水印缺口",而自愈式门禁会往许可原文里插横幅。
 *   本层的排除走台账 roots,**与目录名无关**:登记的第三方路径不论叫什么、不论是否含 "vendor",
 *   一律不再被水印层触碰;反之未登记的 `vendor/xxx/` 目录仍会被要求带横幅(那是 P2 的"拿了没登记")。
 *
 * ⚠️ 已知边界(登记而非掩盖):roots 允许指向**本仓自己的文件**(如 `overrides.json` 的
 *   `xlsx-via-e965-fork` → `apps/web/package.json`,那条登记的是"我们的清单里某个依赖的来源",
 *   不是"这个文件是第三方内容")。对这种 root,本层会把该路径列为排除 —— 之所以今天无副作用,
 *   是因为 `EXT_MAP` 不含 `.json`,它本就不在可注入面内。**若今后有人把自己写的 .ts 登记成 root,
 *   它就会从"必须带横幅"变成"不要求带横幅"**;这一取舍是"台账是唯一真相源"的必然代价,
 *   由 provenance-ledger 的 P1/P2 与人工 review 共同守着,不在本层自立第二套判据。
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { gitRaw } from './face-reader.mjs'

/** 台账目录与四本账(相对仓库根,`/` 分隔)。provenance-ledger.mjs 从这里取,不再自持一份。 */
export const LEDGER_DIR = 'config/third-party-provenance'
export const LEDGER_FILES = [
  { file: 'embedded.json', kind: 'embedded' },
  { file: 'copied.json', kind: 'copied' },
  { file: 'overrides.json', kind: 'override' },
  { file: 'mechanisms.json', kind: 'mechanism' },
]

const GIT_TIMEOUT_MS = 30000

/** 台账读不了 / git 问不到 —— 上层必须"无法判定"，不得按"没有第三方"继续跑。 */
export class LedgerUnavailable extends Error {}

/**
 * 纯函数:把声明的 roots 展开成真实文件集合(前缀语义:root 本身或其目录内的一切)。
 * 不做任何 I/O —— 调用方决定 `filePaths` 来自哪个面(HEAD / 索引 / 磁盘 / git ls-files)。
 */
export function expandRootsToFiles(roots, filePaths) {
  const prefixes = roots.filter((r) => typeof r === 'string' && r)
  const files = new Set()
  for (const rel of filePaths) {
    for (const r of prefixes) {
      if (rel === r || rel.startsWith(`${r}/`)) {
        files.add(rel)
        break
      }
    }
  }
  return files
}

/**
 * 从磁盘读四本账,收集全部 `roots` 声明。
 * @returns {{declared: Array<{root:string, source:string}>, unresolvedRoots: string[], notes: string[]}}
 */
export function readLedgerRoots(repoRoot) {
  const declared = []
  const notes = []
  for (const { file, kind } of LEDGER_FILES) {
    const abs = join(repoRoot, LEDGER_DIR, file)
    if (!existsSync(abs)) {
      notes.push(`${LEDGER_DIR}/${file} 不存在 —— 该本账的 roots 未纳入排除面`)
      continue
    }
    let doc
    try {
      doc = JSON.parse(readFileSync(abs, 'utf8'))
    } catch (e) {
      throw new LedgerUnavailable(
        `${LEDGER_DIR}/${file} 解析失败(${String(e.message).split('\n')[0]})—— ` +
          '第三方排除面算不出来时**拒绝**按"没有第三方内容"继续跑水印层',
      )
    }
    if (!Array.isArray(doc.entries)) {
      throw new LedgerUnavailable(`${LEDGER_DIR}/${file} 没有 entries 数组 —— 台账坏了，判死`)
    }
    for (const e of doc.entries) {
      if (!Array.isArray(e?.roots)) continue
      for (const r of e.roots) {
        if (typeof r !== 'string' || !r) {
          notes.push(`${kind}:${e?.id ?? '(无 id)'} 的 roots 含非字符串项,已跳过`)
          continue
        }
        declared.push({ root: r, source: `${kind}:${e?.id ?? '(无 id)'}` })
      }
    }
  }
  return { declared, notes }
}

/**
 * 水印层用的排除面。
 * @param {string} repoRoot
 * @param {string[]} [trackedFiles] 已有的 `git ls-files` 清单(省一次派生)
 * @returns {{
 *   paths: Set<string>,            展开出的真实第三方文件(相对根, / 分隔)
 *   roots: Array<{root:string, source:string}>, 台账声明的全部 roots
 *   rootPrefixes: string[],        用于谓词的 root 前缀(含未入库的新文件)
 *   unresolvedRoots: string[],     登记了而当前清单里没有的 root(如实报出)
 *   notes: string[]
 * }}
 */
export function thirdPartyExcludedPaths(repoRoot, trackedFiles) {
  const { declared, notes } = readLedgerRoots(repoRoot)
  const allNotes = [...notes]
  let files
  if (Array.isArray(trackedFiles)) {
    files = trackedFiles
  } else {
    try {
      // -z:默认输出会按 core.quotePath 把非 ASCII 文件名转义成八进制串,那种路径永远对不上
      // (gitRaw 已统一带 `core.quotepath=false`,故这里不再自己拼 `-c`)
      files = gitRaw(['ls-files', '-z'], repoRoot, { timeout: GIT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 })
        .split('\0')
        .map((s) => s.trim())
        .filter(Boolean)
    } catch (e) {
      throw new LedgerUnavailable(
        `取不到 git 跟踪清单(${String(e?.message ?? e).split('\n')[0]})—— ` +
          '第三方排除面算不出来时**拒绝**按"没有第三方内容"继续跑水印层',
      )
    }
  }
  const roots = [...new Map(declared.map((d) => [d.root, d])).values()]
  const paths = expandRootsToFiles(
    roots.map((r) => r.root),
    files,
  )
  const present = roots.map((r) => r.root).filter((r) => paths.has(r))
  const unresolvedRoots = roots
    .map((r) => r.root)
    .filter((r) => !present.includes(r) && !files.some((f) => f.startsWith(`${r}/`)))
  return {
    paths,
    roots,
    rootPrefixes: roots.map((r) => r.root),
    unresolvedRoots,
    notes: allNotes,
  }
}

/**
 * 造一个"某路径是否属已登记第三方内容"的谓词。
 * 谓词同时认「展开出的真实文件」与「root 前缀」—— 后者保证新塞进已登记 vendored 目录、
 * 尚未 `git add` 的文件也不会被水印层写入(否则门禁会先把横幅打进它再谈登记)。
 */
export function createExclusionPredicate(repoRoot, trackedFiles) {
  const info = thirdPartyExcludedPaths(repoRoot, trackedFiles)
  const prefixes = info.rootPrefixes
  return {
    ...info,
    isExcluded(rel) {
      const norm = String(rel).replaceAll('\\', '/')
      if (info.paths.has(norm)) return true
      return prefixes.some((r) => norm === r || norm.startsWith(`${r}/`))
    },
  }
}

export const __test__ = {
  expandRootsToFiles,
  readLedgerRoots,
  thirdPartyExcludedPaths,
  createExclusionPredicate,
  LEDGER_DIR,
  LEDGER_FILES,
  LedgerUnavailable,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

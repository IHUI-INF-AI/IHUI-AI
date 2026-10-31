#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-installed-asset-catalog.mjs — 装机资产(技能包)逐文件 sha256 完整性对账。
 *
 * 立的因(逆向-复现-超越 §0.11,G-21,2026-10-31):
 * 对照程序 Qoder CN 用 `catalog.v1.json` + `bundled-resources/manifest.json` 把插件 manifest
 * 与逐文件 sha256 内联,并带 `maxEntries`/`maxExpandedBytes` 解压炸弹护栏。本仓现读只有
 * git commit SHA pin(`apps/cli/src/plugins/url-shape.ts`),没有任何"装机产物逐文件摘要"。
 * ⇒ 技能包被改动、被塞入未登记文件、或体积异常膨胀,本仓没有任何一道尺子能看见。
 *
 * 判据(单一真相源,禁止第二份):
 *   R1 清单有、被审面无 ⇒ 红(missing,资产被删/改名)
 *   R2 被审面有、清单无 ⇒ 红(unlisted,未登记文件混入)
 *   R3 两边都有但 sha256 或字节数不等 ⇒ 红(mismatch,资产被改)
 *   R4 条目数 > maxEntries 或总字节 > maxExpandedBytes ⇒ 红(overLimit,解压炸弹/体积失控)
 * 解析不到清单 / 枚举不到被审面 ⇒ exit 2「未判定」,绝不静默记绿(§0.3)。
 *
 * 取材面(§0.4 纪律):默认判 **HEAD blob**(`git ls-tree` + `git cat-file --batch`),
 * 不读工作树 —— 共享工作树里技能文件常有他席未提交改动,判盘上会把他人的在飞改动
 * 算成资产漂移。盘上面只能由 `--worktree` 人工档显式取,不自动回落。
 *
 * 接线面:刻意**不进提交链**(§12e —— 资产改动与提交内容无关时它是恒红门),唯一调度点 =
 * `scripts/all-checks-runner.mjs`(`pnpm check:all`,人工/CI 全量档)的末段一步。
 * 重新生成清单的唯一出口 = `node scripts/check-installed-asset-catalog.mjs --write`。
 *
 * 退出码:0 一致 / 1 漂移 / 2 未判定(清单坏、git 取不到、枚举为 0 等)。
 *
 * 用法:
 *   node scripts/check-installed-asset-catalog.mjs             # 判 HEAD 面
 *   node scripts/check-installed-asset-catalog.mjs --worktree  # 人工档:判盘上
 *   node scripts/check-installed-asset-catalog.mjs --write     # 按 HEAD 面重生成清单
 *   node scripts/check-installed-asset-catalog.mjs --json      # 机器可读结论
 *   node scripts/check-installed-asset-catalog.mjs --self-test # 判据自检(不读真仓)
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

/** 被审资产根(仓库相对路径,正斜杠)。 */
export const ASSET_ROOT = '.ihui/skills'

/** 清单落点(仓库相对路径)。 */
export const CATALOG_PATH = 'scripts/data/installed-assets-catalog.json'

/**
 * 体积/条目上限。数值不是拍的整数:2026-10-31 现读 HEAD 面 192 文件 / 5,003,556 B,
 * 留约 2 倍余量给技能包正常增长,再高就该有人来问"为什么一个技能包要 16 MB"。
 */
export const DEFAULT_LIMITS = Object.freeze({
  maxEntries: 400,
  maxExpandedBytes: 16 * 1024 * 1024,
})

export const EXIT = Object.freeze({ OK: 0, DRIFT: 1, UNDETERMINED: 2 })

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

/** 解析 `git ls-tree -r -z` 输出(Buffer),返回 [{path, oid, bytes, type}]。 */
export function parseLsTree(buf) {
  const rows = []
  const text = buf.toString('utf8')
  for (const row of text.split('\0')) {
    if (!row) continue
    const tab = row.indexOf('\t')
    if (tab < 0) throw new Error(`ls-tree 行不识形态: ${row.slice(0, 120)}`)
    const meta = row.slice(0, tab).trim().split(/\s+/)
    if (meta.length < 4) throw new Error(`ls-tree 元信息列数不足: ${row.slice(0, 120)}`)
    const [mode, type, oid, bytes] = meta
    rows.push({ path: row.slice(tab + 1), oid, type, mode, bytes: Number(bytes) })
  }
  return rows
}

/** 解析 `git cat-file --batch` 输出(Buffer),返回 Map<oid, Buffer>。 */
export function parseCatFileBatch(buf) {
  const out = new Map()
  let i = 0
  while (i < buf.length) {
    const nl = buf.indexOf(0x0a, i)
    if (nl < 0) throw new Error('cat-file --batch 头行不完整')
    const header = buf.subarray(i, nl).toString('utf8').trim()
    if (header.endsWith(' missing')) {
      const oid = header.split(/\s+/)[0]
      out.set(oid, null)
      i = nl + 1
      continue
    }
    const parts = header.split(/\s+/)
    if (parts.length < 3) throw new Error(`cat-file 头行不识形态: ${header}`)
    const [oid, , sizeText] = parts
    const size = Number(sizeText)
    const start = nl + 1
    const end = start + size
    if (end > buf.length) throw new Error('cat-file 内容长度超出缓冲')
    out.set(oid, buf.subarray(start, end))
    i = end + 1
  }
  return out
}

// spawnSync 默认 maxBuffer 只有 1 MiB,而资产面现读 5.0 MiB(整仓技能包) ⇒ 显式抬到 128 MiB;
// 不抬时症状是 `spawnSync git ENOBUFS`,会被本器自己的 catch 落成"未判定"而不是数据错。
const GIT_MAX_BUFFER = 128 * 1024 * 1024

function runGit(args, { cwd, input } = {}) {
  const stdio = input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  const r = spawnSync('git', args, {
    cwd,
    input,
    stdio,
    maxBuffer: GIT_MAX_BUFFER,
    windowsHide: true,
  })
  if (r.error) throw new Error(`git ${args.join(' ')} 派生失败: ${r.error.message}`)
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} exit ${r.status}: ${r.stderr.toString('utf8').trim()}`)
  }
  return r.stdout
}

/** 按 HEAD blob 面算出清单(与工作树无关)。 */
export function computeHeadCatalog({ repoRoot = REPO_ROOT } = {}) {
  const lsOut = runGit(['ls-tree', '-r', '-l', '-z', 'HEAD', '--', ASSET_ROOT], { cwd: repoRoot })
  const treeRows = parseLsTree(lsOut).filter((r) => r.type === 'blob')
  if (treeRows.length === 0) {
    throw new Error(`HEAD 面 ${ASSET_ROOT} 枚举到 0 个文件(空扫不记绿,§0.3)`)
  }
  const input = Buffer.from(treeRows.map((r) => r.oid).join('\n') + '\n', 'utf8')
  const catOut = runGit(['cat-file', '--batch'], { cwd: repoRoot, input })
  const blobs = parseCatFileBatch(catOut)
  const entries = treeRows.map((row) => {
    const body = blobs.get(row.oid)
    if (!body) throw new Error(`cat-file 未返回 blob: ${row.path}`)
    return { path: row.path, sha256: sha256Hex(body), bytes: body.length }
  })
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return {
    version: 1,
    root: ASSET_ROOT,
    entries,
    totalBytes: entries.reduce((n, e) => n + e.bytes, 0),
  }
}

/**
 * 按盘上工作树算清单(人工档)。
 * 文件集取 git 可见面(`ls-files --cached --others --exclude-standard`),不枚举目录 ——
 * 目录枚举会把 `.gitignore` 挡在外面的渲染示例(`archify/examples/*.html`)算成"未登记",
 * 那不是资产漂移,是判据面错。内容取盘上字节(与 HEAD 档的唯一差别),跳符号链接(§26)。
 */
export function computeWorktreeCatalog({ repoRoot = REPO_ROOT } = {}) {
  const listOut = runGit(
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ASSET_ROOT],
    {
      cwd: repoRoot,
    },
  )
  const paths = listOut.toString('utf8').split('\0').filter(Boolean).sort()
  if (paths.length === 0) {
    throw new Error(`工作树 ${ASSET_ROOT} 枚举到 0 个文件(空扫不记绿,§0.3)`)
  }
  const entries = []
  for (const rel of paths) {
    const abs = join(repoRoot, ...rel.split('/'))
    let st
    try {
      st = lstatSync(abs)
    } catch {
      continue // 跟踪但盘上已删:让它按 missing 落账,而不是在这里吞掉
    }
    if (st.isSymbolicLink()) continue
    const body = readFileSync(abs)
    entries.push({ path: rel, sha256: sha256Hex(body), bytes: body.length })
  }
  return {
    version: 1,
    root: ASSET_ROOT,
    entries,
    totalBytes: entries.reduce((n, e) => n + e.bytes, 0),
  }
}

/** 清单 JSON 解析;结构坏一律抛出,由调用方落"未判定"。 */
export function parseCatalog(text) {
  let raw
  try {
    raw = JSON.parse(text)
  } catch (e) {
    throw new Error(`清单不是合法 JSON: ${e.message}`)
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entries)) {
    throw new Error('清单缺 entries 数组')
  }
  if (raw.root !== ASSET_ROOT) {
    throw new Error(`清单 root=${JSON.stringify(raw.root)} 与判据根 ${ASSET_ROOT} 不一致`)
  }
  const entries = raw.entries.map((e, i) => {
    if (
      !e ||
      typeof e.path !== 'string' ||
      typeof e.sha256 !== 'string' ||
      !Number.isFinite(e.bytes)
    ) {
      throw new Error(`清单 entries[${i}] 结构坏`)
    }
    return { path: e.path, sha256: e.sha256, bytes: e.bytes }
  })
  return { version: raw.version ?? 1, root: raw.root, entries, totalBytes: raw.totalBytes ?? NaN }
}

/**
 * 四维判定。catalog = 清单;actual = 现读面。
 * 返回 verdict 只有 ok / drift 两态;输入不可读的第三态由调用方在更外层落 undetermined。
 */
export function judge(catalog, actual, limits = DEFAULT_LIMITS) {
  const want = new Map(catalog.entries.map((e) => [e.path, e]))
  const have = new Map(actual.entries.map((e) => [e.path, e]))
  const missing = []
  const unlisted = []
  const mismatch = []
  for (const [path, w] of want) {
    const h = have.get(path)
    if (!h) {
      missing.push(path)
      continue
    }
    if (h.sha256 !== w.sha256 || h.bytes !== w.bytes) {
      mismatch.push({ path, expected: w, actual: h })
    }
  }
  for (const path of have.keys()) {
    if (!want.has(path)) unlisted.push(path)
  }
  const totalBytes = actual.entries.reduce((n, e) => n + e.bytes, 0)
  const overLimit = []
  if (actual.entries.length > limits.maxEntries) {
    overLimit.push(`entries ${actual.entries.length} > maxEntries ${limits.maxEntries}`)
  }
  if (totalBytes > limits.maxExpandedBytes) {
    overLimit.push(`bytes ${totalBytes} > maxExpandedBytes ${limits.maxExpandedBytes}`)
  }
  const drift = missing.length + unlisted.length + mismatch.length + overLimit.length > 0
  return {
    verdict: drift ? 'drift' : 'ok',
    counts: {
      catalog: catalog.entries.length,
      actual: actual.entries.length,
      missing: missing.length,
      unlisted: unlisted.length,
      mismatch: mismatch.length,
      overLimit: overLimit.length,
      totalBytes,
    },
    missing,
    unlisted,
    mismatch,
    overLimit,
  }
}

function printResult(result, mode) {
  const c = result.counts
  console.log(
    `[installed-assets] 面=${mode} 清单=${c.catalog} 实读=${c.actual} 字节=${c.totalBytes} ` +
      `missing=${c.missing} unlisted=${c.unlisted} mismatch=${c.mismatch} overLimit=${c.overLimit}`,
  )
  for (const p of result.missing) console.log(`  [missing ] ${p}`)
  for (const p of result.unlisted) console.log(`  [unlisted] ${p}`)
  for (const m of result.mismatch) console.log(`  [mismatch] ${m.path}`)
  for (const o of result.overLimit) console.log(`  [overLimit] ${o}`)
  console.log(
    result.verdict === 'ok'
      ? '[installed-assets] 结论: ok(清单与被审面逐文件一致)'
      : '[installed-assets] 结论: drift(跑 --write 重生成清单,或在提交里同批更新)',
  )
}

function loadCatalogText(repoRoot) {
  return readFileSync(join(repoRoot, ...CATALOG_PATH.split('/')), 'utf8')
}

/** 自检:不读真仓,用 scratch 目录造七种形态。 */
export function selfTest() {
  const dir = mkScratch('installed-assets-')
  const cases = []
  const mkActual = (files) => ({
    entries: Object.entries(files)
      .map(([p, body]) => ({
        path: p,
        sha256: sha256Hex(Buffer.from(body)),
        bytes: Buffer.byteLength(body),
      }))
      .sort((a, b) => (a.path < b.path ? -1 : 1)),
  })
  const limits = DEFAULT_LIMITS

  {
    const actual = mkActual({ 'a/SKILL.md': 'x', 'a/z.txt': 'yy' })
    const r = judge({ entries: actual.entries }, actual, limits)
    cases.push(['一致 ⇒ ok', r.verdict === 'ok' && r.counts.mismatch === 0])
  }
  {
    const actual = mkActual({ 'a/SKILL.md': 'x' })
    const r = judge({ entries: [{ ...actual.entries[0], path: 'a/gone.md' }] }, actual, limits)
    cases.push(['清单有面无比 ⇒ missing', r.verdict === 'drift' && r.missing[0] === 'a/gone.md'])
  }
  {
    const actual = mkActual({ 'a/SKILL.md': 'x', 'a/new.md': 'n' })
    const r = judge(
      { entries: [actual.entries.find((e) => e.path === 'a/SKILL.md')] },
      actual,
      limits,
    )
    cases.push(['面有清单无比 ⇒ unlisted', r.verdict === 'drift' && r.unlisted[0] === 'a/new.md'])
  }
  {
    const actual = mkActual({ 'a/SKILL.md': 'changed' })
    const want = [{ path: 'a/SKILL.md', sha256: sha256Hex(Buffer.from('orig')), bytes: 4 }]
    const r = judge({ entries: want }, actual, limits)
    cases.push(['摘要不等 ⇒ mismatch', r.verdict === 'drift' && r.mismatch.length === 1])
  }
  {
    const files = {}
    for (let i = 0; i < 5; i += 1) files[`a/${i}.txt`] = 'x'
    const actual = mkActual(files)
    const r = judge({ entries: actual.entries }, actual, { maxEntries: 4, maxExpandedBytes: 1e9 })
    cases.push(['条目超限 ⇒ overLimit', r.verdict === 'drift' && r.overLimit.length === 1])
  }
  {
    const actual = mkActual({ 'a/big.txt': 'x'.repeat(32) })
    const r = judge({ entries: actual.entries }, actual, { maxEntries: 100, maxExpandedBytes: 16 })
    cases.push(['字节超限 ⇒ overLimit', r.verdict === 'drift' && r.overLimit.length === 1])
  }
  {
    let threw = false
    try {
      parseCatalog('{not json')
    } catch {
      threw = true
    }
    cases.push(['清单坏 ⇒ 未判定(抛错)', threw])
  }
  {
    const r = judge({ entries: [] }, mkActual({}), limits)
    cases.push(['空对空 ⇒ ok(不误判)', r.verdict === 'ok'])
  }

  rmScratch(dir)
  let failed = 0
  for (const [name, ok] of cases) {
    console.log(`${ok ? '✅' : '❌'} ${name}`)
    if (!ok) failed += 1
  }
  console.log(`[self-test] ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0
}

export function main(argv = process.argv.slice(2)) {
  const repoRoot = process.env.IHUI_ASSET_CATALOG_ROOT
    ? resolve(process.env.IHUI_ASSET_CATALOG_ROOT)
    : REPO_ROOT
  const json = argv.includes('--json')
  const worktree = argv.includes('--worktree')

  if (argv.includes('--help')) {
    console.log(
      [
        '用法: node scripts/check-installed-asset-catalog.mjs [--worktree] [--json]',
        '      node scripts/check-installed-asset-catalog.mjs --write',
        '      node scripts/check-installed-asset-catalog.mjs --self-test',
        `清单: ${CATALOG_PATH}(root=${ASSET_ROOT})`,
        '退出码: 0 一致 / 1 漂移 / 2 未判定',
      ].join('\n'),
    )
    return EXIT.OK
  }

  if (argv.includes('--self-test')) {
    return selfTest() ? EXIT.OK : EXIT.DRIFT
  }

  let catalog
  let actual
  let mode
  try {
    if (argv.includes('--write')) {
      const fresh = computeHeadCatalog({ repoRoot })
      const path = join(repoRoot, ...CATALOG_PATH.split('/'))
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, `${JSON.stringify(fresh, null, 2)}\n`, 'utf8')
      console.log(
        `[installed-assets] 已重生成 ${CATALOG_PATH}: ${fresh.entries.length} 条 / ${fresh.totalBytes} B`,
      )
      return EXIT.OK
    }
    catalog = parseCatalog(loadCatalogText(repoRoot))
    mode = worktree ? 'worktree(人工档)' : 'HEAD'
    actual = worktree ? computeWorktreeCatalog({ repoRoot }) : computeHeadCatalog({ repoRoot })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (json) {
      console.log(JSON.stringify({ verdict: 'undetermined', reason: msg }))
    } else {
      console.error(`[installed-assets] 未判定: ${msg}`)
    }
    return EXIT.UNDETERMINED
  }

  const result = judge(catalog, actual)
  if (json) {
    console.log(JSON.stringify({ mode: mode === 'HEAD' ? 'head' : 'worktree', ...result }))
  } else {
    printResult(result, mode)
  }
  return result.verdict === 'ok' ? EXIT.OK : EXIT.DRIFT
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exitCode = EXIT.UNDETERMINED
  }
}

export const __test__ = {
  sha256Hex,
  parseLsTree,
  parseCatFileBatch,
  computeHeadCatalog,
  computeWorktreeCatalog,
  parseCatalog,
  judge,
  selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

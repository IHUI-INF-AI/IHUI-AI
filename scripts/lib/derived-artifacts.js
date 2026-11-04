// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * derived-artifacts.js — 派生自动同步腿的「产物显式申报」唯一实现(2026-11-04 立)
 *
 * 治什么:pre-commit 钩子的派生腿(`scripts/sync-alpha-usage.mjs`、`scripts/gen-rn-compat.mjs`、
 * 四端 ui-routes 等)会写产物并 `git add`。这些条目不在作者声明集里 ⇒ isolated-git 的
 * 私有索引内容护栏判「声明集外出现条目」⇒ 每次业务提交都被拒绝,提交者只能拿
 * `HUSKY_SKIP_TOKENS_SYNC=1` 换绿(实测 attest 已记 undeclaredSkipHits=1)。这是结构冲突,
 * 不允许长期靠 skip。
 *
 * 通道(单一实现):
 *   - 派生腿**在 `git add` 之前**把「本次将写出的产物路径 + 工作树 blob」申报进 manifest
 *     (`<私有索引>.derived.json`,路径由 isolated-git 经 env 交给钩子);
 *   - isolated-git 的 `restore-index` 把申报路径并入本单允许集,并逐条核验**索引里的 blob
 *     与申报 blob 相等**(申报之外的条目仍按原样拒绝);
 *   - 申报只对「本次确实产出」的路径发生:生成器拒绝写回( failMode=warn 的正常形态)时
 *     不申报、不 add,不留下"申报了却没产出"的悬空条目。
 *
 * 不在本模块做 git 判定:守卫侧的 ls-files 复核由 isolated-git 自己的 `lsEntries` 完成,
 * 避免同一判据写两份(AGENTS §0.6)。
 */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const LOST_PREFIX = '派生申报失败'

function normalizeRelPath(p) {
  const s = String(p || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
  if (!s || s.startsWith('/') || /^[A-Za-z]:/.test(s) || s.split('/').includes('..')) return ''
  return s
}

function readDerivedManifest(file) {
  if (!file) return []
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') return []
    throw new Error(`${LOST_PREFIX}:读不到申报文件 ${file}:${e?.message ?? e}`)
  }
  if (!text.trim()) return []
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error(`${LOST_PREFIX}:申报文件形状坏 ${file}:${e?.message ?? e}`)
  }
  if (!data || !Array.isArray(data.entries))
    throw new Error(`${LOST_PREFIX}:申报文件缺少 entries 数组:${file}`)
  return data.entries
}

function writeDerivedManifest(file, entries) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, entries }))
  fs.renameSync(tmp, file)
}

/** 工作树内容(经 .gitattributes 过滤器)的 blob 号;与 `git add` 落进索引的写法同源。 */
function hashWorktreeBlob({ gitCwd, relPath }) {
  const r = spawnSync('git', ['hash-object', '--', relPath], {
    cwd: gitCwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  if (r.status !== 0) throw new Error(`${LOST_PREFIX}:git hash-object ${relPath} 失败:${r.stderr}`)
  return String(r.stdout || '').trim()
}

/** 索引里某路径的条目(stage 0);取不到返回 null。 */
function indexEntry({ gitCwd, relPath }) {
  const r = spawnSync('git', ['ls-files', '-s', '--', relPath], {
    cwd: gitCwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  if (r.status !== 0) return null
  const line = String(r.stdout || '')
    .split(/\r?\n/)
    .find(Boolean)
  if (!line) return null
  const m = /^(\d+)\s+([0-9a-f]+)\s+(\d)\t(.+)$/.exec(line.trim())
  if (!m) return null
  return { mode: m[1], blob: m[2], stage: Number(m[3]), path: m[4] }
}

/**
 * 申报一条即将进入索引的派生产物。
 *
 * @param {object} p
 * @param {string} p.manifestFile isolated-git 给的申报文件路径(空 ⇒ 本单不是私有索引模式,跳过)
 * @param {string} p.path 产物仓库相对路径
 * @param {string} p.generator 产出它的命令(留痕到 manifest)
 * @param {string[]} [p.declaredPaths] 作者本单声明集(已声明的不重复申报)
 * @returns {{declared:boolean, skipped?:string, path?:string, blob?:string}}
 */
function declareDerivedArtifact({
  manifestFile,
  path: relPathRaw,
  generator,
  declaredPaths = [],
  gitCwd = process.cwd(),
}) {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) throw new Error(`${LOST_PREFIX}:产物路径不合法:${relPathRaw}`)
  if (!manifestFile) return { declared: false, skipped: 'no-manifest' }
  const declared = new Set(declaredPaths.map(normalizeRelPath).filter(Boolean))
  if (declared.has(relPath)) return { declared: false, skipped: 'author-declared', path: relPath }

  const blob = hashWorktreeBlob({ gitCwd, relPath })
  if (!blob) throw new Error(`${LOST_PREFIX}:取不到 ${relPath} 的 blob 号`)
  const entries = readDerivedManifest(manifestFile).filter((e) => e && e.path !== relPath)
  entries.push({
    path: relPath,
    blob,
    generator: String(generator || ''),
    declaredAt: new Date().toISOString(),
  })
  writeDerivedManifest(manifestFile, entries)
  return { declared: true, path: relPath, blob }
}

/** `git add -- <path>` 之后的内容钉核验:索引 blob 必须等于申报 blob。 */
function verifyDeclaredEntryInIndex({ gitCwd, relPath, blob }) {
  const cur = indexEntry({ gitCwd, relPath })
  if (!cur) return { ok: false, reason: `索引里没有 ${relPath}(git add 未生效)` }
  if (cur.stage !== 0)
    return { ok: false, reason: `${relPath} 的索引条目 stage=${cur.stage}(非 0)` }
  if (!/^100(644|755)$/.test(cur.mode))
    return { ok: false, reason: `${relPath} 的索引 mode=${cur.mode}(非普通文件)` }
  if (cur.blob !== blob) return { ok: false, reason: `${relPath} 的索引 blob 与申报不符` }
  return { ok: true }
}

module.exports = {
  LOST_PREFIX,
  normalizeRelPath,
  readDerivedManifest,
  writeDerivedManifest,
  hashWorktreeBlob,
  indexEntry,
  declareDerivedArtifact,
  verifyDeclaredEntryInIndex,
}

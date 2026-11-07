// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * dist 内容寻址缓存(2026-11-07 立,T1 提速)。
 *
 * 病根:旧前置按 **mtime** 判陈旧(`src 最新 mtime > dist 最新 mtime`),于是
 *   - git checkout / 分支切换会把 src 的 mtime 全部刷新,即使内容一字未变也判"陈旧",
 *     每次都把整包 dist 重写一遍(实测冷工作树 packages 重建 59.1s);
 *   - 反向地,任一产物被重建就会把整包 mtime 拉新,真正过期的产物永远判不出来
 *     (这一维由 scripts/lib/stale-dist.mjs 的逐产物对账承担)。
 *
 * 本模块只补"内容面":构建成功后在 `node_modules/.cache/dist-manifest/` 记下
 * `源码指纹 + 每个应有产物的 sha256`。下次前置先比指纹:
 *   - 源码指纹一致 且 应有产物逐个 hash 对得上 ⇒ **内容未变**,直接跳过重建
 *     (mtime 再怎么变也不重写);
 *   - 指纹不一致 ⇒ 真变了,按 stale-dist 的逐产物判据走重建。
 * 拿不到 manifest / 读取失败 ⇒ 退回 stale-dist 的 mtime 判据(不静默、不放松)。
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXCLUDE_DIRS, expectedArtifactRels, listFilesRecursive } from './stale-dist.mjs'

/** 指纹/产物 hash 的缓存根(本机构建缓存,不入库)。 */
export function manifestDir(root) {
  return join(root, 'node_modules', '.cache', 'dist-manifest')
}

function sha256File(abs) {
  try {
    return createHash('sha256').update(readFileSync(abs)).digest('hex')
  } catch {
    return null
  }
}

function safeKey(name) {
  const h = createHash('sha1').update(String(name)).digest('hex').slice(0, 10)
  return `${String(name).replace(/[^a-zA-Z0-9._-]+/g, '_')}-${h}.json`
}

export function manifestPath(root, name) {
  return join(manifestDir(root), safeKey(name))
}

function memoPath(root, name) {
  return join(manifestDir(root), `${safeKey(name).replace(/\.json$/, '')}.memo.json`)
}

function loadMemo(root, name) {
  try {
    const m = JSON.parse(readFileSync(memoPath(root, name), 'utf8'))
    if (m?.schema === 1 && m.files && typeof m.files === 'object') return m.files
  } catch {
    /* 无 memo:全量算一次 */
  }
  return null
}

function saveMemo(root, name, files) {
  try {
    const target = memoPath(root, name)
    const serialized = JSON.stringify({ schema: 1, files })
    let previous = null
    try {
      previous = readFileSync(target, 'utf8')
    } catch {
      /* 首次 */
    }
    if (previous !== serialized) {
      mkdirSync(manifestDir(root), { recursive: true })
      writeFileSync(target, serialized)
    }
  } catch {
    /* 缓存写失败不影响判据(下次全量算) */
  }
}

/**
 * 源码指纹:包内除构建产物/依赖/缓存外的**全部文件内容** hash。
 * 为什么含 tsconfig/package.json/scripts:它们改变编译参数或产物搬运逻辑,
 * 不改 src 也会改变 dist;只盯 src 会漏。
 */
export function sourceFingerprint(pkgDir, prevFiles = null) {
  const files = listFilesRecursive(pkgDir).filter((f) => !shouldExcludeForFingerprint(f.rel))
  files.sort((a, b) => a.rel.localeCompare(b.rel))
  const h = createHash('sha256')
  const nextFiles = {}
  let recomputed = 0
  for (const f of files) {
    // 逐文件 memo:内容 hash 只在 (mtime,size) 变了才重算。checkout 会掀 mtime,
    // 那一轮按内容重算(正是要判"内容真的变没变");mtime 稳定后直接复用,近零成本。
    const prev = prevFiles?.[f.rel]
    let contentHash
    if (prev && prev.mtimeMs === f.mtimeMs && prev.size === f.size && typeof prev.hash === 'string') {
      contentHash = prev.hash
    } else {
      contentHash = sha256File(f.abs)
      recomputed++
    }
    nextFiles[f.rel] = { mtimeMs: f.mtimeMs, size: f.size, hash: contentHash }
    h.update(`${f.rel}\0${contentHash ?? 'null'}\n`)
  }
  return { hash: h.digest('hex'), fileCount: files.length, nextFiles, recomputed, rels: files.map((f) => f.rel) }
}

function shouldExcludeForFingerprint(rel) {
  const top = rel.split('/')[0]
  if (EXCLUDE_DIRS.has(top)) return true
  return top === 'dist' || top === 'coverage' || top === 'build'
}

/** 该包 src 里正常源文件应有的产物清单(排序;`.d.ts` 手写声明不计产物)。 */
export function expectedArtifacts(pkgDir, fileRels = null) {
  const rels = new Set()
  const srcRels = fileRels
    ? fileRels.filter((r) => r.startsWith('src/')).map((r) => r.slice(4))
    : listFilesRecursive(join(pkgDir, 'src')).map((f) => f.rel)
  for (const rel of srcRels) {
    for (const a of expectedArtifactRels(rel)) rels.add(a)
  }
  return [...rels].sort()
}

/** 逐产物 hash(缺失记 null);(mtime,size) 未变的产物复用旧 hash,避免每次全量读 dist。 */
export function artifactHashes(pkgDir, rels, prevArtifacts = null) {
  const prev = new Map((prevArtifacts || []).map((a) => [a.rel, a]))
  const out = []
  for (const rel of rels) {
    const abs = join(pkgDir, 'dist', rel)
    let mtimeMs = -1
    let size = -1
    try {
      const st = statSync(abs)
      mtimeMs = st.mtimeMs
      size = st.size
    } catch {
      /* 缺失 */
    }
    const old = prev.get(rel)
    const reusable =
      old &&
      typeof old.hash === 'string' &&
      old.mtimeMs === mtimeMs &&
      old.size === size &&
      mtimeMs >= 0
    out.push({ rel, hash: reusable ? old.hash : sha256File(abs), mtimeMs, size })
  }
  return out
}

export function readManifest(root, name) {
  try {
    const m = JSON.parse(readFileSync(manifestPath(root, name), 'utf8'))
    if (m?.schema !== 1 || typeof m.sourceHash !== 'string' || !Array.isArray(m.artifacts)) return null
    return m
  } catch {
    return null
  }
}

/**
 * 内容是否与上次成功构建时一致。
 * 三条全真才算"内容新鲜"(缺一条就退回 mtime 判据):
 *   1) manifest 存在且 schema 可读;
 *   2) 源码指纹一致(文件集合 + 每个文件内容);
 *   3) 应有产物集合与 manifest 记录一致,且逐个 sha256 对得上。
 * @returns {{fresh:boolean, reason:string, fingerprint?:string, artifacts?:number}}
 */
export function checkContentFresh(root, entry) {
  const manifest = readManifest(root, entry.name)
  if (!manifest) return { fresh: false, reason: '无 manifest(首次/旧缓存)' }
  const fp = sourceFingerprint(entry.dir, loadMemo(root, entry.name))
  if (fp.recomputed > 0) saveMemo(root, entry.name, fp.nextFiles)
  if (fp.hash !== manifest.sourceHash) {
    return { fresh: false, reason: `源码内容已变(${manifest.sourceHash.slice(0, 12)} → ${fp.hash.slice(0, 12)})`, fingerprint: fp.hash }
  }
  const expected = expectedArtifacts(entry.dir, fp.rels)
  if (expected.length === 0) return { fresh: false, reason: 'src 无可编译产物(退回 mtime 判据)' }
  const recorded = new Map(manifest.artifacts.map((a) => [a.rel, a.hash]))
  if (recorded.size !== expected.length) {
    return { fresh: false, reason: `产物集合变化(${recorded.size} → ${expected.length})`, fingerprint: fp.hash }
  }
  const now = artifactHashes(entry.dir, expected, manifest.artifacts)
  const bad = now.filter((a) => !recorded.has(a.rel) || recorded.get(a.rel) !== a.hash)
  if (bad.length > 0) {
    return { fresh: false, reason: `${bad.length}/${expected.length} 个产物内容与 manifest 不符`, fingerprint: fp.hash }
  }
  return { fresh: true, reason: `${expected.length} 个产物内容一致`, fingerprint: fp.hash, artifacts: expected.length }
}

/** 构建成功后落 manifest(只记应有产物,全部读得到 hash 才写)。 */
export function writeManifest(root, entry) {
  const dir = manifestDir(root)
  mkdirSync(dir, { recursive: true })
  const fp = sourceFingerprint(entry.dir, loadMemo(root, entry.name))
  if (fp.recomputed > 0) saveMemo(root, entry.name, fp.nextFiles)
  const expected = expectedArtifacts(entry.dir, fp.rels)
  const artifacts = artifactHashes(entry.dir, expected, readManifest(root, entry.name)?.artifacts)
  if (artifacts.some((a) => a.hash === null)) return { ok: false, reason: '产物缺失,manifest 不落盘' }
  const payload = {
    schema: 1,
    package: entry.name,
    sourceHash: fp.hash,
    artifactMode: 'per-artifact-sha256',
    artifacts,
    writtenAt: new Date().toISOString(),
  }
  writeFileSync(manifestPath(root, entry.name), JSON.stringify(payload, null, 2))
  return { ok: true, artifacts: artifacts.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

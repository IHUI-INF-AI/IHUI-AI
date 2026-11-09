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
import {
  normalizePath,
  readPackageBuildConfig,
  rootIdentity,
} from './buildinfo-isolation.mjs'

/** 指纹/产物 hash 的缓存根(本机构建缓存,不入库)。 */
export function manifestDir(root) {
  return join(root, 'node_modules', '.cache', 'dist-manifest')
}

/**
 * 构建身份(2026-11-08 立):缓存条目必须绑定**同一套构建面**。
 * 多 worktree 共享主区 `node_modules` 时,缓存文件物理上是同一份;
 * 若键里不带这三个量,"在 A 根构建成功"的 manifest 会被 B 根当成自己的,
 * 于是 B 根本该重建却被跳过(假绿),或反之被判不新鲜后又被共享 buildinfo 吞成 no-op(假红)。
 *
 * 三项任一不同即视为**不同缓存条目**(键不同),不许跨根复用:
 *   - root:构建根的真实路径(realpath,win32 归一大小写);
 *   - outDir:产物输出根(tsconfig 的 outDir,未声明时按 dist/);
 *   - tsBuildInfoFile:tsconfig 声明的增量缓存实际路径(未声明时按默认落点)。
 */
export function buildIdentity(root, entry) {
  const cfg = entry?.dir ? readPackageBuildConfig(entry.dir) : null
  const outDir = cfg?.outDir || (entry?.dir ? join(entry.dir, 'dist') : '(unknown-outDir)')
  const tsBuildInfoFile =
    cfg?.tsBuildInfoFile || (entry?.dir ? join(entry.dir, 'tsconfig.tsbuildinfo') : '(unknown-buildinfo)')
  return {
    root: rootIdentity(root),
    outDir: normalizePath(outDir),
    tsBuildInfoFile: normalizePath(tsBuildInfoFile),
  }
}

/** 构建身份指纹(入缓存键;12 位足够区分本机根数)。 */
export function identityHash(identity) {
  return createHash('sha1')
    .update(JSON.stringify([identity.root, identity.outDir, identity.tsBuildInfoFile]))
    .digest('hex')
    .slice(0, 12)
}

function sha256File(abs) {
  try {
    return createHash('sha256').update(readFileSync(abs)).digest('hex')
  } catch {
    return null
  }
}

function safeKey(name, identity) {
  const h = createHash('sha1').update(String(name)).digest('hex').slice(0, 10)
  return `${String(name).replace(/[^a-zA-Z0-9._-]+/g, '_')}-${h}-${identityHash(identity)}.json`
}

/**
 * manifest 路径。`entry` 必传(生产/夹具一律传):它决定 outDir 与 tsBuildInfoFile,
 * 这两个量必须进键 —— 缺 entry 时退化为"仅按根分桶",不会与带 entry 的键混用。
 */
export function manifestPath(root, name, entry) {
  return join(manifestDir(root), safeKey(name, buildIdentity(root, entry)))
}

function memoPath(root, name, entry) {
  return join(
    manifestDir(root),
    `${safeKey(name, buildIdentity(root, entry)).replace(/\.json$/, '')}.memo.json`,
  )
}

function loadMemo(root, name, entry) {
  try {
    const m = JSON.parse(readFileSync(memoPath(root, name, entry), 'utf8'))
    if (m?.schema === 1 && m.files && typeof m.files === 'object') return m.files
  } catch {
    /* 无 memo:全量算一次 */
  }
  return null
}

function saveMemo(root, name, entry, files) {
  try {
    const target = memoPath(root, name, entry)
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

export function readManifest(root, name, entry) {
  try {
    const m = JSON.parse(readFileSync(manifestPath(root, name, entry), 'utf8'))
    if (m?.schema !== 2 || typeof m.sourceHash !== 'string' || !Array.isArray(m.artifacts)) return null
    return m
  } catch {
    return null
  }
}

/**
 * 内容是否与上次成功构建时一致。
 * 四条全真才算"内容新鲜"(缺一条就退回 mtime 判据):
 *   1) manifest 存在且 schema 可读(2026-11-08 起 schema=2);
 *   2) manifest 记录的构建身份与本次一致(root/outDir/tsBuildInfoFile);
 *   3) 源码指纹一致(文件集合 + 每个文件内容);
 *   4) 应有产物集合与 manifest 记录一致,且逐个 sha256 对得上。
 * @returns {{fresh:boolean, reason:string, fingerprint?:string, artifacts?:number}}
 */
export function checkContentFresh(root, entry) {
  const manifest = readManifest(root, entry.name, entry)
  if (!manifest) return { fresh: false, reason: '无 manifest(首次/旧缓存/构建身份不同)' }
  const identity = buildIdentity(root, entry)
  const recorded = manifest.buildIdentity
  if (
    !recorded ||
    recorded.root !== identity.root ||
    recorded.outDir !== identity.outDir ||
    recorded.tsBuildInfoFile !== identity.tsBuildInfoFile
  ) {
    // 键已按身份分桶,走到这里说明 manifest 被搬运/篡改:拒绝复用并点名两套构建面。
    return {
      fresh: false,
      reason:
        `构建身份不符(不复用):manifest root=${recorded?.root ?? '(缺失)'} outDir=${recorded?.outDir ?? '(缺失)'} ` +
        `tsBuildInfoFile=${recorded?.tsBuildInfoFile ?? '(缺失)'};本根 root=${identity.root} ` +
        `outDir=${identity.outDir} tsBuildInfoFile=${identity.tsBuildInfoFile}`,
    }
  }
  const fp = sourceFingerprint(entry.dir, loadMemo(root, entry.name, entry))
  if (fp.recomputed > 0) saveMemo(root, entry.name, entry, fp.nextFiles)
  if (fp.hash !== manifest.sourceHash) {
    return { fresh: false, reason: `源码内容已变(${manifest.sourceHash.slice(0, 12)} → ${fp.hash.slice(0, 12)})`, fingerprint: fp.hash }
  }
  const expected = expectedArtifacts(entry.dir, fp.rels)
  if (expected.length === 0) return { fresh: false, reason: 'src 无可编译产物(退回 mtime 判据)' }
  const recordedArtifacts = new Map(manifest.artifacts.map((a) => [a.rel, a.hash]))
  if (recordedArtifacts.size !== expected.length) {
    return { fresh: false, reason: `产物集合变化(${recordedArtifacts.size} → ${expected.length})`, fingerprint: fp.hash }
  }
  const now = artifactHashes(entry.dir, expected, manifest.artifacts)
  const bad = now.filter((a) => !recordedArtifacts.has(a.rel) || recordedArtifacts.get(a.rel) !== a.hash)
  if (bad.length > 0) {
    return { fresh: false, reason: `${bad.length}/${expected.length} 个产物内容与 manifest 不符`, fingerprint: fp.hash }
  }
  return { fresh: true, reason: `${expected.length} 个产物内容一致`, fingerprint: fp.hash, artifacts: expected.length }
}

/** 构建成功后落 manifest(只记应有产物,全部读得到 hash 才写)。 */
export function writeManifest(root, entry) {
  const dir = manifestDir(root)
  mkdirSync(dir, { recursive: true })
  const fp = sourceFingerprint(entry.dir, loadMemo(root, entry.name, entry))
  if (fp.recomputed > 0) saveMemo(root, entry.name, entry, fp.nextFiles)
  const expected = expectedArtifacts(entry.dir, fp.rels)
  const artifacts = artifactHashes(entry.dir, expected, readManifest(root, entry.name, entry)?.artifacts)
  if (artifacts.some((a) => a.hash === null)) return { ok: false, reason: '产物缺失,manifest 不落盘' }
  const identity = buildIdentity(root, entry)
  const payload = {
    schema: 2,
    package: entry.name,
    buildIdentity: identity,
    sourceHash: fp.hash,
    artifactMode: 'per-artifact-sha256',
    artifacts,
    writtenAt: new Date().toISOString(),
  }
  writeFileSync(manifestPath(root, entry.name, entry), JSON.stringify(payload, null, 2))
  return { ok: true, artifacts: artifacts.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

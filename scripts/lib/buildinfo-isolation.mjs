// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 构建根身份 / tsbuildinfo 按根隔离(2026-11-08 立)。
 *
 * 病根(实测,见 scripts/tests/typecheck-buildinfo-root.test.mjs 的 E1):
 *   本仓 tsconfig 把 `tsBuildInfoFile` 指向 `<root>/node_modules/.cache/tsbuildinfo/*.tsbuildinfo`;
 *   多 worktree 并行时 `node_modules` 是**主区 junction**,于是每个 worktree 的逻辑路径不同、
 *   **物理文件却是同一份**。TypeScript 的 buildinfo 里 `fileNames/outDir/rootDir` 都是相对
 *   buildinfo 文件目录的路径,读回时按**当前根**重新解析 —— 源码内容一致时 tsc 认为
 *   "程序没变、产物已写出",直接跳过 emit。实测:在另一根 `rimraf dist` 后跑 tsc,
 *   rc=0 而 dist 一个产物都没有。门于是报 `复扫 122 NOT-OK`,但没有任何 `error TS`。
 *
 * 修法:
 *   1) `rootIdentity()` 给出规范化的根身份(realpath + win32 大小写归一);
 *   2) `inspectBuildInfo()` 判定 buildinfo 是否**跨根**(物理落点不在本根 / 记录的 outDir、
 *      rootDir 按本根解析后不等于本包期望值),并把证据(实际路径、记录值、期望值)一起带回;
 *   3) `isolateBuildInfoForRebuild()` 在"门已经决定要重建该包"之前把 buildinfo
 *      **移出共享面**(隔离到 os.tmpdir 下按根分桶),让 tsc 必须真的 emit。
 *      隔离(rename)而不是静默删除:原文件保留在按根分桶的隔离目录,日志给出原路径。
 *
 * 注意:本模块不判"该不该重建"——那是 stale-dist / dist-content-cache 的判据。
 * 本模块只保证"一旦决定重建,这次构建不会被不可信的 buildinfo 吞成 no-op"。
 */

import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { stripJsonComments } from './import-graph.mjs'

/** tsconfig 解析(注释/尾逗号合法);坏配置返回 null,由调用方按"无 buildinfo 可管"回落。 */
export function parseTsconfigJson(raw) {
  try {
    return JSON.parse(stripJsonComments(raw).replace(/,(\s*[}\]])/g, '$1'))
  } catch {
    return null
  }
}

/** Windows 路径大小写不敏感:比较前统一小写;其余平台保持原样。 */
export function normalizePath(p) {
  if (!p) return p
  const s = String(p).replace(/\\/g, '/')
  return process.platform === 'win32' ? s.toLowerCase() : s
}

/**
 * 根身份:优先 realpath(把 junction/符号链接解析掉),失败回落 resolve。
 * 两条不同物理根(主区 / worktree)必须得到不同身份 ⇒ 缓存键天然分桶。
 */
export function rootIdentity(root) {
  let abs = resolve(root)
  try {
    abs = realpathSync.native(abs)
  } catch {
    /* 根尚不存在:用 resolve 即可 */
  }
  return normalizePath(abs)
}

/** 根身份短哈希(用于缓存/隔离目录分桶,避免把整条绝对路径塞进文件名)。 */
export function rootKey(root) {
  return createHash('sha1').update(rootIdentity(root)).digest('hex').slice(0, 12)
}

/** 包名 → 安全文件名。 */
export function safeName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, '_')
}

/**
 * 读包的 tsconfig,解析出**实际生效的** tsBuildInfoFile / outDir / rootDir(绝对路径)。
 * 本仓 18 处声明都在包自身 tsconfig 里(不在 extends 的 base),解析一层即可;
 * 未声明时按 TypeScript 默认落点(有 outDir 时 <outDir>/tsconfig.tsbuildinfo,否则包根)。
 * @returns {{tsconfigPath:string, tsBuildInfoFile:string, outDir:string|null, rootDir:string|null}|null}
 */
export function readPackageBuildConfig(pkgDir) {
  const tsconfigPath = join(pkgDir, 'tsconfig.json')
  let raw
  try {
    raw = readFileSync(tsconfigPath, 'utf8')
  } catch {
    return null
  }
  const json = parseTsconfigJson(raw)
  if (!json || typeof json !== 'object') return null
  const co = json.compilerOptions && typeof json.compilerOptions === 'object' ? json.compilerOptions : {}
  const outDir = typeof co.outDir === 'string' ? resolve(pkgDir, co.outDir) : null
  const rootDir = typeof co.rootDir === 'string' ? resolve(pkgDir, co.rootDir) : null
  const tsBuildInfoFile =
    typeof co.tsBuildInfoFile === 'string'
      ? resolve(pkgDir, co.tsBuildInfoFile)
      : join(outDir || pkgDir, 'tsconfig.tsbuildinfo')
  return { tsconfigPath, tsBuildInfoFile, outDir, rootDir }
}

/**
 * buildinfo 体检(只读)。
 * @returns {{
 *   available:boolean, tsconfigPath?:string, tsBuildInfoFile?:string,
 *   exists:boolean, physicalPath?:string, size?:number, mtimeMs?:number,
 *   expectedOutDir:string|null, expectedRootDir:string|null,
 *   recordedOutDir:string|null, recordedRootDir:string|null,
 *   outsideRoot:boolean, outDirMismatch:boolean, rootDirMismatch:boolean,
 *   foreign:boolean, reason:string
 * }}
 */
export function inspectBuildInfo({ root, pkgDir }) {
  const cfg = readPackageBuildConfig(pkgDir)
  if (!cfg) {
    return {
      available: false,
      exists: false,
      expectedOutDir: join(pkgDir, 'dist'),
      expectedRootDir: join(pkgDir, 'src'),
      recordedOutDir: null,
      recordedRootDir: null,
      outsideRoot: false,
      outDirMismatch: false,
      rootDirMismatch: false,
      foreign: false,
      reason: '包内无可用 tsconfig.json(不接管 buildinfo)',
    }
  }
  const expectedOutDir = cfg.outDir || join(pkgDir, 'dist')
  const expectedRootDir = cfg.rootDir
  const info = {
    available: true,
    tsconfigPath: cfg.tsconfigPath,
    tsBuildInfoFile: cfg.tsBuildInfoFile,
    exists: existsSync(cfg.tsBuildInfoFile),
    physicalPath: null,
    size: -1,
    mtimeMs: -1,
    expectedOutDir,
    expectedRootDir,
    recordedOutDir: null,
    recordedRootDir: null,
    outsideRoot: false,
    outDirMismatch: false,
    rootDirMismatch: false,
    foreign: false,
    reason: '',
  }
  if (!info.exists) {
    info.reason = 'buildinfo 不存在(本次构建自然全量 emit)'
    return info
  }
  try {
    const st = statSync(cfg.tsBuildInfoFile)
    info.size = st.size
    info.mtimeMs = st.mtimeMs
    info.physicalPath = realpathSync.native(cfg.tsBuildInfoFile)
  } catch {
    /* 竞态:保持未知,下方按"读不到就当作不可信"处理 */
  }
  // 跨根证据①:物理落点不在本根下(node_modules junction ⇒ worktree 的 buildinfo 实际住在主区)。
  if (info.physicalPath) {
    const logicalRoot = rootIdentity(root)
    const physical = normalizePath(info.physicalPath)
    info.outsideRoot = !physical.startsWith(`${logicalRoot}/`)
  }
  // 跨根证据②:buildinfo 里记录的 outDir/rootDir 按**本根**解析后不等于本包期望值。
  try {
    const parsed = JSON.parse(readFileSync(cfg.tsBuildInfoFile, 'utf8'))
    const base = dirname(cfg.tsBuildInfoFile)
    if (typeof parsed?.options?.outDir === 'string') {
      info.recordedOutDir = resolve(base, parsed.options.outDir)
      info.outDirMismatch = normalizePath(info.recordedOutDir) !== normalizePath(expectedOutDir)
    }
    if (typeof parsed?.options?.rootDir === 'string') {
      info.recordedRootDir = resolve(base, parsed.options.rootDir)
      info.rootDirMismatch =
        !expectedRootDir ||
        normalizePath(info.recordedRootDir) !== normalizePath(expectedRootDir)
    }
  } catch {
    // 读坏/半份 buildinfo 同样不可信(§0.3:取不到输入面就不许当它可信)。
    info.outDirMismatch = true
  }
  const flags = []
  if (info.outsideRoot) flags.push(`物理路径不在本根(${info.physicalPath})`)
  if (info.outDirMismatch) flags.push(`记录 outDir=${info.recordedOutDir ?? '(读坏)'} ≠ 期望 ${expectedOutDir}`)
  if (info.rootDirMismatch) flags.push(`记录 rootDir=${info.recordedRootDir ?? '(读坏)'} ≠ 期望 ${expectedRootDir ?? '(未声明)'}`)
  info.foreign = flags.length > 0
  info.reason = info.foreign ? flags.join(';') : 'buildinfo 与本根一致(仍需按重建判据决定是否隔离)'
  return info
}

/** 隔离落点:os.tmpdir 下按根分桶 + 包名,避免污染仓库工作树。 */
export function quarantineTarget(root, name) {
  return join(tmpdir(), 'ihui-tsbuildinfo-quarantine', rootKey(root), `${safeName(name)}.tsbuildinfo`)
}

/**
 * 在一次"已判定要重建"的构建之前,把 tsbuildinfo 移出共享面。
 *
 * 为什么不是"只在跨根时才动":实测(同根)删掉 dist 后 tsc 同样会因 buildinfo 认为
 * "输入未变、产物已写出"而 no-op —— 不可信的判据是"buildinfo 声称的产物状态"本身。
 * 既然门已经决定重建,就不允许任何 buildinfo 把这次重建吞成 no-op。
 *
 * @returns {{inspected:object, movedTo:string|null, ok:boolean, error?:string}}
 *   ok=false 表示隔离失败(不能静默继续:那样构建可能再次 no-op,门会把它误报成产物缺失)。
 */
export function isolateBuildInfoForRebuild({ root, pkgDir, name, log = () => {} }) {
  const inspected = inspectBuildInfo({ root, pkgDir })
  if (!inspected.available) return { inspected, movedTo: null, ok: true }
  if (!inspected.exists) {
    log(`[typecheck:full]   · ${name} 无 buildinfo(本次构建走全量 emit)`)
    return { inspected, movedTo: null, ok: true }
  }
  if (inspected.foreign) {
    log(
      `[typecheck:full]   ⚠ ${name} 的 tsbuildinfo 跨根/不可信:${inspected.tsBuildInfoFile}` +
        ` — ${inspected.reason}`,
    )
  }
  const target = quarantineTarget(root, name)
  try {
    mkdirSync(dirname(target), { recursive: true })
    if (existsSync(target)) unlinkSync(target)
    renameSync(inspected.tsBuildInfoFile, target)
  } catch (e) {
    // rename 跨盘/被占用时降级为 copy+unlink;仍失败则如实报错(由调用方判"未判定")。
    try {
      copyFileSync(inspected.tsBuildInfoFile, target)
      unlinkSync(inspected.tsBuildInfoFile)
    } catch (e2) {
      return {
        inspected,
        movedTo: null,
        ok: false,
        error: `隔离 tsbuildinfo 失败:${inspected.tsBuildInfoFile} → ${target}:${e2?.message ?? e?.message ?? e}`,
      }
    }
  }
  log(
    `[typecheck:full]   · ${name} 已隔离 tsbuildinfo(强制 emit):` +
      `${inspected.tsBuildInfoFile} → ${target}(${inspected.size} 字节)`,
  )
  return { inspected, movedTo: target, ok: true }
}

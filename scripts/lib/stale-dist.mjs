// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 陈旧 dist 判定与重建复核(2026-11-07 从 typecheck-full.mjs 拆出,只为可被夹具直接审)。
 *
 * 病根(实测,不是推测):旧判据 `srcNewestMtimeMs > distNewestMtimeMs` 只看**整包最新**的
 * 那个 dist 文件。本仓 `tsconfig.base.json` 开 `incremental + composite`,一次增量构建只重写
 * **内容变了的那几个产物**;于是只要 dist 里有一个新文件(如 embed-types 重写的
 * `ihui-types.d.ts`,或另一个产物刚被重建),整包 mtime 就被拉新 ⇒ 真正陈旧的
 * `notification.d.ts` 永远不会被判陈旧、永远不会被重建。实测主仓 2026-11-07:
 * `@ihui/shared` dist 最早文件 11-06 02:33、最新文件 11-07 20:30,跨度 42 小时 ——
 * 整包最新 mtime 对"哪个产物过期"结构上失明。
 *
 * 判据改成**逐产物对账**:`src/foo.ts` 对应 `dist/foo.js` / `dist/foo.d.ts`
 * (`.mts`→`.mjs/.d.mts`、`.cts`→`.cjs/.d.cts`),只比较**该产物与它自己那份源码**的 mtime。
 * 不外推、不看整包:一个产物新不能替另一个产物担保。
 *
 * 重建后必须复核:每个被判陈旧的产物,重建后 mtime 必须前进或内容 hash 必须变化;
 * 两者都没变 ⇒ 未判定(不许静音、不许把阈值放宽成"rc=0 就算了")。
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'

/** 与 typecheck-full 同口径:依赖/缓存目录不参与 mtime 与产物枚举。 */
export const EXCLUDE_DIRS = new Set([
  '.git',
  '.next',
  '.pnpm-cache',
  '.pnpm-store',
  '.ihui-agent',
  '.turbo',
  '.worktrees',
  'node_modules',
])

/** 递归列出目录内文件(相对 dir 的 `/` 路径 + mtime)。目录不存在/读不到返回 []。 */
export function listFilesRecursive(dir) {
  const out = []
  if (!existsSync(dir)) return out
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()
    let entries = []
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = join(cur, ent.name)
      if (ent.isDirectory()) {
        if (!EXCLUDE_DIRS.has(ent.name)) stack.push(full)
        continue
      }
      try {
        out.push({
          abs: full,
          rel: relative(dir, full).replace(/\\/g, '/'),
          mtimeMs: statSync(full).mtimeMs,
          size: statSync(full).size,
        })
      } catch {
        /* 竞态删除:跳过 */
      }
    }
  }
  return out
}

/** 递归取目录内文件的最新 mtime(仅用于报告"整包 mtime 被拉新"这一维);目录不存在返回 -1。 */
export function newestMtimeMs(dir) {
  let out = -1
  for (const f of listFilesRecursive(dir)) if (f.mtimeMs > out) out = f.mtimeMs
  return out
}

/**
 * 一份源码可能的编译产物(相对 src/ 的路径)。
 * `.d.ts/.d.mts/.d.cts` 是手写声明输入,**不产出**,返回 [] —— 否则 design-tokens 的
 * `src/*.d.ts` 会被永久判成"缺产物"。
 */
export function expectedArtifactRels(srcRel) {
  if (/\.d\.(ts|mts|cts)$/i.test(srcRel)) return []
  const m = /\.(ts|tsx|mts|cts)$/i.exec(srcRel)
  if (!m) return []
  const stem = srcRel.slice(0, -m[0].length)
  if (m[1] === 'mts') return [`${stem}.mjs`, `${stem}.d.mts`]
  if (m[1] === 'cts') return [`${stem}.cjs`, `${stem}.d.cts`]
  return [`${stem}.js`, `${stem}.d.ts`]
}

/** 收集单个包的判据输入(纯 IO;判定在 pickStalePackages 里)。 */
export function collectPackageState(pkgDir, name) {
  const srcDir = join(pkgDir, 'src')
  const distDir = join(pkgDir, 'dist')
  const srcFiles = listFilesRecursive(srcDir)
  const distFiles = listFilesRecursive(distDir)
  const srcNewestMtimeMs = srcFiles.reduce((a, f) => (f.mtimeMs > a ? f.mtimeMs : a), -1)
  const distNewestMtimeMs = distFiles.reduce((a, f) => (f.mtimeMs > a ? f.mtimeMs : a), -1)

  // 产物 → 它那份源码。同名产物取 mtime 最新的 src(理论上 .ts/.tsx 同 stem 才会撞,极少)。
  const srcByArtifact = new Map()
  for (const s of srcFiles) {
    for (const rel of expectedArtifactRels(s.rel)) {
      const prev = srcByArtifact.get(rel)
      if (!prev || s.mtimeMs > prev.mtimeMs) srcByArtifact.set(rel, s)
    }
  }
  const staleArtifacts = []
  for (const d of distFiles) {
    const s = srcByArtifact.get(d.rel)
    if (s && d.mtimeMs < s.mtimeMs) {
      staleArtifacts.push({
        artifact: d.rel,
        src: s.rel,
        artifactMtimeMs: d.mtimeMs,
        srcMtimeMs: s.mtimeMs,
      })
    }
  }
  // 2026-11-07(T1 提速):原有实现只看 dist 里**已存在**的文件,`src` 新增文件对应的产物
  // 整个缺失时不会被判陈旧(只有 dist 整目录缺失才命中)。这里补上"应有产物缺失"这一型:
  // 消费者按 exports.types 解析,少一个产物就是不可信,必须重建成 fail-closed。
  const distRelSet = new Set(distFiles.map((d) => d.rel))
  for (const [rel, s] of srcByArtifact) {
    if (!distRelSet.has(rel)) {
      staleArtifacts.push({
        artifact: rel,
        src: s.rel,
        artifactMtimeMs: -1,
        srcMtimeMs: s.mtimeMs,
        missing: true,
      })
    }
  }
  staleArtifacts.sort((a, b) => a.artifact.localeCompare(b.artifact))
  return {
    name,
    dir: pkgDir,
    distMissing: !existsSync(distDir),
    srcNewestMtimeMs,
    distNewestMtimeMs,
    srcFileCount: srcFiles.length,
    distFileCount: distFiles.length,
    artifactCount: distFiles.filter((d) => srcByArtifact.has(d.rel)).length,
    staleArtifacts,
  }
}

/** 扫 packages/ 构造判据输入。只收有 src 的包;"有没有 build 脚本"由调用方决定射程。 */
export function collectPackageStates(packagesDir) {
  const out = []
  let dirs = []
  try {
    dirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return out
  }
  for (const name of dirs) {
    const pkgDir = join(packagesDir, name)
    let manifest
    try {
      manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    if (!existsSync(join(pkgDir, 'src'))) continue
    const state = collectPackageState(pkgDir, manifest.name || name)
    state.hasBuildScript = !!manifest.scripts?.build
    out.push(state)
  }
  return out
}

/**
 * 判陈旧(逐产物)。`dist` 缺目录 / 0 个文件同样算陈旧(消费者按 exports.types 解析必失败)。
 * 注意:这里**不再**看 `srcNewestMtimeMs > distNewestMtimeMs` —— 那条正是本票的病根。
 */
export function pickStalePackages(entries) {
  return entries
    .filter(
      (e) =>
        e.hasBuildScript && (e.distMissing || e.distFileCount === 0 || e.staleArtifacts.length > 0),
    )
    .map((e) => e.name)
    .sort()
}

/** 旧判据的逐字快照(**只用于自证"旧实现跑同一夹具会漏判"**,生产路径不得调用)。 */
export function legacyPickStalePackages(entries) {
  return entries
    .filter((e) => e.hasBuildScript && (e.distMissing || e.srcNewestMtimeMs > e.distNewestMtimeMs))
    .map((e) => e.name)
    .sort()
}

function sha256(abs) {
  try {
    return createHash('sha256').update(readFileSync(abs)).digest('hex')
  } catch {
    return null
  }
}

/** 重建前快照:每个目标产物的 mtime/size/内容 hash(只对判陈旧的那些产物,数量有界)。 */
export function captureArtifactSnapshot(pkgDir, state) {
  const snap = []
  for (const a of state.staleArtifacts) {
    const abs = join(pkgDir, 'dist', a.artifact)
    let mtimeMs = -1
    let size = -1
    let hash = null
    try {
      const st = statSync(abs)
      mtimeMs = st.mtimeMs
      size = st.size
      hash = sha256(abs)
    } catch {
      /* 已被删:按"未存在"记录,复核时判未刷新 */
    }
    snap.push({ ...a, beforeMtimeMs: mtimeMs, beforeSize: size, beforeHash: hash })
  }
  return snap
}

/**
 * 重建后复核。判"已刷新"必须满足其一:
 *   - mtime 前进(`afterMtimeMs > beforeMtimeMs`),或
 *   - 内容 hash 变化(before/after 都取得到且不同)。
 * 两者都没变(含"文件消失")⇒ unverified,调用方必须按未判定处理。
 */
export function verifyArtifactSnapshot(pkgDir, snap) {
  const rows = []
  for (const r of snap) {
    const abs = join(pkgDir, 'dist', r.artifact)
    let afterMtimeMs = -1
    let afterHash = null
    try {
      afterMtimeMs = statSync(abs).mtimeMs
      afterHash = sha256(abs)
    } catch {
      /* 文件不存在:保持 -1/null */
    }
    const mtimeAdvanced = afterMtimeMs > r.beforeMtimeMs
    const contentChanged =
      typeof r.beforeHash === 'string' &&
      typeof afterHash === 'string' &&
      r.beforeHash !== afterHash
    rows.push({
      artifact: r.artifact,
      src: r.src,
      beforeMtimeMs: r.beforeMtimeMs,
      afterMtimeMs,
      mtimeAdvanced,
      contentChanged,
      refreshed: mtimeAdvanced || contentChanged,
    })
  }
  return rows
}

/** mtime → ISO(无效值给可读占位)。 */
export function fmtMtime(ms) {
  return ms > 0 ? new Date(ms).toISOString() : '(不存在)'
}

/**
 * 重建结果的**唯一判据**(2026-11-08 从 typecheck-full 内联表达式拆出,只为可被夹具直接审)。
 * 关键:rc=0 **不等于**成功 —— tsc 在同源增量 buildinfo 下会 rc=0 且一个产物都不写
 * (见 lib/buildinfo-isolation.mjs 头注)。因此仍要求:
 *   - dist 目录存在且非空;
 *   - 复扫逐产物零陈旧(`staleArtifacts.length === 0`);
 *   - 重建前快照的每个目标产物 mtime 前进或内容 hash 变化(或被内容面 sha256 复核背书)。
 * 三者缺一即 NOT-OK,调用方必须判红/未判定,不得因 rc=0 放行。
 * @returns {{ok:boolean, missingAfter:boolean, postFresh:boolean}}
 */
export function judgeRebuildOutcome({ rc, after, unverifiedCount = 0, contentOk = false }) {
  const missingAfter = after.distMissing || after.distFileCount === 0
  const postFresh =
    !missingAfter && after.artifactCount > 0 && after.staleArtifacts.length === 0
  const ok =
    rc === 0 && !missingAfter && ((unverifiedCount === 0 && postFresh) || contentOk)
  return { ok, missingAfter, postFresh }
}

/**
 * 把"复扫 N 个陈旧产物"落成**可排查的路径点名**:给出总数 + 前 N 个的绝对路径与原因。
 * 只有数字的错误信息(如"复扫 122 NOT-OK")排查成本极高 —— 不知道缺的是哪些产物、
 * 是缺失还是过期,也就不知道是哪套构建根/产物输出串了。
 * @returns {{count:number, missing:number, outdated:number, sample:string[], text:string}}
 */
export function describeMissingArtifacts(state, { limit = 12 } = {}) {
  const stale = Array.isArray(state?.staleArtifacts) ? state.staleArtifacts : []
  const missing = stale.filter((a) => a.missing || a.artifactMtimeMs === -1)
  const outdated = stale.filter((a) => !(a.missing || a.artifactMtimeMs === -1))
  const distDir = join(state.dir, 'dist')
  const sample = stale.slice(0, Math.max(0, limit)).map((a) => join(distDir, a.artifact))
  const lines = []
  lines.push(`产物面复核:共 ${stale.length} 个陈旧(缺失 ${missing.length} / 过期 ${outdated.length}),dist=${distDir}`)
  for (const a of stale.slice(0, Math.max(0, limit))) {
    lines.push(
      a.missing || a.artifactMtimeMs === -1
        ? `  ✗ 缺失 ${join(distDir, a.artifact)}(源:${a.src})`
        : `  ✗ 过期 ${join(distDir, a.artifact)}(产物 ${fmtMtime(a.artifactMtimeMs)} < 源 ${fmtMtime(a.srcMtimeMs)})`,
    )
  }
  if (stale.length > limit) lines.push(`  … 其余 ${stale.length - limit} 个省略(总数已给出)`)
  return { count: stale.length, missing: missing.length, outdated: outdated.length, sample, text: lines.join('\n') }
}


/**
 * 重建被判陈旧的包,逐包打印 **包名 + rc + 重建前后 mtime + 复核结果**。
 * `buildPackage(name)` 必须返回 `{ status, signal? }` —— 生产侧是 spawnSync(`pnpm --filter ... build`)。
 * 返回 `{ results, exitCode }`;exitCode 非 0 时由调用方决定措辞后退出(本模块不 process.exit)。
 */
export function rebuildStalePackages({ entries, staleNames, buildPackage, log = console.log }) {
  const results = []
  for (const name of staleNames) {
    const state = entries.find((e) => e.name === name)
    if (!state) continue
    const snap = captureArtifactSnapshot(state.dir, state)
    log(
      `[typecheck:full] 重建 ${name}: 目标产物 ${snap.length} 个,重建前整包最新 mtime ${fmtMtime(state.distNewestMtimeMs)}`,
    )
    for (const s of snap) {
      log(
        `[typecheck:full]   · ${s.artifact} ${fmtMtime(s.artifactMtimeMs)} < src/${s.src} ${fmtMtime(s.srcMtimeMs)}`,
      )
    }
    const built = buildPackage(name)
    const after = collectPackageState(state.dir, name)
    const verified = verifyArtifactSnapshot(state.dir, snap)
    const unverified = verified.filter((v) => !v.refreshed)
    const postFresh =
      !after.distMissing &&
      after.distFileCount > 0 &&
      after.artifactCount > 0 &&
      after.staleArtifacts.length === 0
    const ok = built.status === 0 && unverified.length === 0 && postFresh
    results.push({
      name,
      status: built.status,
      signal: built.signal ?? null,
      beforeMtimeMs: state.distNewestMtimeMs,
      afterMtimeMs: after.distNewestMtimeMs,
      staleBefore: snap.length,
      refreshed: verified.length - unverified.length,
      unverified,
      postStale: after.staleArtifacts.length,
      postFresh,
      ok,
    })
    log(
      `[typecheck:full] 重建 ${name}: rc=${built.status ?? '?'}${built.signal ? `(signal ${built.signal})` : ''}, ` +
        `整包最新 mtime ${fmtMtime(state.distNewestMtimeMs)} → ${fmtMtime(after.distNewestMtimeMs)}, ` +
        `复核 ${verified.length - unverified.length}/${verified.length} 个产物已刷新` +
        (unverified.length ? `,未刷新 ${unverified.length} 个` : '') +
        `;复扫仍有 ${after.staleArtifacts.length} 个陈旧产物`,
    )
    for (const v of unverified) {
      log(
        `[typecheck:full]   ✗ 未刷新 ${v.artifact}: mtime ${fmtMtime(v.beforeMtimeMs)} → ${fmtMtime(v.afterMtimeMs)}(内容未变)`,
      )
    }
    if (built.status !== 0) {
      return { results, exitCode: built.status ?? 1, failure: 'build' }
    }
    if (unverified.length > 0 || !postFresh) {
      return { results, exitCode: 2, failure: 'unverified' }
    }
  }
  return { results, exitCode: 0, failure: null }
}

/** 一条可读的逐包汇总(失败时调用方原样打印,避免只留"命中 N 个包")。 */
export function formatRebuildSummary(results) {
  return results
    .map(
      (r) =>
        `  - ${r.name}: rc=${r.status ?? '?'}, 陈旧产物 ${r.staleBefore} 个, 已刷新 ${r.refreshed} 个` +
        `${r.unverified.length ? `, 未刷新 ${r.unverified.length} 个` : ''}` +
        `, 重建后整包最新 mtime ${fmtMtime(r.afterMtimeMs)}, ${r.ok ? 'OK' : 'NOT-OK'}`,
    )
    .join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

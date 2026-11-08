// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 引用棘轮的两个**对象面适配器**。
 *
 * 为什么是"对象面"而不是 `--staged`：`reference-transaction` 的 prepared 阶段里，
 * HEAD 还指着**旧提交**、工作树也还停**旧树**（converge 是先 `commit-tree` 再
 * `update-ref`，工作树对齐在落地之后）。谁要是图省事在这里读 `git diff --cached`
 * 或盘上文件，判到的就是旧字节 —— 本文件存在的唯一理由就是挡住这个退路。
 *
 * 判据复用纪律：这两个适配器**不实现任何一条判据**。
 *  - 47p 直接派生 `scripts/watermark.mjs verify`（与 `watermarkPreflight` 同一个判定面），
 *    第三方排除面与工具生成物豁免面也用仓库现成的两份 lib，不另写一份"看起来差不多"的。
 *  - 193 直接调 `check-git-stdio-discipline.mjs` 的 `evaluate(root,'head',{rev})`，
 *    只是把输入面从 HEAD 换成 new OID；扫描、豁免、判红逻辑一行未改。
 *
 * 不在本批适配的门（90/217/298 等）**这次不跑**：不猜、不折成"通过"、也不冒红，更不新增门号；
 * 它们仍由各自的既有通道（push scope / guardian）负责，本钩子只补"main 落定"这一段的空档。
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createExclusionPredicate } from './third-party-roots.mjs'
import { judgeToolGenerated, loadToolGeneratedEntries } from './tool-generated-roots.mjs'
import { evaluate } from '../check-git-stdio-discipline.mjs'

const WATERMARK_CLI = fileURLToPath(new URL('../watermark.mjs', import.meta.url))
const GIT_TIMEOUT_MS = 20_000
const VERIFY_TIMEOUT_MS = 15_000

/** 唯一的 git 出口：显式 stdio（门 193 的判据就盯这个；本文件自己也要过那道门）。 */
function git(root, args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

function blobOid(root, rev, path) {
  const out = git(root, ['rev-parse', '--verify', `${rev}:${path}`], { allowFail: true })
  const oid = String(out ?? '').trim()
  return /^[0-9a-f]{40}$/.test(oid) ? oid : null
}

/**
 * 47p（水印覆盖）—— 对本次变更面的 **new blob** 跑 verify。
 * @returns {{findings: {path:string,blob:string|null}[], undetermined: {path?:string,reason:string,missing:string}[]}}
 */
export function adaptWatermark({ root, newOid, paths }) {
  const findings = []
  const undetermined = []
  if (!paths.length) return { findings, undetermined }

  let exclusion
  try {
    exclusion = createExclusionPredicate(root)
  } catch (e) {
    return {
      findings,
      undetermined: [
        {
          reason: '第三方排除面无法判定',
          missing: `createExclusionPredicate: ${String(e?.message ?? e).split('\n')[0]}`,
        },
      ],
    }
  }
  let toolEntries
  try {
    toolEntries = loadToolGeneratedEntries(root)
  } catch (e) {
    return {
      findings,
      undetermined: [
        {
          reason: '工具生成物豁免面无法判定',
          missing: `loadToolGeneratedEntries: ${String(e?.message ?? e).split('\n')[0]}`,
        },
      ],
    }
  }

  // ── 输入面：临时索引 ────────────────────────────────────────────────
  // `watermark.mjs verify` 只认 head/staged/worktree 三面，而这里要判的既不是 HEAD（旧树）
  // 也不是盘上（旧树）。做法是**只换输入面**：把本次变更的 new blob 装进一份临时索引
  // （GIT_INDEX_FILE，绝不碰仓库自己的索引），再让 verify 跑它的 `--staged` 档。
  // 判据、第三方排除、工具生成物豁免、输出格式全部原样复用 —— 我们不在这里判任何一条。
  const tree = new Map() // rel -> blob oid（一次 ls-tree，避免逐路径 rev-parse）
  try {
    const raw = git(root, ['ls-tree', '-r', '-z', newOid])
    for (const rec of String(raw).split('\0')) {
      if (!rec) continue
      const tab = rec.indexOf('\t')
      if (tab < 0) continue
      const meta = rec.slice(0, tab).split(' ')
      if (meta[1] !== 'blob') continue
      tree.set(rec.slice(tab + 1), meta[2])
    }
  } catch (e) {
    return {
      findings,
      undetermined: [
        { reason: '取不到 new OID 的树清单', missing: String(e?.message ?? e).split('\n')[0] },
      ],
    }
  }

  const targets = []
  for (const rel of paths) {
    if (exclusion.isExcluded(rel)) continue
    const oid = tree.get(rel) ?? blobOid(root, newOid, rel)
    if (!oid) {
      undetermined.push({ path: rel, reason: '取不到 new 侧 blob', missing: `${newOid}:${rel}` })
      continue
    }
    const text = git(root, ['cat-file', 'blob', oid], { allowFail: true })
    if (text === null) {
      undetermined.push({ path: rel, reason: 'blob 读取失败', missing: oid })
      continue
    }
    try {
      if (judgeToolGenerated({ rel, text, entries: toolEntries }).exempt) continue
    } catch (e) {
      undetermined.push({
        path: rel,
        reason: '工具生成物判定抛错',
        missing: String(e?.message ?? e).split('\n')[0],
      })
      continue
    }
    targets.push({ rel, oid })
  }
  if (!targets.length) return { findings, undetermined }

  const dir = mkdtempSync(join(tmpdir(), 'ihui-ref-ratchet-wm-'))
  const indexFile = join(dir, 'index')
  // watermark.mjs 的 ROOT 写死在**脚本自身位置**，且 verify 会 assertRepoRoot 拒绝跨仓。
  // 生产里钩子与被判仓同根；测试/共享钩子场景下必须用被判仓自己的 scripts 副本（测试用 junction）。
  const cli = existsSync(join(root, 'scripts', 'watermark.mjs'))
    ? join(root, 'scripts', 'watermark.mjs')
    : WATERMARK_CLI
  const env = { ...process.env, GIT_INDEX_FILE: indexFile }
  try {
    const prepared = spawnSync('git', ['read-tree', '--empty'], {
      cwd: root,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })
    if (prepared.error || prepared.status !== 0) {
      const why = String(prepared.stderr ?? prepared.error?.message ?? 'no exit status').trim()
      return {
        findings,
        undetermined: [{ reason: '构造临时索引失败(read-tree)', missing: why.split('\n')[0] }],
      }
    }
    const payload = targets.map((t) => `100644 ${t.oid}\t${t.rel}\0`).join('')
    const filled = spawnSync('git', ['update-index', '-z', '--index-info'], {
      cwd: root,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      input: payload,
      env,
    })
    if (filled.error || filled.status !== 0) {
      const why = String(filled.stderr ?? filled.error?.message ?? 'no exit status').trim()
      return {
        findings,
        undetermined: [{ reason: '构造临时索引失败(update-index)', missing: why.split('\n')[0] }],
      }
    }

    // 临时索引已经把分母固定在本次变更面，verify 不再点名文件（点名 = 工作树面，会判旧字节）。
    // `--preserve-symlinks-main` 不可省：共享钩子/测试夹具里 scripts 目录可能是 junction/symlink，
    // node 默认把 main 解析成 realpath，于是 watermark 的 `isDirectRun`（import.meta.url vs
    // argv[1]）不成立 —— main() 不执行、**静默 rc=0**，红文件被读成通过（实测假绿）。
    // 该标志让 import.meta.url 保留 argv 路径，ROOT 才会落在被判仓上；生产（真实文件）无副作用。
    const res = spawnSync(process.execPath, ['--preserve-symlinks-main', cli, 'verify', '--staged'], {
      cwd: root,
      encoding: 'utf8',
      timeout: VERIFY_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env,
    })
    if (res.error || typeof res.status !== 'number') {
      undetermined.push({
        reason: 'verify 派生失败',
        missing: String(res.error?.message ?? 'no exit status').split('\n')[0],
      })
      return { findings, undetermined }
    }
    if (res.status === 2) {
      undetermined.push({ reason: 'verify 报未判定(rc=2)', missing: 'watermark.mjs verify --staged' })
      return { findings, undetermined }
    }
    if (res.status === 1) {
      const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
      const names = out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('- '))
        .map((l) => l.slice(2).trim())
      if (!names.length) {
        // rc=1 但读不到清单 ⇒ 不能折成"通过"：记未判定，由台账留痕。
        undetermined.push({ reason: 'verify rc=1 但未给出缺口清单', missing: 'verify stdout/stderr' })
      }
      for (const name of names) {
        const hit = targets.find((t) => t.rel === name)
        findings.push({ path: hit?.rel ?? name, blob: hit?.oid ?? null })
      }
    }
  } finally {
    // 清理失败不改写结论（与 watermarkPreflight 同一条纪律）。
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* best effort */
    }
  }
  return { findings, undetermined }
}

/**
 * 193（git 派生调用 stdio 纪律）—— 复用 evaluate 的扫描/豁免/判据，只把输入面换成 new OID。
 */
export function adaptStdioDiscipline({ root, newOid, paths }) {
  const findings = []
  const undetermined = []
  const wanted = new Set(paths)
  if (!wanted.size) return { findings, undetermined }
  let result
  try {
    result = evaluate(root, 'head', { rev: newOid })
  } catch (e) {
    return {
      findings,
      undetermined: [
        {
          reason: '193 对象面扫描抛错',
          missing: String(e?.message ?? e).split('\n')[0],
        },
      ],
    }
  }
  const hit = new Set()
  for (const b of result.inputBad ?? []) {
    if (!wanted.has(b.rel)) continue
    hit.add(b.rel)
  }
  for (const b of result.bad ?? []) {
    if (!wanted.has(b.rel)) continue
    hit.add(b.rel)
  }
  for (const rel of hit) findings.push({ path: rel, blob: blobOid(root, newOid, rel) })
  for (const rel of result.unread ?? []) {
    if (!wanted.has(rel)) continue
    undetermined.push({ path: rel, reason: '读不到对象面正文', missing: `${newOid}:${rel}` })
  }
  return { findings, undetermined }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

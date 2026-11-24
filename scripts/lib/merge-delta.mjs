// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * merge-delta.mjs — 「本次提交真正新增/删除/改写」的合并感知基准(唯一真源)。
 *
 * 为什么需要它(2026-11-07 立):
 *   守门脚本普遍支持 head / staged / worktree 三个取材面。`staged` 的语义是
 *   「HEAD → 索引 的差异」,用来回答「本次提交引入了什么」。这在普通提交上成立,
 *   但在**合并提交**上完全失效:一次合并把上游几十个提交的全部变更都摊进
 *   「HEAD → 索引」这一份 diff 里,于是上游早就存在的条目会被判成「本次新增」。
 *   实测:一次含 27 个上游提交的合并,338 项守门里有 16 项因此判红,全部同一类误判。
 *
 * 判据(唯一语义,新增):
 *   条目/文件是「本次提交真正新增」⇔
 *     ① 它在**结果面**(staged = 索引,worktree = 磁盘)存在;
 *     ② 它在**每一枚父提交**里都不存在。
 *   父提交 = `HEAD` 加上 `MERGE_HEAD` 的每一行(git 合并未收口时,HEAD 是我们的
 *   第一父,MERGE_HEAD 是上游 tip;octopus 合并有多行)。非合并提交(无 MERGE_HEAD)
 *   ⇒ 父集只有 HEAD,此时本工具的输出与「HEAD → 结果面」的简单 diff **逐字等价加**
 *   (只多一层多重集归一,见下),既有门的行为不变。
 *
 * 对称判据(删除/改写,供判「丢行/写回旧态」的门使用):
 *   · 本次真正删除 ⇔ 结果面不存在 ∧ **每一枚**父提交都存在(两父都有、合并结果丢了);
 *   · 本次真正改写 ⇔ 结果值 ≠ 每一枚父提交的值(与任何一枚相同即归因于该父,不是本次动作)。
 *   为什么不把「只在 HEAD 有、结果丢了」算本次删除:那正是上游分支从来没有这条时的
 *   合并形态 —— 归因给上游,不能记在本次提交头上(反之亦然)。
 *
 * 两种粒度(不同门判的东西不同):
 *   · 条目级(identifier/key):调用方把结果面与各父面的条目各抽成 key 列表,
 *     走 `newOccurrences` / `removedOccurrences`。**多重集**:同名两枚各记一票,
 *     「摘掉一枚旧的、塞进一枚同名的」计数看不见,只有身份看得见(与守门 111 同课)。
 *   · 文件级(blob / 行内容):`blobNewRels` 按 blob oid 判文件是否本次新增;
 *     行内容级把 `路径\\0行归一文本` 当 key,走同一套 `newOccurrences`。
 *
 * 自证(必须能复算):
 *   `auditDelta({ resultKeys, parentKeyLists, naiveKeys })` 把「两父都不存在」的结论
 *   与「只看 HEAD 的简单 diff」做差集,输出 `onlyNaive`(简单 diff 多报的假阳性)与
 *   `onlyCorrect`(真基准多报的假阴性)。镜像测试用一段真实合并夹具同时钉住两侧。
 *
 * 取不到面(HEAD 不在 / MERGE_HEAD 读坏 / cat-file 失败)⇒ 抛 `Undetermined`,
 * 调用方折成 exit 2「未判定」。**绝不折成空集** —— 空集会让「没判」冒绿。
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { Undetermined, catBatch, gitRaw } from './face-reader.mjs'

export const DELTA_FACES = ['head', 'staged', 'worktree']

/** 简单 diff 面(head = 结果面本身)与提交链面同名的映射:head 面没有「本次提交」这一维。 */
export function deltaApplicable(face) {
  return face === 'staged' || face === 'worktree'
}

/** 父提交标签:第一父恒为 HEAD;MERGE_HEAD 多行按序编号(octopus 合并可 >2 父)。 */
function parentLabels(mergeShas) {
  const out = [{ label: 'HEAD', rev: 'HEAD' }]
  mergeShas.forEach((sha, i) => out.push({ label: i === 0 ? 'MERGE_HEAD' : `MERGE_HEAD#${i + 1}`, rev: sha }))
  return out
}

/** MERGE_HEAD 住在 gitdir(可能在工作区外)⇒ 必须走 `rev-parse --git-path`,不能拼 `.git/`。 */
export function mergeHeadShas(root) {
  let p
  try {
    p = String(gitRaw(['rev-parse', '--git-path', 'MERGE_HEAD'], root, { timeout: 15000 }) ?? '').trim()
  } catch (e) {
    throw new Undetermined(`merge-delta 取不到 MERGE_HEAD 路径:${String(e?.message ?? e).split('\n')[0]}`)
  }
  const abs = path.isAbsolute(p) ? p : path.resolve(root, p)
  if (!existsSync(abs)) return []
  let raw
  try {
    raw = readFileSync(abs, 'utf8')
  } catch (e) {
    throw new Undetermined(`merge-delta 读不到 MERGE_HEAD:${String(e?.message ?? e).split('\n')[0]}`)
  }
  const shas = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  // 有文件却没内容 ⇒ 合并态不可读;报未判定而不是当作非合并(那会把上游全部记成本次新增)。
  if (shas.length === 0) throw new Undetermined('MERGE_HEAD 存在但为空 ⇒ 父提交取不到,不能按非合并判')
  return shas
}

/**
 * 判定面的父提交集。
 * @returns {{applicable:boolean, merge:boolean, parents:{label:string,rev:string}[], why:string}}
 */
export function deltaParents({ root, face = 'staged' } = {}) {
  if (!deltaApplicable(face))
    return {
      applicable: false,
      merge: false,
      parents: [],
      why: 'head 面结构上没有「本次提交」这一维 ⇒ 新增/删除/改写一律报 NA,不得读成 0',
    }
  let shas
  try {
    shas = mergeHeadShas(root)
  } catch (e) {
    throw new Undetermined(String(e?.message ?? e))
  }
  return {
    applicable: true,
    merge: shas.length > 0,
    parents: parentLabels(shas),
    why: shas.length ? `合并未收口(${shas.length + 1} 父)⇒ 上游既有条目不记本次新增` : '非合并提交 ⇒ 只与 HEAD 比',
  }
}

/**
 * 批量读各父面的文件正文。返回 Map<label, Map<rel, string|null>>;
 * null = 该父面没有这份件(合法缺件,不回落另一个面)。
 */
export function readParentTexts({ root, rels, parents }) {
  const out = new Map()
  const list = [...new Set((rels || []).filter(Boolean).map((r) => String(r).replace(/\\/g, '/')))]
  for (const p of parents || []) {
    const m = new Map()
    if (list.length === 0) {
      out.set(p.label, m)
      continue
    }
    const specs = list.map((rel) => `${p.rev}:${rel}`)
    let got
    try {
      got = catBatch(root, specs, { maxBuffer: 64 * 1024 * 1024 })
    } catch (e) {
      throw new Undetermined(`merge-delta 取不到 ${p.label} 面正文:${String(e?.message ?? e).split('\n')[0]}`)
    }
    list.forEach((rel, i) => m.set(rel, got.get(specs[i]) ?? null))
    out.set(p.label, m)
  }
  return out
}

/** 单个父面的单件正文;该父没有 ⇒ null。 */
export function readParentOne({ root, rel, parents }) {
  const texts = readParentTexts({ root, rels: [rel], parents })
  for (const [, m] of texts) return m.get(String(rel).replace(/\\/g, '/')) ?? null
  return null
}

const countMap = (keys) => {
  const m = new Map()
  for (const k of keys || []) m.set(k, (m.get(k) || 0) + 1)
  return m
}

/**
 * 多重集意义下的「本次真正新增」:结果面每个 key 的计数,只超出**任一单父**已有计数的部分
 * 才算新增(取各父的最大值而不是求和:两父都已有 1 枚、结果 2 枚 ⇒ 新增 1 枚)。
 * @param {string[]} resultKeys
 * @param {string[][]} parentKeyLists 每一枚父提交各自的 key 列表
 * @returns {string[]} 新增 key 序列(同 key 可出现多次)
 */
export function newOccurrences(resultKeys, parentKeyLists) {
  const r = countMap(resultKeys)
  const ps = (parentKeyLists || []).map(countMap)
  const out = []
  for (const [k, n] of r) {
    const held = ps.length ? Math.max(...ps.map((m) => m.get(k) || 0)) : 0
    const fresh = Math.max(0, n - held)
    for (let i = 0; i < fresh; i++) out.push(k)
  }
  return out
}

/**
 * 对称判据:本次真正删除的 key = 结果面计数低于**每一枚父提交都有**的计数。
 * 只在 HEAD 有的条目归因给上游(上游从来没有它),不记本次删除。
 */
export function removedOccurrences(resultKeys, parentKeyLists) {
  const r = countMap(resultKeys)
  const ps = (parentKeyLists || []).map(countMap)
  if (ps.length === 0) return []
  const out = []
  const all = new Set()
  for (const m of ps) for (const k of m.keys()) all.add(k)
  for (const k of all) {
    const held = Math.min(...ps.map((m) => m.get(k) || 0))
    const gone = Math.max(0, held - (r.get(k) || 0))
    for (let i = 0; i < gone; i++) out.push(k)
  }
  return out
}

/** 本次真正改写:结果值 ≠ 每一枚父提交的值(与任一父相同即归因于该父)。父面缺失(null)不参与比较。 */
export function changedAgainstEveryParent(resultValue, parentValues) {
  const ps = (parentValues || []).filter((v) => v !== null && v !== undefined)
  if (ps.length === 0) return resultValue !== null && resultValue !== undefined
  return ps.every((v) => v !== resultValue)
}

/**
 * 计数型棘轮的门只需要「有效锚点」:把结果面读数折成 `读数 − 本次新增数`。
 * 于是 `读数 > 锚点 ⇔ 本次新增 > 0`,门的判据规则一个字不动。
 * 非合并提交时 `newOccurrences` 的新增数 = 结果 \ HEAD,故有效锚点 = HEAD 读数(逐字旧行为)。
 */
export function effectiveAnchorCount(resultCount, newCount) {
  return Number(resultCount || 0) - Number(newCount || 0)
}

/**
 * 自证:把「两父都不存在」的新增集与「只看 HEAD 的简单 diff」做差集。
 * `naiveKeys` 是简单 diff 的结论(结果面 key \ HEAD key);本工具不重新推导它,
 * 由调用方按自己门的现有口径传入,这样对比的是「同一把尺子只换了基准」。
 */
export function auditDelta({ resultKeys, parentKeyLists, naiveKeys } = {}) {
  const parents = parentKeyLists && parentKeyLists.length ? parentKeyLists : [[]]
  const correct = newOccurrences(resultKeys || [], parents)
  const naive = [...(naiveKeys || [])]
  const cSet = countMap(correct)
  const nSet = countMap(naive)
  const onlyNaive = []
  const onlyCorrect = []
  for (const [k, n] of nSet) {
    const excess = n - (cSet.get(k) || 0)
    for (let i = 0; i < Math.max(0, excess); i++) onlyNaive.push(k)
  }
  for (const [k, n] of cSet) {
    const excess = n - (nSet.get(k) || 0)
    for (let i = 0; i < Math.max(0, excess); i++) onlyCorrect.push(k)
  }
  return {
    newKeys: correct,
    naiveKeys: naive,
    onlyNaive,
    onlyCorrect,
    same: onlyNaive.length === 0 && onlyCorrect.length === 0,
  }
}

/** 结果面单件 blob oid。staged = `:rel`;head/父 rev = `<rev>:rel`;worktree = 磁盘字节哈希。 */
export function blobOidOf({ root, face = 'staged', rel, rev = null }) {
  const r = String(rel).replace(/\\/g, '/')
  if (face === 'worktree') {
    if (!existsSync(path.resolve(root, r))) return null
    try {
      const out = String(gitRaw(['hash-object', '--', r], root, { timeout: 15000 }) ?? '').trim()
      return out || null
    } catch (e) {
      throw new Undetermined(`merge-delta 取不到工作树 blob(${r}):${String(e?.message ?? e).split('\n')[0]}`)
    }
  }
  // 先验父提交可读:否则「父提交不存在」会被 rev-parse 的非零退出伪装成「该父没有这份件」。
  const revToCheck = rev || (face === 'head' ? 'HEAD' : null)
  if (revToCheck) {
    try {
      gitRaw(['rev-parse', '--verify', `${revToCheck}^{commit}`], root, { timeout: 15000 })
    } catch (e) {
      throw new Undetermined(`merge-delta 父提交 ${revToCheck} 不可读:${String(e?.message ?? e).split('\n')[0]}`)
    }
  }
  const spec = rev ? `${rev}:${r}` : face === 'staged' ? `:${r}` : `HEAD:${r}`
  try {
    const out = String(gitRaw(['rev-parse', '--verify', spec], root, { timeout: 15000 }) ?? '').trim()
    return out || null
  } catch {
    // 父提交已验过可读,这里失败只可能是「该面没有这份件」⇒ null(合法缺件)。
    return null
  }
}

/**
 * 文件级判据:结果面存在、且 blob oid 与**每一枚**父提交都不同 ⇒ 本次真正新增的文件/内容。
 * `null` oid(该面缺件)一律不记新增。
 */
export function blobNewRels({ root, face = 'staged', rels, parents }) {
  const out = new Set()
  for (const rel of rels || []) {
    const cur = blobOidOf({ root, face, rel })
    if (!cur) continue
    const parentOids = (parents || []).map((p) => blobOidOf({ root, face: 'rev', rel, rev: p.rev }))
    if (parentOids.some((o) => o && o === cur)) continue
    out.add(String(rel).replace(/\\/g, '/'))
  }
  return out
}

/** 同样给「删除/改写」用的文件级对照:结果面没有该文件 ∧ 每一枚父提交都有。 */
export function blobRemovedInAllParents({ root, face = 'staged', rels, parents }) {
  const out = new Set()
  for (const rel of rels || []) {
    const cur = blobOidOf({ root, face, rel })
    if (cur) continue
    const parentOids = (parents || []).map((p) => blobOidOf({ root, face: 'rev', rel, rev: p.rev }))
    if (parentOids.length === 0 || parentOids.some((o) => !o)) continue
    out.add(String(rel).replace(/\\/g, '/'))
  }
  return out
}

/** 行内容级 key:`路径\\0行归一文本`(去首尾空白,保留中间语义)。 */
export function lineKey(rel, line) {
  return `${String(rel).replace(/\\/g, '/')}\u0000${String(line ?? '').trim()}`
}

/** 一份正文按行抽 key;空行不进多重集(空行不是条目)。 */
export function lineKeysOf(rel, text) {
  if (typeof text !== 'string') return []
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => lineKey(rel, l))
    .filter((k) => k.slice(k.indexOf('\u0000') + 1).trim() !== '')
}

export const __test__ = {
  deltaParents,
  mergeHeadShas,
  readParentTexts,
  newOccurrences,
  removedOccurrences,
  changedAgainstEveryParent,
  effectiveAnchorCount,
  auditDelta,
  blobOidOf,
  blobNewRels,
  blobRemovedInAllParents,
  lineKey,
  lineKeysOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

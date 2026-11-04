// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 定版索引保护(2026-11-04 立)。
 *
 * ## 病灶(同一根的第四个出口)
 *
 * 钩子里的格式化层(`lint-staged` 的「Staging changes from tasks」)用 `git add` 把**工作树
 * 版本**写回 `GIT_INDEX_FILE` 指向的索引。这对"调用方用私有索引精确控制提交内容"是通用破坏面:
 *
 * ```
 * git read-tree HEAD                      # 基
 * git update-index --cacheinfo <旧 blob>  # 把某个文件钉成旧版本(意图:撤掉被夹带进 HEAD 的半成品)
 * git commit                              # 钩子进来后 lint-staged 把它回灌成工作树的新版本
 * ```
 *
 * 结果不是"撤掉",而是"把对方最新的增量入库"—— 而且提交信息、日志、退出码全是绿的。
 * 与已知三形态(`AD` 复活 / `MM` 挂旧 blob / `git reset HEAD` 清空共享索引)同根:
 * **钩子没有尊重调用方显式给出的索引上下文**。本例是它在私有索引上的新出口。
 *
 * ## 判据与边界
 *
 * - 只在**调用方自带的私有索引**上生效(`mode='private'`);共享索引(`mode='shared'`)一切照旧;
 * - git 自己为 `--only/--amend -- <路径>` 建的那份 `next-index-<pid>.lock` **不保护** ——
 *   那是 git 的提交面语义,调试者要的正是"格式化结果跟着进提交";
 * - 保护粒度 = **索引里已有的每一条**(不只是本单声明集):定版者的意图只体现在索引内容里,
 *   钩子无法区分哪一条是"钉过的",所以按最大保全处理;
 * - 复原手段与 isolated-git 的护栏同型:`git update-index --cacheinfo`,**不碰工作树**。
 *
 * 取舍(明写):私有索引提交时,`lint-staged --fix` 的格式化结果不会进提交。这正是
 * "精确控制提交内容"的语义;要让格式化产物进提交,请用共享索引(`git commit` 不带路径),
 * 或另起一笔专门提交格式化产物。
 */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

/** git 自建的 `--only` 临时索引名:这类索引的格式化回写是**预期行为**,不保护。 */
const GIT_TEMP_INDEX_RE = /^next-index-\d+\.lock$/

/**
 * 「未判定」判据(§0.3):读索引的输出**超过上界**时,我们既没有看到索引全貌(不能记绿:
 * 可能正好漏掉被回灌的那一条),也没有证据说内容被改(不能记红)。这时只允许一种语义:
 * **未判定 ⇒ 钩子以 exit 2 拒绝提交**。与仓内既有"未判定门"同一档(`[44] .fmt-tmp` 那次
 * exit 2 就是先例),不折成 1(1 是"判过且判红",会把容量问题误报成内容违规)。
 */
const UNDETERMINED_CODE = 'PIN_GUARD_UNDETERMINED'

/** 上界地板:空/极小索引也要留足余量(不是"固定 64MB",只是地板)。 */
const MIN_BOUND_BYTES = 8 * 1024 * 1024
/** 上界 = 索引文件实际大小的倍数 + 地板。依据见 `indexBound()` 的算术说明。 */
const BOUND_MULTIPLIER = 3

class PinGuardUndeterminedError extends Error {
  /** @param {string} message @param {{limit:number,indexPath:string,indexSize:number}} meta */
  constructor(message, meta) {
    super(message)
    this.name = 'PinGuardUndeterminedError'
    this.code = UNDETERMINED_CODE
    this.limit = meta.limit
    this.indexPath = meta.indexPath
    this.indexSize = meta.indexSize
  }
}

function cleanGitEnv(env) {
  const full = { ...env }
  // 只删外部注入的 GIT_DIR/GIT_WORK_TREE 覆盖;其余环境原样继承(含 GIT_INDEX_FILE)。
  delete full.GIT_DIR
  delete full.GIT_WORK_TREE
  return full
}

function spawnGit(args, { cwd, env }, maxBuffer) {
  return spawnSync('git', args, {
    cwd,
    env: cleanGitEnv(env),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...(maxBuffer ? { maxBuffer } : {}),
  })
}

/** 本次要读的索引文件的绝对路径:优先 GIT_INDEX_FILE,否则问 git(输出极小,默认上界足够)。 */
function resolveIndexPath({ gitCwd, env }) {
  const pointer = env?.GIT_INDEX_FILE ? path.resolve(gitCwd || process.cwd(), env.GIT_INDEX_FILE) : ''
  if (pointer) return pointer
  const r = spawnGit(['rev-parse', '--path-format=absolute', '--git-path', 'index'], {
    cwd: gitCwd,
    env,
  })
  return r.status === 0 && String(r.stdout || '').trim() ? String(r.stdout).trim() : ''
}

/**
 * 计算本次读取的上界(字节)。**不写死固定值**,按索引实际大小推导:
 *
 * `git ls-files -s -z` 每条 = `<mode> <blob> <stage>\t<path>\0`(约 54 + path 字节),
 * index 文件每条 = 62 字节元数据 + path。两者 path 都只出现一次 ⇒ 输出 ≤ index 大小 * ~1.05;
 * 取 3 倍 + 8MiB 地板,对 index 头部、换行/引号差异、git 版本差异都有余量。
 *
 * 上界仍可能被超过(异常输出/未来格式变化)⇒ 抛「未判定」,由调用方 exit 2;绝不设成无穷大,
 * 也不把地板抬成"够用就好"的固定值(那只是把同一个坑推到下一轮)。
 *
 * `maxBytes` 仅供测试**压低**上界(只能变小,不能变大),生产调用不传。
 */
function indexBound({ gitCwd, env, maxBytes }) {
  const indexPath = resolveIndexPath({ gitCwd, env })
  let indexSize = 0
  if (indexPath) {
    try {
      indexSize = fs.statSync(indexPath).size
    } catch {
      /* 取不到大小 ⇒ 按地板 */
    }
  }
  const derived = Math.max(MIN_BOUND_BYTES, BOUND_MULTIPLIER * indexSize + MIN_BOUND_BYTES)
  const limit =
    Number.isFinite(maxBytes) && maxBytes > 0 ? Math.min(derived, Math.floor(maxBytes)) : derived
  return { limit, indexPath, indexSize }
}

function undeterminedError({ limit, indexPath, indexSize }) {
  return new PinGuardUndeterminedError(
    `整份索引输出超过上界(${limit} 字节;索引文件 ${indexPath || '<未知>'} ` +
      `${indexSize} 字节)⇒ 未判定:无法确认索引全貌`,
    { limit, indexPath, indexSize },
  )
}

/** `git ls-files -s -z` 的逐条解析:`<mode> <blob> <stage>\t<path>\0`。 */
function parseLsFilesZ(text) {
  const out = []
  for (const rec of String(text ?? '').split('\u0000')) {
    if (!rec) continue
    const tab = rec.indexOf('\t')
    if (tab < 0) continue
    const meta = rec.slice(0, tab).trim().split(/\s+/)
    if (meta.length < 3) continue
    out.push({ mode: meta[0], blob: meta[1], stage: Number(meta[2]), path: rec.slice(tab + 1) })
  }
  return out
}

/** 整份索引的条目快照(Map<path,{mode,blob,stage}>),空索引 ⇒ 空 Map(不退回"列举全仓")。 */
function capturePinnedIndex({ gitCwd, env, maxBytes }) {
  const bound = indexBound({ gitCwd, env, maxBytes })
  const res = spawnGit(
    ['-c', 'core.quotepath=false', 'ls-files', '-s', '-z', '--'],
    { cwd: gitCwd, env },
    bound.limit,
  )
  if (res.error) {
    // ENOBUFS = 输出超上界 ⇒ 未判定(exit 2),不是"读不到"(那才是不确定原因的失败)。
    if (res.error.code === 'ENOBUFS') throw undeterminedError(bound)
    throw res.error
  }
  if (res.signal && res.status === null) throw undeterminedError(bound)
  if (res.status !== 0)
    throw new Error(`git ls-files 失败(exit ${res.status}): ${String(res.stderr || '').trim()}`)
  const map = new Map()
  for (const e of parseLsFilesZ(res.stdout)) map.set(e.path, e)
  return { entries: map }
}

/** 路径是否 git 自己的 `--only` 临时索引(这类索引不保护)。 */
function isGitTempIndex(file) {
  if (!file) return false
  const base = String(file).replace(/\\/g, '/').split('/').pop()
  return GIT_TEMP_INDEX_RE.test(base)
}

/**
 * 把被钩子改写的条目按快照复原;只动**内容**(mode/blob/stage),工作树一个字节不碰。
 * @returns {{ok:boolean, undetermined?:boolean, restored:string[], missing:string[], changed:string[], detail:string}}
 */
function restorePinnedIndex({ gitCwd, env, snapshot, log = console, maxBytes }) {
  const restored = []
  const missing = []
  const changed = []
  if (!snapshot || !snapshot.entries || snapshot.entries.size === 0)
    return { ok: true, restored, missing, changed, detail: '' }
  let current
  try {
    current = capturePinnedIndex({ gitCwd, env, maxBytes }).entries
  } catch (e) {
    if (e?.code === UNDETERMINED_CODE)
      return { ok: false, undetermined: true, restored, missing, changed, detail: e.message }
    return { ok: false, restored, missing, changed, detail: `读不到索引(复原前): ${e?.message ?? e}` }
  }
  for (const [p, want] of snapshot.entries) {
    const got = current.get(p)
    if (got && got.mode === want.mode && got.blob === want.blob && got.stage === want.stage) continue
    if (!got) missing.push(p)
    else changed.push(p)
    const args = ['update-index', '--add', '--cacheinfo', `${want.mode},${want.blob},${p}`]
    const r = spawnGit(args, { cwd: gitCwd, env })
    if (r.error || r.status !== 0) {
      return {
        ok: false,
        restored,
        missing,
        changed,
        detail: `git ${args.slice(0, 3).join(' ')} ${p} 失败: ${String(r.stderr || r.error || '').trim()}`,
      }
    }
    restored.push(p)
  }
  // 复核:复原后逐条与原快照相等(不接受"写了就算").
  let after
  try {
    after = capturePinnedIndex({ gitCwd, env, maxBytes }).entries
  } catch (e) {
    if (e?.code === UNDETERMINED_CODE)
      return { ok: false, undetermined: true, restored, missing, changed, detail: e.message }
    return { ok: false, restored, missing, changed, detail: `读不到索引(复原后): ${e?.message ?? e}` }
  }
  const bad = []
  for (const [p, want] of snapshot.entries) {
    const got = after.get(p)
    if (!got || got.mode !== want.mode || got.blob !== want.blob || got.stage !== want.stage) bad.push(p)
  }
  if (bad.length) {
    return {
      ok: false,
      restored,
      missing,
      changed,
      detail: `复原后仍与开工前不一致: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ` 等 ${bad.length} 条` : ''}`,
    }
  }
  if (restored.length) {
    log.warn?.(
      `   ↺ 定版保护:钩子把 ${restored.length} 个索引条目回灌成了别的内容,已按开工前的索引内容复原` +
        `(${restored.slice(0, 5).join(', ')}${restored.length > 5 ? ' …' : ''})`,
    )
  }
  return { ok: true, restored, missing, changed, detail: '' }
}

module.exports = {
  GIT_TEMP_INDEX_RE,
  UNDETERMINED_CODE,
  MIN_BOUND_BYTES,
  BOUND_MULTIPLIER,
  PinGuardUndeterminedError,
  capturePinnedIndex,
  isGitTempIndex,
  parseLsFilesZ,
  indexBound,
  restorePinnedIndex,
}

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 追加型运行日志的保留期回收(机制对标 ZCode `packages/desktop/src/main/logRetention.ts`)。
 *
 * 为什么要有它(实测,不是假想):`.workbuddy/hook-logs/pre-commit.log` 现读 93,344,342 B、
 * `.workbuddy/git-guardian.log` 13,610,246 B,两处都**只有追加、没有死亡**。我方已有同类轮转
 * 只有 `deploy/win/ihui-deploy-loop.ps1` 一处(53MB 事故后加的),即"同类日志各自腐烂"。
 *
 * 为什么挂在守护巡检而不是钩子自身:钩子的日志是由 `scripts/hook-run-hidden.vbs` 用
 * `cmd /c "… >> log"` 打开句柄后才启动 node 的 —— node 在钩子内改名自己正被追加的那个文件
 * 必然撞 Windows 共享冲突(实测同类形态 rename 返回 EBUSY/EPERM)。巡检每 2 分钟一轮,
 * 且撞上"正好有人在提交"时按稳定窗跳过、下一轮再收,失效方向是"少做一次清理"而不是"弄坏提交链"。
 *
 * 三条不可动摇的判据:
 *  ① **双上限**:单文件超 `maxBytes` 才动,且归档总量超 `maxTotalBytes` 才删最旧 —— 与 ZCode
 *     的 `maxFiles + maxTotalBytes` 同形;只按条数会留 40×50MB,只按体积会一夜删空现场。
 *  ② **稳定窗**:mtime 距今 < `settleMs` 的文件**不碰**。正在被写的日志被改名 = 写方继续往
 *     旧句柄写,新文件永远收不到后续行,现象是"日志突然断了"而无人报错。
 *  ③ **不留静默**:每一条 rotated / skipped / failed 都必须被调用方打印出来。本仓最高频的
 *     失效型是"把没判写成判过了",清理同理 —— 悄悄少删与悄悄删错,账面都长得像健康。
 * 本层**只改名与删除归档**,从不截断活动文件、从不写新内容。
 */
import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** 单文件超过该字节数才考虑轮转(实测稳态一轮守门日志约 200KB ⇒ 32MB ≈ 160 轮)。 */
export const DEFAULT_MAX_BYTES = 32 * 1024 * 1024
/** 归档(`.log.1`、`.log.2` …)合计体积上限,超了才从最旧一份开始删。 */
export const DEFAULT_MAX_TOTAL_BYTES = 64 * 1024 * 1024
/** 归档份数上限(与总体积并列的第二个闸)。 */
export const DEFAULT_MAX_FILES = 2
/** 刚写过这么多毫秒内的文件不碰(避免与写方句柄抢改名)。 */
export const DEFAULT_SETTLE_MS = 1000

/** 归档名:`x.log` → `x.log.1` / `x.log.2` …(与本层命名唯一约定,消费者按同一套找)。 */
export function archiveName(activePath, gen) {
  return `${activePath}.${gen}`
}

/** 列出某活动日志现有的归档代(升序:1,2,…),取不到目录 ⇒ 空数组。 */
export function listArchives(activePath) {
  const dir = dirname(activePath)
  const base = activePath.slice(dir.length + 1)
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const out = []
  for (const n of names) {
    const m = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)$`).exec(n)
    if (m) out.push({ gen: Number(m[1]), path: join(dir, n) })
  }
  return out.sort((a, b) => a.gen - b.gen)
}

/**
 * 纯函数判定:给定量到的尺寸与归档清单,该不该动、动谁。
 * 抽出来是为了让"双上限 + 稳定窗"能被构造面证明,而不必真机造 90MB 文件。
 *
 * 代次方向(踩过一次,写死在这里):**`.log.1` 是最新的一份归档**,每次轮转把旧的上移一格
 * (1→2、2→3…),再把活动文件放进 1。所以要删的就是 gen 数字最大的那些。
 */
export function decide({
  exists,
  size,
  ageMs,
  archives,
  _nowMs,
  maxBytes = DEFAULT_MAX_BYTES,
  maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
  maxFiles = DEFAULT_MAX_FILES,
  settleMs = DEFAULT_SETTLE_MS,
}) {
  const rm = []
  let rotate = false
  let reason = '健康'
  if (!exists) {
    reason = '文件不存在(不算失败,新建由写方负责)'
  } else if (ageMs < settleMs) {
    reason = `稳定窗内(距今 ${ageMs}ms < ${settleMs}ms)⇒ 本轮跳过`
  } else if (size > maxBytes) {
    // 预算从"即将成为 .log.1 的这份"开始算,再按新旧顺序往里装;装不下的(最旧)删。
    let acc = size
    let gens = 1
    for (const a of [...archives].sort((x, y) => x.gen - y.gen)) {
      if (acc + a.size > maxTotalBytes || gens + 1 > maxFiles) rm.push(a.path)
      else {
        acc += a.size
        gens += 1
      }
    }
    rotate = true
    reason = `活动 ${size} B > 上限 ${maxBytes} B(归档现 ${archives.length} 份 / ${archives.reduce((s, a) => s + a.size, 0)} B)`
  }
  return { rotate, rm, reason }
}

/**
 * 对一个活动日志执行回收。返回结构化结果,**不打印、不抛**(打印归调用方,
 * 因为"该喊多响"在不同宿主不一样:守护轮次要一行流水,手动档要逐项列)。
 *
 * `rename` / `remove` 是可注入出口:Windows 上"改名必失败"没法靠摆目录可靠地造出来
 * (把目录改名到下一代照样成功,反而把阻塞物搬走了 —— 第一版就白测了一场)。
 * 有了出口,"中途失败必须回到原样"这条性质才能被真的证明。
 */
export function rotateAppendLog(
  activePath,
  {
    maxBytes = DEFAULT_MAX_BYTES,
    maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
    maxFiles = DEFAULT_MAX_FILES,
    settleMs = DEFAULT_SETTLE_MS,
    now = Date.now(),
    dryRun = false,
    rename = renameSync,
    remove = (p) => rmSync(p, { force: true }),
  } = {},
) {
  const out = { path: activePath, rotated: false, movedTo: null, removed: [], skipped: null, failed: null }
  let st
  try {
    st = existsSync(activePath) ? statSync(activePath) : null
  } catch (e) {
    out.failed = `stat 活动文件失败:${e?.code ?? e?.message ?? e}`
    return out
  }
  const archives = []
  for (const a of listArchives(activePath)) {
    try {
      const s = statSync(a.path)
      archives.push({ ...a, size: s.size })
    } catch {
      archives.push({ ...a, size: 0 })
    }
  }
  const d = decide({
    exists: st !== null,
    size: st?.size ?? 0,
    ageMs: st ? now - st.mtimeMs : Number.MAX_SAFE_INTEGER,
    archives,
    maxBytes,
    maxTotalBytes,
    maxFiles,
    settleMs,
  })
  if (!d.rotate) {
    out.skipped = d.reason
    return out
  }
  // 判删的那份**先删**,再把幸存者从大到小上移(2→3、1→2),最后 活动→1:
  // 幸存者要搬进的就是那些格子,不先腾位就会把"该删的旧归档"换成"幸存者的新位置"再删一遍,
  // 结果是删错东西(第一版按"先挪后删"写,R7 的代次断言当场把它咬出来)。
  // 代价如实登记:若后续改名失败,已删的那几份回不来 —— 但它们本来就是这一轮的淘汰对象,
  // 政策上允许消失,所以 out.skipped 明写"回滚只覆盖已完成的移动",不谎称"回到原样"。
  for (const p of d.rm) {
    try {
      remove(p)
      out.removed.push(p)
    } catch (e) {
      out.failed = `删归档失败 ${p}:${e?.code ?? e?.message ?? e}`
    }
  }
  const survivors = archives.filter((a) => !d.rm.includes(a.path))
  const shifted = [...survivors].sort((a, b) => b.gen - a.gen)
  const moves = shifted.map((a) => ({ from: a.path, to: archiveName(activePath, a.gen + 1) }))
  moves.push({ from: activePath, to: archiveName(activePath, 1) })
  if (dryRun) {
    out.rotated = true
    out.movedTo = archiveName(activePath, 1)
    return out
  }
  const done = []
  for (const mv of moves) {
    if (mv.from !== activePath && !existsSync(mv.from)) continue
    try {
      rename(mv.from, mv.to)
      done.push(mv)
    } catch (e) {
      const rollbackFailed = []
      for (const back of [...done].reverse()) {
        try {
          rename(back.to, back.from)
        } catch (e2) {
          rollbackFailed.push(`${back.to} → ${back.from}(${e2?.code ?? e2?.message ?? e2})`)
        }
      }
      out.failed = `改名失败 ${mv.from} → ${mv.to}:${e?.code ?? e?.message ?? e}`
      out.skipped = rollbackFailed.length
        ? `回滚未完成,现场留在半挪动态,须人工核对:${rollbackFailed.join(' / ')}`
        : `已回滚 ${done.length} 次移动${out.removed.length ? `(本轮淘汰的 ${out.removed.length} 份归档已删,不谎称回到原样)` : ''}`
      return out
    }
  }
  out.rotated = true
  out.movedTo = archiveName(activePath, 1)
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

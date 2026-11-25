// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 告知计数与落盘(2026-11-24 二轮)。
 *
 * 两个器件,职责严格分开:
 *   · `createNoticeLedger` —— 记住"同一个来源第几次"和他上次拿到的编号。
 *     纯内存,但启动时从日志尾部重建,所以 router 重启不会把计数清零。
 *     重建只读尾部 `rebuildBytes`(默认 8MB):计数是威慑用的近似量,
 *     不值得为它把 38MB 日志整份读进拒绝路径的启动里。
 *   · `createNoticeWriter` —— 批量落盘 + 按体积轮转。
 *     初版是每个 403 一次 `appendFileSync`:500rps 时等于每秒 500 次同步 IO,
 *     攻击者用请求量就能把拒绝路径拖成瓶颈 —— 这是自己给自己造的 DoS 放大面。
 *     现在先进内存,1 秒或满 512 条刷一次;进程退出前同步刷盘保命。
 *
 * 失守边界(写进注释,不装作没有):被 `kill -9` 时,最近 1 秒内的记录会丢。
 * 这是"批量写"换"扛住刷量"的代价,取舍是有意的 —— 丢的那几条仍在证据链与
 * router 日志里各有一份,不是孤证。
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

export const DEFAULT_REBUILD_BYTES = 8 * 1024 * 1024

/** 读文件尾部若干字节并按行切(首行可能是被截断的半行,丢弃)。 */
function readTailLines(logPath, bytes) {
  let size
  try {
    size = statSync(logPath).size
  } catch {
    return []
  }
  const start = Math.max(0, size - bytes)
  const len = size - start
  if (len <= 0) return []
  const buf = Buffer.alloc(len)
  let fd
  try {
    fd = openSync(logPath, 'r')
    readSync(fd, buf, 0, len, start)
  } catch {
    return []
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        /* 已关 */
      }
    }
  }
  let text = buf.toString('utf8')
  if (start > 0) {
    const nl = text.indexOf('\n')
    text = nl >= 0 ? text.slice(nl + 1) : ''
  }
  return text.split(/\r?\n/).filter(Boolean)
}

/**
 * 计数台账。`peek(ip)` 给出这次是第几次、上次编号;`commit(ip, ref)` 在
 * 本次编号生成后落账(顺序不能反:ref 是本次生成的,commit 之后才是"上次")。
 */
export function createNoticeLedger({ logPath = null, rebuildBytes = DEFAULT_REBUILD_BYTES } = {}) {
  const state = new Map()

  if (logPath && existsSync(logPath)) {
    for (const line of readTailLines(logPath, rebuildBytes)) {
      let row
      try {
        row = JSON.parse(line)
      } catch {
        continue // 半行/坏行跳过:重建是尽力而为,不能因一行坏掉丢掉整份计数
      }
      const ip = String(row?.ip ?? 'unknown')
      const cur = state.get(ip) ?? { count: 0, lastRef: null }
      const seen = Number.isFinite(row?.attempt) && row.attempt > 0 ? row.attempt : cur.count + 1
      state.set(ip, { count: Math.max(cur.count, seen), lastRef: row?.ref ?? cur.lastRef })
    }
  }

  return {
    /** 生成前问:这次算第几次、他上次的编号是什么。 */
    peek(ip) {
      const cur = state.get(String(ip || 'unknown')) ?? { count: 0, lastRef: null }
      return { attempt: cur.count + 1, prevRef: cur.lastRef }
    },
    /** 本次编号已生成,落账。 */
    commit(ip, ref) {
      const key = String(ip || 'unknown')
      const cur = state.get(key) ?? { count: 0, lastRef: null }
      state.set(key, { count: cur.count + 1, lastRef: ref ?? cur.lastRef })
    },
    /** 观测用:当前记住了多少个来源。 */
    size() {
      return state.size
    },
    /** 测试用:导出快照,不暴露内部 Map。 */
    snapshot() {
      return new Map(state)
    },
  }
}

/**
 * 批量写入器。`push(row)` 只进内存;`flush()` 一次写盘。
 * 轮转保留 `keep` 份历史(`.1` 最新),按字节切,不按时段切 —— 攻击量的峰值是突发型,
 * 按时段切会在安静期切出一堆空文件。
 */
export function createNoticeWriter({
  logPath,
  maxBytes = 10 * 1024 * 1024,
  keep = 5,
  flushMs = 1000,
  batchSize = 512,
} = {}) {
  const buf = []
  let timer = null
  let failures = 0
  let written = 0

  function rotateIfNeeded() {
    try {
      if (!existsSync(logPath)) return
      if (statSync(logPath).size < maxBytes) return
      for (let i = keep - 1; i >= 1; i -= 1) {
        const from = `${logPath}.${i}`
        const to = `${logPath}.${i + 1}`
        if (!existsSync(from)) continue
        try {
          rmSync(to, { force: true })
        } catch {
          /* 目标不存在或无权限,继续尝试下一个 */
        }
        renameSync(from, to)
      }
      renameSync(logPath, `${logPath}.1`)
    } catch {
      failures += 1 // 轮转失败不阻断写入:继续往当前文件追加,盘满由运维兜
    }
  }

  function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!buf.length) return
    const chunk = buf.splice(0, buf.length).join('')
    try {
      mkdirSync(dirname(logPath), { recursive: true })
      rotateIfNeeded()
      appendFileSync(logPath, chunk, 'utf8')
      written += 1
    } catch {
      failures += 1
    }
  }

  function schedule() {
    if (timer) return
    timer = setTimeout(flush, flushMs)
    if (typeof timer.unref === 'function') timer.unref() // 别让定时器把进程吊在退出前
  }

  return {
    push(row) {
      buf.push(`${JSON.stringify(row)}\n`)
      if (buf.length >= batchSize) flush()
      else schedule()
    },
    flush,
    stats() {
      return { pending: buf.length, failures, flushes: written }
    },
  }
}

export const __test__ = { readTailLines, createNoticeLedger, createNoticeWriter }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

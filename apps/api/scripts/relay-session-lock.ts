// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话搬家腿的互斥锁(2026-10-27 立)。
 *
 * 立因:本仓多会话并行是常态(move_ops.jsonl 追加写、session_links.json 整写都没有互斥),
 * 两个 relay:session-move --apply 同时跑会互相踩:一个刚搬走文件、另一个按旧计划再搬一次,
 * ops 里出现两条"同文件同去向"的记录,undo 时按行号回退就可能搬错。
 *
 * 形态:锁文件 O_EXCL 创建(writeFileSync flag:'wx'),内容 JSON {pid, host, startedAt, cmd}。
 * 争用:已存在 ⇒ 读旧锁判活——
 *  - 进程在(process.kill(pid,0) 不抛或 EPERM 视为活)且 not 超 TTL ⇒ 拒绝并点名持有者;
 *  - 进程不在 或 超 TTL ⇒ 视为陈旧锁:先把旧内容逐字归档到 `<lock>.stale-<ts>`,
 *    再重试一次 O_EXCL 抢占(抢占失败说明别人同时抢到了,照样报争用,不硬闯)。
 * 释放:只有当锁文件内容仍是自己那一份(pid + startedAt 都匹配)才 unlink——
 * 避免 TTL 抢占后,慢半拍的原持有者把新持有者的锁删掉。
 *
 * 失效方向:判活不确定(process.kill 抛非 ESRCH)⇒ 按"活"处理(多要一次人工确认,
 * 绝不因判活噪声多放一次并发写)。
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { dirname } from 'node:path'

export interface SessionLockInfo {
  pid: number
  host: string
  startedAt: string
  cmd: string
}

export interface SessionLockHandle {
  path: string
  info: SessionLockInfo
  release: () => void
}

export interface AcquireOptions {
  /** 陈旧判定:超过这个时长即视为残留锁(默认 30 分钟) */
  ttlMs?: number
  now?: Date
  /** 测试注入:判 pid 是否活着;缺省用 process.kill(pid, 0) */
  isAlive?: (pid: number) => boolean
}

const DEFAULT_TTL_MS = 30 * 60 * 1000

/**
 * 会话库共享锁名(2026-10-28 立):备份(读全库)、恢复(写全库)、搬移/复制/换桶(读写单会话)
 * 争的是**同一个**文件树,必须互斥。台账只写 session_links.json,与文件树不冲突,
 * 仍用各自的 session-links.lock。
 */
export const SESSION_STORE_LOCK_NAME = 'session-store.lock'
/** 台账锁名(只保护 session_links.json 的整写) */
export const SESSION_LINKS_LOCK_NAME = 'session-links.lock'

/** pid 存活判定:ESRCH=不在;EPERM=在但无权限(按活处理);其它异常按活处理(失效方向保守) */
export function defaultIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ESRCH') return false
    return true
  }
}

function readLock(path: string): SessionLockInfo | null {
  try {
    const j = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    const pid = typeof j['pid'] === 'number' ? j['pid'] : Number.NaN
    return {
      pid,
      host: typeof j['host'] === 'string' ? j['host'] : '',
      startedAt: typeof j['startedAt'] === 'string' ? j['startedAt'] : '',
      cmd: typeof j['cmd'] === 'string' ? j['cmd'] : '',
    }
  } catch {
    return null
  }
}

/**
 * 取锁。争用且持有者活着 ⇒ 抛错(带持有者 pid/host/时刻/cmd);陈旧 ⇒ 归档后抢占。
 * 返回的 handle 必须 release(调用方用 try/finally)。
 */
export function acquireSessionLock(
  lockPath: string,
  cmd: string,
  opts: AcquireOptions = {},
): SessionLockHandle {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
  const now = opts.now ?? new Date()
  const alive = opts.isAlive ?? defaultIsAlive
  mkdirSync(dirname(lockPath), { recursive: true })
  const info: SessionLockInfo = {
    pid: process.pid,
    host: hostname(),
    startedAt: now.toISOString(),
    cmd,
  }
  const body = `${JSON.stringify(info)}\n`
  const tryCreate = (): boolean => {
    try {
      writeFileSync(lockPath, body, { flag: 'wx' })
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false
      throw err
    }
  }
  if (!tryCreate()) {
    const prev = readLock(lockPath)
    const startedMs = prev ? Date.parse(prev.startedAt) : Number.NaN
    const ageMs = Number.isFinite(startedMs) ? now.getTime() - startedMs : Number.POSITIVE_INFINITY
    // 同 pid 也算"活":同一进程重入直接拒绝,避免把自己刚建的锁当陈旧锁抢占掉
    const holderAlive = prev !== null && alive(prev.pid)
    const stale = !prev || !holderAlive || !Number.isFinite(ageMs) || ageMs > ttlMs
    if (!stale) {
      const who = prev
        ? `pid=${prev.pid} host=${prev.host} cmd=${prev.cmd} at=${prev.startedAt}`
        : '未知'
      throw new Error(
        `另一个会话正在操作会话库(锁: ${lockPath};持有者 ${who})。` +
          '等它结束,或确认它已死后再跑(本器不替你删锁)。',
      )
    }
    // 陈旧锁:先逐字归档再抢占(留证,不静默覆盖)
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
    if (existsSync(lockPath)) {
      try {
        writeFileSync(`${lockPath}.stale-${stamp}`, readFileSync(lockPath))
      } catch {
        /* 归档失败不阻断抢占:锁本身不是数据 */
      }
    }
    try {
      unlinkSync(lockPath)
    } catch {
      /* 竞态已消失 */
    }
    if (!tryCreate()) {
      throw new Error(`会话库锁争用: ${lockPath} 刚被另一会话抢到,请稍后重试`)
    }
  }
  let released = false
  return {
    path: lockPath,
    info,
    release: () => {
      if (released) return
      released = true
      const cur = readLock(lockPath)
      if (cur && cur.pid === info.pid && cur.startedAt === info.startedAt) {
        try {
          unlinkSync(lockPath)
        } catch {
          /* 已不存在 */
        }
      }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

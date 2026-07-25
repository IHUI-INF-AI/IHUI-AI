/**
 * 权限模式历史记录(2026-07-25 立,深度对标 OpenAI Codex CLI 审计能力)
 *
 * 目的:
 * - 用户每次切权限模式(default / accept-edits / bypass-permissions)都记录一条
 * - 持久化到 localStorage,跨刷新可查
 * - 提供"过去一段时间每个模式累计用了多久"统计
 * - 给用户安全感和事后追溯能力(出问题可查"我什么时候切的什么模式")
 *
 * 数据流:
 * - 写入:permission-mode-popover / cyclePermissionMode(Shift+Tab) / use-chat.ts 拦截的 /permission 切
 *   + 自动撤销 1h 计时器归零 → auto-revert 来源
 *   调 recordModeChange 追加
 * - 读取:PermissionHistoryPanel(挂载在 message-input 末尾)
 *   调 getRecentHistory 渲染最近 10 条
 * - 统计:getTotalDurationByMode 用于历史面板底部的"X 模式累计 N 小时"汇总
 *
 * 容量:
 * - 最多 50 条(防无限增长),超过从最旧淘汰
 * - 与 full-access-confirm-dialog / use-permission-auto-revert 共用 localStorage 风格:
 *   try/catch 包裹所有读 / 写,隐私模式 / quota 超出静默
 *
 * 不在本文件做的事:
 * - 不导出 React hook(纯函数,调用方自己用 useEffect 同步 state)
 * - 不在内部用任何 store(zustand / ai-panel store)(避免循环依赖)
 * - 不做时区转换(Date.now() → Intl.DateTimeFormat 由调用方处理)
 */

import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'

/** localStorage 键,与 full-access-acknowledged / auto-revert-bypass 同前缀保持一致 */
export const PERMISSION_HISTORY_KEY = 'ihui:permission-mode-history'

/** 最多保留条数(防无限增长) */
export const MAX_HISTORY_ENTRIES = 50

/** 切换来源(用于历史面板展示"通过什么方式切的") */
export type ModeChangeSource = 'popover' | 'shift-tab' | 'slash' | 'auto-revert'

export interface ModeChangeEntry {
  mode: WorkspacePermissionMode
  /** 工作区路径(空字符串表示未绑定) */
  workspacePath: string
  /** 切换时间戳(ms,Date.now()) */
  timestamp: number
  source: ModeChangeSource
}

function readAll(): ModeChangeEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PERMISSION_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is ModeChangeEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as ModeChangeEntry).timestamp === 'number' &&
        typeof (e as ModeChangeEntry).mode === 'string' &&
        typeof (e as ModeChangeEntry).workspacePath === 'string' &&
        typeof (e as ModeChangeEntry).source === 'string',
    )
  } catch {
    // 隐私模式 / JSON 损坏静默忽略
    return []
  }
}

function writeAll(entries: ModeChangeEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PERMISSION_HISTORY_KEY, JSON.stringify(entries))
  } catch {
    // quota 超出静默
  }
}

/**
 * 追加一条模式切换记录(2026-07-25 立)
 *
 * 调用时机:任何 mode 实际发生变化的代码路径切完后再调
 * (popover handleSelect / cyclePermissionMode / use-chat.ts /permission 拦截 / auto-revert hook)
 *
 * 实现细节:
 * - 写到 localStorage 末尾(最新在前)
 * - 超过 50 条从末尾截掉最旧(只保留前 50)
 * - 重复同模式不合并(用户每次手动切都值得记录)
 */
export function recordModeChange(entry: ModeChangeEntry): void {
  const all = readAll()
  const next = [entry, ...all].slice(0, MAX_HISTORY_ENTRIES)
  writeAll(next)
}

/**
 * 取最近 N 条记录(2026-07-25 立)
 *
 * @param workspacePath - 可选,只返回该工作区的记录(空字符串 = 未绑定)
 * @param limit - 默认 10(历史面板用),可自定义
 * @returns 按 timestamp 降序(最新在前)
 */
export function getRecentHistory(workspacePath?: string, limit: number = 10): ModeChangeEntry[] {
  const all = readAll()
  const filtered =
    workspacePath === undefined ? all : all.filter((e) => e.workspacePath === workspacePath)
  return filtered.slice(0, limit)
}

/**
 * 累计某模式总时长(2026-07-25 立)
 *
 * 算法:按时间顺序遍历,每次 mode 切换作为"上一段开始",下一段切换时间作为"上一段结束"
 * 累加每段持续时长,直到现在(now)或截止时间(sinceMs)
 *
 * @param mode - 要统计的模式
 * @param sinceMs - 可选,只统计从该时间戳(epoch ms)开始的累计
 * @returns 总毫秒数
 *
 * 例子:
 * - 历史:10:00 切到 default,10:30 切到 bypass,11:00 切到 default
 *   getTotalDurationByMode('default', 0) = 30min(default)+ 现在-11:00 之间的 default 时长
 *
 * 实现细节:
 * - 第一条记录(最早的一条)如果 mode 不匹配,从 0 计起(没有前段可累加)
 * - 如果是当前正在用的模式(now 还在用),累加到 now
 */
export function getTotalDurationByMode(mode: WorkspacePermissionMode, sinceMs: number = 0): number {
  const all = readAll()
  if (all.length === 0) return 0
  // 按时间正序(最早在前),方便按段累加
  const sorted = [...all].sort((a, b) => a.timestamp - b.timestamp)
  let totalMs = 0
  // 段定义:[startMs, endMs),startMs = 当前条 timestamp,endMs = 下一条 timestamp 或 now
  // 段归属"前一条的 mode"——所以段归属的判断用 sorted[i-1].mode
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const curr = sorted[i]!
    if (prev.mode !== mode) continue
    const segStart = Math.max(prev.timestamp, sinceMs)
    const segEnd = curr.timestamp
    if (segEnd > segStart) totalMs += segEnd - segStart
  }
  // 最后一段(从最后一条到现在):如果最后一条的 mode 是目标 mode,累加到 now
  const last = sorted[sorted.length - 1]!
  if (last.mode === mode) {
    const segStart = Math.max(last.timestamp, sinceMs)
    const segEnd = Date.now()
    if (segEnd > segStart) totalMs += segEnd - segStart
  }
  return totalMs
}

/**
 * 清空所有历史(2026-07-25 立,供历史面板"清空历史"按钮调用)
 *
 * 注:不传确认参数,调用方先弹 ConfirmDialog 确认
 */
export function clearHistory(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PERMISSION_HISTORY_KEY)
  } catch {
    // 静默
  }
}

/**
 * 把毫秒格式化成"X 小时 Y 分钟"或"X 分钟"(用于历史面板统计)
 *
 * 1h = 60min,只显示最大 2 个单位
 *
 * @example
 *   formatDuration(3_600_000)   // "1小时"
 *   formatDuration(5_400_000)   // "1小时30分钟"
 *   formatDuration(120_000)     // "2分钟"
 *   formatDuration(45_000)      // "45秒"
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0秒'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0 && m > 0) return `${h}小时${m}分钟`
  if (h > 0) return `${h}小时`
  if (m > 0) return `${m}分钟`
  return `${s}秒`
}

/**
 * 把时间戳格式化成"X 分钟前"相对时间(用于历史面板条目)
 *
 * 复用现有 Intl.DateTimeFormat / 简单字符串逻辑,避免引入 dayjs 等新依赖
 * 时间梯度:< 1min → "刚刚" / < 1h → "X 分钟前" / < 24h → "X 小时前" / < 30d → "X 天前" / 否则具体日期
 */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp
  if (diff < 0) return '刚刚'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day}天前`
  // 超过 30 天显示具体日期
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const dd = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

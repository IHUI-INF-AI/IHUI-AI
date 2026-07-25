'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useAiPanelStore } from '@/stores/ai-panel'
import { switchPermissionMode } from '@/components/ai/permission-mode-popover'

/**
 * 高风险模式自动撤销倒计时(2026-07-25 深化,深度对标 Codex CLI 安全护栏)
 *
 * 为什么需要:
 * - 用户切到 bypass-permissions 后,5s 撤销 toast 只能覆盖"刚点错"的场景
 * - 真正风险是"忘了切回":跑了一会儿任务,发现高风险模式还开着
 * - 自动倒计时兜底:1 小时后无脑切回 default,即使忘记也不会持续高风险
 *
 * 数据流:
 * - 输入:当前 activeWorkspaceMode
 * - 输出:{ remainingMs, isActive, cancelRevert, extendRevert, startedAt }
 * - 副作用:倒计时归零 → 自动调 switchPermissionMode('default')
 *
 * 持久化:
 * - startedAt 写到 localStorage(ihui:auto-revert-bypass),跨刷新延续
 * - 用户主动 cancelRevert → 清除 localStorage(下次开启重新计时)
 * - 解除工作区绑定 / 切换工作区 → 清除(避免跨工作区污染)
 *
 * 时序细节:
 * - 用 Date.now() 算剩余,不用 setInterval 累积(setInterval 在标签页后台会被节流到 1 分钟,误差大)
 * - 用 1s 的 setInterval 仅触发 setState(强制重渲染剩余时间)
 * - 跨标签页同步:监听 'storage' 事件(用户在另一标签页点撤销时,本标签页也跟着清掉)
 */
const STORAGE_KEY = 'ihui:auto-revert-bypass'
const DEFAULT_DURATION_MS = 60 * 60 * 1000 // 1 小时

interface AutoRevertRecord {
  /** 切到 bypass-permissions 的时间戳(ms) */
  startedAt: number
  /** 持续时间(ms) */
  durationMs: number
}

function readRecord(): AutoRevertRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AutoRevertRecord>
    if (typeof parsed.startedAt !== 'number' || typeof parsed.durationMs !== 'number') {
      return null
    }
    return { startedAt: parsed.startedAt, durationMs: parsed.durationMs }
  } catch {
    return null
  }
}

function writeRecord(record: AutoRevertRecord | null): void {
  if (typeof window === 'undefined') return
  try {
    if (record) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // 隐私模式 / quota 超出静默
  }
}

export function usePermissionAutoRevert(durationMs: number = DEFAULT_DURATION_MS) {
  // 国际化文本(2026-07-25 深化):自动撤销触发的反馈 toast
  const t = useTranslations('chat.permission')
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const activeMode = activeWorkspace?.mode
  // 初始读 localStorage(SSR 阶段跳过,客户端首次渲染再读)
  const [record, setRecord] = React.useState<AutoRevertRecord | null>(null)
  // 客户端 mount 时强制读一次(2026-07-25 修复:useState lazy initializer 在 SSR 返回 null 后,
  // 客户端 hydration 不会重跑,导致 expired/刷新场景的 record 被 effect 1 覆盖)
  const [hydrated, setHydrated] = React.useState(false)
  React.useEffect(() => {
    if (hydrated) return
    setRecord(readRecord())
    setHydrated(true)
  }, [hydrated])
  // 强制 1s 重渲染,刷新倒计时显示
  const [, setTick] = React.useState(0)

  // 模式变化 → 同步 record
  // - 切到 bypass-permissions:启动新倒计时(如果当前已激活则保持,只在切回 default/accept-edits 时清掉)
  // - 切到 default / accept-edits:清掉
  // 依赖 hydrated:hydration 完成后才允许 effect 同步,防止 hydration 前 effect 把 record 覆盖
  React.useEffect(() => {
    if (!hydrated) return
    if (activeMode === 'bypass-permissions') {
      // 仅在没有活跃 record 时启动新的
      setRecord((prev) => {
        if (prev) {
          // 已有 record(刷新场景) → 保持
          return prev
        }
        const next: AutoRevertRecord = { startedAt: Date.now(), durationMs }
        writeRecord(next)
        return next
      })
    } else {
      // 非高风险模式 → 清掉
      setRecord((prev) => {
        if (prev) writeRecord(null)
        return null
      })
    }
  }, [activeMode, durationMs])

  // 1s 触发 setState 强制重渲染剩余时间
  React.useEffect(() => {
    if (!record) return
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [record])

  // 跨标签页同步
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      setRecord(readRecord())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // 计算剩余时间
  const remainingMs = React.useMemo(() => {
    if (!record) return 0
    const elapsed = Date.now() - record.startedAt
    return Math.max(0, record.durationMs - elapsed)
  }, [record])

  // 快到期提醒(2026-07-25 深化,防"被切懵"):
  // - 剩 5 分钟:警告 toast,可一键续期 1h
  // - 剩 1 分钟:紧急 toast
  // 用 ref 去重,每个阈值只弹一次
  const warnedFiveMinRef = React.useRef(false)
  const warnedOneMinRef = React.useRef(false)
  React.useEffect(() => {
    if (!record) {
      warnedFiveMinRef.current = false
      warnedOneMinRef.current = false
      return
    }
    if (remainingMs > 5 * 60 * 1000) {
      warnedFiveMinRef.current = false
      warnedOneMinRef.current = false
      return
    }
    if (remainingMs <= 5 * 60 * 1000 && remainingMs > 60 * 1000 && !warnedFiveMinRef.current) {
      warnedFiveMinRef.current = true
      toast(t('revertWarning5minTitle'), {
        description: t('revertWarning5minDesc'),
        duration: 10000,
        action: {
          label: t('extendOneHour'),
          onClick: () => extendRevert(DEFAULT_DURATION_MS),
        },
      })
    } else if (remainingMs <= 60 * 1000 && remainingMs > 0 && !warnedOneMinRef.current) {
      warnedOneMinRef.current = true
      toast(t('revertWarning1minTitle'), {
        description: t('revertWarning1minDesc'),
        duration: 8000,
        action: {
          label: t('extendOneHour'),
          onClick: () => extendRevert(DEFAULT_DURATION_MS),
        },
      })
    }
  }, [remainingMs, record, t]) // extendRevert 引用稳定,可省略

  // 倒计时归零 → 自动切回 default
  // 2026-07-25 修复:本地优先,API 失败不阻断本地切换(兜底安全护栏必须保证最终生效)
  // 1. 先乐观更新 store + localStorage → 立即退出高风险
  // 2. 后台异步调 API 落库 + 失败重试 1 次
  const autoSwitchedRef = React.useRef(false)
  React.useEffect(() => {
    if (!record) {
      autoSwitchedRef.current = false
      return
    }
    if (remainingMs > 0) return
    if (autoSwitchedRef.current) return
    // 当前模式已被切走 → 清 record 退出
    const current = useAiPanelStore.getState().activeWorkspace?.mode
    if (current !== 'bypass-permissions') {
      setRecord(null)
      writeRecord(null)
      return
    }
    autoSwitchedRef.current = true
    // 立即本地切回(安全护栏兜底,不能被 API 失败阻断)
    const store = useAiPanelStore.getState()
    if (store.activeWorkspace) {
      store.setActiveWorkspace({ ...store.activeWorkspace, mode: 'default' })
    }
    // 计算本次完全访问累计时长(2026-07-25 深化):让用户知道"我开了多久"
    const usedMs = record ? Math.min(Date.now() - record.startedAt, record.durationMs) : 0
    const usedMin = Math.round(usedMs / 60000)
    setRecord(null)
    writeRecord(null)
    toast(t('autoRevertedTitle'), {
      description: t('autoRevertedDescWithDuration', { usedMin }),
      duration: 6000,
    })
    // 后台异步落库 + 失败重试
    void (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await switchPermissionMode('default')
        if (result.ok) return
        // 短暂等待再重试
        await new Promise((r) => setTimeout(r, 1500))
      }
      // 2 次都失败:记录到 console(不阻塞 UI,本地已切回)
      console.warn('[usePermissionAutoRevert] 自动切回 default 后落库失败,已本地切回')
    })()
  }, [remainingMs, record, t])

  /** 用户主动取消自动撤销(不清工作区模式,只取消计时) */
  const cancelRevert = React.useCallback(() => {
    setRecord(null)
    writeRecord(null)
    toast.success(t('cancelAutoRevert') + ' ✓', {
      description: '当前保持完全访问,关闭标签页/刷新后也不会自动降级',
      duration: 3000,
    })
  }, [t])

  /** 延长计时(从 now 重置 durationMs) */
  const extendRevert = React.useCallback(
    (extraMs: number = durationMs) => {
      const next: AutoRevertRecord = { startedAt: Date.now(), durationMs: extraMs }
      setRecord(next)
      writeRecord(next)
    },
    [durationMs],
  )

  // 全局句柄(2026-07-25 深化):toast callback 在 React 组件作用域外触发不了 hook,
  // 把 extendRevert 挂到 window 上,供任何 toast action.onClick 安全调用
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      __IHUI_EXTEND_AUTO_REVERT__?: (ms?: number) => void
    }
    w.__IHUI_EXTEND_AUTO_REVERT__ = (ms?: number) => extendRevert(ms ?? DEFAULT_DURATION_MS)
    return () => {
      w.__IHUI_EXTEND_AUTO_REVERT__ = undefined
    }
  }, [extendRevert])

  return {
    /** 是否处于高风险 + 倒计时激活态 */
    isActive: !!record && remainingMs > 0,
    /** 剩余 ms(0 表示已到期) */
    remainingMs,
    /** 切到 bypass 的时间戳(显示"X 分钟前切到"用) */
    startedAt: record?.startedAt ?? null,
    cancelRevert,
    extendRevert,
  }
}

/** 把毫秒格式化成 mm:ss / hh:mm:ss(展示用) */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

/** 内部供测试 / 自验脚本导入的存储 key(避免硬编码 2 处) */
export const __AUTO_REVERT_STORAGE_KEY__ = STORAGE_KEY

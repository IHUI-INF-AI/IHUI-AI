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
  }, [record]) // eslint-disable-line react-hooks/exhaustive-deps

  // 倒计时归零 → 自动切回 default
  const autoSwitchedRef = React.useRef(false)
  React.useEffect(() => {
    if (!record) {
      autoSwitchedRef.current = false
      return
    }
    if (remainingMs > 0) return
    if (autoSwitchedRef.current) return
    // 当前模式仍是 bypass → 自动切
    const current = useAiPanelStore.getState().activeWorkspace?.mode
    if (current !== 'bypass-permissions') {
      // 已被切走,清 record 退出
      setRecord(null)
      writeRecord(null)
      return
    }
    autoSwitchedRef.current = true
    void (async () => {
      const result = await switchPermissionMode('default')
      if (result.ok) {
        setRecord(null)
        writeRecord(null)
        // 自动切回反馈(2026-07-25 深化):让用户知道"为什么被切了"
        toast(t('autoRevertedTitle'), {
          description: t('autoRevertedDesc'),
          duration: 6000,
        })
      } else {
        autoSwitchedRef.current = false
      }
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

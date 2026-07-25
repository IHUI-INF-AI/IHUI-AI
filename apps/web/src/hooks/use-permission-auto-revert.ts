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
 * 2026-07-25 修复 2 个边缘场景:
 * 1) 跨工作区 record 污染:record 携带 workspacePath,切换工作区时校验并清掉
 * 2) 自动撤销归零 race condition:record 携带 monotonic version,自动切回前
 *    校验 ref 是否还是我们 watch 的那个(防止用户最后一刻手动切到 bypass)
 *
 * 时序细节:
 * - 用 Date.now() 算剩余,不用 setInterval 累积(setInterval 在标签页后台会被节流到 1 分钟,误差大)
 * - 用 1s 的 setInterval 仅触发 setState(强制重渲染剩余时间)
 * - 跨标签页同步:监听 'storage' 事件(用户在另一标签页点撤销时,本标签页也跟着清掉)
 */
const STORAGE_KEY = 'ihui:auto-revert-bypass'
const DEFAULT_DURATION_MS = 60 * 60 * 1000 // 1 小时

/**
 * 2026-07-25 新增字段:
 * - workspacePath:启动 record 时所属工作区,跨工作区切换时校验避免污染
 * - version:单调递增版本号,自动切回前校验防止 race condition
 * 旧版 record(无这 2 字段)readRecord 视为无效,自动忽略。
 */
interface AutoRevertRecord {
  /** 切到 bypass-permissions 的时间戳(ms) */
  startedAt: number
  /** 持续时间(ms) */
  durationMs: number
  /** 关联工作区路径(防止跨工作区 record 污染) */
  workspacePath: string
  /** 单调递增版本号(防止 race condition) */
  version: number
}

/** 模块级单调计数器(2026-07-25 修复 race condition):跨 hook 实例也单调递增 */
let globalRecordVersion = 0

function readRecord(): AutoRevertRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AutoRevertRecord>
    if (
      typeof parsed.startedAt !== 'number' ||
      typeof parsed.durationMs !== 'number' ||
      typeof parsed.workspacePath !== 'string' ||
      typeof parsed.version !== 'number'
    ) {
      return null
    }
    return {
      startedAt: parsed.startedAt,
      durationMs: parsed.durationMs,
      workspacePath: parsed.workspacePath,
      version: parsed.version,
    }
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
  // 2026-07-25 修复 race condition:缓存当前 watch 的 record 引用,
  // 自动切回 effect 用 ref === record 校验,防止用户最后一刻手动切到 bypass
  // 引起的 record 替换被误判为"刚启动的新 record"
  const watchedRecordRef = React.useRef<AutoRevertRecord | null>(null)
  React.useEffect(() => {
    if (hydrated) return
    const loaded = readRecord()
    console.log('[auto-revert:hydration] readRecord', { hasLoaded: !!loaded, version: loaded?.version, ws: loaded?.workspacePath, startedAt: loaded?.startedAt, startedAtAgo: loaded ? Date.now() - loaded.startedAt : null })
    setRecord(loaded)
    watchedRecordRef.current = loaded
    setHydrated(true)
  }, [hydrated])
  // 强制 1s 重渲染,刷新倒计时显示
  const [tick, setTick] = React.useState(0)

  // 模式变化 / 工作区变化 → 同步 record(2026-07-25 修复跨工作区污染 + race condition)
  // - 切到 bypass-permissions:
  //   * 已有 record 且 workspacePath 匹配 + 未到期 → 保持(刷新场景)
  //   * 已有 record 但 workspacePath 不匹配 → 跨工作区,启动新 record
  //   * 已有 record + workspacePath 匹配 + 已到期 → 不启动新 record,让 auto-switch effect 处理
  //     (否则模式 effect 永久重启,auto-switch 永远等不到归零时刻)
  //   * 无 record → 启动新 record
  // - 切到 default / accept-edits → 清掉
  // 依赖:hydrated(防 hydration 前 effect 覆盖)+ activeWorkspace.path(防跨工作区污染)
  React.useEffect(() => {
    if (!hydrated) return
    const currentPath = activeWorkspace?.path ?? null
    if (activeMode === 'bypass-permissions') {
      setRecord((prev) => {
        if (prev && prev.workspacePath === currentPath) {
          const elapsed = Date.now() - prev.startedAt
          if (elapsed < prev.durationMs) {
            console.log('[auto-revert:mode-effect] 保持同工作区未到期 record', { prevVersion: prev.version, currentPath })
            return prev
          }
          // 2026-07-25 修复:同工作区已到期 → 不重启 record,
          // 让归零 effect 走自动切回逻辑(否则模式 effect 永久覆盖归零时刻)
          console.log('[auto-revert:mode-effect] 保持同工作区已到期 record 让 auto-switch 处理', { prevVersion: prev.version, currentPath })
          return prev
        }
        // 跨工作区 或 无 record → 启动新 record
        const next: AutoRevertRecord = {
          startedAt: Date.now(),
          durationMs,
          workspacePath: currentPath ?? '',
          version: ++globalRecordVersion,
        }
        console.log('[auto-revert:mode-effect] 启动新 record', { prev: prev ? { version: prev.version, ws: prev.workspacePath, expired: Date.now() - prev.startedAt >= prev.durationMs } : null, nextVersion: next.version, currentPath })
        writeRecord(next)
        watchedRecordRef.current = next
        return next
      })
    } else {
      setRecord((prev) => {
        if (prev) writeRecord(null)
        watchedRecordRef.current = null
        return null
      })
    }
  }, [activeMode, activeWorkspace?.path, durationMs, hydrated])

  // 1s 触发 setState 强制重渲染剩余时间
  React.useEffect(() => {
    if (!record) return
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [record])

  // 跨标签页同步(2026-07-25 修复:从 storage 事件加载的 record 也需要同步到 watchedRecordRef,
  // 否则用户在另一标签页点击 cancel 后,本标签页自动切回 effect 看到的是过期的本地 ref)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const next = readRecord()
      setRecord(next)
      watchedRecordRef.current = next
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
    // 2026-07-25 修复:依赖 tick 让 effect 在 1s 后重新检查 remainingMs(同归零 effect 原因)
  }, [remainingMs, record, t, tick])

  // 倒计时归零 → 自动切回 default
  // 2026-07-25 修复:本地优先,API 失败不阻断本地切换(兜底安全护栏必须保证最终生效)
  // 1. 先乐观更新 store + localStorage → 立即退出高风险
  // 2. 后台异步调 API 落库 + 失败重试 1 次
  // 2026-07-25 race condition 防御:自动切回前校验 watchedRecordRef === record,
  // 防止用户在最后一刻手动切到 bypass 时旧 expired record 残留触发自动切回
  const autoSwitchedRef = React.useRef(false)
  React.useEffect(() => {
    if (!record) {
      autoSwitchedRef.current = false
      watchedRecordRef.current = null
      return
    }
    if (remainingMs > 0) return
    if (autoSwitchedRef.current) {
      console.log('[auto-revert:auto-switch] 跳过:已触发过', { autoSwitchedRef: autoSwitchedRef.current })
      return
    }
    // 2026-07-25 race condition 防御:当前 record 不是我们 watch 的那个
    // (用户已重启 record / 切走模式 / 跨标签页 cancel),跳过自动切回
    if (watchedRecordRef.current !== record) {
      console.log('[auto-revert:auto-switch] 跳过:watchedRecordRef !== record', { watched: watchedRecordRef.current?.version, record: record.version })
      return
    }
    console.log('[auto-revert:auto-switch] 通过所有检查,准备切回')
    // 当前模式已被切走 → 清 record 退出
    const current = useAiPanelStore.getState().activeWorkspace?.mode
    if (current !== 'bypass-permissions') {
      setRecord(null)
      writeRecord(null)
      watchedRecordRef.current = null
      return
    }
    autoSwitchedRef.current = true
    // 计算本次完全访问累计时长(2026-07-25 深化):让用户知道"我开了多久"
    const usedMs = record ? Math.min(Date.now() - record.startedAt, record.durationMs) : 0
    const usedMin = Math.round(usedMs / 60000)
    console.log('[auto-revert:auto-switch] 触发自动切回', { usedMin, currentMode: useAiPanelStore.getState().activeWorkspace?.mode })
    // 立即本地切回(安全护栏兜底,不能被 API 失败阻断)
    const store = useAiPanelStore.getState()
    if (store.activeWorkspace) {
      store.setActiveWorkspace({ ...store.activeWorkspace, mode: 'default' })
      console.log('[auto-revert:auto-switch] 已设 store mode=default', { newMode: useAiPanelStore.getState().activeWorkspace?.mode })
    } else {
      console.log('[auto-revert:auto-switch] store.activeWorkspace 为空,无法切回')
    }
    setRecord(null)
    writeRecord(null)
    watchedRecordRef.current = null
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
    watchedRecordRef.current = null
    toast.success(t('cancelAutoRevert') + ' ✓', {
      description: '当前保持完全访问,关闭标签页/刷新后也不会自动降级',
      duration: 3000,
    })
  }, [t])

  /** 延长计时(从 now 重置 durationMs) */
  const extendRevert = React.useCallback(
    (extraMs: number = durationMs) => {
      const currentPath = activeWorkspace?.path ?? ''
      const next: AutoRevertRecord = {
        startedAt: Date.now(),
        durationMs: extraMs,
        workspacePath: currentPath,
        version: ++globalRecordVersion,
      }
      watchedRecordRef.current = next
      setRecord(next)
      writeRecord(next)
    },
    [durationMs, activeWorkspace?.path],
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

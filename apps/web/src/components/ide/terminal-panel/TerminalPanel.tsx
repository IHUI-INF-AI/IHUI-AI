// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useTerminalSession } from '@/hooks/use-terminal-session'
import type { TerminalSplitDirection } from '@/stores/terminal'
import { TerminalTabBar } from '../terminal-tab-bar'
import { SplitPaneContainer } from './SplitPaneContainer'
import { FONT_SIZE_DEFAULT } from './constants'

/** 终端面板主组件 — tab bar + 分屏容器 */
export function TerminalPanel() {
  const {
    sessions,
    activeSessionId,
    createSession,
    closeSession,
    renameSession,
    setActive,
    refreshSessions,
    hasToken,
    loading,
    // pane state
    panes,
    activePaneId,
    splitDirections,
    addPane,
    removePane,
    setActivePane,
    // 录制 / AI state(2026-07-23 立)
    recordingBySession,
    recordings,
    activePlaybackId,
    startRecording,
    stopRecording,
    listRecordings,
    playRecording,
    deleteRecording,
  } = useTerminalSession()
  const t = useTranslations('ide')

  // 全局字号状态(所有 session/pane 共享)
  const [fontSize, setFontSize] = React.useState<number>(FONT_SIZE_DEFAULT)

  // 首次挂载:刷新 session 列表,如果为空则自动创建一个
  const initRef = React.useRef(false)
  React.useEffect(() => {
    if (initRef.current || !hasToken) return
    initRef.current = true
    void (async () => {
      await refreshSessions()
      const store = await import('@/stores/terminal')
      const current = store.useTerminalStore.getState()
      if (current.sessions.length === 0) {
        await createSession()
      }
    })()
  }, [hasToken, createSession, refreshSessions])

  const handleNew = React.useCallback(
    (opts?: Parameters<typeof createSession>[0]) => {
      void createSession(opts)
    },
    [createSession],
  )

  const handleClose = React.useCallback(
    (id: string) => {
      void closeSession(id)
    },
    [closeSession],
  )

  const handleRename = React.useCallback(
    (id: string, name: string) => {
      void renameSession(id, name)
    },
    [renameSession],
  )

  // 当前激活 session 的 pane 列表
  const currentPaneIds = activeSessionId ? (panes[activeSessionId] ?? []) : []
  const currentDirection = activeSessionId
    ? (splitDirections[activeSessionId] ?? 'vertical')
    : 'vertical'

  // 分屏操作回调(传给 SplitPaneContainer)
  const handleAddPane = React.useCallback(
    (direction: TerminalSplitDirection) => {
      if (!activeSessionId) return
      addPane(activeSessionId, direction)
    },
    [activeSessionId, addPane],
  )

  const handleRemovePane = React.useCallback(
    (paneId: string) => {
      if (!activeSessionId) return
      const paneList = panes[activeSessionId] ?? []
      if (paneList.length <= 1) {
        // 只有一个 pane 时,关闭 pane = 关闭 session
        handleClose(activeSessionId)
        return
      }
      removePane(activeSessionId, paneId)
    },
    [activeSessionId, panes, removePane, handleClose],
  )

  // 录制切换(开始/停止,2026-07-23 立)
  const handleToggleRecording = React.useCallback(
    (sessionId: string) => {
      if (recordingBySession[sessionId]) {
        void stopRecording(sessionId)
      } else {
        void startRecording(sessionId)
      }
    },
    [recordingBySession, startRecording, stopRecording],
  )

  // 回放录制(2026-07-23 立)
  const handlePlayRecording = React.useCallback(
    (recordingId: string) => {
      void playRecording(recordingId)
    },
    [playRecording],
  )

  // 删除录制(2026-07-23 立)
  const handleDeleteRecording = React.useCallback(
    (recordingId: string) => {
      void deleteRecording(recordingId)
    },
    [deleteRecording],
  )

  // 刷新录制列表(2026-07-23 立)
  const handleRefreshRecordings = React.useCallback(() => {
    void listRecordings()
  }, [listRecordings])

  if (!hasToken) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        {t('terminalPanel.loginRequired')}
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <TerminalTabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActive}
        onClose={handleClose}
        onNew={handleNew}
        onRename={handleRename}
        loading={loading}
        recordingBySession={recordingBySession}
        onToggleRecording={handleToggleRecording}
        recordings={recordings}
        onRefreshRecordings={handleRefreshRecordings}
        onPlayRecording={handlePlayRecording}
        onDeleteRecording={handleDeleteRecording}
        activePlaybackId={activePlaybackId}
      />
      <div className="min-h-0 flex-1">
        {activeSessionId && currentPaneIds.length > 0 ? (
          <SplitPaneContainer
            sessionId={activeSessionId}
            paneIds={currentPaneIds}
            direction={currentDirection}
            activePaneId={activePaneId}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            onAddPane={handleAddPane}
            onRemovePane={handleRemovePane}
            onSetActivePane={setActivePane}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            {loading ? t('terminalPanel.creatingTerminal') : t('terminalPanel.createHint')}
          </div>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

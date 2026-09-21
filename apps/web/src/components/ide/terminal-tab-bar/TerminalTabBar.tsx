// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { Circle, Play, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import type { TerminalSession, TerminalCreateInput, TerminalRecordingListItem } from '@ihui/types'
import { useTranslations } from 'next-intl'
import { TerminalTab } from './TerminalTab'
import { NewSessionMenu } from './NewSessionMenu'
import { RecordingDrawer } from './RecordingDrawer'

export interface TerminalTabBarProps {
  sessions: TerminalSession[]
  activeSessionId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  /** 新建会话(支持本地 shell 或 SSH 远程,参数透传到 terminal-service.createSession) */
  onNew: (opts?: TerminalCreateInput) => void
  onRename: (id: string, name: string) => Promise<boolean> | void
  /** 录制状态:sessionId → recordingId(值为 undefined 表示该 session 未在录制) */
  recordingBySession: Record<string, string>
  /** 切换录制(开始/停止),由 terminal-panel 调用 REST + store */
  onToggleRecording: (sessionId: string) => void
  /** 录制列表(REST 拉取,录制列表抽屉消费) */
  recordings: TerminalRecordingListItem[]
  /** 拉取录制列表(打开抽屉时触发) */
  onRefreshRecordings: () => void
  /** 回放录制(POST /recordings/:id/play) */
  onPlayRecording: (recordingId: string) => void
  /** 删除录制(DELETE /recordings/:id) */
  onDeleteRecording: (recordingId: string) => void
  /** 当前正在回放的录制 ID(用于显示回放徽章,null=无回放) */
  activePlaybackId: string | null
}

/**
 * 终端 tab bar — 多 session 切换 + 新建(本地 / SSH 远程) + 关闭 + 双击 rename
 * + 录制控制/列表抽屉。
 *
 * 2026-09-09 0-6 组件拆分:视图层按 terminal-panel 文件夹模式拆为——
 * - TerminalTab(单 tab:激活/录制点/rename/关闭)
 * - NewSessionMenu(新建菜单:连接类型 + shell 选择 + SSH 表单,状态自持)
 * - RecordingDrawer(录制列表抽屉,状态自持)
 * 纯函数复用 model.ts(label/subtitle/SSH 校验/录制时长格式化)。
 *
 * 样式约束(AGENTS.md §4):分隔(非 divide-x)、gap-* 间距、禁止 rounded-full /
 * 蓝色发光边框、active tab 用 subtle 颜色变化。
 */
export function TerminalTabBar({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onClose,
  onNew,
  onRename,
  recordingBySession,
  onToggleRecording,
  recordings,
  onRefreshRecordings,
  onPlayRecording,
  onDeleteRecording,
  activePlaybackId,
}: TerminalTabBarProps) {
  const t = useTranslations('ide')

  // rename 状态(跨 tab 共享:同一时刻只有一个 tab 处于 rename 态)
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState('')

  const handleStartRename = (session: TerminalSession, fallbackLabel: string) => {
    setRenamingId(session.id)
    setRenameValue(session.name ?? fallbackLabel)
  }

  const handleConfirmRename = async () => {
    const id = renamingId
    if (!id) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      await onRename(id, trimmed)
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleCancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  /** 录制按钮点击(切换当前激活 session 的录制状态) */
  const handleToggleRecording = () => {
    if (!activeSessionId) return
    onToggleRecording(activeSessionId)
  }

  /** 当前激活 session 是否正在录制 */
  const isCurrentRecording = activeSessionId ? !!recordingBySession[activeSessionId] : false

  return (
    <div className="flex items-center gap-1 bg-muted/30 px-2 py-1">
      {sessions.map((session, index) => (
        <TerminalTab
          key={session.id}
          session={session}
          index={index}
          isActive={session.id === activeSessionId}
          isRecording={!!recordingBySession[session.id]}
          renaming={renamingId === session.id}
          renameValue={renameValue}
          onRenameValueChange={setRenameValue}
          onConfirmRename={() => void handleConfirmRename()}
          onCancelRename={handleCancelRename}
          onStartRename={() => handleStartRename(session, `Terminal ${index + 1}`)}
          onSelect={onSelect}
          onClose={onClose}
        />
      ))}

      {/* 新建按钮 + 下拉菜单(本地 shell / SSH 远程) */}
      <NewSessionMenu loading={loading} onNew={onNew} />

      {loading && (
        <span className="ml-1 text-[10px] text-muted-foreground/60">
          {t('terminalTabBar.creating')}
        </span>
      )}

      {/* 右侧:录制控制 + 回放徽章 + 录制列表抽屉 */}
      <div className="ml-auto flex items-center gap-1">
        {/* 回放徽章(正在回放录制时显示) */}
        {activePlaybackId && (
          <span className="flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">
            <Play className="h-2.5 w-2.5" />
            <span>{t('terminalTabBar.playing')}</span>
          </span>
        )}

        {/* 录制按钮:切换当前激活 session 的录制状态 */}
        <Tooltip
          content={
            isCurrentRecording
              ? t('terminalTabBar.stopRecording')
              : t('terminalTabBar.startRecording')
          }
        >
          <button
            type="button"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
              isCurrentRecording
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'text-muted-foreground hover:bg-background hover:text-foreground',
              !activeSessionId && 'pointer-events-none opacity-40',
            )}
            onClick={handleToggleRecording}
            disabled={!activeSessionId}
            aria-label={
              isCurrentRecording
                ? t('terminalTabBar.stopRecording')
                : t('terminalTabBar.startRecording')
            }
          >
            {isCurrentRecording ? (
              <Circle className="h-3 w-3 fill-current" />
            ) : (
              <Video className="h-3 w-3" />
            )}
          </button>
        </Tooltip>

        <RecordingDrawer
          recordings={recordings}
          onRefresh={onRefreshRecordings}
          onPlay={onPlayRecording}
          onDelete={onDeleteRecording}
        />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

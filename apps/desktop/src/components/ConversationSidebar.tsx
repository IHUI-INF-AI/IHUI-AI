import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { ConversationSummary } from '../lib/desktop'

interface Props {
  list: ConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onRename: (id: string, newTitle: string) => Promise<void>
}

/** 格式化时间戳为相对时间(刚刚 / N 分钟前 / N 小时前 / 月-日)。 */
function formatRelative(ts: number): string {
  const now = Date.now()
  const diff = Math.max(0, now - ts * 1000)
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  const d = new Date(ts * 1000)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

/**
 * 会话历史侧边栏(仅桌面端 Tauri 环境启用,浏览器不渲染)。
 * 显示会话列表 + 新建按钮 + 单项删除 + 双击重命名。
 */
export default function ConversationSidebar({ list, activeId, onSelect, onDelete, onNew, onRename }: Props) {
  const { t } = useI18n()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const onStartRename = (c: ConversationSummary) => {
    setRenamingId(c.id)
    setRenameValue(c.title)
  }

  const onCommitRename = async () => {
    if (!renamingId) return
    const newTitle = renameValue.trim()
    const original = list.find((c) => c.id === renamingId)?.title ?? ''
    setRenamingId(null)
    setRenameValue('')
    if (newTitle && newTitle !== original) {
      await onRename(renamingId, newTitle)
    }
  }

  const onCancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <aside className="conv-sidebar" aria-label={t('chat.conversationHistory')}>
      <div className="conv-sidebar-header">
        <span className="conv-sidebar-title">{t('chat.conversationHistory')}</span>
        <button type="button" className="conv-new-btn" onClick={onNew} aria-label={t('chat.newChat')}>
          +
        </button>
      </div>
      <div className="conv-list">
        {list.length === 0 ? (
          <div className="conv-empty">{t('chat.noConversations')}</div>
        ) : (
          list.map((c) => (
            <div
              key={c.id}
              className={`conv-item${c.id === activeId ? ' conv-item--active' : ''}`}
              onClick={() => {
                if (renamingId === c.id) return
                onSelect(c.id)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (renamingId === c.id) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(c.id)
                }
              }}
            >
              {renamingId === c.id ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  className="conv-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void onCommitRename()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      onCancelRename()
                    }
                  }}
                  onBlur={() => void onCommitRename()}
                  aria-label={t('chat.renameConversation')}
                  maxLength={60}
                />
              ) : (
                <div
                  className="conv-item-title"
                  title={`${c.title}\n${t('chat.renameHint')}`}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onStartRename(c)
                  }}
                >
                  {c.title}
                </div>
              )}
              <div className="conv-item-meta">
                <span>{formatRelative(c.updatedAt)}</span>
                <span className="conv-item-count">{c.messageCount}</span>
                {renamingId !== c.id ? (
                  <button
                    type="button"
                    className="conv-item-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(t('chat.deleteConfirm'))) onDelete(c.id)
                    }}
                    aria-label={t('chat.deleteConversation')}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

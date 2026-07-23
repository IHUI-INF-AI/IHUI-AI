import { useI18n } from '../i18n'
import type { ConversationSummary } from '../lib/desktop'

interface Props {
  list: ConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
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
 * 显示会话列表 + 新建按钮 + 单项删除。
 */
export default function ConversationSidebar({ list, activeId, onSelect, onDelete, onNew }: Props) {
  const { t } = useI18n()
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
              onClick={() => onSelect(c.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(c.id)
                }
              }}
            >
              <div className="conv-item-title" title={c.title}>
                {c.title}
              </div>
              <div className="conv-item-meta">
                <span>{formatRelative(c.updatedAt)}</span>
                <span className="conv-item-count">{c.messageCount}</span>
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
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

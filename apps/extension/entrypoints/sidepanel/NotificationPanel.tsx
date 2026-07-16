import { useNotificationStore } from '../../lib/notification-store'

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export default function NotificationPanel() {
  const { notifications, visible, markAllRead, setVisible, clearAll } = useNotificationStore()

  if (!visible) return null

  return (
    <>
      <div className="sp-np-overlay" onClick={() => setVisible(false)} />
      <div className="sp-np-panel" role="dialog" aria-label="通知">
        <div className="sp-np-header">
          <span className="sp-np-title">通知</span>
          <div className="sp-np-actions">
            <button className="sp-np-btn" onClick={markAllRead} type="button">
              全部已读
            </button>
            <button className="sp-np-btn" onClick={clearAll} type="button">
              清空
            </button>
            <button
              className="sp-np-btn sp-np-close"
              onClick={() => setVisible(false)}
              type="button"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>
        <div className="sp-np-list">
          {notifications.length === 0 ? (
            <div className="sp-np-empty">暂无通知</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`sp-np-item ${n.isRead ? 'read' : 'unread'}`}>
                <div className="sp-np-item-title">{n.title}</div>
                {n.content ? <div className="sp-np-item-content">{n.content}</div> : null}
                <div className="sp-np-item-time">{formatTime(n.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

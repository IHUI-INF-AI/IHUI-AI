import { useNotificationStore } from '../../lib/notification-store'
import { useI18n } from '../../src/i18n'

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
  const { t } = useI18n()
  const { notifications, visible, markAllRead, setVisible, clearAll } = useNotificationStore()

  if (!visible) return null

  return (
    <>
      <div className="sp-np-overlay" onClick={() => setVisible(false)} />
      <div className="sp-np-panel" role="dialog" aria-label={t('notification.title')}>
        <div className="sp-np-header">
          <span className="sp-np-title">{t('notification.title')}</span>
          <div className="sp-np-actions">
            <button className="sp-np-btn" onClick={markAllRead} type="button">
              {t('notification.markAllRead')}
            </button>
            <button className="sp-np-btn" onClick={clearAll} type="button">
              {t('notification.clearAll')}
            </button>
            <button
              className="sp-np-btn sp-np-close"
              onClick={() => setVisible(false)}
              type="button"
              aria-label={t('notification.close')}
            >
              ×
            </button>
          </div>
        </div>
        <div className="sp-np-list">
          {notifications.length === 0 ? (
            <div className="sp-np-empty">{t('notification.empty')}</div>
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

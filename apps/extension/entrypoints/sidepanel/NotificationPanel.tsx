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
      <div className="fixed inset-0 bg-black/20 z-[90]" onClick={() => setVisible(false)} />
      <div
        className="fixed top-0 right-0 bottom-0 w-[300px] max-w-[90vw] bg-card border-l border-border shadow-[-4px_0_16px_rgba(0,0,0,0.08)] z-[100] flex flex-col"
        role="dialog"
        aria-label={t('notification.title')}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
          <span className="font-semibold text-[13px]">{t('notification.title')}</span>
          <div className="flex items-center gap-1.5">
            <button
              className="bg-transparent border border-border rounded-[5px] px-2 py-0.5 text-[11px] cursor-pointer text-inherit hover:bg-muted"
              onClick={markAllRead}
              type="button"
            >
              {t('notification.markAllRead')}
            </button>
            <button
              className="bg-transparent border border-border rounded-[5px] px-2 py-0.5 text-[11px] cursor-pointer text-inherit hover:bg-muted"
              onClick={clearAll}
              type="button"
            >
              {t('notification.clearAll')}
            </button>
            <button
              className="bg-transparent border-none text-base leading-none px-1.5 py-0.5 cursor-pointer text-inherit hover:bg-muted"
              onClick={() => setVisible(false)}
              type="button"
              aria-label={t('notification.close')}
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {notifications.length === 0 ? (
            <div className="py-8 px-3 text-center text-muted-foreground text-xs">
              {t('notification.empty')}
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-2.5 py-2 rounded-md mb-0.5 ${n.isRead ? '' : 'bg-muted'}`}
              >
                <div className="font-medium text-xs mb-0.5">{n.title}</div>
                {n.content ? (
                  <div className="text-[11px] text-muted-foreground mb-0.5 break-words">
                    {n.content}
                  </div>
                ) : null}
                <div className="text-[10px] text-muted-foreground">{formatTime(n.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

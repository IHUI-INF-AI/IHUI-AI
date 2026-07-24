/**
 * ComingSoonPage — 尚未实现的页面占位(2026-07-25 立)。
 *
 * 用于应用中心列出但尚未独立实现的路由,展示"即将上线"提示 +
 * 提供"在网页版打开"按钮(chrome.tabs.create)。
 *
 * 一旦对应页面独立实现完成,从 SidepanelApp.tsx 的路由表中
 * 将 ComingSoonPage 替换为实际页面组件即可。
 */
import { useI18n } from '../../../src/i18n'

interface ComingSoonPageProps {
  /** 页面标题 i18n key */
  titleKey: string
  /** web 端 URL(用于"在网页版打开"按钮) */
  webUrl?: string
}

export function ComingSoonPage({ titleKey, webUrl }: ComingSoonPageProps) {
  const { t } = useI18n()
  return (
    <div className="p-4 md:p-6 flex flex-col items-center justify-center gap-3 min-h-[60vh] text-center">
      <span className="text-4xl" aria-hidden>
        🚧
      </span>
      <h3 className="m-0 text-sm font-semibold">{t(titleKey)}</h3>
      <p className="m-0 text-xs text-muted-foreground">{t('apps.comingSoon')}</p>
      {webUrl ? (
        <button
          type="button"
          onClick={() => void chrome.tabs.create({ url: webUrl })}
          className="mt-2 px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
        >
          {t('apps.openInWeb')} ↗
        </button>
      ) : null}
    </div>
  )
}

export default ComingSoonPage

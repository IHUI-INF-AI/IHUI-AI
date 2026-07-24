/**
 * AppListPage — 通用应用中心列表页(2026-07-25 立)。
 *
 * 用于 AI / 内容 / 我的 三大分类的首页,展示该分类下所有功能入口。
 * - 内部路由(to):点击在扩展 sidepanel 内导航
 * - 外部链接(externalUrl):点击用 chrome.tabs.create 在网页版打开
 *
 * 设计原则:
 * - 卡片网格布局,sm 单列 / md 双列,适配 320-576px 扩展面板宽度
 * - 移动端 375-428px 触摸优化:卡片高度足够(py-3),字号放大(text-sm)
 * - 复用 design-tokens,与 web 端 Card 风格一致
 */
import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../src/i18n'

export interface AppItem {
  /** 内部路由路径(优先) */
  to?: string
  /** 外部 web 端 URL(to 为空时使用,会在新标签页打开) */
  externalUrl?: string
  /** 图标(emoji 或 ReactNode) */
  icon: ReactNode
  /** 标题 i18n key */
  titleKey: string
  /** 描述 i18n key */
  descKey: string
  /** 角标(如未读数、状态等) */
  badge?: string | number
  /** 是否即将上线(灰色禁用) */
  comingSoon?: boolean
}

interface AppListPageProps {
  /** 页面标题 i18n key */
  titleKey: string
  /** 应用列表 */
  items: AppItem[]
}

export function AppListPage({ titleKey, items }: AppListPageProps) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const handleClick = (item: AppItem) => {
    if (item.comingSoon) return
    if (item.to) {
      navigate(item.to)
      return
    }
    if (item.externalUrl) {
      void chrome.tabs.create({ url: item.externalUrl })
    }
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t(titleKey)}</h3>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => {
          const isExternal = !item.to && !!item.externalUrl
          return (
            <button
              key={item.titleKey}
              type="button"
              onClick={() => handleClick(item)}
              disabled={item.comingSoon}
              className={`group flex flex-col items-start gap-1 p-3 text-left rounded-md border border-border bg-card transition-colors ${
                item.comingSoon
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:border-muted-foreground hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-xl leading-none shrink-0" aria-hidden>
                  {item.icon}
                </span>
                <span className="text-sm font-medium flex-1 truncate">
                  {t(item.titleKey)}
                </span>
                {item.badge ? (
                  <span className="min-w-4 h-4 px-1 bg-destructive text-primary-foreground text-[10px] font-semibold rounded inline-flex items-center justify-center leading-none">
                    {item.badge}
                  </span>
                ) : null}
                {isExternal && !item.comingSoon ? (
                  <span
                    className="text-[10px] text-muted-foreground shrink-0"
                    aria-label={t('apps.openInWeb')}
                    title={t('apps.openInWeb')}
                  >
                    ↗
                  </span>
                ) : null}
                {item.comingSoon ? (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {t('apps.comingSoon')}
                  </span>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {t(item.descKey)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AppListPage

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D181 电脑使用画中画(2026-10-23 立项落地,对标竞品 chatSession.pictureInPicture.* 五键)。
// 形态 = 2026-09-30 拍板 + 本轮用户令"现在就立项落地":computer-use 会话可视化本体未立项,
// 本面只做「开关 + 持久化 + 空态占位」;开关真接既有画中画能力面 —— 浏览器内等价 API 为
// Document Picture-in-Picture(window.documentPictureInPicture.requestWindow,Chromium ≥116):
// 隐藏档翻转 ⇒ 关闭已开的画中画浮窗;可见且能力在位 ⇒ 占位区提供真开窗动作。
// 词包挂在 aiChat.pictureInPicture 下(同 D182/D183 把竞品 chatSession.headerActions
// 落为 aiChat.headerActions 的先例)。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, PictureInPicture2 } from 'lucide-react'

import { usePictureInPicturePrefsStore } from '@/stores/picture-in-picture-prefs'

/** Document Picture-in-Picture 能力面(仓内唯一既有画中画 API 通道;TS lib 未收录,本地声明) */
interface DocumentPictureInPictureLike {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>
}

/** 本组件开出的浮窗(模块级单例:同页多会话窗格共用一个画中画面板) */
let pipWindow: Window | null = null

function getPipCapability(): DocumentPictureInPictureLike | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { documentPictureInPicture?: DocumentPictureInPictureLike })
    .documentPictureInPicture
}

export function PictureInPictureSection({ conversationId }: { conversationId: string | null }) {
  const t = useTranslations('aiChat')
  const hideInAllSessions = usePictureInPicturePrefsStore((s) => s.hideInAllSessions)
  const hiddenConversationIds = usePictureInPicturePrefsStore((s) => s.hiddenConversationIds)
  const setHideInAllSessions = usePictureInPicturePrefsStore((s) => s.setHideInAllSessions)
  const setSessionHidden = usePictureInPicturePrefsStore((s) => s.setSessionHidden)
  const [failed, setFailed] = React.useState(false)
  const [canOpenPip, setCanOpenPip] = React.useState(false)

  const hiddenInSession = conversationId !== null && hiddenConversationIds.includes(conversationId)
  const visible = !hideInAllSessions && !hiddenInSession

  React.useEffect(() => {
    setCanOpenPip(getPipCapability() !== undefined)
  }, [])

  // 规格语义:任一隐藏档生效 ⇒ 画中画不得再浮在屏上 ⇒ 真关既有浮窗
  React.useEffect(() => {
    if (!visible && pipWindow && !pipWindow.closed) {
      pipWindow.close()
      pipWindow = null
    }
  }, [visible])

  const applyToggle = (fn: () => void) => {
    try {
      fn()
      setFailed(false)
    } catch {
      // 偏好通道写入失败(如存储配额)⇒ 按规格报 updateFailed,不静默吞
      setFailed(true)
    }
  }

  const openPipWindow = () => {
    const dpp = getPipCapability()
    if (!dpp) return
    dpp
      .requestWindow({ width: 480, height: 360 })
      .then((w) => {
        pipWindow = w
        w.document.title = t('pictureInPicture.title')
        w.document.body.textContent = t('pictureInPicture.emptyState')
        w.addEventListener('pagehide', () => {
          if (pipWindow === w) pipWindow = null
        })
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }

  const switchClass = 'h-4 w-4 accent-primary'

  return (
    <section
      data-testid="pip-section"
      aria-label={t('pictureInPicture.sectionLabel')}
      className="mx-auto mb-1 w-full max-w-2xl rounded-lg border bg-card text-body"
    >
      {/* 2026-11-04 第三轮结构性修正(D181 二次调整):本节的落点从「消息流内容」
          改为「面板常驻条」,并以 <details> 折叠。
          旧形态是滚动内容的第一块:消息流一滚,卡片上半截滑出滚动视口,而滚动视口顶边
          正好是档位胶囊的底边 —— 280 下 elementFromPoint 采样有 40% 落在 detail-mode-* 上
          (pip-open-window 命中 60%)。这类"固定条 vs 滚动内容"共享同一条带的问题,
          靠 z-index/pointer-events 修不了:被遮部分本来就被滚动容器裁掉了。
          结构性解法 = 把该节挪出滚动容器,放进面板常驻条;折叠态只占一行,
          开窗按钮常驻 summary(不展开也能点),两个开关留在展开体里。 */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-label [&::-webkit-details-marker]:hidden">
          <PictureInPicture2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-semibold">
            {t('pictureInPicture.sectionLabel')}
          </span>
          {visible && canOpenPip ? (
            <button
              type="button"
              data-testid="pip-open-window"
              // summary 内的按钮默认会连带翻转折叠态:显式取消默认行为,只开窗
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openPipWindow()
              }}
              className="shrink-0 rounded-sm border px-2 py-0.5 text-label font-medium transition hover:bg-accent"
            >
              {t('pictureInPicture.openWindow')}
            </button>
          ) : null}
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="px-3 pb-2">
          <p className="mb-2 text-label text-muted-foreground">{t('pictureInPicture.title')}</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                role="switch"
                data-testid="pip-hide-in-session"
                className={switchClass}
                aria-checked={hiddenInSession}
                checked={hiddenInSession}
                disabled={conversationId === null}
                onChange={(e) =>
                  applyToggle(() => {
                    if (conversationId !== null) setSessionHidden(conversationId, e.target.checked)
                  })
                }
              />
              <span>{t('pictureInPicture.hideInSession')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                role="switch"
                data-testid="pip-hide-in-all-sessions"
                className={switchClass}
                aria-checked={hideInAllSessions}
                checked={hideInAllSessions}
                onChange={(e) => applyToggle(() => setHideInAllSessions(e.target.checked))}
              />
              <span>{t('pictureInPicture.hideInAllSessions')}</span>
            </label>
          </div>
          {visible ? (
            <div
              data-testid="pip-empty-state"
              className="mt-2 rounded-md border border-dashed px-3 py-2 text-label text-muted-foreground"
            >
              {t('pictureInPicture.emptyState')}
            </div>
          ) : null}
          {failed ? (
            <p
              role="alert"
              data-testid="pip-update-failed"
              className="mt-2 text-label text-destructive"
            >
              {t('pictureInPicture.updateFailed')}
            </p>
          ) : null}
        </div>
      </details>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

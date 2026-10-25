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
import { PictureInPicture2 } from 'lucide-react'

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
      className="mx-auto mb-2 max-w-2xl rounded-lg border bg-card p-3 text-sm"
    >
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <PictureInPicture2 className="h-4 w-4 text-primary" aria-hidden />
        <span>{t('pictureInPicture.sectionLabel')}</span>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{t('pictureInPicture.title')}</p>
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
          className="mt-2 flex items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground"
        >
          <span>{t('pictureInPicture.emptyState')}</span>
          {canOpenPip ? (
            <button
              type="button"
              data-testid="pip-open-window"
              onClick={openPipWindow}
              className="rounded-sm border px-2 py-0.5 font-medium transition hover:bg-accent"
            >
              {t('pictureInPicture.openWindow')}
            </button>
          ) : null}
        </div>
      ) : null}
      {failed ? (
        <p role="alert" data-testid="pip-update-failed" className="mt-2 text-xs text-destructive">
          {t('pictureInPicture.updateFailed')}
        </p>
      ) : null}
    </section>
  )
}

export default PictureInPictureSection
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

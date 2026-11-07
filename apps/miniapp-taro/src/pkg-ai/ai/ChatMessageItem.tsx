// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { aizhsUrl } from '@/constants/icon-urls'
import { useI18n } from '@/i18n'
import { Button, Image, Video, View } from '@tarojs/components'
import type { ReactNode } from 'react'
import LineIcon, { type LineIconProps } from '@/components/LineIcon'
import { StreamActivityCards, SteerNoticeCard } from './cards/ai-cards'
import { taroPreviewChatImages, taroSaveChatImageToAlbum } from '@/lib/image-preview-pack'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/api'
import { rateChatMessage, sendToolApprovalResponse } from '@/api'
import { APPROVAL_ACTIONS } from './permission-tier-text'
import { rpx } from '@/utils/rpx'
import { onToast } from '@/host/on-toast'
import { ChatMessageItemView } from '@ihui/rn-app/features/chat/ChatMessageItem'

const sikaoIcon = aizhsUrl('remote-images/sikao_icon.png')
const downloadIcon = aizhsUrl('remote-images/download.png')
const copyIcon = aizhsUrl('remote-images/copy.png')
const reuseBtnPng = aizhsUrl('remote-images/fuyong_btn.png')
const agentsharePng = aizhsUrl('remote-images/agentshare.png')

export interface ChatMessageItemProps {
  msg: ChatMessage
  onReuse?: (question: string) => void
  /** 票59:必须把"点的是哪一条"原样传下去 —— 只接 `() => void` 时宿主拿不到目标行,
   *  重新生成只会落在最后一条助手消息上,给旧回答开的新版本就会挂错版本族。 */
  onRegenerate?: (msg: ChatMessage) => void
  onLongPress?: () => void
  onEdit?: () => void
  isFavorited?: boolean
  onToggleFavorite?: () => void
  onSpeak?: (content: string) => void
  onOpenReasoning?: () => void
  onShare?: () => void
  /** 版本菜单节点(由调用方按 messageId 注入;端内不自判族) */
  versionMenuSlot?: ReactNode
}

/**
 * 端内适配器:视觉结构已上收 `@ihui/rn-app/features/chat/ChatMessageItem`。
 * 本文件只保留平台行为(剪贴板/相册/音频/导航/接口/分享 Button)与端内子件注入;
 * 共享件不认识 Taro,也不判断端。
 */
export default function ChatMessageItem({
  msg,
  onReuse,
  onRegenerate,
  onLongPress,
  onEdit,
  isFavorited,
  onToggleFavorite,
  onSpeak,
  onOpenReasoning,
  onShare,
  versionMenuSlot,
}: ChatMessageItemProps) {
  const { t } = useI18n()
  const [cardsExpanded, setCardsExpanded] = useState(true)
  const audioContextRef = useRef<Taro.InnerAudioContext | null>(null)
  useEffect(() => {
    return () => {
      audioContextRef.current?.destroy()
      audioContextRef.current = null
    }
  }, [])

  async function handleRate(next: 'like' | 'dislike') {
    const messageId = msg.id
    if (!messageId) return
    await rateChatMessage({ messageId, rating: next })
  }

  async function handleApproval(actionId: string) {
    const action = APPROVAL_ACTIONS.find((a) => a.id === actionId)
    if (!action || !msg.id) return
    await sendToolApprovalResponse({
      approvalId: msg.id,
      decision: action.decision,
      ...(action.scope !== undefined ? { scope: action.scope } : {}),
    })
  }

  function playVoice(url: string, onEnded: () => void) {
    audioContextRef.current?.destroy()
    const audio = Taro.createInnerAudioContext()
    audioContextRef.current = audio
    audio.src = url
    audio.onEnded(onEnded)
    audio.onError(onEnded)
    audio.play()
  }

  /** 下载图片到相册(D64② 接线:保存成败判定走共享层 imageTransferView 出口) */
  async function downloadImages(urls: string[]) {
    if (!urls.length) return
    Taro.showLoading({ title: t('ai.chatMessageItem.downloading') })
    let labelKey = ''
    let failed = false
    for (const url of urls) {
      let filePath = ''
      try {
        const res = await Taro.downloadFile({ url })
        if (res.statusCode === 200) filePath = res.tempFilePath
      } catch {
        filePath = ''
      }
      const out = await taroSaveChatImageToAlbum(filePath)
      labelKey = out.labelKey
      if (out.result === 'failed') {
        failed = true
        break
      }
    }
    Taro.hideLoading()
    if (!failed) {
      onToast(t(labelKey), { kind: 'success' })
      return
    }
    const setting = await Taro.getSetting().catch(() => null)
    if (setting?.authSetting?.['scope.writePhotosAlbum'] === false) {
      Taro.showModal({
        title: t('common.hint'),
        content: t('ai.chatMessageItem.needAlbumAuth'),
        confirmText: t('common.goSettings'),
        success: (res) => {
          if (res.confirm) Taro.openSetting()
        },
      })
    } else {
      onToast(t(labelKey), { kind: 'info' })
    }
  }

  function copyText(text: string) {
    if (!text || !text.trim()) {
      onToast(t('ai.chatMessageItem.noContent'), { kind: 'info' })
      return
    }
    Taro.setClipboardData({
      data: text,
      success: () => onToast(t('success.copied'), { kind: 'info' }),
    })
  }

  const cardsCount =
    (msg.aiCards?.planSteps.length ?? 0) +
    (msg.aiCards?.toolCalls.length ?? 0) +
    (msg.aiCards?.terminalTasks.length ?? 0) +
    (msg.aiCards?.subagentTasks?.length ?? 0) +
    (msg.aiCards?.injections?.length ?? 0) +
    (msg.aiCards?.citations?.length ?? 0)

  return (
    <ChatMessageItemView
      t={t}
      msg={msg}
      icons={{
        reuse: reuseBtnPng,
        copy: copyIcon,
        download: downloadIcon,
        sikao: sikaoIcon,
        share: agentsharePng,
      }}
      renderIcon={({ name, size, color, className, style, onClick }) => (
        <LineIcon
          name={name as LineIconProps['name']}
          size={size}
          color={color}
          className={className}
          style={style}
          onClick={onClick}
        />
      )}
      rpx={rpx}
      onCopy={copyText}
      onOpenImage={taroPreviewChatImages}
      onDownloadImages={downloadImages}
      onOpenDigitalHuman={() => {
        Taro.navigateTo({ url: '/pkg-ai/ai/agent' })
      }}
      onPlayVoice={playVoice}
      onRate={(next) => void handleRate(next)}
      onApproval={(actionId) => void handleApproval(actionId)}
      approvalActions={APPROVAL_ACTIONS.map((a) => ({
        id: a.id,
        label: t(a.key) || a.fallback,
      }))}
      onReuse={onReuse}
      onRegenerate={onRegenerate ? () => onRegenerate(msg) : undefined}
      onLongPress={onLongPress}
      onEdit={onEdit}
      isFavorited={isFavorited}
      onToggleFavorite={onToggleFavorite}
      onSpeak={onSpeak}
      onOpenReasoning={onOpenReasoning}
      onShare={onShare}
      versionMenuSlot={versionMenuSlot}
      renderVideo={(url, i) => (
        <Video
          key={`video-${i}`}
          src={url}
          style={{ width: '100%', marginTop: '10rpx' }}
          controls
          showPlayBtn
          showCenterPlayBtn
          enableProgressGesture
          objectFit="contain"
        />
      )}
      activityCardsSlot={
        msg.aiCards && cardsCount > 0 ? (
          <StreamActivityCards
            planSteps={msg.aiCards.planSteps}
            toolCalls={msg.aiCards.toolCalls}
            terminalTasks={msg.aiCards.terminalTasks}
            subagentTasks={msg.aiCards.subagentTasks}
            injections={msg.aiCards.injections ?? []}
            citations={msg.aiCards.citations ?? []}
            expanded={cardsExpanded}
            onToggleExpand={() => setCardsExpanded((v) => !v)}
          />
        ) : undefined
      }
      steerNoticeSlot={
        msg.aiCards?.steerNotices?.length ? (
          <SteerNoticeCard notices={msg.aiCards.steerNotices} />
        ) : undefined
      }
      shareSlot={
        <View className="share-btn" onClick={onShare} hoverClass="opacity-60">
          <Button openType="share" className="share-button">
            {t('ai.chatMessageItem.share')}
          </Button>
          <Image className="share-icon" src={agentsharePng} mode="widthFix" />
        </View>
      }
    />
  )
}

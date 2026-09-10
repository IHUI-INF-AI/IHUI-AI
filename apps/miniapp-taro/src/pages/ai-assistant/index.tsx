// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 助手页面(对标旧项目 pages/tools/ai_assistant.vue)
 * 改用 Taro 现有 chatStream(SSE 流式),保留核心交互:思考进度条 + 消息列表 + 复制/预览/可见性切换 + 快捷问题 + 分享。
 * 路由注册:需在 app.config.ts pages 追加 'pages/ai-assistant/index'。
 */
import { useTt, useI18n, t } from '@/i18n'
import { View, Text, ScrollView, Image, Input, Video } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import { chatStream, type ChatMessage } from '@/api'
import { getToken, getUserInfo } from '@/utils/auth'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'

interface QAItem {
  question: string
  answer: string
  images: string[]
  videos: string[]
  totalTokens?: number
  visible: boolean
}

const SUGGESTED = [
  '写一首关于春天的诗',
  t('aiassistant.q1'),
  t('aiassistant.q2'),
  t('aiassistant.q3'),
]
const IMG_EXT = /\.(jpeg|jpg|png|gif|webp|bmp|svg)(\?.*)?$/i
const IMG_DOMAINS = ['volces.com', 'fyshark.com', 's.coze.cn', 'coze.cn']

function isValidImageUrl(url: string): boolean {
  if (!url || !/^https?:\/\//.test(url)) return false
  if (IMG_EXT.test(url.split('?')[0] ?? '')) return true
  return IMG_DOMAINS.some((d) => url.includes(d))
}
function extractImageUrls(content: string): string[] {
  if (!content) return []
  const matches = content.match(/https?:\/\/[^\s<>"'\n\r\t,。!?:;()\[\]{}]+/gi) || []
  return Array.from(
    new Set(matches.map((u) => u.replace(/[.,;!?)\]}]+$/, '')).filter(isValidImageUrl)),
  )
}
function formatTokens(n?: number): string {
  if (typeof n !== 'number') return ''
  return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n)
}

export default function AiAssistantPage() {
  const tt = useTt()
  const router = useRouter()
  const { t } = useI18n()
  const [prompt, setPrompt] = useState('')
  const [list, setList] = useState<QAItem[]>([])
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [thinkingProgress, setThinkingProgress] = useState(0)
  const [pageTitle] = useState(t('aiassistant.p2'))
  const [tishiShow, setTishiShow] = useState(true)
  const [agentPrologue] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const shareIdxRef = useRef(0)

  useDidShow(() => {
    const p = router.params || {}
    if (p.souce === 'share' && p.question) {
      setList([
        {
          question: p.question,
          answer: p.content || '',
          images: extractImageUrls(p.content || ''),
          videos: [],
          visible: true,
        },
      ])
    } else if (p.prompt) {
      setPrompt(decodeURIComponent(p.prompt))
    }
    Taro.setNavigationBarTitle({ title: pageTitle })
  })

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const startProgress = useCallback(() => {
    setThinkingProgress(0)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    progressTimerRef.current = setInterval(() => {
      setThinkingProgress((p) => (p < 99 ? p + Math.random() * 1.2 : p))
    }, 120)
  }, [])

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setThinkingProgress(100)
    setTimeout(() => {
      setThinking(false)
      setThinkingProgress(0)
    }, 400)
  }, [])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => setScrollTop((s) => (s === 99998 ? 99999 : 99998)), 50)
  }, [])

  const copyHandle = useCallback(
    (text?: string) => {
      if (!text || !text.trim())
        return Taro.showToast({ title: t('ai.aiAssistant.nothingToCopy'), icon: 'none' })
      Taro.setClipboardData({
        data: text,
        success: () => Taro.showToast({ title: t('ai.aiAssistant.copySuccess'), icon: 'success' }),
        fail: () => Taro.showToast({ title: t('ai.aiAssistant.copyFailed'), icon: 'none' }),
      })
    },
    [t],
  )

  const toggleVisible = useCallback((idx: number) => {
    setList((prev) => prev.map((it, i) => (i === idx ? { ...it, visible: !it.visible } : it)))
  }, [])

  const handleSend = useCallback(async () => {
    const message = prompt.trim()
    if (!message)
      return Taro.showToast({ title: t('ai.aiAssistant.pleaseInputDesc'), icon: 'none' })
    if (loading) return Taro.showToast({ title: t('ai.aiAssistant.pleaseWait'), icon: 'none' })
    const u = getUserInfo() as { userMargin?: { tokenQuantity?: number } }
    if (u?.userMargin?.tokenQuantity && u.userMargin.tokenQuantity < 50000) {
      const r = await Taro.showModal({
        title: t('ai.aiAssistant.insufficientTokens'),
        content: t('ai.aiAssistant.goRecharge'),
      })
      if (r.confirm) Taro.navigateTo({ url: '/pages/wallet/recharge/index' })
      return
    }
    if (!getToken()) return Taro.showToast({ title: t('ai.aiAssistant.pleaseLogin'), icon: 'none' })

    const idx = list.length
    shareIdxRef.current = idx
    setList((prev) => [
      ...prev,
      { question: message, answer: t('aiassistant.text1'), images: [], videos: [], visible: true },
    ])
    setPrompt('')
    setLoading(true)
    setThinking(true)
    startProgress()
    scrollToBottom()

    const messages: ChatMessage[] = [{ role: 'user', content: message, timestamp: Date.now() }]
    abortRef.current = new AbortController()
    let acc = ''
    const imgs: string[] = []
    const vids: string[] = []
    let totalTokens: number | undefined

    try {
      await chatStream(
        messages,
        '',
        { model: 'GLM-4.5' },
        (delta) => {
          acc += delta
          extractImageUrls(delta).forEach((u) => !imgs.includes(u) && imgs.push(u))
          setList((prev) =>
            prev.map((it, i) =>
              i === idx ? { ...it, answer: acc, images: [...imgs], videos: [...vids] } : it,
            ),
          )
          scrollToBottom()
        },
        undefined,
        undefined,
        abortRef.current.signal,
        undefined,
        (done) => {
          totalTokens = done?.totalTokens
        },
      )
      setList((prev) =>
        prev.map((it, i) =>
          i === idx
            ? {
                ...it,
                answer: acc || tt('aiassistant.p1', '生成的图片:'),
                images: [...imgs],
                videos: [...vids],
                totalTokens,
                visible: true,
              }
            : it,
        ),
      )
    } catch (e) {
      logger.error('ai-assistant', 'chatStream', e)
      setList((prev) =>
        prev.map((it, i) =>
          i === idx ? { ...it, answer: t('aiassistant.failed2'), visible: true } : it,
        ),
      )
      Taro.showToast({ title: t('ai.aiAssistant.generateFailed'), icon: 'none' })
    } finally {
      setLoading(false)
      stopProgress()
      scrollToBottom()
    }
  }, [prompt, loading, list.length, startProgress, stopProgress, scrollToBottom, t, tt])

  useShareAppMessage(() => {
    const item = list[shareIdxRef.current]
    return {
      title: item?.question || tt('aiassistant.p2', '智汇AI助手'),
      path: `/pages/ai-assistant/index?souce=share&question=${encodeURIComponent(item?.question || '')}&content=${encodeURIComponent(item?.answer || '')}`,
    }
  })

  return (
    <ThemeRoot className="flex flex-col h-screen bg-background box-border">
      {/* 对齐 RN NavBar:px 10dp=20rpx / backBtn 32dp=64rpx / title 18dp=36rpx w600 / 透出 root 背景 */}
      <View className="flex flex-row items-center px-[20rpx] py-[12rpx] bg-background">
        <Text className="text-[48rpx] text-foreground" onClick={() => Taro.navigateBack()}>
          ←
        </Text>
        <Text className="flex-1 text-center text-[36rpx] font-semibold text-foreground truncate">
          {pageTitle}
        </Text>
        <View className="w-[64rpx]" />
      </View>

      {/* 对齐 RN listContent:px rpx(32)=32rpx / py rpx(16)=16rpx / pb rpx(32)=32rpx */}
      <ScrollView scrollY className="flex-1" scrollTop={scrollTop}>
        <View className="px-[32rpx] pt-[16rpx] pb-[32rpx]">
          {/* 对齐 RN ChatScreen tishiBtn:muted 底 / px16 py12 rpx / 8rpx 圆角 / 次级 26rpx 文字 */}
          <View
            className="flex flex-row items-center px-[16rpx] py-[12rpx] mb-[16rpx] rounded-[8rpx] bg-[var(--color-muted)]"
            onClick={() => setTishiShow((v) => !v)}
            hoverClass="opacity-60"
          >
            <Text className="text-[26rpx] text-muted-foreground">
              {tishiShow ? tt('common.close', '关闭') : tt('ai.tishi.view', '查看')}智能体引导说明
            </Text>
          </View>
          {/* 对齐 RN thinkingBox:maxWidth 78% / px16 py12 rpx / 8dp=16rpx 圆角 / muted 底 / 12dp=24rpx 次级文字 */}
          {tishiShow && agentPrologue ? (
            <View className="max-w-[78%] mb-[16rpx] px-[16rpx] py-[12rpx] bg-[var(--color-muted)] rounded-[16rpx]">
              <Text className="text-[24rpx] leading-[36rpx] text-muted-foreground">
                {agentPrologue}
              </Text>
            </View>
          ) : null}

          {/* 对齐 RN Empty:py 48dp=96rpx / px 24dp=48rpx / 文字 14dp=28rpx 次级色 */}
          {list.length === 0 ? (
            <View className="flex flex-col items-center py-[96rpx] px-[48rpx]">
              <Text className="text-[28rpx] text-muted-foreground">
                {tt('aiassistant.text3', '请在下方输入您的问题')}
              </Text>
            </View>
          ) : (
            list.map((item, idx) => (
              <View key={idx} className="mb-[16rpx]">
                {/* 对齐 RN bubbleStyles.rowUser:右对齐;气泡 px24 py16 rpx / 8dp=16rpx 圆角 / brand 底 + surface.light 字 / 14dp=28rpx */}
                <View className="flex flex-row justify-end mb-[8rpx]">
                  <View
                    className="max-w-[78%] px-[24rpx] py-[16rpx] bg-[var(--color-brand)] text-[var(--color-surface-light)] rounded-[16rpx] text-[28rpx] leading-[40rpx]"
                    onClick={() => setPrompt(item.question)}
                    hoverClass="opacity-60"
                  >
                    <Text>{item.question}</Text>
                  </View>
                </View>
                {item.visible ? (
                  <View className="flex flex-col">
                    {/* 对齐 RN bubbleAi:card 底 / px24 py16 rpx / 16rpx 圆角 / 28rpx 主文字 */}
                    <View className="max-w-[78%] px-[24rpx] py-[16rpx] bg-card rounded-[16rpx]">
                      <Text className="block text-[28rpx] leading-[40rpx] text-foreground whitespace-pre-wrap break-words">
                        {item.answer}
                      </Text>
                      {/* 对齐 RN imageGrid:gap 12rpx / mt 16rpx / 120dp=240rpx 方图 / 6dp=12rpx 圆角 */}
                      {item.images.length > 0 ? (
                        <View className="flex flex-row flex-wrap gap-[12rpx] mt-[16rpx]">
                          {item.images.map((url, i) => (
                            <Image
                              key={i}
                              className="w-[240rpx] h-[240rpx] rounded-[12rpx] bg-muted"
                              src={url}
                              mode="aspectFill"
                              onClick={() => Taro.previewImage({ current: url, urls: item.images })}
                            />
                          ))}
                        </View>
                      ) : null}
                      {item.videos.map((url, i) => (
                        <Video
                          key={`v-${i}`}
                          className="w-[240rpx] h-[240rpx] rounded-[12rpx] mt-[16rpx]"
                          src={url}
                          controls
                          showPlayBtn
                          showCenterPlayBtn
                        />
                      ))}
                    </View>
                    {/* 对齐 RN actionRow:mt 8rpx / 消耗文案 11dp=22rpx 三级色 / 操作次级色 gap 20rpx */}
                    <View className="flex flex-row items-center justify-between max-w-[78%] mt-[8rpx]">
                      <Text className="flex-1 mr-[16rpx] text-[22rpx] text-[var(--color-text-tertiary)]">
                        {tt('aiassistant.text4', '智汇AI生成')}
                        {item.totalTokens !== undefined
                          ? t('aiassistant.y1', { p1: formatTokens(item.totalTokens) })
                          : ''}
                      </Text>
                      <View className="flex flex-row items-center gap-[20rpx]">
                        <Text
                          className="text-[24rpx] text-muted-foreground"
                          onClick={() => toggleVisible(idx)}
                        >
                          {tt('forgot.hidePassword', '隐藏')}
                        </Text>
                        <Text
                          className="text-[24rpx] text-muted-foreground"
                          onClick={() => copyHandle(item.answer)}
                        >
                          {tt('ai.chatMessageItem.copy', '复制')}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="max-w-[78%] px-[24rpx] py-[16rpx] bg-card rounded-[16rpx] flex flex-row justify-center">
                    <Text
                      className="text-[24rpx] text-muted-foreground"
                      onClick={() => toggleVisible(idx)}
                    >
                      {tt('aiassistant.text5', '显示回答')}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 对齐 RN streamingBar:card 底 / py 12rpx / 12dp=24rpx 三级色文字(无上边框) */}
      {thinking ? (
        <View className="px-[24rpx] py-[12rpx] bg-card">
          <View className="flex flex-row items-center mb-[8rpx]">
            <Text className="text-[24rpx] text-[var(--color-text-tertiary)] mr-[12rpx]">
              {tt('aiassistant.text6', '正在极速生成中')}
            </Text>
            <Text className="text-[24rpx] text-[var(--color-text-tertiary)]">
              {Math.floor(thinkingProgress)}%
            </Text>
          </View>
          <View className="w-full h-[16rpx] bg-muted rounded-[8rpx] overflow-hidden">
            <View
              className="h-full bg-[var(--color-brand)] rounded-[8rpx] transition-all duration-300"
              style={{ width: `${thinkingProgress}%` }}
            />
          </View>
        </View>
      ) : null}

      {/* 对齐 RN quickWrap:root 背景 + 上边框 / 内容 px24 py16 rpx gap16rpx;chip px24 py12 rpx / 16dp=32rpx 圆角 / card 底描边 / 12dp=24rpx 次级字 */}
      <View className="bg-background border-t border-border">
        <ScrollView scrollX>
          <View className="flex flex-row gap-[16rpx] px-[24rpx] py-[16rpx]">
            {SUGGESTED.map((q) => (
              <View
                key={q}
                className="px-[24rpx] py-[12rpx] rounded-[32rpx] bg-card border border-border"
                onClick={() => {
                  setPrompt(q)
                  setTimeout(() => handleSend(), 0)
                }}
                hoverClass="opacity-60"
              >
                <Text className="text-[24rpx] text-muted-foreground whitespace-nowrap">{q}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      {/* 对齐 RN InputArea:row 底对齐 / px12 py8 dp=24/16 rpx / card 底 + 上边框;输入框 minHeight 48dp=96rpx / 12dp=24rpx 圆角 / root 底描边;发送钮 44dp=88rpx brand 底 */}
      <View className="flex flex-row items-end bg-card border-t border-border px-[24rpx] py-[16rpx]">
        <Input
          className="flex-1 h-[96rpx] px-[24rpx] bg-background border border-border rounded-[24rpx] text-[28rpx] text-foreground"
          placeholder={tt('tail.9', '请输入描述')}
          value={prompt}
          onInput={(e) => setPrompt(e.detail.value)}
          onConfirm={handleSend}
        />
        <View
          className={`ml-[16rpx] min-w-[88rpx] h-[88rpx] px-[16rpx] flex items-center justify-center rounded-[24rpx] ${loading ? 'bg-muted' : 'bg-[var(--color-brand)]'}`}
          onClick={handleSend}
          hoverClass="opacity-60"
        >
          <Text className="text-[28rpx] font-semibold text-[var(--color-surface-light)]">
            {loading ? tt('aiassistant.p3', '生成中') : tt('ai.agentDetail.runtimeSend', '发送')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 助手页面(对标旧项目 pages/tools/ai_assistant.vue)
 * 改用 Taro 现有 chatStream(SSE 流式),保留核心交互:思考进度条 + 消息列表 + 复制/预览/可见性切换 + 快捷问题 + 分享。
 * 路由注册:需在 app.config.ts pages 追加 'pages/ai-assistant/index'。
 */
import { View, Text, ScrollView, Image, Input, Video } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage, useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import { chatStream, type ChatMessage } from '@/api'
import { getToken, getUserInfo } from '@/utils/auth'
import { logger } from '@/utils/logger'

interface QAItem {
  question: string
  answer: string
  images: string[]
  videos: string[]
  totalTokens?: number
  visible: boolean
}

const SUGGESTED = ['写一首关于春天的诗', '生成一张猫咪图片', '推荐三本好书', '解释量子纠缠']
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
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;!?)\]}]+$/, '')).filter(isValidImageUrl)))
}
function formatTokens(n?: number): string {
  if (typeof n !== 'number') return ''
  return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n)
}

export default function AiAssistantPage() {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [list, setList] = useState<QAItem[]>([])
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [thinkingProgress, setThinkingProgress] = useState(0)
  const [pageTitle] = useState('智汇AI助手')
  const [tishiShow, setTishiShow] = useState(true)
  const [agentPrologue] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const shareIdxRef = useRef(0)

  useDidShow(() => {
    const p = router.params || {}
    if (p.souce === 'share' && p.question) {
      setList([{
        question: p.question,
        answer: p.content || '',
        images: extractImageUrls(p.content || ''),
        videos: [],
        visible: true,
      }])
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

  const copyHandle = useCallback((text?: string) => {
    if (!text || !text.trim()) return Taro.showToast({ title: '没有可复制的内容', icon: 'none' })
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '复制成功', icon: 'success' }),
      fail: () => Taro.showToast({ title: '复制失败', icon: 'none' }),
    })
  }, [])

  const toggleVisible = useCallback((idx: number) => {
    setList((prev) => prev.map((it, i) => (i === idx ? { ...it, visible: !it.visible } : it)))
  }, [])

  const handleSend = useCallback(async () => {
    const message = prompt.trim()
    if (!message) return Taro.showToast({ title: '请输入描述', icon: 'none' })
    if (loading) return Taro.showToast({ title: '请等待当前请求完成', icon: 'none' })
    const u = getUserInfo() as { userMargin?: { tokenQuantity?: number } }
    if (u?.userMargin?.tokenQuantity && u.userMargin.tokenQuantity < 50000) {
      const r = await Taro.showModal({ title: '智汇值不足', content: '是否前往充值?' })
      if (r.confirm) Taro.navigateTo({ url: '/pages/wallet/recharge/index' })
      return
    }
    if (!getToken()) return Taro.showToast({ title: '请先登录', icon: 'none' })

    const idx = list.length
    shareIdxRef.current = idx
    setList((prev) => [...prev, { question: message, answer: '深度思考中...', images: [], videos: [], visible: true }])
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
        messages, '', { model: 'GLM-4.5' },
        (delta) => {
          acc += delta
          extractImageUrls(delta).forEach((u) => !imgs.includes(u) && imgs.push(u))
          setList((prev) => prev.map((it, i) =>
            i === idx ? { ...it, answer: acc, images: [...imgs], videos: [...vids] } : it,
          ))
          scrollToBottom()
        },
        undefined, undefined, abortRef.current.signal, undefined,
        (done) => { totalTokens = done?.totalTokens },
      )
      setList((prev) => prev.map((it, i) =>
        i === idx
          ? { ...it, answer: acc || '生成的图片:', images: [...imgs], videos: [...vids], totalTokens, visible: true }
          : it,
      ))
    } catch (e) {
      logger.error('ai-assistant', 'chatStream', e)
      setList((prev) => prev.map((it, i) => (i === idx ? { ...it, answer: '生成失败,请重试', visible: true } : it)))
      Taro.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      setLoading(false)
      stopProgress()
      scrollToBottom()
    }
  }, [prompt, loading, list.length, startProgress, stopProgress, scrollToBottom])

  useShareAppMessage(() => {
    const item = list[shareIdxRef.current]
    return {
      title: item?.question || '智汇AI助手',
      path: `/pages/ai-assistant/index?souce=share&question=${encodeURIComponent(item?.question || '')}&content=${encodeURIComponent(item?.answer || '')}`,
    }
  })

  return (
    <View className="flex flex-col h-screen bg-background box-border">
      <View className="flex items-center px-[40rpx] py-[24rpx] bg-card">
        <Text className="text-[56rpx] text-foreground" onClick={() => Taro.navigateBack()}>←</Text>
        <Text className="flex-1 text-center text-[64rpx] font-semibold text-foreground truncate">{pageTitle}</Text>
        <View className="w-[80rpx]" />
      </View>

      <ScrollView scrollY className="flex-1 px-[40rpx]" scrollTop={scrollTop}>
        <View className="flex items-center py-[32rpx] mb-[24rpx] bg-card rounded-lg px-[32rpx]" onClick={() => setTishiShow((v) => !v)}>
          <Text className="text-[52rpx] text-foreground">{tishiShow ? '关闭' : '查看'}智能体引导说明</Text>
        </View>
        {tishiShow && agentPrologue ? (
          <View className="mb-[32rpx] p-[40rpx] bg-card rounded-lg">
            <Text className="text-[52rpx] text-muted-foreground">{agentPrologue}</Text>
          </View>
        ) : null}

        {list.length === 0 ? (
          <View className="flex flex-col items-center py-[160rpx]">
            <Text className="text-[52rpx] text-muted-foreground">请在下方输入您的问题</Text>
          </View>
        ) : (
          list.map((item, idx) => (
            <View key={idx} className="mb-[40rpx]">
              <View className="flex justify-end mb-[24rpx]">
                <View className="max-w-[70%] px-[40rpx] py-[32rpx] bg-primary text-foreground rounded-lg text-[52rpx]" onClick={() => setPrompt(item.question)}>
                  <Text>{item.question}</Text>
                </View>
              </View>
              {item.visible ? (
                <View className="p-[40rpx] bg-card rounded-lg">
                  <Text className="block text-[52rpx] text-foreground whitespace-pre-wrap break-words">{item.answer}</Text>
                  {item.images.map((url, i) => (
                    <Image key={i} className="w-full mt-[24rpx] rounded-lg" src={url} mode="widthFix" onClick={() => Taro.previewImage({ current: url, urls: item.images })} />
                  ))}
                  {item.videos.map((url, i) => (
                    <Video key={`v-${i}`} className="w-full mt-[24rpx]" src={url} controls showPlayBtn showCenterPlayBtn />
                  ))}
                  <View className="flex items-center justify-between mt-[24rpx]">
                    <Text className="text-[44rpx] text-muted-foreground">
                      智汇AI生成{item.totalTokens !== undefined ? ` · 智汇值:${formatTokens(item.totalTokens)}` : ''}
                    </Text>
                    <View className="flex gap-[32rpx]">
                      <Text className="text-[44rpx] text-primary" onClick={() => toggleVisible(idx)}>隐藏</Text>
                      <Text className="text-[44rpx] text-primary" onClick={() => copyHandle(item.answer)}>复制</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="p-[40rpx] bg-card rounded-lg flex justify-center">
                  <Text className="text-[44rpx] text-primary" onClick={() => toggleVisible(idx)}>显示回答</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {thinking ? (
        <View className="px-[40rpx] py-[24rpx] bg-card border-t border-border">
          <View className="flex items-center mb-[16rpx]">
            <Text className="text-[48rpx] text-foreground mr-[16rpx]">正在极速生成中</Text>
            <Text className="text-[48rpx] text-primary">{Math.floor(thinkingProgress)}%</Text>
          </View>
          <View className="w-full h-[16rpx] bg-muted rounded">
            <View className="h-full bg-primary rounded transition-all duration-300" style={{ width: `${thinkingProgress}%` }} />
          </View>
        </View>
      ) : null}

      <View className="bg-card border-t border-border px-[40rpx] py-[24rpx]">
        <ScrollView scrollX className="mb-[16rpx]">
          <View className="flex gap-[24rpx]">
            {SUGGESTED.map((q) => (
              <View key={q} className="px-[32rpx] py-[12rpx] rounded border border-border text-[48rpx] text-foreground whitespace-nowrap" onClick={() => { setPrompt(q); setTimeout(() => handleSend(), 0) }}>
                <Text>{q}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View className="flex items-center gap-[24rpx]">
          <Input className="flex-1 h-[128rpx] px-[40rpx] bg-muted rounded text-[56rpx] text-foreground" placeholder="请输入描述" value={prompt} onInput={(e) => setPrompt(e.detail.value)} onConfirm={handleSend} />
          <View className={`px-[48rpx] h-[128rpx] flex items-center justify-center rounded text-[56rpx] text-foreground ${loading ? 'bg-muted' : 'bg-primary'}`} onClick={handleSend}>
            <Text>{loading ? '生成中' : '发送'}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

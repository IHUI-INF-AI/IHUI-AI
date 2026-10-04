// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 @tarojs/components 输入组件与 Taro 导航,不适合共享层。
import { useI18n } from '@/i18n'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

/** 提问模式(对齐 apps/api 的 /api/ai-tutor 代理:explain 讲解 / hint 提示引导) */
type TutorMode = 'explain' | 'hint'

const MODES: TutorMode[] = ['explain', 'hint']

/** 历史行(对齐 GET /ai-tutor/history 的 select 字段;answer 是 jsonb 落库原文,形态未知) */
interface TutorHistoryItem {
  id: string
  mode: string
  subject: string | null
  question: string
  answer: unknown
  createdAt: string
}

interface TutorHistoryData {
  list: TutorHistoryItem[]
}

/** ai-service 非标准响应原文转可读文本(只取字符串形态,未知形态降级为 JSON) */
function formatAnswer(answer: unknown): string {
  if (typeof answer === 'string') return answer
  if (answer !== null && typeof answer === 'object') {
    const record = answer as Record<string, unknown>
    const keys = ['reply', 'answer', 'content', 'text', 'result'] as const
    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'string' && value.length > 0) return value
    }
    try {
      return JSON.stringify(answer)
    } catch {
      return ''
    }
  }
  if (typeof answer === 'number' || typeof answer === 'boolean') return String(answer)
  return ''
}

export default function AiTutor() {
  const { t } = useI18n()
  const [mode, setMode] = useState<TutorMode>('explain')
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [current, setCurrent] = useState('')
  const [history, setHistory] = useState<TutorHistoryItem[]>([])

  const loadHistory = useCallback(async () => {
    try {
      const res = await get<TutorHistoryData>('/ai-tutor/history', { limit: 20 })
      setHistory(res.list || [])
    } catch {
      // 历史加载失败不打断提问主流程,静默留空
    }
  }, [])

  useDidShow(() => {
    loadHistory()
  })

  const handleSend = useCallback(async () => {
    const text = question.trim()
    if (text.length === 0 || sending) return
    setSending(true)
    setCurrent('')
    try {
      // 只传 ai-tutor-routes.ts 的 AiTutorBody 定义字段(subject/question),不自拼第二份
      const res = await post<unknown>(`/ai-tutor/${mode}`, { question: text })
      setCurrent(formatAnswer(res))
      setQuestion('')
      loadHistory()
    } catch {
      Taro.showToast({ title: t('exam.detail.loadFailed'), icon: 'none' })
    } finally {
      setSending(false)
    }
  }, [question, sending, mode, loadHistory, t])

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background">
        <View className="flex flex-row items-center px-[20rpx] pt-[24rpx] pb-[16rpx] gap-[16rpx]">
          <Text className="text-[length:44rpx] font-semibold text-foreground">AI 助教</Text>
        </View>

        <View className="flex flex-row px-[20rpx] py-[16rpx] gap-[12rpx]">
          {MODES.map((m) => (
            <View
              key={m}
              className={`px-[24rpx] py-[12rpx] rounded-lg ${
                mode === m ? 'bg-primary' : 'bg-card border border-solid border-border'
              }`}
              hoverClass="opacity-60"
              onClick={() => setMode(m)}
            >
              <Text
                className={`text-[length:28rpx] ${
                  mode === m ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {m === 'explain' ? '讲解' : '提示'}
              </Text>
            </View>
          ))}
        </View>

        {current.length > 0 && (
          <View className="mx-[20rpx] rounded-lg bg-card p-[28rpx] border border-solid border-border">
            <Text className="text-[length:30rpx] text-foreground">{current}</Text>
          </View>
        )}

        <View className="p-[28rpx] pb-[64rpx]">
          {history.map((item) => (
            <View
              key={item.id}
              className="bg-card rounded-lg p-[28rpx] mb-[20rpx] border border-solid border-border"
            >
              <Text className="text-[length:32rpx] font-bold text-foreground text-ellipsis-2">
                {item.question}
              </Text>
              {formatAnswer(item.answer).length > 0 && (
                <Text className="mt-[12rpx] text-[length:28rpx] text-muted-foreground text-ellipsis-2">
                  {formatAnswer(item.answer)}
                </Text>
              )}
            </View>
          ))}
          {history.length === 0 && (
            <View className="flex justify-center py-[80rpx]">
              <Text className="text-[length:28rpx] text-[var(--color-text-tertiary)]">
                {t('ai.history.empty')}
              </Text>
            </View>
          )}
        </View>

        <View className="flex flex-row items-center gap-[16rpx] px-[20rpx] pb-[48rpx]">
          <View className="flex-1 rounded-lg bg-card border border-solid border-border px-[20rpx] py-[12rpx]">
            <Input
              value={question}
              placeholder={t('ai.inputPlaceholder')}
              placeholderClass="text-[var(--color-text-tertiary)]"
              onInput={(e) => setQuestion(e.detail.value)}
              confirmType="send"
              onConfirm={handleSend}
            />
          </View>
          <View
            className="px-[32rpx] py-[12rpx] rounded-lg bg-primary shrink-0"
            hoverClass="opacity-60"
            onClick={handleSend}
          >
            <Text className="text-[length:28rpx] text-primary-foreground">
              {sending ? t('common.loading') : '发送'}
            </Text>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

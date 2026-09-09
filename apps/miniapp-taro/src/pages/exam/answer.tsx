// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ThemeRoot from '@/components/ThemeRoot'
import {
  getExamPaper,
  getExamQuestions,
  submitExam,
  startExamRecord,
  type QuestionType,
} from '@/api'

interface Question {
  id: string
  title: string
  type: QuestionType
  options?: string[]
}

type AnswerValue = number | number[] | string | boolean

export default function ExamAnswer() {
  const { t, tList } = useI18n()
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [remain, setRemain] = useState(0)
  const recordIdRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)
  const onSubmitRef = useRef<() => void>(() => {})

  const judgmentOptions = tList('exam.answer.judgmentOptions')
  const current = useMemo(() => questions[currentIdx], [questions, currentIdx])

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }, [])

  const onSubmit = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    try {
      const arr = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }))
      const res = await submitExam({ recordId: recordIdRef.current, answers: arr })
      Taro.redirectTo({
        url: `/pages/exam/result?id=${recordIdRef.current}&score=${res.result.score}&pass=${res.result.isPassed}`,
      })
    } catch {
      submittedRef.current = false
    }
  }, [answers])

  onSubmitRef.current = onSubmit

  useEffect(() => {
    const id = router.params.id
    if (!id) return
    Promise.all([getExamPaper(id), getExamQuestions(id), startExamRecord(id)])
      .then(([{ paper }, { list }, { record }]) => {
        recordIdRef.current = record.id
        setQuestions((list || []) as unknown as Question[])
        setRemain((paper.duration || 0) * 60)
        timerRef.current = setInterval(() => {
          setRemain((prev) => {
            if (prev <= 1) {
              onSubmitRef.current()
              return 0
            }
            return prev - 1
          })
        }, 1000)
      })
      .catch((e) => {
        logger.error('unknown', '考试加载', e)
        Taro.showToast({ title: t('exam.answer.loadFailed'), icon: 'none' })
      })
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [router.params.id, t])

  const select = useCallback(
    (val: AnswerValue) => {
      if (!current) return
      const id = current.id
      setAnswers((prev) => {
        if (current.type === 'multi_choice') {
          const arr = Array.isArray(prev[id]) ? (prev[id] as number[]) : []
          const idx = val as number
          return {
            ...prev,
            [id]: arr.includes(idx) ? arr.filter((n) => n !== idx) : [...arr, idx],
          }
        }
        return { ...prev, [id]: val }
      })
    },
    [current],
  )

  const prev = useCallback(() => {
    setCurrentIdx((idx) => (idx > 0 ? idx - 1 : idx))
  }, [])

  const next = useCallback(() => {
    setCurrentIdx((idx) => (idx < questions.length - 1 ? idx + 1 : idx))
  }, [questions.length])

  const renderAnswer = () => {
    if (!current) return null
    const ans = answers[current.id]
    if (current.type === 'fill_blank') {
      return (
        <ThemeRoot>
          <Input
            className="w-full py-[16rpx] px-[28rpx] border-[2rpx] border-[var(--color-border)] rounded-[24rpx] text-[32rpx] text-foreground"
            type="text"
            placeholder={t('exam.answer.answerPlaceholder')}
            value={typeof ans === 'string' ? ans : ''}
            onInput={(e) => select(e.detail.value)}
          />
        </ThemeRoot>
      )
    }
    if (current.type === 'subjective') {
      return (
        <ThemeRoot>
          <Textarea
            className="w-full py-[16rpx] px-[28rpx] border-[2rpx] border-[var(--color-border)] rounded-[24rpx] text-[32rpx] text-foreground min-h-[320rpx]"
            placeholder={t('exam.answer.answerPlaceholder')}
            value={typeof ans === 'string' ? ans : ''}
            onInput={(e) => select(e.detail.value)}
            maxlength={1000}
          />
        </ThemeRoot>
      )
    }
    const opts = current.type === 'judgment' ? judgmentOptions : current.options || []
    const isMulti = current.type === 'multi_choice'
    return opts.map((opt, i) => {
      const selected = isMulti
        ? Array.isArray(ans) && (ans as number[]).includes(i)
        : current.type === 'judgment'
          ? ans === (i === 0)
          : ans === i
      const val: AnswerValue = current.type === 'judgment' ? i === 0 : i
      return (
        <ThemeRoot key={i}>
          {/* 对齐 RN SharedExamQuestionScreen option:p28rpx 圆角24rpx 2rpx描边 mb16rpx;
              选中 border/文字 success + bg success.light */}
          <View
            key={i}
            className={`flex items-center p-[28rpx] border-[2rpx] rounded-[24rpx] mb-[16rpx] ${
              selected
                ? 'border-[var(--color-success)] bg-[var(--color-success-light)]'
                : 'border-[var(--color-border)]'
            }`}
            hoverClass="opacity-60"
            onClick={() => select(val)}
          >
            <View
              className={`w-[56rpx] h-[56rpx] leading-[56rpx] text-center border-[2rpx] rounded-[12rpx] text-[28rpx] ${
                selected
                  ? 'border-[var(--color-success)] text-[var(--color-success)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-medium)]'
              }`}
            >
              {current.type === 'judgment' ? (i === 0 ? '√' : '×') : String.fromCharCode(65 + i)}
            </View>
            <Text
              className={`flex-1 ml-[24rpx] text-[32rpx] ${
                selected
                  ? 'text-[var(--color-success)] font-medium'
                  : 'text-[var(--color-text-medium)]'
              }`}
            >
              {opt}
            </Text>
          </View>
        </ThemeRoot>
      )
    })
  }

  return (
    <ThemeRoot>
      {/* 对齐 RN SharedExamQuestionScreen:背景 surface.bg / 水平 padding 20rpx / 内容流内按钮行;
          顶部计时条为小程序业务(自动交卷),进度对齐 RN progress(28rpx/600 success) */}
      <View className="min-h-screen bg-background px-[20rpx] pt-[24rpx] pb-[64rpx]">
        <View className="flex justify-between items-center">
          <Text className="text-[32rpx] text-[var(--color-danger)] font-bold">
            {formatTime(remain)}
          </Text>
          <Text className="text-[28rpx] text-[var(--color-success)] font-semibold">
            {currentIdx + 1}/{questions.length}
          </Text>
        </View>

        {current && (
          <View>
            <Text className="mt-[16rpx] block text-[36rpx] text-foreground font-semibold leading-relaxed">
              {currentIdx + 1}. {current.title}
            </Text>
            <View className="mt-[32rpx]">{renderAnswer()}</View>
          </View>
        )}

        {/* 对齐 RN actionRow:mt32rpx / gap16rpx / navBtn h100rpx 圆角24rpx bg-card,
            提交按钮 bg-primary 白字 32rpx/600;禁用 opacity 0.4 */}
        <View className="mt-[32rpx] flex gap-[16rpx]">
          {currentIdx > 0 && (
            <View
              className="h-[100rpx] flex-1 flex items-center justify-center rounded-[24rpx] bg-card"
              hoverClass="opacity-60"
              onClick={prev}
            >
              <Text className="text-[32rpx] text-[var(--color-text-medium)]">
                {t('exam.answer.prev')}
              </Text>
            </View>
          )}
          {currentIdx < questions.length - 1 ? (
            <View
              className="h-[100rpx] flex-1 flex items-center justify-center rounded-[24rpx] bg-card"
              hoverClass="opacity-60"
              onClick={next}
            >
              <Text className="text-[32rpx] text-[var(--color-text-medium)]">
                {t('exam.answer.next')}
              </Text>
            </View>
          ) : (
            <View
              className="h-[100rpx] flex-1 flex items-center justify-center rounded-[24rpx] bg-primary"
              hoverClass="opacity-60"
              onClick={onSubmit}
            >
              <Text className="text-[32rpx] font-semibold text-primary-foreground">
                {t('exam.answer.submit')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

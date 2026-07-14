import { View, Text, Input, Textarea, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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

const JUDGMENT_OPTIONS = ['正确', '错误']

export default function ExamAnswer() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [remain, setRemain] = useState(0)
  const recordIdRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)
  const onSubmitRef = useRef<() => void>(() => {})

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
        setQuestions(list || [])
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
        console.error('考试加载 failed:', e)
        Taro.showToast({ title: '考试加载失败', icon: 'none' })
      })
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [router.params.id])

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
        <Input
          className="w-full text-sm text-[#333] p-3 border border-[#eee] rounded-xl"
          type="text"
          placeholder="请输入答案"
          value={typeof ans === 'string' ? ans : ''}
          onInput={(e) => select(e.detail.value)}
        />
      )
    }
    if (current.type === 'subjective') {
      return (
        <Textarea
          className="w-full text-sm text-[#333] p-3 border border-[#eee] rounded-xl min-h-[160px]"
          placeholder="请输入答案"
          value={typeof ans === 'string' ? ans : ''}
          onInput={(e) => select(e.detail.value)}
          maxlength={1000}
        />
      )
    }
    const opts = current.type === 'judgment' ? JUDGMENT_OPTIONS : current.options || []
    const isMulti = current.type === 'multi_choice'
    return opts.map((opt, i) => {
      const selected = isMulti
        ? Array.isArray(ans) && (ans as number[]).includes(i)
        : current.type === 'judgment'
          ? ans === (i === 0)
          : ans === i
      const val: AnswerValue = current.type === 'judgment' ? i === 0 : i
      return (
        <View
          key={i}
          className={`flex items-center p-3 border rounded-xl mb-2 ${
            selected ? 'border-[#007aff] bg-[#e6f0ff]' : 'border-[#eee]'
          }`}
          onClick={() => select(val)}
        >
          <View
            className={`w-7 h-7 leading-7 text-center border text-sm ${
              isMulti ? 'rounded-md' : 'rounded-full'
            } ${
              selected ? 'border-[#007aff] bg-[#007aff] text-white' : 'border-[#ccc] text-[#666]'
            }`}
          >
            {current.type === 'judgment' ? (i === 0 ? '√' : '×') : String.fromCharCode(65 + i)}
          </View>
          <Text className="flex-1 ml-3 text-sm text-[#333]">{opt}</Text>
        </View>
      )
    })
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="flex justify-between p-3 bg-white">
        <Text className="text-base text-[#dd524d] font-bold">{formatTime(remain)}</Text>
        <Text className="text-sm text-[#666]">
          {currentIdx + 1}/{questions.length}
        </Text>
      </View>

      {current && (
        <View className="m-3 p-4 bg-white rounded-2xl">
          <Text className="text-base text-[#333] font-semibold leading-relaxed">
            {currentIdx + 1}. {current.title}
          </Text>
          <View className="mt-4">{renderAnswer()}</View>
        </View>
      )}

      <View className="fixed bottom-4 left-4 right-4 flex gap-3">
        {currentIdx > 0 && (
          <Button className="flex-1 bg-white text-[#333] rounded-full text-sm" onClick={prev}>
            上一题
          </Button>
        )}
        {currentIdx < questions.length - 1 ? (
          <Button className="flex-1 bg-[#007aff] text-white rounded-full text-sm" onClick={next}>
            下一题
          </Button>
        ) : (
          <Button
            className="flex-1 bg-[#007aff] text-white rounded-full text-sm"
            onClick={onSubmit}
          >
            交卷
          </Button>
        )}
      </View>
    </View>
  )
}

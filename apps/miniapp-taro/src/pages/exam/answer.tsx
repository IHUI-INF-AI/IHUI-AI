import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { getExamDetail, submitExam } from '@/api'

interface Question {
  id: string
  title: string
  options: string[]
}

export default function ExamAnswer() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [remain, setRemain] = useState(0)
  const examIdRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)

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
      const res = await submitExam({ examId: examIdRef.current, answers })
      Taro.redirectTo({ url: `/pages/exam/result?id=${examIdRef.current}&score=${res.score}&pass=${res.pass}` })
    } catch (e) {
      submittedRef.current = false
    }
  }, [answers])

  useEffect(() => {
    const id = router.params.id
    if (!id) return
    examIdRef.current = id
    getExamDetail(id)
      .then(exam => {
        setQuestions(exam.questions || [])
        setRemain(exam.duration * 60)
        timerRef.current = setInterval(() => {
          setRemain(prev => {
            if (prev <= 1) {
              onSubmit()
              return 0
            }
            return prev - 1
          })
        }, 1000)
      })
      .catch(() => {})
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.params.id])

  const select = useCallback((i: number) => {
    if (!current) return
    setAnswers(prev => ({ ...prev, [current.id]: i }))
  }, [current])

  const prev = useCallback(() => {
    setCurrentIdx(idx => (idx > 0 ? idx - 1 : idx))
  }, [])

  const next = useCallback(() => {
    setCurrentIdx(idx => (idx < questions.length - 1 ? idx + 1 : idx))
  }, [questions.length])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="flex justify-between p-3 bg-white">
        <Text className="text-base text-[#dd524d] font-bold">{formatTime(remain)}</Text>
        <Text className="text-sm text-[#666]">{currentIdx + 1}/{questions.length}</Text>
      </View>

      {current && (
        <View className="m-3 p-4 bg-white rounded-2xl">
          <Text className="text-base text-[#333] font-semibold leading-relaxed">
            {currentIdx + 1}. {current.title}
          </Text>
          <View className="mt-4">
            {current.options.map((opt, i) => (
              <View
                key={i}
                className={`flex items-center p-3 border rounded-xl mb-2 ${
                  answers[current.id] === i ? 'border-[#007aff] bg-[#e6f0ff]' : 'border-[#eee]'
                }`}
                onClick={() => select(i)}
              >
                <View
                  className={`w-7 h-7 leading-7 text-center border rounded-full text-sm ${
                    answers[current.id] === i ? 'border-[#007aff] bg-[#007aff] text-white' : 'border-[#ccc] text-[#666]'
                  }`}
                >
                  {['A', 'B', 'C', 'D'][i]}
                </View>
                <Text className="flex-1 ml-3 text-sm text-[#333]">{opt}</Text>
              </View>
            ))}
          </View>
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
          <Button className="flex-1 bg-[#007aff] text-white rounded-full text-sm" onClick={onSubmit}>
            交卷
          </Button>
        )}
      </View>
    </View>
  )
}

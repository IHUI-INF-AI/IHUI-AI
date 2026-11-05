// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/exam-question/ExamQuestionScreen.tsx(直载共享屏 + 注入本端事实)
//
// 本端保留(不可丢的业务):
//   ① 试卷加载链 GET /exam/papers/:id + /questions + /start(开考记录)
//   ② 倒计时三态(时长未知 ⇒ 不限时;≤0 才自动交卷)与 onSubmitRef 自动提交
//   ③ 作答模型 ExamAnswerValue + serializeExamAnswers(选项 key 序列化,判据单源在 api-client)
//   ④ 提交后 redirectTo /pages/exam/result(分数/是否通过回填)
//   ⑤ AI 操控通道(useUiField 登记):填空/主观题写入走 select,与作答回调同一通道
// 版面/进度/题型标签/选项字母/上题下题/错误态由共享屏输出;onNavigate 端口按契约注入(本屏无受控跳转)。

import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { useUiField } from '@/lib/ui-field-registry'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import {
  getExamPaper,
  getExamQuestions,
  serializeExamAnswers,
  submitExam,
  startExamRecord,
  toShellOptionTexts,
  toShellQuestionType,
  type ExamAnswerValue,
  type ExamPaper,
  type ExamQuestion,
  type ShellQuestionType,
} from '@/api'
import { onToast } from '@/host/on-toast'
import { ExamQuestionScreen as SharedExamQuestionScreen } from '@ihui/rn-app/features/exam-question/ExamQuestionScreen'
import type { ExamQuestionPaper, OnNavigate } from '@ihui/types'

/** 共享屏的宿主导航端口:本屏没有任何受控跳转点,按契约注入并在误用时可见地报错 */
const onNavigate: OnNavigate = (target) => {
  onToast(`导航未接入: ${target}`, { kind: 'error' })
}

export default function ExamAnswer() {
  const { t } = useI18n()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  // 题目一律吃 api-client 的原始形状(ExamQuestion):type 是后端五档
  // single|multiple|judge|fill|essay,options 是 {key,value}[] | null。
  // 渲染要的「共享屏题型 / 选项文案」现投影(toShellQuestionType / toShellOptionTexts),
  // 提交要的「选项 key」由 serializeExamAnswers 内部消化 —— 端内不再翻译第二遍。
  const [paper, setPaper] = useState<ExamPaper | null>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, ExamAnswerValue>>({})
  // null = 时长未知(试卷未回/无时长),不是 0 —— 0 会被读成「时间到,已自动交卷」。
  const [remain, setRemain] = useState<number | null>(null)
  const recordIdRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)
  const onSubmitRef = useRef<() => void>(() => {})

  const current = useMemo(() => questions[currentIdx], [questions, currentIdx])
  // 共享屏题型(单一投影点):作答区分支 / 选项取值全部读它,
  // 不再各自拿后端词表去比对 'fill_blank' 之类根本不存在的值。
  const shellType: ShellQuestionType = current ? toShellQuestionType(current.type) : 'single'
  // AI 操控通道(2026-09-21):填空题 / 主观题的作答框(同一屏只有一个作答框)。
  // 写入走与 onAnswer 同一个 select(current) 通道。
  const answerType = shellType === 'fill' || shellType === 'subjective' ? shellType : ''
  useUiField(
    answerType
      ? {
          kind: answerType === 'subjective' ? 'textarea' : 'input',
          label: t('examQuestion.answerPlaceholder'),
          placeholder: t('examQuestion.answerPlaceholder'),
          inputType: 'text',
          ...(answerType === 'subjective' ? { maxLength: 1000 } : {}),
          readValue: () => {
            const ans = current ? answers[current.id] : undefined
            return typeof ans === 'string' ? ans : ''
          },
          setValue: (next) => onAnswer('', next),
        }
      : null,
  )

  const onSubmit = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    try {
      // 提交前必须序列化:题库 answer 列存的是**选项 key**("A"/["A","B"]),后端
      // submitExamRecord 走 contentEqual 直接比 ⇒ 交下标会整卷判错。判据单源在
      // @ihui/api-client 的 serializeExamAnswers(与 RN wrapper 同一实现,端内不另抄)。
      const arr = serializeExamAnswers(questions, answers)
      const res = await submitExam({ recordId: recordIdRef.current, answers: arr })
      Taro.redirectTo({
        url: `/pages/exam/result?id=${recordIdRef.current}&score=${res.result.score}&pass=${res.result.isPassed}`,
      })
    } catch {
      // 对齐 RN onSubmit 的失败面:失败必须让用户看见并留在本屏(可重交)。
      submittedRef.current = false
      onToast(t('examQuestion.submitFailed'), { kind: 'error' })
    }
  }, [answers, questions, t])

  onSubmitRef.current = onSubmit

  useEffect(() => {
    const id = router.params.id
    if (!id) {
      setLoading(false)
      return
    }
    Promise.all([getExamPaper(id), getExamQuestions(id), startExamRecord(id)])
      .then(([{ paper }, { list }, { record }]) => {
        recordIdRef.current = record.id
        setPaper(paper)
        setQuestions(list || [])
        // 时长未知(缺省/0)的试卷不限时:既不起倒计时,更不能拿 0 当起始值
        // —— 0 会被计时条读成「时间到,已自动交卷」,并在第一秒真的自动交卷。
        const seconds = Math.max(0, Math.floor(Number(paper.duration) || 0)) * 60
        if (seconds <= 0) return
        setRemain(seconds)
        timerRef.current = setInterval(() => {
          setRemain((prev) => {
            if (prev === null) return prev
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
        // 对齐 RN SharedExamQuestionScreen:加载失败由 ErrorState 常驻呈现(message 取
        // examQuestion.loadFailed)。RN 同屏的重试是真重载(重新加载);小程序只给返回出口(合法差异)
        setLoadFailed(true)
      })
      .finally(() => {
        setLoading(false)
      })
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [router.params.id])

  const select = useCallback(
    (val: ExamAnswerValue) => {
      if (!current) return
      const id = current.id
      setAnswers((prev) => {
        if (current.type === 'multiple') {
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

  // 共享屏 onAnswer 回调:判断题/填空题/主观题写入,与 AI 通道同一写函数
  const onAnswer = useCallback(
    (_id: string, value: ExamAnswerValue) => {
      select(value)
    },
    [select],
  )

  // 多选题点击由共享屏带 multi 标记回调;规则与端内 select 原来同一套(选中再点即取消)
  const onToggleOption = useCallback((id: string, idx: number, multi: boolean) => {
    setAnswers((prev) => {
      if (multi) {
        const arr = Array.isArray(prev[id]) ? (prev[id] as number[]) : []
        return {
          ...prev,
          [id]: arr.includes(idx) ? arr.filter((n) => n !== idx) : [...arr, idx],
        }
      }
      return { ...prev, [id]: idx }
    })
  }, [])

  const prev = useCallback(() => {
    setCurrentIdx((idx) => (idx > 0 ? idx - 1 : idx))
  }, [])

  const next = useCallback(() => {
    setCurrentIdx((idx) => (idx < questions.length - 1 ? idx + 1 : idx))
  }, [questions.length])

  // 共享屏投影:题型/选项文案现投影,分值随接口给(缺省不渲染)
  const exam = useMemo<ExamQuestionPaper | null>(() => {
    if (!paper) return null
    return {
      id: paper.id,
      title: paper.title,
      duration: Number(paper.duration) || 0,
      questions: questions.map((q) => ({
        id: q.id,
        type: toShellQuestionType(q.type),
        content: q.title,
        options: toShellOptionTexts(q),
        ...(typeof q.score === 'number' ? { score: q.score } : {}),
      })),
    }
  }, [paper, questions])

  return (
    <ThemeRoot>
      <SharedExamQuestionScreen
        t={t}
        exam={exam}
        loading={loading}
        error={loadFailed ? t('examQuestion.loadFailed') : ''}
        current={currentIdx}
        // 单选存下标(number)、多选存下标数组、判断存 boolean、填空存 string —— 与 RN host
        // (`apps/mobile-rn/src/screens/ExamQuestionScreen.tsx`) 的运行时形状完全一致;
        // 共享类型只列了 string|boolean|string[]|number[],未列单选 number,故此处按运行时契约断言。
        answers={answers as unknown as Record<string, string | boolean | string[] | number[]>}
        onToggleOption={onToggleOption}
        onAnswer={onAnswer}
        leftSec={remain === null ? undefined : remain}
        submitting={false}
        onPrev={prev}
        onNext={next}
        onSubmit={() => {
          void onSubmit()
        }}
        onBack={() => {
          void Taro.navigateBack()
        }}
        onRetry={() => {
          void Taro.navigateBack()
        }}
        onNavigate={onNavigate}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

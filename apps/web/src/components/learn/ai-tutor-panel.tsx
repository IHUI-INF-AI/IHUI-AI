'use client'

import * as React from 'react'
import { Loader2, Sparkles, Lightbulb, HelpCircle, Send } from 'lucide-react'
import { Card, CardContent, Button, Input } from '@ihui/ui'
import {
  explainConcept,
  getHint,
  generateQuiz,
  type ExplainResult,
  type HintResult,
  type QuizResult,
} from '@/api/edu-api'

type Mode = 'explain' | 'hint' | 'quiz'

const SUBJECTS = ['数学', '物理', '化学', '生物', '英语', '历史', '地理'] as const

const MODES: {
  value: Mode
  label: string
  icon: React.ComponentType<{ className?: string }>
  tone: string
}[] = [
  { value: 'explain', label: '讲解', icon: Sparkles, tone: 'text-primary' },
  { value: 'hint', label: '提示', icon: Lightbulb, tone: 'text-amber-600' },
  { value: 'quiz', label: '出题', icon: HelpCircle, tone: 'text-emerald-600' },
]

const SUBJECT_CHIP =
  'rounded-md border border-border px-2.5 py-1 text-xs leading-none transition-colors hover:bg-accent'

export function AiTutorPanel() {
  const [subject, setSubject] = React.useState<string>(SUBJECTS[0] ?? '数学')
  const [mode, setMode] = React.useState<Mode>('explain')
  const [question, setQuestion] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [explain, setExplain] = React.useState<ExplainResult | null>(null)
  const [hint, setHint] = React.useState<HintResult | null>(null)
  const [quiz, setQuiz] = React.useState<QuizResult | null>(null)

  function resetResults() {
    setExplain(null)
    setHint(null)
    setQuiz(null)
    setError(null)
  }

  async function handleAsk() {
    if (!question.trim()) return
    setLoading(true)
    resetResults()
    try {
      if (mode === 'explain') {
        setExplain(await explainConcept(subject, question.trim()))
      } else if (mode === 'hint') {
        setHint(await getHint(subject, question.trim()))
      } else {
        setQuiz(await generateQuiz(subject, question.trim(), 3))
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI 助教</span>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">学科</div>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={
                  s === subject
                    ? `${SUBJECT_CHIP} bg-primary/10 border-primary/30 text-primary`
                    : SUBJECT_CHIP
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">模式</div>
          <div className="flex gap-1.5">
            {MODES.map((m) => {
              const active = m.value === mode
              const Icon = m.icon
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setMode(m.value)
                    resetResults()
                  }}
                  className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium leading-none transition-colors ${
                    active
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {mode === 'quiz' ? '出题方向(可选)' : '你的问题'}
          </div>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAsk()
              }
            }}
            placeholder={
              mode === 'quiz'
                ? '如:二次函数图像性质'
                : '如:勾股定理怎么证明?'
            }
            className="h-9 text-sm"
          />
          <Button
            size="sm"
            className="w-full"
            disabled={loading || (mode !== 'quiz' && !question.trim())}
            onClick={handleAsk}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>{mode === 'quiz' ? '生成题目' : '提问'}</span>
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {explain && (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-primary">讲解</div>
                <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-relaxed">
                  {explain.answer}
                </div>
              </div>
              {explain.knowledge_points && explain.knowledge_points.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">知识点</div>
                  <div className="flex flex-wrap gap-1.5">
                    {explain.knowledge_points.map((k, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {explain.follow_up_questions && explain.follow_up_questions.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">延伸思考</div>
                  <ul className="space-y-1 text-xs">
                    {explain.follow_up_questions.map((q, i) => (
                      <li key={i} className="rounded-md bg-muted/30 px-2 py-1">
                        {i + 1}. {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {hint && (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600">提示</div>
                <div className="whitespace-pre-wrap rounded-md bg-amber-500/5 p-3 text-sm leading-relaxed">
                  {hint.hint}
                </div>
              </div>
              {hint.next_step_hint && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">下一步</div>
                  <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
                    {hint.next_step_hint}
                  </div>
                </div>
              )}
              {hint.encouragement && (
                <div className="text-xs italic text-muted-foreground">
                  {hint.encouragement}
                </div>
              )}
            </div>
          )}

          {quiz && quiz.quizzes && quiz.quizzes.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-emerald-600">
                生成 {quiz.quizzes.length} 道练习题
              </div>
              {quiz.quizzes.map((item, i) => (
                <div key={i} className="space-y-1 rounded-md bg-muted/30 p-3">
                  <div className="text-sm font-medium">
                    {i + 1}. {item.question}
                  </div>
                  {item.answer && (
                    <div className="text-xs text-emerald-700">
                      答:{item.answer}
                    </div>
                  )}
                  {item.explanation && (
                    <div className="text-xs text-muted-foreground">
                      {item.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!error && !explain && !hint && !quiz && !loading && (
            <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
              选择学科与模式,提出你的问题。
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default AiTutorPanel

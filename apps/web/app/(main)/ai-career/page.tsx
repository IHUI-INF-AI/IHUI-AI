'use client'

import * as React from 'react'
import { GraduationCap, Loader2, Sparkles } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@ihui/ui'
import { Container } from '@/components/layout'
import { Textarea } from '@/components/form'

interface CareerForm {
  school: string
  classLevel: string
  scoreRange: string
  languageDifficulty: string
  scienceCharacteristics: string
  learningObstacle: string
  hobbies: string
  target: string
}

const INITIAL_FORM: CareerForm = {
  school: '',
  classLevel: '',
  scoreRange: '',
  languageDifficulty: '',
  scienceCharacteristics: '',
  learningObstacle: '',
  hobbies: '',
  target: '',
}

const SCHOOL_OPTIONS = ['公立学校', '私立学校', '重点学校']
const CLASS_OPTIONS = ['普通班', '重点班']
const DIFFICULTY_OPTIONS = ['阅读速度慢', '理解困难', '词汇量不足', '写作薄弱']
const OBSTACLE_OPTIONS = ['游戏沉迷', '注意力分散', '拖延症', '效率低']

export default function AICareerPage() {
  const [form, setForm] = React.useState<CareerForm>(INITIAL_FORM)
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<string>('')

  const update = (key: keyof CareerForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const canSubmit =
    form.school &&
    form.classLevel &&
    form.scoreRange &&
    form.languageDifficulty &&
    form.learningObstacle &&
    form.target

  const handleSubmit = async () => {
    setLoading(true)
    setResult('')
    try {
      // TODO: 接入真实 AI API (/api/ai/career-advice)
      await new Promise((r) => setTimeout(r, 1500))
      setResult(
        `基于您提供的信息，AI 生成的生涯指导建议：\n\n` +
          `1. 学业现状分析：${form.school}${form.classLevel}的学生，语英成绩${form.scoreRange}，主要困难是${form.languageDifficulty}。\n` +
          `2. 学习障碍诊断：检测到${form.learningObstacle}倾向，建议家长加强陪伴与引导，建立规律作息。\n` +
          `3. 兴趣特长培养：${form.hobbies || '暂未明确'}可作为突破口，结合理科特点${form.scienceCharacteristics || '一般'}制定个性化学习计划。\n` +
          `4. 升学目标规划：目标${form.target}，建议分阶段制定学习里程碑，定期评估调整。\n\n` +
          `温馨提示：本建议由 AI 生成，仅供参考，具体教育决策请结合专业教师意见。`,
      )
    } finally {
      setLoading(false)
    }
  }

  const RadioGroup = ({
    value,
    onChange,
    options,
  }: {
    value: string
    onChange: (v: string) => void
    options: string[]
  }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            value === opt
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:bg-muted'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <GraduationCap className="h-7 w-7" />
          AI 生涯指导
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          填写孩子学习情况，AI 为您生成个性化生涯指导建议
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <span className="mb-2 block text-sm font-medium">
              孩子就读学校类型 <span className="text-destructive">*</span>
            </span>
            <RadioGroup
              value={form.school}
              onChange={(v) => update('school', v)}
              options={SCHOOL_OPTIONS}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              班级整体水平 <span className="text-destructive">*</span>
            </span>
            <RadioGroup
              value={form.classLevel}
              onChange={(v) => update('classLevel', v)}
              options={CLASS_OPTIONS}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              语文和英语考试分数范围 <span className="text-destructive">*</span>
            </span>
            <Input
              value={form.scoreRange}
              onChange={(e) => update('scoreRange', e.target.value)}
              placeholder="如：80-90分"
              maxLength={100}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              语文和英语学习困难 <span className="text-destructive">*</span>
            </span>
            <RadioGroup
              value={form.languageDifficulty}
              onChange={(v) => update('languageDifficulty', v)}
              options={DIFFICULTY_OPTIONS}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">理科方面特点</span>
            <Textarea
              value={form.scienceCharacteristics}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                update('scienceCharacteristics', e.target.value)
              }
              placeholder="如：数学较好，物理一般..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              影响学习的因素 <span className="text-destructive">*</span>
            </span>
            <RadioGroup
              value={form.learningObstacle}
              onChange={(v) => update('learningObstacle', v)}
              options={OBSTACLE_OPTIONS}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">兴趣爱好</span>
            <Input
              value={form.hobbies}
              onChange={(e) => update('hobbies', e.target.value)}
              placeholder="如：编程、绘画、音乐"
              maxLength={100}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              升学目标 <span className="text-destructive">*</span>
            </span>
            <Input
              value={form.target}
              onChange={(e) => update('target', e.target.value)}
              placeholder="如：重点高中、985大学"
              maxLength={100}
            />
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit || loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                AI 分析中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                生成生涯指导
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5" />
              AI 生涯指导建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {result}
            </pre>
          </CardContent>
        </Card>
      )}
    </Container>
  )
}

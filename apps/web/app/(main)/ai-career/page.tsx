'use client'

import * as React from 'react'
import {
  GraduationCap,
  Loader2,
  Sparkles,
  Download,
  FileText,
  FileType2,
  Presentation,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Container } from '@/components/layout'
import { Textarea } from '@/components/form'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { getCareerAdvice, exportCareerReport } from '@ihui/api-client'

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

export default function AICareerPage() {
  const t = useTranslations('aiCareerPage')
  const [form, setForm] = React.useState<CareerForm>(INITIAL_FORM)
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<string>('')
  const [error, setError] = React.useState<string>('')
  const [exporting, setExporting] = React.useState(false)

  const SCHOOL_OPTIONS = t.raw('options.school') as string[]
  const CLASS_OPTIONS = t.raw('options.classLevel') as string[]
  const DIFFICULTY_OPTIONS = t.raw('options.difficulty') as string[]
  const OBSTACLE_OPTIONS = t.raw('options.obstacle') as string[]

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
    setError('')
    try {
      const r = await getCareerAdvice(form)
      if (!r.success) {
        setError(r.error || t('result.failed'))
        return
      }
      setResult(r.data.content)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('result.failed'))
    } finally {
      setLoading(false)
    }
  }

  // 导出结构化报告(PDF / Word / PPT)— 复用 student 页面 use-report-generator 的 blob 下载模式
  const handleExport = async (format: 'pdf' | 'word' | 'ppt') => {
    if (!result) {
      toast.error(t('export.empty'))
      return
    }
    setExporting(true)
    try {
      const resp = await exportCareerReport({ ...form, format, content: result })
      if (!resp.ok) {
        toast.error(t('export.failed'))
        return
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const cd = resp.headers.get('Content-Disposition') ?? ''
      const match = /filename="?([^";]+)"?/.exec(cd)
      const ext = format === 'pdf' ? 'pdf' : format === 'word' ? 'doc' : 'pptx'
      const filename = match?.[1] ?? `ai-career-report.${ext}`
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(t('export.success'))
    } catch {
      toast.error(t('export.failed'))
    } finally {
      setExporting(false)
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
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <GraduationCap className="h-7 w-7" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-4 min-[768px]:p-6">
          <div>
            <span className="mb-2 block text-sm font-medium">
              {t('fields.school')} <span className="text-destructive">*</span>
            </span>
            <RadioGroup
              value={form.school}
              onChange={(v) => update('school', v)}
              options={SCHOOL_OPTIONS}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              {t('fields.classLevel')} <span className="text-destructive">*</span>
            </span>
            <RadioGroup
              value={form.classLevel}
              onChange={(v) => update('classLevel', v)}
              options={CLASS_OPTIONS}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              {t('fields.scoreRange')} <span className="text-destructive">*</span>
            </span>
            <Input
              value={form.scoreRange}
              onChange={(e) => update('scoreRange', e.target.value)}
              placeholder={t('fields.scoreRangePlaceholder')}
              maxLength={100}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              {t('fields.languageDifficulty')} <span className="text-destructive">*</span>
            </span>
            <RadioGroup
              value={form.languageDifficulty}
              onChange={(v) => update('languageDifficulty', v)}
              options={DIFFICULTY_OPTIONS}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              {t('fields.scienceCharacteristics')}
            </span>
            <Textarea
              value={form.scienceCharacteristics}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                update('scienceCharacteristics', e.target.value)
              }
              placeholder={t('fields.scienceCharacteristicsPlaceholder')}
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              {t('fields.learningObstacle')} <span className="text-destructive">*</span>
            </span>
            <RadioGroup
              value={form.learningObstacle}
              onChange={(v) => update('learningObstacle', v)}
              options={OBSTACLE_OPTIONS}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">{t('fields.hobbies')}</span>
            <Input
              value={form.hobbies}
              onChange={(e) => update('hobbies', e.target.value)}
              placeholder={t('fields.hobbiesPlaceholder')}
              maxLength={100}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">
              {t('fields.target')} <span className="text-destructive">*</span>
            </span>
            <Input
              value={form.target}
              onChange={(e) => update('target', e.target.value)}
              placeholder={t('fields.targetPlaceholder')}
              maxLength={100}
            />
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit || loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('submitting')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('submit')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-lg">
              <span className="flex min-w-0 items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0" />
                <span className="truncate">{t('result.title')}</span>
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0" disabled={exporting}>
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4 shrink-0" />
                    )}
                    <span className="whitespace-nowrap">{exporting ? t('export.exporting') : t('export.button')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t('export.pdf')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('word')}>
                    <FileType2 className="mr-2 h-4 w-4" />
                    {t('export.word')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('ppt')}>
                    <Presentation className="mr-2 h-4 w-4" />
                    {t('export.ppt')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

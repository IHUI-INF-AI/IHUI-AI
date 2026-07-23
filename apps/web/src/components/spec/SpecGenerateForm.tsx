'use client'

import * as React from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Switch,
  Checkbox,
} from '@ihui/ui'
import {
  SPEC_BUILTIN_TEMPLATES,
  type SpecGenerateInput,
  type SpecGenerateResult,
  type SpecScopeType,
  type SpecTemplate,
} from '@ihui/shared/spec/index'
import { generateSpec } from '@/lib/spec-api'

interface SpecGenerateFormProps {
  defaultWorkspacePath?: string
  defaultTemplateId?: string
  onGenerated?: (result: SpecGenerateResult) => void
}

const scopeOptions: Array<{ value: SpecScopeType; label: string; desc: string }> = [
  { value: 'file', label: '文件', desc: '单个文件' },
  { value: 'dir', label: '目录', desc: '整个目录' },
  { value: 'workspace', label: '工作区', desc: '完整工作区' },
]

const languageOptions = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Rust',
  'Java',
]

/** Spec 生成表单:workspacePath + scope 选择 + 依赖/语言 + 模板快速选择 */
export function SpecGenerateForm({
  defaultWorkspacePath = '',
  defaultTemplateId,
  onGenerated,
}: SpecGenerateFormProps) {
  const [workspacePath, setWorkspacePath] = React.useState(defaultWorkspacePath)
  const [scopeType, setScopeType] = React.useState<SpecScopeType>('workspace')
  const [scopePath, setScopePath] = React.useState('')
  const [includeDependencies, setIncludeDependencies] = React.useState(false)
  const [languages, setLanguages] = React.useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = React.useState<SpecTemplate | null>(
    () =>
      SPEC_BUILTIN_TEMPLATES.find((t) => t.id === defaultTemplateId) ?? null,
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!workspacePath.trim()) {
      setError('请输入工作区路径')
      return
    }
    setLoading(true)
    try {
      const input: SpecGenerateInput = {
        workspacePath: workspacePath.trim(),
        scope: {
          type: scopeType,
          ...(scopePath.trim() ? { path: scopePath.trim() } : {}),
        },
        includeDependencies,
        ...(languages.length > 0 ? { languages } : {}),
      }
      const result = await generateSpec(input)
      onGenerated?.(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          生成 Spec 文档
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="spec-workspace-path">工作区路径</Label>
            <Input
              id="spec-workspace-path"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="/path/to/project"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>分析范围</Label>
            <div className="grid grid-cols-3 gap-2">
              {scopeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setScopeType(opt.value)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    scopeType === opt.value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
            {scopeType !== 'workspace' && (
              <Input
                value={scopePath}
                onChange={(e) => setScopePath(e.target.value)}
                placeholder={scopeType === 'file' ? '文件路径(相对工作区)' : '目录路径(相对工作区)'}
                disabled={loading}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="spec-deps" className="text-sm">包含依赖关系</Label>
              <p className="text-xs text-muted-foreground">提取模块间的依赖调用</p>
            </div>
            <Switch
              id="spec-deps"
              checked={includeDependencies}
              onCheckedChange={setIncludeDependencies}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>语言筛选(可选)</Label>
            <div className="flex flex-wrap gap-3">
              {languageOptions.map((lang) => (
                <label
                  key={lang}
                  className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <Checkbox
                    checked={languages.includes(lang)}
                    onCheckedChange={() => toggleLanguage(lang)}
                    disabled={loading}
                  />
                  {lang}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>快速选择模板</Label>
            <div className="grid grid-cols-2 gap-2">
              {SPEC_BUILTIN_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tpl)}
                  disabled={loading}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    selectedTemplate?.id === tpl.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:bg-accent'
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">{tpl.name}</div>
                  <div className="text-xs text-muted-foreground">{tpl.description}</div>
                </button>
              ))}
            </div>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground">
                已选择「{selectedTemplate.name}」模板(模板选择仅作参考,生成结果由后端决定)
              </p>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? '正在生成…' : '生成 Spec'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

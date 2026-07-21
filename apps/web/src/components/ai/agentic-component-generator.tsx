'use client'

import * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Download, Loader2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui'
import { Textarea, Checkbox } from '@/components/form'

/** 组件生成器表单状态(对应任务规格) */
export interface ComponentFormState {
  componentName: string
  description: string
  type: string
  framework: 'react' | 'vue'
  style: 'tailwind' | 'css' | 'styled-components'
  useTypeScript: boolean
  useStyles: boolean
  useTests: boolean
  useDocs: boolean
  useStorybook: boolean
}

interface GeneratedResult {
  preview: string
  code: string
  test: string
}

type TabKey = 'preview' | 'code' | 'test'

const TYPE_OPTIONS = ['Button', 'Card', 'Form', 'Layout', 'Table', 'Dialog'] as const

const FRAMEWORK_OPTIONS: Array<{ value: ComponentFormState['framework']; label: string }> = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
]

const STYLE_OPTIONS: Array<{ value: ComponentFormState['style']; label: string }> = [
  { value: 'tailwind', label: 'Tailwind' },
  { value: 'css', label: 'CSS' },
  { value: 'styled-components', label: 'Styled-Components' },
]

const CHECKBOX_FIELDS: Array<{ key: keyof ComponentFormState; label: string }> = [
  { key: 'useTypeScript', label: '使用 TypeScript' },
  { key: 'useStyles', label: '包含样式' },
  { key: 'useTests', label: '包含测试' },
  { key: 'useDocs', label: '包含文档' },
  { key: 'useStorybook', label: '包含 Storybook' },
]

const INITIAL_STATE: ComponentFormState = {
  componentName: '',
  description: '',
  type: 'Button',
  framework: 'react',
  style: 'tailwind',
  useTypeScript: true,
  useStyles: true,
  useTests: false,
  useDocs: false,
  useStorybook: false,
}

/**
 * AgenticComponentGenerator - 组件生成器子组件
 * 1:1 复刻自 Vue 版 AgenticComponentGenerator,按任务规格扩展
 * type/framework/style/5 项 checkbox/3 Tab(预览/代码/测试)/复制 + 下载
 */
export function AgenticComponentGenerator() {
  const [form, setForm] = useState<ComponentFormState>(INITIAL_STATE)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<GeneratedResult | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('preview')

  const update = <K extends keyof ComponentFormState>(key: K, value: ComponentFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.componentName.trim() || !form.description.trim()) return
    setIsGenerating(true)
    try {
      // mock:实际应调用 useAgenticComponentGenerator().generateComponent(request)
      await new Promise((resolve) => setTimeout(resolve, 600))
      setResult({
        preview: generatePreview(form),
        code: generateCode(form),
        test: generateTest(form),
      })
      toast.success(`已生成 ${form.type} 组件`)
    } finally {
      setIsGenerating(false)
    }
  }

  const currentCode = (): string => {
    if (!result) return ''
    return activeTab === 'preview' ? result.preview : activeTab === 'code' ? result.code : result.test
  }

  const handleCopy = () => {
    const text = currentCode()
    if (!text) return
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('代码已复制'))
      .catch(() => toast.error('复制失败'))
  }

  const handleDownload = () => {
    if (!result) return
    const ext =
      form.framework === 'react' ? (form.useTypeScript ? 'tsx' : 'jsx') : 'vue'
    const filename = `${form.componentName || 'component'}.${ext}`
    const blob = new Blob([result.code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="rounded-lg">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">组件生成器</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        <form onSubmit={handleGenerate} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="comp-name">组件名称</Label>
            <Input
              id="comp-name"
              value={form.componentName}
              onChange={(e) => update('componentName', e.target.value)}
              placeholder="UserCard"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comp-desc">组件描述</Label>
            <Textarea
              id="comp-desc"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="描述要生成的组件"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>组件类型</Label>
              <Select value={form.type} onValueChange={(v) => update('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>框架</Label>
              <Select
                value={form.framework}
                onValueChange={(v) => update('framework', v as ComponentFormState['framework'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRAMEWORK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>样式</Label>
              <Select
                value={form.style}
                onValueChange={(v) => update('style', v as ComponentFormState['style'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {CHECKBOX_FIELDS.map(({ key, label }) => (
              <Checkbox
                key={key}
                checked={form[key] as boolean}
                onChange={(checked) => update(key, checked)}
                label={label}
              />
            ))}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!form.componentName.trim() || !form.description.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              '生成组件'
            )}
          </Button>
        </form>

        {result && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
              <TabsList className="w-full">
                <TabsTrigger value="preview" className="flex-1">
                  预览
                </TabsTrigger>
                <TabsTrigger value="code" className="flex-1">
                  代码
                </TabsTrigger>
                <TabsTrigger value="test" className="flex-1">
                  测试
                </TabsTrigger>
              </TabsList>
              <TabsContent value="preview">
                <pre className="max-h-80 overflow-auto rounded-md bg-background p-3 text-xs">
                  <code>{result.preview}</code>
                </pre>
              </TabsContent>
              <TabsContent value="code">
                <pre className="max-h-80 overflow-auto rounded-md bg-background p-3 text-xs">
                  <code>{result.code}</code>
                </pre>
              </TabsContent>
              <TabsContent value="test">
                <pre className="max-h-80 overflow-auto rounded-md bg-background p-3 text-xs">
                  <code>{result.test}</code>
                </pre>
              </TabsContent>
            </Tabs>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" />
                复制代码
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                下载
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** 生成预览片段 */
function generatePreview(form: ComponentFormState): string {
  return `<!-- ${form.componentName} 预览 -->
<${form.componentName}>
  ${form.description}
</${form.componentName}>`
}

/** 生成代码片段 */
function generateCode(form: ComponentFormState): string {
  const ext = form.useTypeScript ? 'tsx' : 'jsx'
  const imports: string[] = []
  if (form.style === 'tailwind') imports.push("import { cn } from '@/lib/utils'")
  if (form.style === 'styled-components') imports.push('import styled from "styled-components"')
  const propsType = form.useTypeScript
    ? `\ninterface ${form.componentName}Props {\n  children?: React.ReactNode\n  className?: string\n}`
    : ''
  const code = `${imports.join('\n')}${imports.length ? '\n' : ''}${propsType}
export function ${form.componentName}({ children, className }${
    form.useTypeScript ? `: ${form.componentName}Props` : ''
  }) {
  return (
    <div className={cn('${form.type.toLowerCase()}-wrapper', className)}>
      {/* ${form.description} */}
      {children}
    </div>
  )
}

export default ${form.componentName}`
  return `// ${form.componentName}.${ext}\n${code}`
}

/** 生成测试片段 */
function generateTest(form: ComponentFormState): string {
  return `import { render } from '@testing-library/react'
import { ${form.componentName} } from './${form.componentName}'

describe('${form.componentName}', () => {
  it('renders without crashing', () => {
    const { container } = render(<${form.componentName} />)
    expect(container).toBeInTheDocument()
  })

  it('renders children', () => {
    const { getByText } = render(<${form.componentName}>Hello</${form.componentName}>)
    expect(getByText('Hello')).toBeInTheDocument()
  })
})`
}

export default AgenticComponentGenerator

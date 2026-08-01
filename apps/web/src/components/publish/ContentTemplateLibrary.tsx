'use client'

/**
 * 内容模板库 — 预设 5 模板 + localStorage 自定义模板。
 * 点击模板 → onApply 回调填入编辑器;保存当前内容为自定义模板。
 *
 * AGENTS.md §4:rounded-md / 无分割线 / 无渐变遮罩
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Save, Trash2, Plus } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'

export interface ContentTemplate {
  readonly id: string
  readonly name: string
  readonly title: string
  readonly content: string
  readonly tags: readonly string[]
  readonly coverHint: string
  readonly preset?: boolean
}

export interface ContentTemplateLibraryProps {
  readonly currentContent: string
  readonly currentTitle: string
  readonly onApply: (template: ContentTemplate) => void
}

const CUSTOM_KEY = 'ihui-publish-templates'

const PRESET_TEMPLATES: readonly ContentTemplate[] = [
  {
    id: 'preset-tech-blog',
    name: 'techBlog',
    title: '【技术博客】{主题}:从原理到实践',
    content: '## 背景\n\n{描述问题背景}\n\n## 核心原理\n\n{原理解析}\n\n## 代码实现\n\n```python\n{代码示例}\n```\n\n## 实践总结\n\n{要点回顾}\n\n## 参考\n\n- [参考链接]({url})',
    tags: ['技术', '编程', '教程'],
    coverHint: '科技感蓝色背景 + 代码截图',
    preset: true,
  },
  {
    id: 'preset-marketing',
    name: 'marketing',
    title: '{产品名}:让{目标人群}告别{痛点}',
    content: '## 痛点场景\n\n你是否遇到过{痛点描述}?\n\n## 解决方案\n\n{产品名}帮你{核心价值}\n\n## 用户证言\n\n> "{用户评价}" — {用户名}\n\n## 立即体验\n\n{行动召唤}',
    tags: ['营销', '推广', '产品'],
    coverHint: '产品截图 + 高对比配色',
    preset: true,
  },
  {
    id: 'preset-product-intro',
    name: 'productIntro',
    title: '产品介绍:{产品名} v{版本}',
    content: '## 产品概览\n\n{一句话介绍}\n\n## 核心功能\n\n1. {功能1}\n2. {功能2}\n3. {功能3}\n\n## 适用场景\n\n- {场景1}\n- {场景2}\n\n## 技术规格\n\n| 项目 | 规格 |\n| --- | --- |\n| {项} | {值} |',
    tags: ['产品', '介绍'],
    coverHint: '产品正面图 + 简洁背景',
    preset: true,
  },
  {
    id: 'preset-news',
    name: 'newsRelease',
    title: '【新闻稿】{事件}:{关键信息}',
    content: '## 导语\n\n{时间地点人物事件}\n\n## 事件详情\n\n{详细描述}\n\n## 各方回应\n\n> {相关方表态}\n\n## 背景信息\n\n{背景补充}',
    tags: ['新闻', '资讯'],
    coverHint: '新闻现场图 + 标题压字',
    preset: true,
  },
  {
    id: 'preset-tutorial',
    name: 'tutorial',
    title: '零基础教程:{主题}入门指南',
    content: '## 前置准备\n\n- {准备项1}\n- {准备项2}\n\n## 步骤一:{步骤名}\n\n{操作说明}\n\n## 步骤二:{步骤名}\n\n{操作说明}\n\n## 常见问题\n\n**Q: {问题}**\nA: {解答}\n\n## 小结\n\n{要点回顾}',
    tags: ['教程', '入门', '指南'],
    coverHint: '步骤截图拼接 + 编号',
    preset: true,
  },
]

function loadCustomTemplates(): ContentTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as ContentTemplate[]
    return Array.isArray(arr) ? arr.filter((t) => t && typeof t.id === 'string') : []
  } catch {
    return []
  }
}

function saveCustomTemplates(list: ContentTemplate[]): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
  } catch {
    // 静默
  }
}

export function ContentTemplateLibrary({
  currentContent,
  currentTitle,
  onApply,
}: ContentTemplateLibraryProps) {
  const t = useTranslations('publish')
  const [custom, setCustom] = React.useState<ContentTemplate[]>([])

  React.useEffect(() => {
    setCustom(loadCustomTemplates())
  }, [])

  function saveCurrent() {
    if (!currentContent.trim()) return
    const tpl: ContentTemplate = {
      id: `custom-${Date.now()}`,
      name: 'custom',
      title: currentTitle || '未命名模板',
      content: currentContent,
      tags: [],
      coverHint: '',
    }
    const next = [tpl, ...custom].slice(0, 20)
    setCustom(next)
    saveCustomTemplates(next)
  }

  function removeCustom(id: string) {
    const next = custom.filter((t) => t.id !== id)
    setCustom(next)
    saveCustomTemplates(next)
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t('templates.title')}</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={saveCurrent}>
            <Save className="mr-1 h-3 w-3" />
            {t('templates.saveAsTemplate')}
          </Button>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase text-muted-foreground">{t('templates.presetTemplates')}</span>
          {PRESET_TEMPLATES.map((tpl) => (
            <TemplateRow key={tpl.id} tpl={tpl} labelKey={`templates.${tpl.name}`} onApply={() => onApply(tpl)} t={t} />
          ))}
        </div>

        {custom.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase text-muted-foreground">{t('templates.customTemplates')}</span>
            {custom.map((tpl) => (
              <TemplateRow
                key={tpl.id}
                tpl={tpl}
                label={tpl.title}
                onApply={() => onApply(tpl)}
                onRemove={() => removeCustom(tpl.id)}
                t={t}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface TemplateRowProps {
  readonly tpl: ContentTemplate
  readonly labelKey?: string
  readonly label?: string
  readonly onApply: () => void
  readonly onRemove?: () => void
  readonly t: ReturnType<typeof useTranslations>
}

function TemplateRow({ tpl, labelKey, label, onApply, onRemove, t }: TemplateRowProps) {
  return (
    <div className="group flex items-center gap-2 rounded-md border border-transparent bg-muted/20 px-2 py-1.5 transition-colors hover:border-border hover:bg-accent/40">
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-xs hover:text-primary"
        onClick={onApply}
      >
        {labelKey ? t(labelKey as never) : (label ?? tpl.title)}
      </button>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onApply}>
          <Plus className="h-3 w-3" />
        </Button>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-rose-600" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

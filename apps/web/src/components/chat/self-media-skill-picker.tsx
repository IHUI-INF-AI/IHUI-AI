'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Newspaper, Mic } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SkillItem {
  id: 'content-engine' | 'koubo-workflow'
  labelKey: 'wechatArticle' | 'kouboScript'
  descKey: 'wechatArticleDesc' | 'kouboScriptDesc'
  icon: React.ComponentType<{ className?: string }>
  template: string
}

const SKILLS: SkillItem[] = [
  {
    id: 'content-engine',
    labelKey: 'wechatArticle',
    descKey: 'wechatArticleDesc',
    icon: Newspaper,
    template:
      '/wechat-article 请帮我生成一篇公众号文章。要求:\n1. 主题:\n2. 摘要:\n3. 重点标记(金句卡 / 提示块 / 引用 / 代码块 / 小标题)\n4. 配图建议:\n请走 content-engine 流水线(摸鱼绿主题 + 22 项自检 + 草稿箱推送)。',
  },
  {
    id: 'koubo-workflow',
    labelKey: 'kouboScript',
    descKey: 'kouboScriptDesc',
    icon: Mic,
    template:
      '/koubo-script 请帮我生成今日 8 篇抖音口播稿。要求:\n1. 日期:MMDD\n2. 选题方向:\n3. 双门禁验证(歧义压缩 / 跨稿词表 / 全量验证 / 语病 / 热点覆盖)\n请走 koubo-workflow 流水线(约束优先写作法)。',
  },
]

interface Props {
  onSelect: (template: string) => void
  onClose: () => void
}

export function SelfMediaSkillPicker({ onSelect, onClose }: Props) {
  const t = useTranslations('chat')
  const handlePick = (skill: SkillItem) => {
    onSelect(skill.template)
    onClose()
  }
  return (
    <div className="w-72 space-y-1 p-1">
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {t('selfMediaSkill')}
      </div>
      {SKILLS.map((skill) => {
        const Icon = skill.icon
        return (
          <button
            key={skill.id}
            type="button"
            onClick={() => handlePick(skill)}
            className={cn(
              'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="flex-1 space-y-0.5">
              <div className="text-xs font-medium">{t(skill.labelKey)}</div>
              <div className="text-[11px] text-muted-foreground">{t(skill.descKey)}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

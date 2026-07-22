import type { Metadata } from 'next'

import { RulesManager } from '@/components/rules/rules-manager'

export const metadata: Metadata = {
  title: '规则管理',
  description: '管理用户自定义规则,约束 AI agent 运行时行为',
}

export default function RulesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold leading-tight">规则管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          用户可编辑的规则集,在 agent 运行时按匹配条件动态注入到 system prompt
        </p>
      </div>
      <RulesManager />
    </div>
  )
}

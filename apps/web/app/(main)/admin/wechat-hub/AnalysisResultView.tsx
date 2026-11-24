// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { Card, CardContent } from '@ihui/ui-react'
import type { ReactNode } from 'react'
import type { WechatAnalysisResult } from '@ihui/types'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

export default function AnalysisResultView({ result }: { result: WechatAnalysisResult }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>来源：{result.generatedBy === 'llm' ? '模型生成' : '本地规则'}</span>
        <span>· 消息 {result.stats.messageCount} 条</span>
        <span>· 参与者 {result.stats.participantCount} 人</span>
      </div>
      <Section title="摘要">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.summary}</p>
      </Section>
      {result.highlights.length > 0 ? (
        <Section title="要点">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {result.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {result.todos.length > 0 ? (
        <Section title="待办">
          <ul className="space-y-1 text-sm">
            {result.todos.map((todo, index) => (
              <li key={`${todo.text}-${String(index)}`} className="rounded-md bg-muted px-3 py-2">
                <span className="font-medium">{todo.text}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {todo.owner ? `负责人：${todo.owner}` : '未指派'}
                  {todo.due ? ` · 截止：${todo.due}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {result.keywords.length > 0 ? (
        <Section title="关键词">
          <div className="flex flex-wrap gap-1.5">
            {result.keywords.map((item) => (
              <span
                key={item.word}
                className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
              >
                {item.word} · {item.count}
              </span>
            ))}
          </div>
        </Section>
      ) : null}
      {result.participants.length > 0 ? (
        <Section title="参与者">
          <div className="flex flex-wrap gap-1.5">
            {result.participants.map((item) => (
              <span
                key={item.id}
                className="rounded-md border border-stroke-subtle px-2 py-0.5 text-xs"
              >
                {item.name ?? item.id} · {item.messageCount}
              </span>
            ))}
          </div>
        </Section>
      ) : null}
      {result.relations && result.relations.length > 0 ? (
        <Section title="互动关系">
          <div className="space-y-1 text-sm">
            {result.relations.slice(0, 20).map((item) => (
              <p key={`${item.from}-${item.to}`} className="text-muted-foreground">
                {item.from} → {item.to}：{item.count} 次
              </p>
            ))}
          </div>
        </Section>
      ) : null}
      {result.risks.length > 0 ? (
        <Section title="风险提示">
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-600 dark:text-red-400">
            {result.risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Card>
        <CardContent className="p-3 min-[640px]:p-3 text-xs text-muted-foreground">
          时间窗：{result.stats.startAt ?? '—'} ~ {result.stats.endAt ?? '—'}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

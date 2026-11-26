// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { Card, CardContent } from '@ihui/ui-react'
import type { ReactNode } from 'react'
import type { WechatAnalysisResult } from '@ihui/types'
import { buildBarRows, type BarRow } from './analysis-chart'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-label font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

/** 纯 CSS 横条：宽度按最大值归一，右列是真实计数，不引入图表库也不会误导 */
function Bars({ rows }: { rows: BarRow[] }) {
  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.key} className="font-[weight:inherit] flex items-center gap-2 text-label">
          <span className="w-28 shrink-0 truncate text-muted-foreground" title={row.label}>
            {row.label}
          </span>
          <div className="relative h-1.5 min-w-0 flex-1 rounded-sm bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-sm bg-primary"
              style={{ width: `${Math.max(2, Math.round(row.ratio * 100))}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalysisResultView({ result }: { result: WechatAnalysisResult }) {
  const keywordBars = buildBarRows(
    result.keywords.map((item) => ({ key: item.word, label: item.word, value: item.count })),
    10,
  )
  const participantBars = buildBarRows(
    result.participants.map((item) => ({
      key: item.id,
      label: item.name ?? item.id,
      value: item.messageCount,
    })),
    10,
  )

  return (
    <div className="space-y-4">
      <div className="font-[weight:inherit] flex flex-wrap items-center gap-2 text-label text-muted-foreground">
        <span>来源：{result.generatedBy === 'llm' ? '模型生成' : '本地规则'}</span>
        <span>· 消息 {result.stats.messageCount} 条</span>
        <span>· 参与者 {result.stats.participantCount} 人</span>
      </div>
      <Section title="摘要">
        <p className="font-[weight:inherit] whitespace-pre-wrap text-body leading-relaxed">{result.summary}</p>
      </Section>
      {result.highlights.length > 0 ? (
        <Section title="要点">
          <ul className="font-[weight:inherit] list-disc space-y-1 pl-5 text-body">
            {result.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {result.todos.length > 0 ? (
        <Section title="待办">
          <ul className="font-[weight:inherit] space-y-1 text-body">
            {result.todos.map((todo, index) => (
              <li key={`${todo.text}-${String(index)}`} className="rounded-md bg-muted px-3 py-2">
                <span className="font-medium">{todo.text}</span>
                <span className="font-[weight:inherit] ml-2 text-label text-muted-foreground">
                  {todo.owner ? `负责人：${todo.owner}` : '未指派'}
                  {todo.due ? ` · 截止：${todo.due}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {keywordBars.length > 0 ? (
        <Section title="关键词">
          <Bars rows={keywordBars} />
        </Section>
      ) : null}
      {participantBars.length > 0 ? (
        <Section title="参与者">
          <Bars rows={participantBars} />
        </Section>
      ) : null}
      {result.relations && result.relations.length > 0 ? (
        <Section title="互动关系">
          <div className="font-[weight:inherit] space-y-1 text-body">
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
          <ul className="font-[weight:inherit] list-disc space-y-1 pl-5 text-body text-red-600 dark:text-red-400">
            {result.risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Card>
        <CardContent className="font-[weight:inherit] p-3 min-[640px]:p-3 text-label text-muted-foreground">
          时间窗：{result.stats.startAt ?? '—'} ~ {result.stats.endAt ?? '—'}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

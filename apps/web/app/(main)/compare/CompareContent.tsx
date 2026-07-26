'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, X, Sparkles, Github, Layers, Boxes, Network } from 'lucide-react'
import { Button } from '@ihui/ui-react'

type Cell = { t: string; ok?: boolean }

const COLS = ['特性', 'IHUI-AI', 'ChatGPT Plus', 'Dify', 'LangChain', 'Coze', 'FastGPT'] as const

const ROWS: [string, Cell, Cell, Cell, Cell, Cell, Cell][] = [
  [
    '开源协议',
    { t: 'Apache 2.0', ok: true },
    { t: '闭源', ok: false },
    { t: 'Apache 2.0', ok: true },
    { t: 'MIT', ok: true },
    { t: '闭源', ok: false },
    { t: 'Apache 2.0', ok: true },
  ],
  [
    '私有化部署',
    { t: '免费', ok: true },
    { t: '不支持', ok: false },
    { t: '付费', ok: true },
    { t: '支持', ok: true },
    { t: '不支持', ok: false },
    { t: '付费', ok: true },
  ],
  [
    '8 端同源',
    { t: 'Web/API/CLI/Desktop/Ext/Mobile/Miniapp', ok: true },
    { t: '仅 Web', ok: false },
    { t: '仅 Web', ok: false },
    { t: '库', ok: false },
    { t: '仅 Web', ok: false },
    { t: '仅 Web', ok: false },
  ],
  [
    'LLM 模型数',
    { t: '176', ok: true },
    { t: '1 (GPT)', ok: false },
    { t: '50+', ok: true },
    { t: '100+', ok: true },
    { t: '10+', ok: true },
    { t: '50+', ok: true },
  ],
  [
    'MCP 协议',
    { t: '支持', ok: true },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
  ],
  [
    'A2A 协议',
    { t: '支持', ok: true },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
  ],
  [
    'RAG 知识库',
    { t: '引用追溯', ok: true },
    { t: '支持', ok: true },
    { t: '支持', ok: true },
    { t: '库', ok: false },
    { t: '支持', ok: true },
    { t: '支持', ok: true },
  ],
  [
    'Agent 市场',
    { t: '支持', ok: true },
    { t: 'GPT Store', ok: true },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
    { t: '支持', ok: true },
    { t: '不支持', ok: false },
  ],
  [
    'SaaS 计费',
    { t: '内置', ok: true },
    { t: '不支持', ok: false },
    { t: '支持', ok: true },
    { t: '不支持', ok: false },
    { t: '不支持', ok: false },
    { t: '支持', ok: true },
  ],
  [
    '数据库表',
    { t: '340', ok: true },
    { t: '?', ok: false },
    { t: '?', ok: false },
    { t: '无', ok: false },
    { t: '?', ok: false },
    { t: '?', ok: false },
  ],
  [
    '测试覆盖',
    { t: '5346', ok: true },
    { t: '?', ok: false },
    { t: '?', ok: false },
    { t: '?', ok: false },
    { t: '?', ok: false },
    { t: '?', ok: false },
  ],
  [
    '价格',
    { t: '免费/¥99月起', ok: true },
    { t: '$20/月起', ok: false },
    { t: '免费/付费', ok: true },
    { t: '免费', ok: true },
    { t: '免费/付费', ok: true },
    { t: '免费/付费', ok: true },
  ],
]

const ADVANTAGES = [
  {
    icon: Layers,
    title: '完全开源',
    desc: 'Apache 2.0 商用无限制,可审计可定制',
    vs: 'ChatGPT/Coze 闭源,Dify BSL 限制商业竞争',
  },
  {
    icon: Boxes,
    title: '8 端同源',
    desc: '一份代码,Web/API/CLI/Desktop/Extension/Mobile/Miniapp 多端运行',
    vs: '竞品仅 Web 端,需自建其他端',
  },
  {
    icon: Network,
    title: '三栈合一',
    desc: 'LangGraph + MCP + A2A 三协议原生支持',
    vs: '竞品单一栈,无 MCP/A2A',
  },
]

const SUB_COMPARISONS = [
  { group: 'AI 应用平台', items: ['dify', 'coze', 'fastgpt', 'flowise', 'typebot', 'stack-ai'] },
  { group: 'AI 编排框架', items: ['langchain', 'llamaindex', 'crewai', 'autogen', 'openai-agent'] },
  { group: '自动化工具', items: ['n8n', 'make', 'zapier-ai', 'wordware', 'spark', 'relevance-ai'] },
  {
    group: 'AI 编程助手',
    items: [
      'cursor',
      'github-copilot',
      'claude-code',
      'bolt-new',
      'v0-dev',
      'lovable',
      'replit-agent',
      'windsurf',
      'devin',
      'manus',
    ],
  },
  {
    group: '国内大模型平台',
    items: [
      'qwen-platform',
      'deepseek-platform',
      'doubao',
      'kimi-platform',
      'minimax',
      'zhipu',
      'ernie',
    ],
  },
  { group: '企业级', items: ['copilot-studio', 'voiceflow'] },
]

const labelMap: Record<string, string> = {
  dify: 'Dify',
  coze: 'Coze',
  fastgpt: 'FastGPT',
  flowise: 'Flowise',
  typebot: 'Typebot',
  'stack-ai': 'Stack AI',
  langchain: 'LangChain',
  llamaindex: 'LlamaIndex',
  crewai: 'CrewAI',
  autogen: 'AutoGen',
  'openai-agent': 'OpenAI Agent',
  n8n: 'n8n',
  make: 'Make',
  'zapier-ai': 'Zapier AI',
  wordware: 'Wordware',
  spark: 'Spark',
  'relevance-ai': 'Relevance AI',
  cursor: 'Cursor',
  'github-copilot': 'GitHub Copilot',
  'claude-code': 'Claude Code',
  'bolt-new': 'Bolt.new',
  'v0-dev': 'v0.dev',
  lovable: 'Lovable',
  'replit-agent': 'Replit Agent',
  windsurf: 'Windsurf',
  devin: 'Devin',
  manus: 'Manus',
  'qwen-platform': '通义千问平台',
  'deepseek-platform': 'DeepSeek 平台',
  doubao: '豆包',
  'kimi-platform': 'Kimi 平台',
  minimax: 'MiniMax',
  zhipu: '智谱',
  ernie: '文心一言',
  'copilot-studio': 'Copilot Studio',
  voiceflow: 'Voiceflow',
}

function CellView({ cell, isIhui = false }: { cell: Cell; isIhui?: boolean }) {
  return (
    <td
      className={`px-3 py-3 text-center text-sm md:px-4 ${isIhui ? 'bg-primary/5 font-medium' : ''}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {cell.ok === true && <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />}
        {cell.ok === false && <X className="h-4 w-4 shrink-0 text-red-600" aria-hidden />}
        <span className={cell.ok === false ? 'text-red-600' : ''}>{cell.t}</span>
      </span>
    </td>
  )
}

export function CompareContent(): React.JSX.Element {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Layers className="h-3.5 w-3.5 text-primary" />
          竞品对比
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">IHUI-AI vs 竞品对比</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          为什么选择 IHUI-AI 而不是 ChatGPT/Dify/LangChain?
        </p>
      </section>

      {/* 对比表格 */}
      <section className="mt-12 overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b bg-muted/30">
              {COLS.map((col, i) => (
                <th
                  key={col}
                  className={`px-3 py-3 text-sm font-semibold md:px-4 ${i === 0 ? 'text-left' : 'text-center'} ${i === 1 ? 'text-primary' : ''}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, idx) => (
              <tr key={row[0]} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                <td className="px-3 py-3 text-sm font-medium md:px-4">{row[0]}</td>
                <CellView cell={row[1]} isIhui />
                <CellView cell={row[2]} />
                <CellView cell={row[3]} />
                <CellView cell={row[4]} />
                <CellView cell={row[5]} />
                <CellView cell={row[6]} />
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 优势卡片 */}
      <section className="mt-12 grid gap-6 md:grid-cols-3">
        {ADVANTAGES.map(({ icon: Icon, title, desc, vs }) => (
          <div
            key={title}
            className="rounded-lg border bg-card p-6 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-foreground">{desc}</p>
            <p className="mt-2 text-xs text-muted-foreground">vs {vs}</p>
          </div>
        ))}
      </section>

      {/* 更多深度对比 */}
      <section className="mt-12">
        <h2 className="text-xl font-bold tracking-tight md:text-2xl">更多深度对比</h2>
        <p className="mt-1 text-sm text-muted-foreground">IHUI-AI 与 36 个竞品的逐一深度对比</p>
        <div className="mt-6 space-y-6">
          {SUB_COMPARISONS.map(({ group, items }) => (
            <div key={group}>
              <h3 className="text-sm font-semibold text-muted-foreground">{group}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {items.map((slug) => (
                  <Link
                    key={slug}
                    href={`/compare/ihui-vs-${slug}`}
                    className="inline-flex items-center rounded-md border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    {labelMap[slug] ?? slug}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-lg border bg-primary/5 p-8 text-center md:p-12">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">立即开始使用 IHUI-AI</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          开源、免费、8 端同源,176 模型 + LangGraph + MCP + A2A 三栈合一。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/pricing">立即开始</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a
              href="https://github.com/IHUI-INF-AI/IHUI-AI"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="mr-2 h-4 w-4" />
              查看 GitHub
            </a>
          </Button>
        </div>
      </section>
    </main>
  )
}

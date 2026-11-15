// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { BadgeCheck, Code, Copy, ExternalLink, Filter, Search } from 'lucide-react'

import {
  REA_CAPABILITIES,
  REA_CATEGORIES,
  REA_SOURCES,
  type ReaCapability,
  type ReaCategory,
  type ReaSource,
} from '@/data/rea-capabilities'
import { BackButton } from '@/components/common'
import { Badge } from '@/components/data'
import { Button, SearchInput } from '@ihui/ui-react'

/** 成熟度 → 标签 + 颜色(@/components/data Badge 的 variant:default|primary|success|warning|danger) */
const MATURITY_META: Record<
  ReaCapability['maturity'],
  { label: string; variant: 'primary' | 'warning' | 'default' }
> = {
  A: { label: 'A · 可直接移植', variant: 'primary' },
  B: { label: 'B · 需适配', variant: 'warning' },
  C: { label: 'C · 仅借鉴', variant: 'default' },
}

/** 源程序展示名 */
const SOURCE_LABEL: Record<ReaSource, string> = {
  qoder: 'Qoder',
  trae: 'Trae',
  workbuddy: 'WorkBuddy',
  deepseek: 'DeepSeek',
  rea: 'REA 内部',
}

/** 分类展示名 */
const CATEGORY_LABEL: Record<ReaCategory, string> = {
  terminal: '终端执行',
  snapshot: '快照回滚',
  permission: '权限沙箱',
  'code-intel': '代码智能',
  plugin: '插件视图',
  ipc: 'IM 解码',
  secret: '密钥脱敏',
  'agent-runtime': 'Agent 运行时',
  'agent-team': 'Agent 编队',
  'sandbox-fs': '文件系统沙箱',
  'process-governance': '进程治理',
  'local-model': '本地大模型',
  'session-log': '会话事件溯源',
  document: '文档处理',
  mcp: 'MCP 协议栈',
}

export default function ReaCapabilitiesPageClient() {
  const [q, setQ] = React.useState('')
  const [category, setCategory] = React.useState<ReaCategory | ''>('')
  const [source, setSource] = React.useState<ReaSource | ''>('')

  const items = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return REA_CAPABILITIES.filter((c) => {
      if (category && c.category !== category) return false
      if (source && c.source !== source) return false
      if (!needle) return true
      return (
        c.name.toLowerCase().includes(needle) ||
        c.summary.toLowerCase().includes(needle) ||
        c.target.toLowerCase().includes(needle) ||
        c.evidence.probe.toLowerCase().includes(needle)
      )
    })
  }, [q, category, source])

  const copyTarget = (target: string) => {
    void navigator.clipboard.writeText(target)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-4">
      <BackButton />
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-6 w-6 text-primary" />
          <h1 className="text-display font-bold tracking-tight">REA 逆向能力目录</h1>
          <Badge variant="default">{items.length} 项</Badge>
        </div>
        <p className="text-label text-muted-foreground">
          每条能力均锚定 REA 取证实测函数名,不写臆测。证据目录:
          <code className="text-xs">.ihui-agent/evidence/rea-reverse/</code>
        </p>
      </header>

      {/* 过滤栏 */}
      <div className="flex flex-col gap-2 min-[640px]:flex-row min-[640px]:items-center">
        <SearchInput
          size="lg"
          wrapperClassName="flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索名称 / 落位 / 实测函数…"
          autoComplete="off"
        />
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ReaCategory | '')}
            className="rounded-sm border bg-card px-3 py-2 text-body text-foreground"
            aria-label="按分类筛选"
          >
            <option value="">全部分类</option>
            {REA_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as ReaSource | '')}
            className="rounded-sm border bg-card px-3 py-2 text-body text-foreground"
            aria-label="按源程序筛选"
          >
            <option value="">全部来源</option>
            {REA_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 卡片列表 */}
      <ul className="space-y-3" aria-label="逆向能力列表">
        {items.map((c) => {
          const Icon = c.icon
          const mat = MATURITY_META[c.maturity]
          return (
            <li
              key={c.id}
              data-testid="rea-capability-card"
              data-category={c.category}
              className="group rounded-md border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {/* 标题行 */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <Badge variant={mat.variant}>{mat.label}</Badge>
                    <Badge variant="default">{SOURCE_LABEL[c.source]}</Badge>
                    <Badge variant="default">{CATEGORY_LABEL[c.category]}</Badge>
                  </div>

                  {/* 摘要 */}
                  <p className="text-sm text-muted-foreground">{c.summary}</p>

                  {/* 证据(REA 现场取证:版本 + sha8 + 实测要点)+ 落位 */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Search className="h-3 w-3 shrink-0" />
                      <span className="font-mono">{c.evidence.probe}</span>
                      <Badge variant="default" title={c.evidence.file}>
                        {c.evidence.version}
                        {c.evidence.sha8 !== '—' ? ` @${c.evidence.sha8}` : ''}
                      </Badge>
                    </div>
                    <div className="text-[11px] leading-relaxed">{c.evidence.measured}</div>
                    <div className="flex items-center gap-1.5">
                      <Code className="h-3 w-3 shrink-0" />
                      <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {c.target}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`复制落位路径 ${c.target}`}
                        onClick={() => copyTarget(c.target)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* 挂载视图(若有) */}
                  {c.view && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <ExternalLink className="h-3 w-3 text-primary" />
                      <span className="text-muted-foreground">
                        挂载视图:
                        <a
                          href={c.view.src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {c.view.title}
                        </a>
                        <span className="ml-2 font-mono text-muted-foreground">
                          sandbox=allow-scripts
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
        {items.length === 0 && (
          <li className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            无匹配能力,请调整筛选条件。
          </li>
        )}
      </ul>

      <footer className="pt-2 text-xs text-muted-foreground">
        <p>
          本目录是逆向复用的静态展示,不含运行时代码;每条能力的实际实现进度以
          <code className="mx-1 font-mono">PROJECT_PLAN.md</code>
          对应登记行为准。
        </p>
      </footer>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

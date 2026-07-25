'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, X, Sparkles, Rocket, Layers } from 'lucide-react'
import { Button } from '@ihui/ui-react'

type CellValue = boolean | string

interface CompareRow {
  dimension: string
  ihui: CellValue
  competitor: CellValue
  ihuiDetail?: string
  competitorDetail?: string
}

interface CompetitorConfig {
  id: 'dify' | 'coze' | 'fastgpt' | 'n8n'
  name: string
  tagline: string
  rows: CompareRow[]
  verdict: string
}

const COMPETITORS: Record<CompetitorConfig['id'], CompetitorConfig> = {
  dify: {
    id: 'dify',
    name: 'Dify',
    tagline: 'Dify 偏 LLM 应用开发框架(Web 端);IHUI AI 是六端同源全栈 AI 操作系统',
    verdict:
      '如果你的团队只需要 Web 端的 LLM 应用开发,Dify 是不错的选择;如果你需要 Agent 市场化、六端分发、团队协作和私有化,IHUI AI 是更完整的方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: 'Web 端 LLM 应用开发框架',
        ihuiDetail: '一套代码,六端发布(Web/桌面/小程序/扩展/移动/CLI)',
        competitorDetail: '专注 Web 端 LLM 应用编排',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端(Web/桌面/小程序/扩展/移动/CLI)',
        competitor: 'Web only',
        ihuiDetail: '同源 React 组件库 + 同套 API 契约',
        competitorDetail: '仅 Web 应用,需自建其他端',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '内置 200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无内置 Agent 市场',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: true,
        ihuiDetail: '向量 + BM25 混合检索 + 中文友好 + 知识图谱',
        competitorDetail: '基础 RAG,文档解析能力相对简单',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: true,
        ihuiDetail: '10+ 模型统一调度 + 自动 fallback + 成本路由',
        competitorDetail: '支持多模型,但无统一计费',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: false,
        ihuiDetail: '原生 Model Context Protocol,100+ 预置 MCP Server',
        competitorDetail: '不支持 MCP 协议',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: true,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支 + 人机协同',
        competitorDetail: '支持工作流,但节点类型相对有限',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO/OAuth + 积分共享',
        competitorDetail: '基础多用户,无 RBAC/审计/SSO',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: '受限',
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s Helm',
        competitorDetail: 'BSL 商业许可,生产环境需付费',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: 'Dify Open Source License (BSL)',
        ihuiDetail: '完全开源,商业可用',
        competitorDetail: 'BSL 限制商业竞争',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '社区版免费 + 云版按量计费',
        ihuiDetail: '自托管零费用,云版统一积分',
        competitorDetail: '云版按 token 计费,自托管有限制',
      },
    ],
  },
  coze: {
    id: 'coze',
    name: 'Coze',
    tagline: 'Coze 是字节跳动出品的闭源 AI Agent 平台;IHUI AI 是开源 + 私有化替代',
    verdict:
      '如果你的产品/数据不能上云,Coze 完全不适合你;如果可以上云但希望避免厂商锁定,IHUI AI 是开源 + 跨云的更好选择。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: '字节出品的闭源 Agent 平台',
        ihuiDetail: '开源,Apache 2.0',
        competitorDetail: '闭源,字节跳动运营',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端',
        competitor: 'Web + 飞书/抖音插件',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '主要 Web + 飞书集成',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: true,
        ihuiDetail: '200+ 模板 + 创作者市场',
        competitorDetail: '字节官方 Bot 商店',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '不支持,数据全部上字节云',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源',
        ihuiDetail: '完全开源,商业可用',
        competitorDetail: '无源码,无法审计',
      },
      {
        dimension: '数据主权',
        ihui: '自托管 100% 数据自有',
        competitor: '字节云托管',
        ihuiDetail: '自托管版数据不出域',
        competitorDetail: '数据由字节跳动掌控',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: '部分',
        ihuiDetail: '原生 MCP + 100+ 预置',
        competitorDetail: '部分插件支持',
      },
      {
        dimension: '多模型',
        ihui: '10+ 模型',
        competitor: '豆包为主 + 部分三方',
        ihuiDetail: 'OpenAI/Claude/Gemini/Qwen/DeepSeek/Kimi 等',
        competitorDetail: '豆包系列为主,接入有限',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '基础工作空间',
        ihuiDetail: '企业级协作',
        competitorDetail: '适合个人和小团队',
      },
      {
        dimension: '生态',
        ihui: '开源生态 + 跨云部署',
        competitor: '字节生态(飞书/抖音)',
        ihuiDetail: '中立,不被任何云锁定',
        competitorDetail: '深度绑定字节产品',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费(字节补贴)',
        ihuiDetail: '统一积分,无隐藏费用',
        competitorDetail: '免费但有调用上限',
      },
    ],
  },
  fastgpt: {
    id: 'fastgpt',
    name: 'FastGPT',
    tagline: 'FastGPT 专注知识库 Q&A;IHUI AI 含知识库 + Agent 市场 + 六端分发',
    verdict:
      '如果你的需求只是知识库 Q&A,FastGPT 够用;如果你需要 Agent 编排 + 跨端分发 + 团队协作,IHUI AI 是更完整的方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: '知识库 Q&A 工具',
        ihuiDetail: '知识库是组件之一',
        competitorDetail: '专注知识库 RAG',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端',
        competitor: 'Web only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web 应用',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: true,
        ihuiDetail: '向量 + BM25 + 知识图谱,中文友好',
        competitorDetail: '向量检索为主,中文友好',
      },
      {
        dimension: 'Agent 编排',
        ihui: true,
        competitor: '有限',
        ihuiDetail: '可视化拖拽 Agent + 200+ 模板',
        competitorDetail: '基础工作流,无 Agent 市场',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: false,
        ihuiDetail: '原生 MCP,100+ 预置',
        competitorDetail: '不支持',
      },
      {
        dimension: '多模型调度',
        ihui: '10+ 模型 + 自动 fallback',
        competitor: '多模型但无统一计费',
        ihuiDetail: '统一积分 + 成本路由',
        competitorDetail: '需分别配 API Key',
      },
      {
        dimension: '工作流',
        ihui: true,
        competitor: '基础',
        ihuiDetail: 'n8n 风格画布',
        competitorDetail: '基础节点',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '基础多用户',
        ihuiDetail: '多租户工作区',
        competitorDetail: '简单权限',
      },
      {
        dimension: '私有化',
        ihui: 'Apache 2.0',
        competitor: 'Apache 2.0',
        ihuiDetail: 'Docker Compose + K8s',
        competitorDetail: 'Docker 部署',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费',
        ihuiDetail: '云版统一积分',
        competitorDetail: '自托管免费',
      },
      {
        dimension: '生态',
        ihui: 'Agent 市场 + MCP 工具市场',
        competitor: '知识库模板',
        ihuiDetail: '完整 AI 操作系统生态',
        competitorDetail: '专注 RAG 场景',
      },
    ],
  },
  n8n: {
    id: 'n8n',
    name: 'n8n',
    tagline: 'n8n 偏工作流自动化;IHUI AI 在工作流上叠加 LLM + Agent + 六端',
    verdict:
      '如果你的需求是纯工作流自动化(无 AI),n8n 生态更丰富;如果你需要 LLM/Agent 作为工作流核心节点,IHUI AI 是更合适的选择。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统,含工作流',
        competitor: '工作流自动化平台',
        ihuiDetail: '工作流是组件,LLM/Agent 是一等公民',
        competitorDetail: '通用工作流,LLM 只是一个节点',
      },
      {
        dimension: 'AI 能力',
        ihui: '原生 AI 优先',
        competitor: '作为节点集成',
        ihuiDetail: 'LLM/Agent/Knowledge Base 是核心模块',
        competitorDetail: '通过 AI 节点接入,需自己配',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化拖拽 + 200+ 模板',
        competitor: '无 Agent 概念',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '需自己用 LLM 节点搭建',
      },
      {
        dimension: '知识库',
        ihui: '内置 RAG 模块',
        competitor: '需通过 Pinecone 等外部集成',
        ihuiDetail: '向量 + BM25 混合检索',
        competitorDetail: '外部向量库集成',
      },
      {
        dimension: 'MCP',
        ihui: true,
        competitor: '有限',
        ihuiDetail: '原生 MCP,100+ 预置',
        competitorDetail: '通过社区节点',
      },
      {
        dimension: '客户端',
        ihui: '6 端',
        competitor: 'Web + 自托管',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web 编辑器 + 自托管',
      },
      {
        dimension: '多模型',
        ihui: '10+ 模型 + 统一计费',
        competitor: '通过节点接入',
        ihuiDetail: 'OpenAI/Claude/Gemini 等',
        competitorDetail: '需分别配凭证',
      },
      {
        dimension: '工作流节点',
        ihui: 'AI 节点 + 通用节点',
        competitor: '通用节点(400+)',
        ihuiDetail: 'AI 节点更丰富',
        competitorDetail: '集成节点更丰富',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: 'Sustainable Use License',
        ihuiDetail: '完全开源,商业可用',
        competitorDetail: 'SUL 限制商业竞争',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '多用户协作',
        ihuiDetail: '多租户 + 积分共享',
        competitorDetail: '协作功能较基础',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '云版按工作流执行计费',
        ihuiDetail: '统一积分',
        competitorDetail: '按执行次数',
      },
    ],
  },
}

function Cell({ value, isIhui, dimension }: { value: CellValue; dimension: string; isIhui: boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="mx-auto h-5 w-5 text-primary" aria-label={`${isIhui ? 'IHUI AI' : '竞品'}支持 ${dimension}`} />
    ) : (
      <X className="mx-auto h-5 w-5 text-muted-foreground/40" aria-label={`${isIhui ? 'IHUI AI' : '竞品'}不支持 ${dimension}`} />
    )
  }
  return <span className="text-sm font-medium">{value}</span>
}

export function CompareContent({ competitor }: { competitor: 'dify' | 'coze' | 'fastgpt' | 'n8n' }): React.JSX.Element {
  const config = COMPETITORS[competitor]
  const yesCount = config.rows.filter((r) => r.ihui === true).length
  const competitorYesCount = config.rows.filter((r) => r.competitor === true).length
  const competitorLimitedCount = config.rows.filter((r) => r.competitor === '基础' || r.competitor === '有限' || r.competitor === '受限' || r.competitor === '部分' || (typeof r.competitor === 'string' && r.competitor.includes('only'))).length

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-5 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Layers className="h-3.5 w-3.5 text-primary" />
          深度对比
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          IHUI AI vs {config.name}
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
          {config.tagline}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>IHUI AI: {yesCount}/{config.rows.length} 项支持</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>
              {config.name}: {competitorYesCount}/{config.rows.length} 项完全支持
              {competitorLimitedCount > 0 && ` + ${competitorLimitedCount} 项有限`}
            </span>
          </div>
        </div>
      </section>

      {/* 对比表格 */}
      <section className="mt-12 overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-4 text-left text-sm font-semibold md:px-6">对比维度</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-primary md:px-6">IHUI AI</th>
              <th className="px-4 py-4 text-center text-sm font-semibold md:px-6">{config.name}</th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, idx) => (
              <tr key={row.dimension} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                <td className="px-4 py-4 md:px-6">
                  <div className="text-sm font-medium">{row.dimension}</div>
                  {(row.ihuiDetail || row.competitorDetail) && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.ihuiDetail && (
                        <div>
                          <span className="text-primary">IHUI:</span> {row.ihuiDetail}
                        </div>
                      )}
                      {row.competitorDetail && (
                        <div className="mt-0.5">
                          <span>{config.name}:</span> {row.competitorDetail}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-center md:px-6">
                  <Cell value={row.ihui} dimension={row.dimension} isIhui={true} />
                </td>
                <td className="px-4 py-4 text-center md:px-6">
                  <Cell value={row.competitor} dimension={row.dimension} isIhui={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 总结 */}
      <section className="mt-12 rounded-2xl border bg-primary/5 p-8 md:p-12">
        <div className="flex items-start gap-3">
          <Rocket className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">结论</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
              {config.verdict}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-2xl border bg-card p-8 text-center md:p-12">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
          30 分钟体验 IHUI AI
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          注册即得 1000 积分,所有模型、所有 6 端免费试用。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/sso/register">免费注册</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/compare">查看其他对比</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}

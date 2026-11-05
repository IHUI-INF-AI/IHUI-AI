// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Metadata } from 'next'
import {
  ShoppingCart,
  Code,
  PenLine,
  BarChart3,
  GraduationCap,
  Lightbulb,
  Heart,
} from 'lucide-react'
import { ManualFigure } from '@/components/docs/manual-figure'
import { ManualNav, chapters } from '../_manual-nav'

const SITE_URL = 'https://aizhs.top'

export const metadata: Metadata = {
  title: '第 3 章 使用 Agent — 智汇 AI 使用说明手册',
  description:
    '智汇 AI 使用说明手册第 3 章:浏览 Agent 市场、选用 Agent、收藏、定制提示词、保存为自己的 Agent、发布到市场。',
  alternates: {
    canonical: '/docs/manual/agent',
    languages: {
      'x-default': '/docs/manual/agent',
    },
  },
  openGraph: {
    title: '第 3 章 使用 Agent — 智汇 AI',
    description: '从市场选用 Agent、收藏、定制提示词、发布。',
    url: `${SITE_URL}/docs/manual/agent`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20261021', width: 1200, height: 630, alt: '智汇 AI Agent 使用' }],
  },
}

export default function ManualAgentPage() {
  return (
    <main className="px-4 mx-auto w-full max-w-3xl py-4">
      {/* Hero */}
      <header className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground">第 03 章 · 使用说明手册</div>
        <h1 className="text-display min-[768px]:text-3xl font-bold tracking-tight">使用 Agent</h1>
        <p className="text-sm text-muted-foreground min-[768px]:text-base">
          Agent 是预设好提示词 + 模型 + 工具的"AI 角色",拿来即用,无需自己写提示词。
          本章教你从 200+ 模板中选用、定制、发布 Agent。
        </p>
      </header>

      {/* 什么是 Agent */}
      <section id="what-is-agent" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">3.1 什么是 Agent?</h2>
        <div className="rounded-lg border bg-card p-3 space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Agent = 提示词 + 模型 + 工具 + 知识库</strong> 的封装体,完成特定任务。
          </p>
          <p>类比:Agent 是"AI 员工",提示词是"岗位说明书",模型是"大脑",工具是"手",知识库是"参考资料"。</p>
          <p>常见 Agent 示例:</p>
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>
              <ShoppingCart className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
              <strong>智能客服</strong>:7×24 答疑,挂载产品手册知识库
            </li>
            <li>
              <Code className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
              <strong>代码审查</strong>:读 GitHub PR,自动找 bug + 给建议
            </li>
            <li>
              <PenLine className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
              <strong>内容创作</strong>:写文案 / 公众号 / 小红书,支持多模态配图
            </li>
            <li>
              <BarChart3 className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
              <strong>数据分析</strong>:上传 Excel,自动出图 + 洞察
            </li>
            <li>
              <GraduationCap className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
              <strong>课程答疑</strong>:挂载课件知识库,7×24 答疑
            </li>
          </ul>
        </div>
      </section>

      {/* 浏览市场 */}
      <section id="browse-market" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">3.2 浏览 Agent 市场</h2>
        <div className="rounded-lg border bg-card p-3 space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>左侧栏点击"Agent 市场",或访问 <a href="https://aizhs.top/agents" className="text-primary underline">aizhs.top/agents</a></li>
            <li>顶部按分类筛选:客服 / 代码 / 写作 / 数据 / 教育 / 销售 / HR / 通用</li>
            <li>可按"免费 / 付费 / 热门 / 最新"排序</li>
            <li>点击任意 Agent 卡片,查看详情页:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li><strong>简介</strong>:Agent 介绍 + 使用场景</li>
                <li><strong>示例对话</strong>:作者提供的演示对话</li>
                <li><strong>评论</strong>:其他用户的评价</li>
                <li><strong>使用次数 / 评分</strong>:可信度参考</li>
              </ul>
            </li>
          </ol>
        </div>
        <ManualFigure
          src="/images/docs/manual/agent-market.png"
          alt="智汇 AI 智能体市场页:标题「智能体市场」下为「Agent 市场 / 我的 Agent」两个页签、搜索框与「全部分类、AI 编程助手、AI 写作助手、AI 绘画助手、AI 教育助手、AI 营销助手」分类按钮,其下是三列 Agent 卡片,每张含头像、名称、简介与「免费」徽章"
          caption="实拍 aizhs.top 智能体市场(/agents),卡片为线上已发布(可公开访问)的真实 Agent。分类按钮即本节第 2 步的筛选入口;卡片点进去就是下面 3.3 的详情页。"
        />
        <ManualFigure
          src="/images/docs/manual/agent-detail.png"
          alt="智汇 AI 智能体详情页:顶部为「返回」「编辑」「派发 Subagent」三个操作,主体显示 Agent 头像与名称「古诗词搜索」、已发布与免费徽章、功能简介,其下两列列出智能体 ID、分类、工作区、状态、价格、排序、创建时间与更新时间,再往下是进度、群体监控、检查点、计划、活动流、后台、权限、Agent 执行八个页签"
          caption="实拍线上已发布 Agent 的详情页(/agents/〔智能体 ID〕)。第 3 步「查看详情页」看到的就是这一屏:简介、状态与价格在上,运行观测页签在下。"
        />
      </section>

      {/* 选用 Agent */}
      <section id="use-agent" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">3.3 选用 Agent</h2>
        <div className="rounded-lg border bg-card p-3 space-y-2 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>在 Agent 详情页点击"<strong>使用</strong>"按钮</li>
            <li>系统自动 fork 一份到你自己的工作台(原 Agent 不受影响)</li>
            <li>跳转到对话页,直接开始对话</li>
            <li>左侧栏"我的 Agent"可看到刚 fork 的 Agent</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            <Lightbulb className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
            <strong>免费 Agent</strong>:直接使用,消耗你的积分。
            <strong>付费 Agent</strong>:作者定价(如 ¥9.9/月),购买后无限次使用。
          </p>
        </div>
      </section>

      {/* 收藏 */}
      <section id="favorite" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">3.4 收藏 Agent</h2>
        <div className="rounded-lg border bg-card p-3 space-y-2 text-sm text-muted-foreground">
          <ul className="ml-4 list-disc space-y-1">
            <li>
              Agent 卡片右上角点 <Heart className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 收藏
            </li>
            <li>左侧栏"收藏夹"快速访问</li>
            <li>支持自定义分组(如"工作必备"、"学习用"、"备用")</li>
          </ul>
        </div>
      </section>

      {/* 定制 */}
      <section id="customize" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">3.5 定制 Agent(改提示词)</h2>
        <div className="rounded-lg border bg-card p-3 space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>左侧栏"我的 Agent" → 选择要定制的 Agent → 点击"编辑"</li>
            <li>进入 Agent 编辑器,可修改:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li><strong>名称 / 头像 / 描述</strong>:基础信息</li>
                <li><strong>系统提示词</strong>:定义 Agent 人格、能力、输出格式</li>
                <li><strong>模型</strong>:选 LLM(GPT-4o / Claude / DeepSeek 等)</li>
                <li><strong>知识库</strong>:挂载你的知识库(见第 4 章)</li>
                <li><strong>工具</strong>:开启搜索 / 代码执行 / 文件读写 / MCP 工具</li>
                <li><strong>开场白</strong>:用户进入时 Agent 主动说的话</li>
                <li><strong>推荐问题</strong>:用户可点击的快捷问题</li>
              </ul>
            </li>
            <li>右侧"预览"实时测试改动效果</li>
            <li>点击"保存",新版本生效</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            <Lightbulb className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
            <strong>提示词技巧</strong>:用"你是 XXX,擅长 XXX,输出格式为 XXX"结构化描述,效果远好于"帮我写文案"这种模糊指令。
          </p>
        </div>
      </section>

      {/* 发布 */}
      <section id="publish" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">3.6 发布 Agent 到市场(变现)</h2>
        <div className="rounded-lg border bg-card p-3 space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>Agent 编辑页点"发布到市场"</li>
            <li>填写市场信息:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li><strong>分类</strong>:选 1-3 个分类</li>
                <li><strong>定价</strong>:免费 / 付费(¥X.X / 月)</li>
                <li><strong>截图</strong>:3-5 张示例对话截图</li>
                <li><strong>描述</strong>:用户能搜到你的关键词</li>
              </ul>
            </li>
            <li>提交审核(1-3 工作日,审核提示词合规性)</li>
            <li>审核通过 → 上架市场 → 全球用户可见</li>
            <li>收益:付费 Agent 80% 分成,月结到支付宝</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            <Lightbulb className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
            <strong>爆款 Agent 技巧</strong>:解决具体痛点(如"小红书爆款文案"),提供示例对话,定期更新提示词。
          </p>
        </div>
      </section>

      <ManualNav prev={chapters['02']} next={chapters['04']} />
    </main>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

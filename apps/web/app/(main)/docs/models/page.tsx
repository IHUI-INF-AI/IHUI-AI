// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BookOpen,
  Bot,
  Brain,
  Coins,
  Flag,
  Globe,
  Lightbulb,
  Monitor,
  Pin,
  Shuffle,
  Wrench,
} from 'lucide-react'
import { CodeBlock } from '@/components/docs/code-block'

const SITE_URL = 'https://aizhs.top'

/**
 * Provider 健康档位 → 徽章配色(文档页只读展示,取本仓既有状态色档:
 * healthy 绿 / degraded 琥珀 / down 红 / 未配置 中性 / 本地·免费 信息蓝·正向绿)。
 * 值档逐字沿用 `admin/monitor` 与 `settings/llm/ProviderCardV2` 已落地的 token 组合,
 * 不自创新档、不写字面色值。
 */
const STATUS_TONE_CLASS = {
  healthy: 'bg-success/10 text-success-deep-text',
  degraded: 'bg-warning/10 text-warning-amber-text',
  down: 'bg-danger/10 text-danger-text',
  unconfigured: 'bg-muted text-muted-foreground',
  local: 'bg-info/10 text-info-text',
  free: 'bg-success/10 text-success-deep-text',
} as const

type ProviderStatusTone = keyof typeof STATUS_TONE_CLASS

/** Provider 健康档位行:机器名 + 色档 + 中文标签 + 含义(色档键受封闭联合约束,漏档即 tsc 红) */
const PROVIDER_HEALTH_ROWS: {
  status: string
  tone: ProviderStatusTone
  label: string
  desc: string
}[] = [
  { status: 'healthy', tone: 'healthy', label: '健康', desc: '正常服务,延迟 < 2s' },
  {
    status: 'degraded',
    tone: 'degraded',
    label: '降级',
    desc: '可用但慢(延迟 > 5s)或部分模型异常',
  },
  {
    status: 'down',
    tone: 'down',
    label: '不可用',
    desc: '402 余额不足 / 403 无权限 / 超时 / 网络错误',
  },
  { status: 'not_configured', tone: 'unconfigured', label: '未配置', desc: 'Admin 未填 API Key' },
  { status: 'local', tone: 'local', label: '本地', desc: 'Ollama / vLLM 等本地部署,不走云端' },
  { status: 'zero_cost', tone: 'free', label: '免费额度', desc: '厂商提供免费 quota,不消耗积分' },
]

const modelsJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TechArticle',
      '@id': 'https://aizhs.top/docs/models#article',
      headline: '智汇 AI 多模型调度完整指南',
      description:
        '智汇 AI 多模型调度:100+ LLM 统一接入,Provider 健康检查,自动 fallback,Combo 链组合,Token 压缩,统一积分池。',
      author: { '@id': 'https://aizhs.top/#organization' },
      publisher: { '@id': 'https://aizhs.top/#organization' },
      datePublished: '2024-01-01',
      dateModified: '2026-08-01',
      proficiencyLevel: 'Beginner',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/models#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        {
          '@type': 'ListItem',
          position: 3,
          name: '多模型调度',
          item: 'https://aizhs.top/docs/models',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '多模型调度 — 智汇 AI 文档',
  description:
    '智汇 AI 多模型调度完整指南:100+ LLM 统一接入,Provider 健康检查,自动 fallback,Combo 链,Token 压缩,统一积分池。',
  alternates: {
    canonical: '/docs/models',
    // hreflang 死链已删(2026-11-02 实测):/zh-cn /zh-tw /ko /ja 目录与 /en 子页均 404,只留 canonical + x-default
    languages: {
      'x-default': '/docs/models',
    },
  },
  openGraph: {
    title: '多模型调度 — 智汇 AI',
    description: '100+ LLM 统一接入,自动 fallback,Combo 链组合调用。',
    url: `${SITE_URL}/docs/models`,
    type: 'article',
    images: [
      { url: '/images/logo.png?v=20261021', width: 1200, height: 630, alt: '智汇 AI 多模型调度' },
    ],
  },
}

export default function ModelsDocsPage() {
  return (
    <main className="px-4 mx-auto w-full max-w-5xl py-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(modelsJsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-label font-medium text-muted-foreground">
          <Brain className="h-3.5 w-3.5" />
          多模型调度
        </div>
        <h1 className="text-display min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          多模型调度完整指南
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          100+ LLM 统一接入,自动 fallback,Combo 链组合调用,Token 压缩,
          统一积分池一套账单全模型通用。
        </p>
      </header>

      {/* 支持的模型 */}
      <section id="supported-models" className="mt-16 space-y-6">
        <h2 className="text-display font-bold tracking-tight">支持的模型(100+)</h2>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="flex items-center text-body font-semibold">
              <Globe className="mr-1.5 inline h-4 w-4" />
              国际厂商
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="font-[weight:inherit] w-full text-body">
                <thead>
                  <tr className="bg-muted/60 text-left text-label font-semibold">
                    <th scope="col" className="p-3">
                      厂商
                    </th>
                    <th scope="col" className="p-3">
                      模型
                    </th>
                    <th scope="col" className="p-3">
                      适用场景
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      'OpenAI',
                      'GPT-5、GPT-4.1、GPT-4o、o3-mini、o1、GPT-4 Turbo',
                      '通用 / 推理 / 视觉',
                    ],
                    [
                      'Anthropic',
                      'Claude Opus 4.5、Sonnet 4.5、Haiku 3.5',
                      '长上下文 / 代码 / 推理',
                    ],
                    ['Google', 'Gemini 2.5 Pro、Gemini 2.5 Flash', '多模态 / 长上下文'],
                    ['xAI', 'Grok 4、Grok 3、Grok Code Fast', '实时 / 代码'],
                    ['Mistral', 'Mistral Large 2、Codestral、Pixtral', '欧洲 / 开源'],
                  ].map(([vendor, models, scene], i) => (
                    <tr key={vendor} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}>
                      <td className="p-3 font-medium whitespace-nowrap">{vendor}</td>
                      <td className="p-3 text-muted-foreground">{models}</td>
                      <td className="font-[weight:inherit] p-3 text-label text-muted-foreground">{scene}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="flex items-center text-body font-semibold">
              <Flag className="mr-1.5 inline h-4 w-4" />
              国产模型
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="font-[weight:inherit] w-full text-body">
                <thead>
                  <tr className="bg-muted/60 text-left text-label font-semibold">
                    <th scope="col" className="p-3">
                      厂商
                    </th>
                    <th scope="col" className="p-3">
                      模型
                    </th>
                    <th scope="col" className="p-3">
                      适用场景
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      '阿里通义千问',
                      'Qwen3-Max、Qwen3-235B、Qwen-Plus、Qwen-Turbo',
                      '中文 / 代码 / 推理',
                    ],
                    ['DeepSeek', 'DeepSeek V3.2、R1、Coder', '推理 / 代码 / 低成本'],
                    ['智谱 AI', 'GLM-4.6、GLM-4-Plus、GLM-4-Flash、GLM-4V', '中文 / 多模态'],
                    ['百度文心', 'ERNIE 4.5、ERNIE Speed', '中文 / 企业'],
                    ['字节豆包', 'Doubao-Pro、Doubao-Lite、Doubao-Vision', '中文 / 多模态'],
                    ['月之暗面', 'Kimi K2、Kimi Thinking', '长上下文 / 推理'],
                    ['MiniMax', 'abab6.5、abab6.5s', '中文 / 语音'],
                    ['阶跃星辰', 'Step-2、Step-1V', '多模态'],
                  ].map(([vendor, models, scene], i) => (
                    <tr key={vendor} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}>
                      <td className="p-3 font-medium whitespace-nowrap">{vendor}</td>
                      <td className="p-3 text-muted-foreground">{models}</td>
                      <td className="font-[weight:inherit] p-3 text-label text-muted-foreground">{scene}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="flex items-center text-body font-semibold">
              <Monitor className="mr-1.5 inline h-4 w-4" />
              本地 / 开源
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="font-[weight:inherit] w-full text-body">
                <thead>
                  <tr className="bg-muted/60 text-left text-label font-semibold">
                    <th scope="col" className="p-3">
                      运行时
                    </th>
                    <th scope="col" className="p-3">
                      模型
                    </th>
                    <th scope="col" className="p-3">
                      适用场景
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Ollama', 'llama3.3、qwen2.5、deepseek-r1、gemma2', '本地部署'],
                    ['vLLM', '任意 HuggingFace 模型', '高吞吐推理'],
                    ['LM Studio', 'GGUF 量化模型', '桌面应用'],
                    ['OpenAI 兼容', '任何 OpenAI API 兼容端点', '自定义接入'],
                  ].map(([vendor, models, scene], i) => (
                    <tr key={vendor} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}>
                      <td className="p-3 font-medium whitespace-nowrap">{vendor}</td>
                      <td className="p-3 text-muted-foreground">{models}</td>
                      <td className="font-[weight:inherit] p-3 text-label text-muted-foreground">{scene}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Provider 健康检查 */}
      <section id="provider-health" className="mt-16 space-y-6">
        <h2 className="text-display font-bold tracking-tight">Provider 健康检查(独家)</h2>
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <p className="font-[weight:inherit] text-body text-muted-foreground">
            智汇 AI 每 5 分钟探测所有 Provider,自动剔除"账户没钱 / Key 失效 / 接不通"的 Provider,
            终端用户只会看到真正可用的模型。Admin 端可查看每个 Provider 的状态、余额、错误详情。
          </p>
          <div className="overflow-x-auto">
            <table className="font-[weight:inherit] w-full text-body">
              <thead>
                <tr className="bg-muted/60 text-left text-label font-semibold">
                  <th scope="col" className="p-3">
                    状态值
                  </th>
                  <th scope="col" className="p-3">
                    显示
                  </th>
                  <th scope="col" className="p-3">
                    含义
                  </th>
                </tr>
              </thead>
              <tbody>
                {PROVIDER_HEALTH_ROWS.map(({ status, tone, label, desc }, i) => (
                  <tr key={status} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}>
                    <td className="font-[weight:inherit] p-3 font-mono text-label whitespace-nowrap">{status}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex h-4 items-center justify-center rounded-md px-1 text-[10px] font-semibold leading-none ${STATUS_TONE_CLASS[tone]}`}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="font-[weight:inherit] p-3 text-label text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 自动 Fallback */}
      <section id="fallback" className="mt-16 space-y-6">
        <h2 className="text-display font-bold tracking-tight">自动 Fallback(高可用)</h2>
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <p className="font-[weight:inherit] text-body text-muted-foreground">
            配置 fallback 链,主模型失败时自动切换备用模型,用户无感知:
          </p>
          <CodeBlock
            language="json"
            code={`# Agent 配置示例
{
  "model": "gpt-4o",                    // 主模型
  "fallback_models": [                  // 备用链(按优先级)
    "claude-sonnet-4-5",
    "qwen3-max",
    "deepseek-v3.2"
  ],
  "fallback_strategy": "error_or_rate_limit"  // 触发条件
}

# 触发场景
- 429 Rate Limit → 切下一个
- 5xx Server Error → 切下一个
- 超时(默认 30s)→ 切下一个
- 402 Payment Required → 切下一个并通知 Admin
- 200 成功 → 不切`}
          />
          <p className="font-[weight:inherit] text-label text-muted-foreground">
            <Lightbulb className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
            <strong>跨厂商 fallback</strong>:OpenAI 挂了切 Anthropic,Anthropic 挂了切通义,
            三大厂商同时挂的概率几乎为 0,服务可用性达 99.95%。
          </p>
        </div>
      </section>

      {/* Combo 链 */}
      <section id="combo-chain" className="mt-16 space-y-6">
        <h2 className="text-display font-bold tracking-tight">Combo 链(组合调用)</h2>
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <p className="font-[weight:inherit] text-body text-muted-foreground">
            把多个模型串联 / 并联调用,实现单模型无法完成的能力:
          </p>
          <div className="space-y-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="flex items-center text-body font-semibold">
                <Pin className="mr-1.5 inline h-4 w-4" />
                串联(Priority 策略)
              </p>
              <p className="font-[weight:inherit] mt-1 text-label text-muted-foreground">
                按顺序尝试,前一个失败才用下一个 — <strong>等价于 fallback</strong>
              </p>
              <CodeBlock
                language="yaml"
                code={`chain: ["gpt-4o", "claude-sonnet-4-5", "qwen3-max"]`}
              />
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="flex items-center text-body font-semibold">
                <Coins className="mr-1.5 inline h-4 w-4" />
                串联(Cheapest 策略)
              </p>
              <p className="font-[weight:inherit] mt-1 text-label text-muted-foreground">
                按价格从低到高尝试,优先用便宜模型,质量不够才升级
              </p>
              <CodeBlock
                language="yaml"
                code={`chain: ["deepseek-v3.2", "qwen3-plus", "gpt-4o-mini", "gpt-4o"]`}
              />
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="flex items-center text-body font-semibold">
                <Shuffle className="mr-1.5 inline h-4 w-4" />
                并联(Fusion 策略)
              </p>
              <p className="font-[weight:inherit] mt-1 text-label text-muted-foreground">
                多模型同时回答,Judge 模型打分选最佳 — <strong>质量最高但贵</strong>
              </p>
              <CodeBlock
                language="yaml"
                code={`chain: ["gpt-4o", "claude-sonnet-4-5", "qwen3-max"]
judge: "gpt-4o"   # 用 GPT-4o 评分选最佳答案`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Token 压缩 */}
      <section id="token-compaction" className="mt-16 space-y-6">
        <h2 className="text-display font-bold tracking-tight">Token 压缩(降本利器)</h2>
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <p className="font-[weight:inherit] text-body text-muted-foreground">
            长对话自动压缩历史消息,降低 Token 消耗 60%+,质量损失 &lt; 5%:
          </p>
          <div className="overflow-x-auto">
            <table className="font-[weight:inherit] w-full text-body">
              <thead>
                <tr className="bg-muted/60 text-left text-label font-semibold">
                  <th scope="col" className="p-3">
                    策略
                  </th>
                  <th scope="col" className="p-3">
                    全称
                  </th>
                  <th scope="col" className="p-3">
                    做法
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['RTK', 'Retrieval Token Keep', '保留关键 Token,删除冗余词(介词/语气词)'],
                  ['Caveman', '压缩成"穴居人语"', '去掉所有非关键词,仅保留主谓宾'],
                  ['RTK + Caveman', '混合策略', '先 RTK 再 Caveman,压缩率最高'],
                ].map(([name, full, desc], i) => (
                  <tr key={name} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}>
                    <td className="font-[weight:inherit] p-3 font-mono text-label whitespace-nowrap">{name}</td>
                    <td className="p-3 font-medium">{full}</td>
                    <td className="font-[weight:inherit] p-3 text-label text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CodeBlock
            language="json"
            code={`# Admin 配置
{
  "compaction_strategy": "rtk_caveman",
  "compaction_threshold": 8000,    // 上下文超过 8K Token 触发
  "keep_recent": 4                 // 保留最近 4 轮对话不压缩
}`}
          />
        </div>
      </section>

      {/* 统一积分池 */}
      <section id="credits" className="mt-16 space-y-6">
        <h2 className="text-display font-bold tracking-tight">统一积分池</h2>
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <p className="font-[weight:inherit] text-body text-muted-foreground">
            不用每个厂商单独充值,智汇 AI 统一积分池,一套账单全模型通用:
          </p>
          <ul className="font-[weight:inherit] ml-4 list-disc space-y-1 text-body text-muted-foreground">
            <li>1 积分 ≈ 1000 Token(标准模型)</li>
            <li>贵模型(GPT-4o / Claude Opus)消耗 2-5x 积分</li>
            <li>便宜模型(DeepSeek / Qwen-Turbo)消耗 0.1-0.5x 积分</li>
            <li>本地模型(Ollama)消耗 0 积分</li>
            <li>Admin 可设"模型系数"精细控制成本</li>
          </ul>
          <CodeBlock
            language="json"
            code={`# 模型积分系数示例
{
  "gpt-4o": 3.0,           // 3x 积分
  "claude-opus-4": 5.0,    // 5x 积分
  "qwen3-plus": 1.0,       // 标准
  "deepseek-v3.2": 0.3,    // 0.3x 积分(便宜)
  "ollama:llama3.3": 0     // 免费(本地)
}`}
          />
        </div>
      </section>

      {/* 下一步 */}
      <section className="mt-16 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-3">
        <h2 className="text-lg font-semibold">下一步</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
          <Link
            href="/docs/agent"
            className="font-[weight:inherit] rounded-lg border bg-card p-3 text-body hover:bg-accent"
          >
            <Bot className="mr-1 inline h-4 w-4" aria-hidden />
            <span>Agent 开发 →</span>
            <br />
            <span className="font-[weight:inherit] text-label text-muted-foreground">为 Agent 选模型</span>
          </Link>
          <Link href="/docs/rag" className="font-[weight:inherit] rounded-lg border bg-card p-3 text-body hover:bg-accent">
            <BookOpen className="mr-1 inline h-4 w-4" aria-hidden />
            <span>知识库 RAG →</span>
            <br />
            <span className="font-[weight:inherit] text-label text-muted-foreground">Embedding 模型选择</span>
          </Link>
          <Link href="/docs/api" className="font-[weight:inherit] rounded-lg border bg-card p-3 text-body hover:bg-accent">
            <Wrench className="mr-1 inline h-4 w-4" aria-hidden />
            <span>API 参考 →</span>
            <br />
            <span className="font-[weight:inherit] text-label text-muted-foreground">通过 API 调用模型</span>
          </Link>
        </div>
      </section>
    </main>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

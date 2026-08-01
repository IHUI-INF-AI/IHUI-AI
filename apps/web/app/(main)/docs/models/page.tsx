import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

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
        { '@type': 'ListItem', position: 3, name: '多模型调度', item: 'https://aizhs.top/docs/models' },
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
    languages: {
      'zh-CN': '/zh-cn/docs/models',
      'zh-TW': '/zh-tw/docs/models',
      en: '/en/docs/models',
      ko: '/ko/docs/models',
      ja: '/ja/docs/models',
      'x-default': '/docs/models',
    },
  },
  openGraph: {
    title: '多模型调度 — 智汇 AI',
    description: '100+ LLM 统一接入,自动 fallback,Combo 链组合调用。',
    url: `${SITE_URL}/docs/models`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI 多模型调度' }],
  },
}

export default function ModelsDocsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(modelsJsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>🧠</span>
          多模型调度
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          多模型调度完整指南
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          100+ LLM 统一接入,自动 fallback,Combo 链组合调用,Token 压缩,
          统一积分池一套账单全模型通用。
        </p>
      </header>

      {/* 支持的模型 */}
      <section id="supported-models" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">支持的模型(100+)</h2>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-6">
            <p className="text-sm font-semibold">🌍 国际厂商</p>
            <div className="mt-3 space-y-2">
              {[
                ['OpenAI', 'GPT-5、GPT-4.1、GPT-4o、o3-mini、o1、GPT-4 Turbo', '通用 / 推理 / 视觉'],
                ['Anthropic', 'Claude Opus 4.5、Sonnet 4.5、Haiku 3.5', '长上下文 / 代码 / 推理'],
                ['Google', 'Gemini 2.5 Pro、Gemini 2.5 Flash', '多模态 / 长上下文'],
                ['xAI', 'Grok 4、Grok 3、Grok Code Fast', '实时 / 代码'],
                ['Mistral', 'Mistral Large 2、Codestral、Pixtral', '欧洲 / 开源'],
              ].map(([vendor, models, scene], i) => (
                <div
                  key={vendor}
                  className={`grid grid-cols-1 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-3 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
                >
                  <div className="font-medium">{vendor}</div>
                  <div className="text-muted-foreground">{models}</div>
                  <div className="text-xs text-muted-foreground">{scene}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <p className="text-sm font-semibold">🇨🇳 国产模型</p>
            <div className="mt-3 space-y-2">
              {[
                ['阿里通义千问', 'Qwen3-Max、Qwen3-235B、Qwen-Plus、Qwen-Turbo', '中文 / 代码 / 推理'],
                ['DeepSeek', 'DeepSeek V3.2、R1、Coder', '推理 / 代码 / 低成本'],
                ['智谱 AI', 'GLM-4.6、GLM-4-Plus、GLM-4-Flash、GLM-4V', '中文 / 多模态'],
                ['百度文心', 'ERNIE 4.5、ERNIE Speed', '中文 / 企业'],
                ['字节豆包', 'Doubao-Pro、Doubao-Lite、Doubao-Vision', '中文 / 多模态'],
                ['月之暗面', 'Kimi K2、Kimi Thinking', '长上下文 / 推理'],
                ['MiniMax', 'abab6.5、abab6.5s', '中文 / 语音'],
                ['阶跃星辰', 'Step-2、Step-1V', '多模态'],
              ].map(([vendor, models, scene], i) => (
                <div
                  key={vendor}
                  className={`grid grid-cols-1 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-3 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
                >
                  <div className="font-medium">{vendor}</div>
                  <div className="text-muted-foreground">{models}</div>
                  <div className="text-xs text-muted-foreground">{scene}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <p className="text-sm font-semibold">🖥️ 本地 / 开源</p>
            <div className="mt-3 space-y-2">
              {[
                ['Ollama', 'llama3.3、qwen2.5、deepseek-r1、gemma2', '本地部署'],
                ['vLLM', '任意 HuggingFace 模型', '高吞吐推理'],
                ['LM Studio', 'GGUF 量化模型', '桌面应用'],
                ['OpenAI 兼容', '任何 OpenAI API 兼容端点', '自定义接入'],
              ].map(([vendor, models, scene], i) => (
                <div
                  key={vendor}
                  className={`grid grid-cols-1 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-3 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
                >
                  <div className="font-medium">{vendor}</div>
                  <div className="text-muted-foreground">{models}</div>
                  <div className="text-xs text-muted-foreground">{scene}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Provider 健康检查 */}
      <section id="provider-health" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Provider 健康检查(独家)</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            智汇 AI 每 5 分钟探测所有 Provider,自动剔除"账户没钱 / Key 失效 / 接不通"的 Provider,
            终端用户只会看到真正可用的模型。Admin 端可查看每个 Provider 的状态、余额、错误详情。
          </p>
          <div className="space-y-2">
            {[
              ['healthy', '✅ 健康', '正常服务,延迟 < 2s'],
              ['degraded', '🟡 降级', '可用但慢(延迟 > 5s)或部分模型异常'],
              ['down', '🔴 不可用', '402 余额不足 / 403 无权限 / 超时 / 网络错误'],
              ['not_configured', '⚪ 未配置', 'Admin 未填 API Key'],
              ['local', '🖥️ 本地', 'Ollama / vLLM 等本地部署,不走云端'],
              ['zero_cost', '🆓 免费额度', '厂商提供免费 quota,不消耗积分'],
            ].map(([status, label, desc], i) => (
              <div
                key={status}
                className={`grid grid-cols-1 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-3 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
              >
                <div className="font-mono text-xs">{status}</div>
                <div className="font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 自动 Fallback */}
      <section id="fallback" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">自动 Fallback(高可用)</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            配置 fallback 链,主模型失败时自动切换备用模型,用户无感知:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>{`# Agent 配置示例
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
- 200 成功 → 不切`}</code>
          </pre>
          <p className="text-xs text-muted-foreground">
            💡 <strong>跨厂商 fallback</strong>:OpenAI 挂了切 Anthropic,Anthropic 挂了切通义,
            三大厂商同时挂的概率几乎为 0,服务可用性达 99.95%。
          </p>
        </div>
      </section>

      {/* Combo 链 */}
      <section id="combo-chain" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Combo 链(组合调用)</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            把多个模型串联 / 并联调用,实现单模型无法完成的能力:
          </p>
          <div className="space-y-3">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">📌 串联(Priority 策略)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                按顺序尝试,前一个失败才用下一个 — <strong>等价于 fallback</strong>
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                <code>{`chain: ["gpt-4o", "claude-sonnet-4-5", "qwen3-max"]`}</code>
              </pre>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">💰 串联(Cheapest 策略)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                按价格从低到高尝试,优先用便宜模型,质量不够才升级
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                <code>{`chain: ["deepseek-v3.2", "qwen3-plus", "gpt-4o-mini", "gpt-4o"]`}</code>
              </pre>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">🔀 并联(Fusion 策略)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                多模型同时回答,Judge 模型打分选最佳 — <strong>质量最高但贵</strong>
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                <code>{`chain: ["gpt-4o", "claude-sonnet-4-5", "qwen3-max"]
judge: "gpt-4o"   # 用 GPT-4o 评分选最佳答案`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Token 压缩 */}
      <section id="token-compaction" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Token 压缩(降本利器)</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            长对话自动压缩历史消息,降低 Token 消耗 60%+,质量损失 &lt; 5%:
          </p>
          <div className="space-y-2">
            {[
              ['RTK', 'Retrieval Token Keep', '保留关键 Token,删除冗余词(介词/语气词)'],
              ['Caveman', '压缩成"穴居人语"', '去掉所有非关键词,仅保留主谓宾'],
              ['RTK + Caveman', '混合策略', '先 RTK 再 Caveman,压缩率最高'],
            ].map(([name, full, desc], i) => (
              <div
                key={name}
                className={`grid grid-cols-1 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-3 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
              >
                <div className="font-mono text-xs">{name}</div>
                <div className="font-medium">{full}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            ))}
          </div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            <code>{`# Admin 配置
{
  "compaction_strategy": "rtk_caveman",
  "compaction_threshold": 8000,    // 上下文超过 8K Token 触发
  "keep_recent": 4                 // 保留最近 4 轮对话不压缩
}`}</code>
          </pre>
        </div>
      </section>

      {/* 统一积分池 */}
      <section id="credits" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">统一积分池</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            不用每个厂商单独充值,智汇 AI 统一积分池,一套账单全模型通用:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>1 积分 ≈ 1000 Token(标准模型)</li>
            <li>贵模型(GPT-4o / Claude Opus)消耗 2-5x 积分</li>
            <li>便宜模型(DeepSeek / Qwen-Turbo)消耗 0.1-0.5x 积分</li>
            <li>本地模型(Ollama)消耗 0 积分</li>
            <li>Admin 可设"模型系数"精细控制成本</li>
          </ul>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            <code>{`# 模型积分系数示例
{
  "gpt-4o": 3.0,           // 3x 积分
  "claude-opus-4": 5.0,    // 5x 积分
  "qwen3-plus": 1.0,       // 标准
  "deepseek-v3.2": 0.3,    // 0.3x 积分(便宜)
  "ollama:llama3.3": 0     // 免费(本地)
}`}</code>
          </pre>
        </div>
      </section>

      {/* 下一步 */}
      <section className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <h2 className="text-lg font-semibold">下一步</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
          <a href="/docs/agent" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🤖 Agent 开发 →<br />
            <span className="text-xs text-muted-foreground">为 Agent 选模型</span>
          </a>
          <a href="/docs/rag" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            📚 知识库 RAG →<br />
            <span className="text-xs text-muted-foreground">Embedding 模型选择</span>
          </a>
          <a href="/docs/api" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🛠️ API 参考 →<br />
            <span className="text-xs text-muted-foreground">通过 API 调用模型</span>
          </a>
        </div>
      </section>
    </main>
  )
}

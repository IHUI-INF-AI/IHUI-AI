import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

const ragJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TechArticle',
      '@id': 'https://aizhs.top/docs/rag#article',
      headline: '智汇 AI 知识库 RAG 完整指南',
      description:
        '智汇 AI 知识库 RAG 实现:文档解析、向量化、BM25 混合检索、知识图谱、rerank、引用溯源、多语言支持。',
      author: { '@id': 'https://aizhs.top/#organization' },
      publisher: { '@id': 'https://aizhs.top/#organization' },
      datePublished: '2024-01-01',
      dateModified: '2026-08-01',
      proficiencyLevel: 'Beginner',
      dependencies: '智汇 AI 账号 + 知识库模块',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/rag#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        { '@type': 'ListItem', position: 3, name: '知识库 RAG', item: 'https://aizhs.top/docs/rag' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '知识库 RAG — 智汇 AI 文档',
  description:
    '智汇 AI 知识库 RAG 完整指南:文档解析(PDF/Word/Markdown)、向量化、BM25 混合检索、知识图谱、rerank、引用溯源、多语言分词。',
  alternates: {
    canonical: '/docs/rag',
    languages: {
      'zh-CN': '/zh-cn/docs/rag',
      'zh-TW': '/zh-tw/docs/rag',
      en: '/en/docs/rag',
      ko: '/ko/docs/rag',
      ja: '/ja/docs/rag',
      'x-default': '/docs/rag',
    },
  },
  openGraph: {
    title: '知识库 RAG — 智汇 AI',
    description: '从文档上传到引用溯源,完整覆盖 RAG 全链路。',
    url: `${SITE_URL}/docs/rag`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI RAG' }],
  },
}

export default function RagDocsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ragJsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>📚</span>
          知识库 RAG
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          知识库 RAG 完整指南
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          从文档上传到引用溯源,完整覆盖 RAG 全链路。
          支持向量 + BM25 + 知识图谱三路混合检索,中文友好分词,多语言全覆盖。
        </p>
      </header>

      {/* 什么是 RAG */}
      <section id="what-is-rag" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">什么是 RAG?</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong>RAG(Retrieval-Augmented Generation,检索增强生成)</strong>是大模型与外部知识结合的核心技术:
            用户提问 → 先从知识库检索相关片段 → 把片段塞入 Prompt → LLM 基于片段生成答案。
          </p>
          <p className="text-sm text-muted-foreground">解决三大痛点:</p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li><strong>知识过时</strong>:LLM 训练数据截止到某时间,RAG 可挂载最新文档</li>
            <li><strong>领域不专</strong>:LLM 不懂企业内部文档,RAG 让它"临时抱佛脚"</li>
            <li><strong>幻觉</strong>:LLM 会编造事实,RAG 给出引用来源,可溯源可核验</li>
          </ul>
        </div>
      </section>

      {/* 完整流程 */}
      <section id="pipeline" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">智汇 AI RAG 全流程</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 1.上传   │ → │ 2.解析   │ → │ 3.切块   │ → │ 4.向量化 │ → │ 5.入库   │
│ PDF/Word │   │ OCR/表格 │   │ Chunking │   │ Embedding│   │ PG+pgv  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                                  ↓
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 10.引用  │ ← │ 9.生成   │ ← │ 8.Rerank │ ← │ 7.融合   │ ← │ 6.检索   │
│ 溯源     │   │ LLM 答   │   │ Cross    │   │ RRF      │   │ 向量+BM25│
│ [doc:p3] │   │ +引用    │   │ Encoder  │   │ Recipro  │   │ +知识图谱│
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘`}</code>
          </pre>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
            <li><strong>文档上传</strong>:支持 PDF / Word / Markdown / TXT / HTML / PPT / Excel / EPUB,单文件最大 100MB</li>
            <li><strong>文档解析</strong>:Unstructured 引擎,自动 OCR 扫描件、识别表格结构、保留标题层级</li>
            <li><strong>切块(Chunking)</strong>:滑动窗口策略,默认 chunk_size=512、overlap=64,支持按段落/标题智能切分</li>
            <li><strong>向量化(Embedding)</strong>:默认 bge-m3(中英多语言),可切 OpenAI text-embedding-3-large / Cohere / 本地 bge-large-zh</li>
            <li><strong>入库</strong>:PostgreSQL + pgvector 扩展,HNSW 索引,查询延迟 &lt; 50ms</li>
            <li><strong>检索</strong>:向量检索 + BM25 关键词检索 + 知识图谱实体检索三路并发</li>
            <li><strong>融合(RRF)</strong>:Reciprocal Rank Fusion 算法合并三路结果,兼顾语义与关键词</li>
            <li><strong>Rerank</strong>:Cross-Encoder(bge-reranker-v2-m3)对 Top-20 重排,精选 Top-5</li>
            <li><strong>生成</strong>:LLM 基于检索片段生成答案,带引用编号 [1] [2] [3]</li>
            <li><strong>引用溯源</strong>:每个引用点击跳转到原文位置,可视化高亮</li>
          </ol>
        </div>
      </section>

      {/* 创建知识库 */}
      <section id="create-kb" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">创建第一个知识库</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
            <li>访问 <a href="https://aizhs.top/knowledge-base" className="text-primary underline">知识库页面</a>,点击"新建知识库"</li>
            <li>填写名称、描述,选择嵌入模型(默认 bge-m3)</li>
            <li>上传文档(拖拽或选择,支持批量)</li>
            <li>等待解析 + 向量化(进度条实时显示,通常 1MB 文档约 10 秒)</li>
            <li>测试检索:在"检索测试"输入问题,查看召回片段</li>
            <li>挂载到 Agent:在 Agent 编辑页 → 知识库 → 选择刚创建的库</li>
          </ol>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>{`# 通过 API 创建
curl -X POST https://api.aizhs.top/v1/knowledge-bases \\
  -H "Authorization: Bearer $JWT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "产品手册库",
    "description": "公司全部产品手册 + FAQ",
    "embedding_model": "bge-m3",
    "chunk_strategy": "paragraph",
    "chunk_size": 512,
    "chunk_overlap": 64
  }'

# 上传文档
curl -X POST https://api.aizhs.top/v1/knowledge-bases/$KB_ID/documents \\
  -H "Authorization: Bearer $JWT" \\
  -F "file=@product-manual.pdf" \\
  -F "file=@faq.docx"`}</code>
          </pre>
        </div>
      </section>

      {/* 混合检索 */}
      <section id="hybrid-search" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">三路混合检索(核心优势)</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            纯向量检索对"专有名词 / 代码 / 型号"等关键词不敏感,纯 BM25 对"语义相似但措辞不同"的问题失效。
            智汇 AI 采用三路并发 + RRF 融合,兼顾语义与关键词:
          </p>
          <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">① 向量检索</p>
              <p className="mt-1 text-xs text-muted-foreground">
                bge-m3 编码 query → pgvector HNSW 查询 → 返回 Top-20 语义相似片段
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">② BM25 关键词</p>
              <p className="mt-1 text-xs text-muted-foreground">
                jieba 中文分词 + ts_vector → PostgreSQL 全文检索 → 返回 Top-20 关键词匹配片段
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">③ 知识图谱</p>
              <p className="mt-1 text-xs text-muted-foreground">
                LLM 抽取实体 + 关系 → Neo4j 图查询 → 返回关联实体片段(解决多跳推理)
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <p className="text-sm font-semibold">RRF 融合公式</p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
              <code>{`score(d) = Σ 1 / (k + rank_i(d))    # k=60, rank_i = 文档在第 i 路结果中的排名`}</code>
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              三路结果按 RRF 重新排序 → 取 Top-20 给 Reranker
            </p>
          </div>
        </div>
      </section>

      {/* 支持的文档类型 */}
      <section id="file-types" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">支持的文档类型</h2>
        <div className="space-y-2">
          {[
            ['PDF', '.pdf', '文本 + 扫描件 OCR + 表格 + 书签', '100MB'],
            ['Word', '.docx .doc', '段落 + 标题 + 表格 + 图片', '100MB'],
            ['Markdown', '.md .markdown', '原生解析,保留标题层级', '50MB'],
            ['文本', '.txt .log', 'UTF-8 / GBK 自动识别', '50MB'],
            ['HTML', '.html .htm', '清洗标签,保留正文结构', '50MB'],
            ['PPT', '.pptx .ppt', '按幻灯片切片,保留标题', '100MB'],
            ['Excel', '.xlsx .xls .csv', '按行切块,保留表头', '100MB'],
            ['EPUB', '.epub', '按章节切片', '50MB'],
            ['图片', '.png .jpg .jpeg', 'OCR 文字识别(需开启)', '20MB'],
          ].map(([fmt, ext, desc, size], i) => (
            <div
              key={fmt}
              className={`grid grid-cols-2 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-4 ${i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}`}
            >
              <div className="font-medium">{fmt}</div>
              <div className="text-muted-foreground">{ext}</div>
              <div className="text-xs text-muted-foreground min-[768px]:col-span-2">{desc}</div>
              <div className="col-span-2 text-xs text-muted-foreground min-[768px]:col-span-1">{size}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Embedding 模型 */}
      <section id="embedding-models" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">支持的 Embedding 模型</h2>
        <div className="space-y-2">
          {[
            ['bge-m3', '智源(BAAI)', '1024', '中英多语言', '默认,中文友好'],
            ['bge-large-zh-v1.5', '智源', '1024', '中文', '纯中文场景更优'],
            ['text-embedding-3-large', 'OpenAI', '3072', '多语言', '效果最佳,按量计费'],
            ['text-embedding-3-small', 'OpenAI', '1536', '多语言', '性价比高'],
            ['embed-multilingual-v3', 'Cohere', '1024', '100+ 语言', '小语种友好'],
            ['voyage-2', 'Voyage AI', '1024', '多语言', '检索优化'],
            ['m3e-base', '开源', '768', '中文', '本地部署可选'],
          ].map(([model, vendor, dim, lang, note], i) => (
            <div
              key={model}
              className={`grid grid-cols-2 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-5 ${i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}`}
            >
              <div className="font-medium">{model}</div>
              <div className="text-muted-foreground">{vendor}</div>
              <div className="text-muted-foreground">{dim}</div>
              <div className="text-muted-foreground">{lang}</div>
              <div className="col-span-2 text-xs text-muted-foreground min-[768px]:col-span-1">{note}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          💡 <strong>选型建议</strong>:中文为主选 bge-m3(默认);中英混合选 text-embedding-3-large;成本敏感选 bge-large-zh-v1.5;
          本地部署选 m3e-base + Ollama。
        </div>
      </section>

      {/* 引用溯源 */}
      <section id="citation" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">引用溯源(防幻觉关键)</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            智汇 AI 的每个 RAG 回答都附引用编号 [1] [2] [3],点击跳转到原文位置并高亮:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>{`用户问:产品 X 的保修期是多久?

LLM 答:产品 X 的标准保修期为 24 个月 [1],若购买延保服务可延长至 36 个月 [2]。
        保修范围涵盖主机和原装附件 [1],不含人为损坏 [3]。

引用:
[1] product-x-manual.pdf 第 12 页 §保修条款
[2] extended-warranty.docx 第 2 页
[3] faq.docx 第 8 行`}</code>
          </pre>
          <p className="text-sm text-muted-foreground">
            <strong>反幻觉机制</strong>:LLM 被系统提示约束为"只能基于检索片段回答,无关内容回答'文档中未提及'",
            若检索片段为空或相关性低,会直接告知"未在知识库中找到答案"而非编造。
          </p>
        </div>
      </section>

      {/* 最佳实践 */}
      <section id="best-practices" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">最佳实践</h2>
        <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">📏 切块策略</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>说明文档:按段落切(chunk_size=512)</li>
              <li>FAQ:按问答对切(每对独立 chunk)</li>
              <li>代码:按函数/类切(保留完整逻辑)</li>
              <li>表格:整表一个 chunk(保留结构)</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">🎯 文档质量</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>避免扫描件(OCR 易出错,优先用原生 PDF)</li>
              <li>删除页眉页脚(避免污染检索)</li>
              <li>保留标题层级(帮助切块)</li>
              <li>每篇文档聚焦一个主题</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">🔄 定期更新</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>开启 Webhook:文档库变更自动重新向量化</li>
              <li>每月跑一次"知识库体检"(检测失效链接)</li>
              <li>版本化:旧版文档保留 90 天后归档</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">💰 成本控制</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>用 bge-m3(免费)而非 OpenAI embedding</li>
              <li>chunk_overlap 不要超过 25%(浪费存储)</li>
              <li>大文档先去重再上传(节省向量化费用)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 下一步 */}
      <section className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <h2 className="text-lg font-semibold">下一步</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
          <a href="/docs/agent" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🤖 Agent 开发 →<br />
            <span className="text-xs text-muted-foreground">把知识库挂载到 Agent</span>
          </a>
          <a href="/docs/models" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🧠 多模型调度 →<br />
            <span className="text-xs text-muted-foreground">选合适的 LLM 配 RAG</span>
          </a>
          <a href="/docs/api" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🛠️ API 参考 →<br />
            <span className="text-xs text-muted-foreground">通过 API 操作知识库</span>
          </a>
        </div>
      </section>
    </main>
  )
}

import type { Metadata } from 'next'
import { ManualNav, chapters } from '../_manual-nav'

const SITE_URL = 'https://aizhs.top'

export const metadata: Metadata = {
  title: '第 4 章 知识库 — 智汇 AI 使用说明手册',
  description:
    '智汇 AI 使用说明手册第 4 章:新建知识库、上传文档、查看处理状态、检索测试、挂载到 Agent、删除编辑操作。',
  alternates: {
    canonical: '/docs/manual/knowledge-base',
    languages: {
      'zh-CN': '/zh-cn/docs/manual/knowledge-base',
      'zh-TW': '/zh-tw/docs/manual/knowledge-base',
      en: '/en/docs/manual/knowledge-base',
      ko: '/ko/docs/manual/knowledge-base',
      ja: '/ja/docs/manual/knowledge-base',
      'x-default': '/docs/manual/knowledge-base',
    },
  },
  openGraph: {
    title: '第 4 章 知识库 — 智汇 AI',
    description: '上传文档、检索测试、挂载到 Agent,让 AI 懂你的业务。',
    url: `${SITE_URL}/docs/manual/knowledge-base`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI 知识库' }],
  },
}

export default function ManualKnowledgeBasePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <header className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground">第 04 章 · 使用说明手册</div>
        <h1 className="text-2xl min-[768px]:text-3xl font-bold tracking-tight">知识库</h1>
        <p className="text-sm text-muted-foreground min-[768px]:text-base">
          把你的文档(PDF / Word / Excel / 网页 等)上传到知识库,Agent 对话时自动检索相关片段,
          回答带引用来源,告别 AI 幻觉。
        </p>
      </header>

      {/* 什么是知识库 */}
      <section id="what-is-kb" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">4.1 什么是知识库?</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>知识库 = 你上传的文档 + AI 检索系统</strong>。Agent 对话时,先从知识库找相关内容,
            再基于找到的内容回答,每个回答都附引用编号 [1] [2] [3]。
          </p>
          <p>适用场景:</p>
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>📚 产品手册 + FAQ → 智能客服 Agent</li>
            <li>📄 公司制度 + 流程 → HR 助手 Agent</li>
            <li>🎓 课件 + 教材 → 课程答疑 Agent</li>
            <li>📑 合同模板 + 法规 → 法务 Agent</li>
            <li>🔬 论文 + 实验数据 → 研究助手 Agent</li>
          </ul>
        </div>
      </section>

      {/* 新建知识库 */}
      <section id="create-kb" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">4.2 新建知识库</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>左侧栏点击"知识库" → 右上角"+ 新建知识库"</li>
            <li>填写信息:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li><strong>名称</strong>:例如"产品手册库"</li>
                <li><strong>描述</strong>:可选,方便管理</li>
                <li><strong>嵌入模型</strong>:默认 bge-m3(中文友好,免费),也可选 OpenAI text-embedding-3-large(更准但收费)</li>
                <li><strong>切块策略</strong>:段落 / 标题 / 问答对(默认段落)</li>
              </ul>
            </li>
            <li>点击"创建",跳转到知识库详情页</li>
          </ol>
        </div>
      </section>

      {/* 上传文档 */}
      <section id="upload-docs" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">4.3 上传文档</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>知识库详情页点击"上传文档"或拖拽文件到上传区</li>
            <li>选择文件(可批量),支持:PDF / Word / Excel / PPT / TXT / Markdown / HTML / EPUB / 图片(OCR)</li>
            <li>点击"开始上传",系统自动:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li>📄 <strong>解析</strong>:提取文字、表格、图片(扫描件自动 OCR)</li>
                <li>✂️ <strong>切块</strong>:按段落切成 500 字左右的片段</li>
                <li>🔢 <strong>向量化</strong>:把片段转成 1024 维向量</li>
                <li>💾 <strong>入库</strong>:存到 PostgreSQL + pgvector</li>
              </ul>
            </li>
            <li>处理进度实时显示,1MB 文档约 10 秒</li>
            <li>状态变为"✅ 已就绪"后即可使用</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            ⚠️ <strong>大小限制</strong>:单文件 100MB,单个知识库总容量 1GB(免费)/ 10GB(Pro)/ 100GB(团队)。
          </p>
        </div>
      </section>

      {/* 检索测试 */}
      <section id="test-search" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">4.4 检索测试(验证效果)</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>知识库详情页 → "检索测试"标签</li>
            <li>输入测试问题,例如:<code className="rounded bg-muted px-1 text-xs">产品 X 的保修期是多久?</code></li>
            <li>点击"测试检索",系统返回 Top-5 相关片段</li>
            <li>查看片段是否准确,若不准可调整:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li>切块策略(段落 → 问答对)</li>
                <li>嵌入模型(bge-m3 → OpenAI text-embedding-3-large)</li>
                <li>文档质量(删除扫描件 / 拆分大文档)</li>
              </ul>
            </li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            💡 <strong>验证标准</strong>:Top-5 中包含正确答案片段 ≥ 90% 即可挂载到 Agent。
          </p>
        </div>
      </section>

      {/* 挂载到 Agent */}
      <section id="attach-agent" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">4.5 挂载到 Agent</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>左侧栏"我的 Agent" → 编辑目标 Agent</li>
            <li>左侧"知识库"区域 → "+ 添加知识库"</li>
            <li>选择刚创建的知识库(可挂多个)</li>
            <li>设置检索参数:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li><strong>Top-K</strong>:检索片段数(默认 5,范围 1-20)</li>
                <li><strong>相似度阈值</strong>:0-1,低于阈值的片段丢弃(默认 0.5)</li>
                <li><strong>Rerank</strong>:开启后用 Cross-Encoder 重排,质量更高(消耗积分)</li>
              </ul>
            </li>
            <li>保存,Agent 对话时自动检索知识库</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            💡 <strong>验证 Agent 已挂载</strong>:对话时提问知识库内容,回答应附引用 [1] [2],点击引用可跳转原文。
          </p>
        </div>
      </section>

      {/* 管理文档 */}
      <section id="manage-docs" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">4.6 管理文档</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>查看</strong>:知识库详情页 → 文档列表</li>
            <li><strong>重新处理</strong>:文档右键 → 重新解析(更新文档内容后)</li>
            <li><strong>删除</strong>:文档右键 → 删除(从知识库移除,原文件不动)</li>
            <li><strong>下载</strong>:文档右键 → 下载原文件</li>
            <li><strong>查看切片</strong>:文档右键 → 查看切片(检查切块效果)</li>
            <li><strong>批量操作</strong>:勾选多个文档 → 批量删除 / 重新处理</li>
          </ul>
        </div>
      </section>

      <ManualNav prev={chapters['03']} next={chapters['05']} />
    </main>
  )
}
